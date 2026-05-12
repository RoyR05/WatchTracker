import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const ALLOWED_ORIGIN = Deno.env.get('SITE_URL') ?? '*';
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLEX_CLIENT_ID = "watchtracker-plex-proxy";
const CACHE_TTL_MS = 10 * 60 * 1000;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeArticles(s: string): string {
  return s.replace(/^(the|a|an)\s+/, "");
}

function titleWords(title: string): string[] {
  return removeArticles(normalize(title)).split(" ").filter(Boolean);
}

function titleSimilarity(searchTitle: string, resultTitle: string): number {
  const normSearch = removeArticles(normalize(searchTitle));
  const normResult = removeArticles(normalize(resultTitle));

  if (normSearch === normResult) return 1.0;

  const searchWords = normSearch.split(" ").filter(Boolean);
  const resultWords = normResult.split(" ").filter(Boolean);
  if (searchWords.length === 0 || resultWords.length === 0) return 0;

  const searchSet = new Set(searchWords);
  const resultSet = new Set(resultWords);
  let matchCount = 0;
  for (const w of searchSet) {
    if (resultSet.has(w)) matchCount++;
  }

  const precision = matchCount / searchSet.size;
  const recall = matchCount / resultSet.size;
  if (precision === 0 && recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

interface ServerInfo {
  uri: string;
  name: string;
  accessToken: string;
}

interface PlexConnection {
  uri: string;
  local: boolean;
  relay: boolean;
  protocol: string;
}

interface PlexResource {
  name: string;
  provides: string;
  accessToken: string;
  connections: PlexConnection[];
}

function pickBestConnection(connections: PlexConnection[]): string | null {
  const remoteHttps = connections.find((c) => !c.local && !c.relay && c.protocol === "https");
  const relay = connections.find((c) => c.relay);
  const remoteHttp = connections.find((c) => !c.local && !c.relay);
  const local = connections.find((c) => c.local);
  const best = remoteHttps || relay || remoteHttp || local;
  return best?.uri || null;
}

async function discoverServers(plexToken: string): Promise<ServerInfo[]> {
  const res = await fetch(
    "https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1",
    {
      headers: {
        Accept: "application/json",
        "X-Plex-Token": plexToken,
        "X-Plex-Client-Identifier": PLEX_CLIENT_ID,
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!res.ok) {
    throw new Error(`Plex.tv returned ${res.status}`);
  }

  const resources: PlexResource[] = await res.json();
  const servers = resources.filter((r) => r.provides.includes("server"));

  const results: ServerInfo[] = [];
  for (const server of servers) {
    const uri = pickBestConnection(server.connections || []);
    if (uri) results.push({ uri, name: server.name, accessToken: server.accessToken || plexToken });
  }

  if (results.length === 0) {
    throw new Error("No reachable Plex servers found");
  }
  return results;
}

async function getCachedServers(
  plexToken: string,
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown> | null
): Promise<ServerInfo[]> {
  if (config?.discovered_servers && config?.discovered_at) {
    const cachedAt = new Date(config.discovered_at as string).getTime();
    if (Date.now() - cachedAt < CACHE_TTL_MS) {
      return config.discovered_servers as ServerInfo[];
    }
  }

  const servers = await discoverServers(plexToken);

  // Cache in background
  supabase
    .from("plex_server_config")
    .upsert({ id: 1, discovered_servers: servers, discovered_at: new Date().toISOString() })
    .then(() => {});

  return servers;
}

async function plexFetch(
  serverUri: string,
  path: string,
  plexToken: string,
  timeoutMs = 5000
): Promise<unknown | null> {
  try {
    const separator = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `${serverUri}${path}${separator}X-Plex-Token=${plexToken}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function findBestMatch(
  items: Array<Record<string, unknown>>,
  searchTitle: string,
  year: string | null,
  mediaType: string | null,
  serverName: string
): { title: string; year: number | null; quality: string | null; server: string; score: number } | null {
  let best: { title: string; year: number | null; quality: string | null; server: string; score: number } | null = null;

  for (const item of items) {
    const itemTitle = (item.title as string) || "";
    const itemYear = item.year ? String(item.year) : null;
    const itemType = item.type as string;

    if (mediaType === "tv" && itemType && itemType !== "show" && itemType !== "season" && itemType !== "episode") continue;
    if (mediaType === "movie" && itemType && itemType !== "movie") continue;

    const score = titleSimilarity(searchTitle, itemTitle);
    if (score < 0.6) continue;

    const yearMatch = !year || !itemYear || itemYear === year;
    if (!yearMatch && score < 0.95) continue;

    if (!best || score > best.score) {
      let quality: string | null = null;
      const media = (item.Media as Array<{ videoResolution?: string }>) || [];
      if (media.length > 0 && media[0].videoResolution) {
        const h = parseInt(media[0].videoResolution);
        if (!isNaN(h)) {
          quality = h >= 2160 ? "4K" : h >= 1080 ? "1080p" : h >= 720 ? "720p" : `${h}p`;
        } else {
          quality = media[0].videoResolution;
        }
      }
      best = { title: itemTitle, year: item.year as number | null, quality, server: serverName, score };
    }
  }
  return best;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const plexToken = Deno.env.get("PLEX_TOKEN");
    if (!plexToken) {
      return jsonResponse({ error: "PLEX_TOKEN not configured." }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) {
      return jsonResponse({ error: "Missing action parameter" }, 400);
    }

    const { data: config } = await supabase
      .from("plex_server_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (action === "test") {
      try {
        const servers = await getCachedServers(plexToken, supabase, config);
        return jsonResponse({
          success: true,
          serverName: servers.map((s) => s.name).join(", "),
          serverCount: servers.length,
          connectionMethod: "cloud",
        });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message });
      }
    }

    if (action === "discover") {
      try {
        const servers = await discoverServers(plexToken);
        return jsonResponse({ success: true, servers: servers.map((s) => ({ name: s.name, uri: s.uri })) });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message });
      }
    }

    if (action === "sections") {
      let servers: ServerInfo[];
      try {
        servers = await getCachedServers(plexToken, supabase, config);
      } catch (err) {
        return jsonResponse({ error: err.message }, 400);
      }

      const allSections: { id: string; title: string; type: string }[] = [];
      await Promise.allSettled(
        servers.map(async (server) => {
          const data = await plexFetch(server.uri, "/library/sections", server.accessToken) as { MediaContainer?: { Directory?: Array<{ key: string; title: string; type: string }> } } | null;
          if (!data) return;
          const dirs = data?.MediaContainer?.Directory || [];
          for (const s of dirs) {
            allSections.push({
              id: `${server.name}::${s.key}`,
              title: `${s.title} (${server.name})`,
              type: s.type,
            });
          }
        })
      );

      return jsonResponse({ sections: allSections });
    }

    if (action === "search") {
      const title = url.searchParams.get("title");
      const year = url.searchParams.get("year");
      const mediaType = url.searchParams.get("media_type");

      if (!title) {
        return jsonResponse({ error: "Missing title parameter" }, 400);
      }

      let servers: ServerInfo[];
      try {
        servers = await getCachedServers(plexToken, supabase, config);
      } catch (err) {
        return jsonResponse({ available: false, serversSearched: 0, error: err.message }, 200);
      }

      // Search all servers in parallel using /hubs/search (the correct Plex search endpoint)
      const results = await Promise.allSettled(
        servers.map(async (server) => {
          const path = `/hubs/search?query=${encodeURIComponent(title)}&includeCollections=0&includeExternalMedia=0`;
          const data = await plexFetch(server.uri, path, server.accessToken, 8000) as { MediaContainer?: { Hub?: Array<{ type: string; Metadata?: Array<Record<string, unknown>> }> } } | null;
          if (!data) return null;

          // Extract items from all hubs
          const hubs = data?.MediaContainer?.Hub || [];
          const allItems: Array<Record<string, unknown>> = [];
          for (const hub of hubs) {
            if (hub.Metadata) {
              allItems.push(...hub.Metadata);
            }
          }
          return findBestMatch(allItems, title, year, mediaType, server.name);
        })
      );

      // Find best across all servers
      let overallBest: { title: string; year: number | null; quality: string | null; server: string; score: number } | null = null;
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          if (!overallBest || r.value.score > overallBest.score) {
            overallBest = r.value;
          }
        }
      }

      if (overallBest) {
        return jsonResponse({
          available: true,
          match: { title: overallBest.title, year: overallBest.year, quality: overallBest.quality, server: overallBest.server },
          serversSearched: servers.length,
        });
      }

      // If global search failed, try section-specific search as fallback
      // Only do this if we have cached section info (don't detect on the fly)
      const cachedSections = mediaType === "tv" ? config?.auto_tv_section_id : config?.auto_movie_section_id;
      if (cachedSections) {
        try {
          const sections = JSON.parse(cachedSections as string) as { server: string; id: string }[];
          const sectionResults = await Promise.allSettled(
            sections.map(async (sec) => {
              const server = servers.find((s) => s.name === sec.server);
              if (!server) return null;
              const path = `/library/sections/${sec.id}/all?title=${encodeURIComponent(title)}`;
              const data = await plexFetch(server.uri, path, server.accessToken) as { MediaContainer?: { Metadata?: Array<Record<string, unknown>> } } | null;
              if (!data) return null;
              const items = data?.MediaContainer?.Metadata || [];
              return findBestMatch(items, title, year, mediaType, server.name);
            })
          );

          for (const r of sectionResults) {
            if (r.status === "fulfilled" && r.value) {
              if (!overallBest || r.value.score > overallBest.score) {
                overallBest = r.value;
              }
            }
          }

          if (overallBest) {
            return jsonResponse({
              available: true,
              match: { title: overallBest.title, year: overallBest.year, quality: overallBest.quality, server: overallBest.server },
              serversSearched: servers.length,
            });
          }
        } catch { /* ignore parse errors */ }
      }

      return jsonResponse({ available: false, match: null, serversSearched: servers.length });
    }

    // --- DETECT-SECTIONS (separate action, run manually from admin) ---
    if (action === "detect-sections") {
      let servers: ServerInfo[];
      try {
        servers = await getCachedServers(plexToken, supabase, config);
      } catch (err) {
        return jsonResponse({ error: err.message }, 400);
      }

      const movieSections: { server: string; id: string }[] = [];
      const tvSections: { server: string; id: string }[] = [];

      await Promise.allSettled(
        servers.map(async (server) => {
          const data = await plexFetch(server.uri, "/library/sections", server.accessToken) as { MediaContainer?: { Directory?: Array<{ key: string; type: string }> } } | null;
          if (!data) return;
          const dirs = data?.MediaContainer?.Directory || [];
          for (const d of dirs) {
            if (d.type === "movie") movieSections.push({ server: server.name, id: String(d.key) });
            if (d.type === "show") tvSections.push({ server: server.name, id: String(d.key) });
          }
        })
      );

      await supabase
        .from("plex_server_config")
        .update({
          auto_movie_section_id: movieSections.length > 0 ? JSON.stringify(movieSections) : null,
          auto_tv_section_id: tvSections.length > 0 ? JSON.stringify(tvSections) : null,
        })
        .eq("id", 1);

      return jsonResponse({ movieSections, tvSections });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("Plex proxy error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
