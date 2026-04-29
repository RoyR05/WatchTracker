import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLEX_CLIENT_ID = "watchtracker-plex-proxy";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Title matching utilities ---

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
  const searchWords = titleWords(searchTitle);
  const resultWords = titleWords(resultTitle);

  if (searchWords.length === 0 || resultWords.length === 0) return 0;

  // Exact normalized match
  if (removeArticles(normalize(searchTitle)) === removeArticles(normalize(resultTitle))) {
    return 1.0;
  }

  // Word overlap
  const searchSet = new Set(searchWords);
  const resultSet = new Set(resultWords);
  let matchCount = 0;
  for (const w of searchSet) {
    if (resultSet.has(w)) matchCount++;
  }

  const precision = matchCount / searchSet.size;
  const recall = matchCount / resultSet.size;

  if (precision === 0 && recall === 0) return 0;
  // F1 score
  return (2 * precision * recall) / (precision + recall);
}

// --- Plex API helpers ---

interface ServerInfo {
  uri: string;
  name: string;
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
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) {
    throw new Error(`Plex.tv returned ${res.status} - verify PLEX_TOKEN is valid`);
  }

  const resources: PlexResource[] = await res.json();
  const servers = resources.filter((r) => r.provides.includes("server"));

  const results: ServerInfo[] = [];
  for (const server of servers) {
    const uri = pickBestConnection(server.connections || []);
    if (uri) results.push({ uri, name: server.name });
  }

  if (results.length === 0) {
    throw new Error("No reachable Plex servers found on this account");
  }
  return results;
}

async function getServers(
  plexToken: string,
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown> | null
): Promise<ServerInfo[]> {
  // Check cache
  if (config?.discovered_servers && config?.discovered_at) {
    const cachedAt = new Date(config.discovered_at as string).getTime();
    if (Date.now() - cachedAt < CACHE_TTL_MS) {
      return config.discovered_servers as ServerInfo[];
    }
  }

  // Fresh discovery
  const servers = await discoverServers(plexToken);

  // Update cache (fire and forget)
  supabase
    .from("plex_server_config")
    .upsert({
      id: 1,
      discovered_servers: servers,
      discovered_at: new Date().toISOString(),
    })
    .then(() => {});

  return servers;
}

async function plexFetch(
  serverUri: string,
  path: string,
  plexToken: string,
  timeoutMs = 6000
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

async function autoDetectSections(
  servers: ServerInfo[],
  plexToken: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ movieSections: { server: string; id: string }[]; tvSections: { server: string; id: string }[] }> {
  const movieSections: { server: string; id: string }[] = [];
  const tvSections: { server: string; id: string }[] = [];

  const sectionPromises = servers.map(async (server) => {
    const data = await plexFetch(server.uri, "/library/sections", plexToken) as { MediaContainer?: { Directory?: Array<{ key: string; type: string }> } } | null;
    if (!data) return;
    const dirs = data?.MediaContainer?.Directory || [];
    for (const d of dirs) {
      if (d.type === "movie") movieSections.push({ server: server.name, id: String(d.key) });
      if (d.type === "show") tvSections.push({ server: server.name, id: String(d.key) });
    }
  });

  await Promise.allSettled(sectionPromises);

  // Cache the first detected sections
  if (movieSections.length > 0 || tvSections.length > 0) {
    supabase
      .from("plex_server_config")
      .update({
        auto_movie_section_id: movieSections.length > 0 ? JSON.stringify(movieSections) : null,
        auto_tv_section_id: tvSections.length > 0 ? JSON.stringify(tvSections) : null,
      })
      .eq("id", 1)
      .then(() => {});
  }

  return { movieSections, tvSections };
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const plexToken = Deno.env.get("PLEX_TOKEN");
    if (!plexToken) {
      return jsonResponse(
        { error: "PLEX_TOKEN not configured." },
        500
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const debug = url.searchParams.get("debug") === "1";

    if (!action) {
      return jsonResponse({ error: "Missing action parameter" }, 400);
    }

    const { data: config } = await supabase
      .from("plex_server_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    // --- TEST ---
    if (action === "test") {
      try {
        const servers = await getServers(plexToken, supabase, config);
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

    // --- DISCOVER ---
    if (action === "discover") {
      try {
        const servers = await discoverServers(plexToken);
        return jsonResponse({
          success: true,
          servers: servers.map((s) => ({ name: s.name, uri: s.uri })),
        });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message });
      }
    }

    // --- SECTIONS ---
    if (action === "sections") {
      let servers: ServerInfo[];
      try {
        servers = await getServers(plexToken, supabase, config);
      } catch (err) {
        return jsonResponse({ error: err.message }, 400);
      }

      const allSections: { id: string; title: string; type: string }[] = [];

      const results = await Promise.allSettled(
        servers.map(async (server) => {
          const data = await plexFetch(server.uri, "/library/sections", plexToken) as { MediaContainer?: { Directory?: Array<{ key: string; title: string; type: string }> } } | null;
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

    // --- SEARCH ---
    if (action === "search") {
      const title = url.searchParams.get("title");
      const year = url.searchParams.get("year");
      const mediaType = url.searchParams.get("media_type");

      if (!title) {
        return jsonResponse({ error: "Missing title parameter" }, 400);
      }

      let servers: ServerInfo[];
      try {
        servers = await getServers(plexToken, supabase, config);
      } catch (err) {
        return jsonResponse({ available: false, error: err.message }, 200);
      }

      // Determine which sections to search
      const configuredSection =
        mediaType === "tv" ? config?.library_tv_section_id : config?.library_movie_section_id;

      let sectionsToSearch: { serverUri: string; serverName: string; sectionId: string }[] = [];

      if (configuredSection) {
        // Manually configured
        if (configuredSection.includes("::")) {
          const [sName, sId] = configuredSection.split("::");
          const server = servers.find((s) => s.name === sName);
          if (server) sectionsToSearch.push({ serverUri: server.uri, serverName: server.name, sectionId: sId });
        } else {
          for (const s of servers) {
            sectionsToSearch.push({ serverUri: s.uri, serverName: s.name, sectionId: configuredSection });
          }
        }
      } else {
        // Try auto-detected sections from cache
        const cachedSections = mediaType === "tv" ? config?.auto_tv_section_id : config?.auto_movie_section_id;
        if (cachedSections) {
          try {
            const parsed = JSON.parse(cachedSections as string) as { server: string; id: string }[];
            for (const ps of parsed) {
              const server = servers.find((s) => s.name === ps.server);
              if (server) sectionsToSearch.push({ serverUri: server.uri, serverName: server.name, sectionId: ps.id });
            }
          } catch { /* fall through to auto-detect */ }
        }

        // If no cached sections, auto-detect now
        if (sectionsToSearch.length === 0) {
          const detected = await autoDetectSections(servers, plexToken, supabase);
          const relevantSections = mediaType === "tv" ? detected.tvSections : detected.movieSections;
          for (const ds of relevantSections) {
            const server = servers.find((s) => s.name === ds.server);
            if (server) sectionsToSearch.push({ serverUri: server.uri, serverName: server.name, sectionId: ds.id });
          }
        }
      }

      const debugInfo: string[] = [];

      // If we have sections, search them in parallel
      if (sectionsToSearch.length > 0) {
        const searchResults = await Promise.allSettled(
          sectionsToSearch.map(async (section) => {
            const path = `/library/sections/${section.sectionId}/all?title=${encodeURIComponent(title)}`;
            const data = await plexFetch(section.serverUri, path, plexToken) as { MediaContainer?: { Metadata?: Array<Record<string, unknown>> } } | null;
            if (!data) return null;
            const items = data?.MediaContainer?.Metadata || [];
            if (debug) debugInfo.push(`${section.serverName} section ${section.sectionId}: ${items.length} results`);
            return { items, serverName: section.serverName };
          })
        );

        // Check all results for best match
        let bestMatch: { title: string; year: number | null; quality: string | null; server: string; score: number } | null = null;

        for (const result of searchResults) {
          if (result.status !== "fulfilled" || !result.value) continue;
          const { items, serverName } = result.value;

          for (const item of items) {
            const itemTitle = item.title as string || "";
            const itemYear = item.year ? String(item.year) : null;

            const score = titleSimilarity(title, itemTitle);
            if (debug) debugInfo.push(`  "${itemTitle}" (${itemYear}) score=${score.toFixed(2)}`);

            if (score < 0.6) continue;

            const yearMatch = !year || !itemYear || itemYear === year;
            if (!yearMatch && score < 0.95) continue;

            if (!bestMatch || score > bestMatch.score) {
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
              bestMatch = { title: itemTitle, year: item.year as number | null, quality, server: serverName, score };
            }
          }
        }

        if (bestMatch) {
          const response: Record<string, unknown> = {
            available: true,
            match: { title: bestMatch.title, year: bestMatch.year, quality: bestMatch.quality, server: bestMatch.server },
          };
          if (debug) response.debug = debugInfo;
          return jsonResponse(response);
        }
      }

      // Fallback: global search across all servers in parallel
      const globalResults = await Promise.allSettled(
        servers.map(async (server) => {
          const path = `/search?query=${encodeURIComponent(title)}`;
          const data = await plexFetch(server.uri, path, plexToken) as { MediaContainer?: { Metadata?: Array<Record<string, unknown>> } } | null;
          if (!data) return null;
          const items = data?.MediaContainer?.Metadata || [];
          if (debug) debugInfo.push(`Global search ${server.name}: ${items.length} results`);
          return { items, serverName: server.name };
        })
      );

      let bestMatch: { title: string; year: number | null; quality: string | null; server: string; score: number } | null = null;

      for (const result of globalResults) {
        if (result.status !== "fulfilled" || !result.value) continue;
        const { items, serverName } = result.value;

        for (const item of items) {
          const itemTitle = item.title as string || "";
          const itemYear = item.year ? String(item.year) : null;
          const itemType = item.type as string;

          if (mediaType === "tv" && itemType !== "show") continue;
          if (mediaType === "movie" && itemType !== "movie") continue;

          const score = titleSimilarity(title, itemTitle);
          if (debug) debugInfo.push(`  "${itemTitle}" (${itemYear}) type=${itemType} score=${score.toFixed(2)}`);

          if (score < 0.6) continue;

          const yearMatch = !year || !itemYear || itemYear === year;
          if (!yearMatch && score < 0.95) continue;

          if (!bestMatch || score > bestMatch.score) {
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
            bestMatch = { title: itemTitle, year: item.year as number | null, quality, server: serverName, score };
          }
        }
      }

      const response: Record<string, unknown> = {
        available: !!bestMatch,
        match: bestMatch ? { title: bestMatch.title, year: bestMatch.year, quality: bestMatch.quality, server: bestMatch.server } : null,
        serversSearched: servers.length,
      };
      if (debug) response.debug = debugInfo;
      return jsonResponse(response);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("Plex proxy error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
