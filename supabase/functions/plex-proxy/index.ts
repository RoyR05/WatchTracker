import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PLEX_CLIENT_ID = "watchtracker-plex-proxy";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

interface ServerInfo {
  uri: string;
  name: string;
}

function pickBestConnection(connections: PlexConnection[]): string | null {
  const relay = connections.find((c) => c.relay);
  const remoteHttps = connections.find((c) => !c.local && !c.relay && c.protocol === "https");
  const remoteHttp = connections.find((c) => !c.local && !c.relay);
  const local = connections.find((c) => c.local);
  const best = relay || remoteHttps || remoteHttp || local;
  return best?.uri || null;
}

async function discoverAllServers(plexToken: string): Promise<ServerInfo[]> {
  const res = await fetch(
    "https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1",
    {
      headers: {
        Accept: "application/json",
        "X-Plex-Token": plexToken,
        "X-Plex-Client-Identifier": PLEX_CLIENT_ID,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Plex.tv returned status ${res.status} - check that your PLEX_TOKEN is valid`);
  }

  const resources: PlexResource[] = await res.json();
  const servers = resources.filter((r) => r.provides.includes("server"));

  if (servers.length === 0) {
    throw new Error("No Plex servers found on this account");
  }

  const results: ServerInfo[] = [];
  for (const server of servers) {
    const uri = pickBestConnection(server.connections || []);
    if (uri) {
      results.push({ uri, name: server.name });
    }
  }

  if (results.length === 0) {
    throw new Error("No reachable connections found for any Plex server");
  }

  return results;
}

async function fetchFromServer(
  serverUri: string,
  path: string,
  plexToken: string
): Promise<Response | null> {
  try {
    const res = await fetch(
      `${serverUri}${path}${path.includes("?") ? "&" : "?"}X-Plex-Token=${plexToken}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) return res;
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const plexToken = Deno.env.get("PLEX_TOKEN");
    if (!plexToken) {
      return jsonResponse(
        { error: "PLEX_TOKEN not configured. Set it as an edge function secret in the Supabase dashboard." },
        500
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) {
      return jsonResponse({ error: "Missing action parameter" }, 400);
    }

    const { data: config, error: configError } = await supabase
      .from("plex_server_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (configError) {
      console.error("Config read error:", configError);
      return jsonResponse({ error: "Failed to read Plex configuration" }, 500);
    }

    if (action === "test") {
      try {
        const servers = await discoverAllServers(plexToken);
        const names = servers.map((s) => s.name);
        return jsonResponse({
          success: true,
          serverName: names.join(", "),
          serverCount: servers.length,
          connectionMethod: "cloud",
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: err.message || "Could not connect to Plex",
        });
      }
    }

    if (action === "discover") {
      try {
        const servers = await discoverAllServers(plexToken);
        return jsonResponse({
          success: true,
          servers: servers.map((s) => ({ name: s.name, uri: s.uri })),
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: err.message || "Discovery failed",
        });
      }
    }

    if (action === "sections") {
      let servers: ServerInfo[];
      try {
        servers = await discoverAllServers(plexToken);
      } catch (err) {
        return jsonResponse(
          { error: err.message || "Cannot reach Plex servers." },
          400
        );
      }

      const allSections: { id: string; title: string; type: string; server: string }[] = [];

      for (const server of servers) {
        const res = await fetchFromServer(server.uri, "/library/sections", plexToken);
        if (!res) continue;
        const data = await res.json();
        const dirs = data?.MediaContainer?.Directory || [];
        for (const s of dirs) {
          allSections.push({
            id: `${server.name}::${s.key}`,
            title: `${s.title} (${server.name})`,
            type: s.type as string,
          });
        }
      }

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
        servers = await discoverAllServers(plexToken);
      } catch (err) {
        return jsonResponse(
          { available: false, error: err.message || "Cannot reach Plex servers" },
          200
        );
      }

      const normalizedSearchTitle = normalizeTitleForComparison(title);

      // Parse configured section IDs (format: "ServerName::sectionKey" or plain number)
      const configuredSectionId =
        mediaType === "tv"
          ? config?.library_tv_section_id
          : config?.library_movie_section_id;

      // Search across all servers
      for (const server of servers) {
        let searchPath: string;

        if (configuredSectionId) {
          // Check if this section belongs to this server
          if (configuredSectionId.includes("::")) {
            const [sName, sId] = configuredSectionId.split("::");
            if (sName !== server.name) continue;
            searchPath = `/library/sections/${sId}/all?title=${encodeURIComponent(title)}`;
          } else {
            searchPath = `/library/sections/${configuredSectionId}/all?title=${encodeURIComponent(title)}`;
          }
        } else {
          searchPath = `/search?query=${encodeURIComponent(title)}`;
        }

        const res = await fetchFromServer(server.uri, searchPath, plexToken);
        if (!res) continue;

        const plexData = await res.json();
        const results = plexData?.MediaContainer?.Metadata || [];

        for (const item of results) {
          const itemTitle = normalizeTitleForComparison(item.title || "");
          const itemYear = item.year ? String(item.year) : null;
          const itemType = item.type;

          if (mediaType === "tv" && itemType !== "show") continue;
          if (mediaType === "movie" && itemType !== "movie") continue;

          const titleMatch =
            itemTitle === normalizedSearchTitle ||
            itemTitle.includes(normalizedSearchTitle) ||
            normalizedSearchTitle.includes(itemTitle);

          if (!titleMatch) continue;

          const yearMatch = !year || !itemYear || itemYear === year;
          if (titleMatch && yearMatch) {
            let quality = null;
            if (item.Media && item.Media.length > 0) {
              const media = item.Media[0];
              const height = media.videoResolution;
              if (height) {
                quality =
                  parseInt(height) >= 2160
                    ? "4K"
                    : parseInt(height) >= 1080
                      ? "1080p"
                      : parseInt(height) >= 720
                        ? "720p"
                        : `${height}p`;
              }
            }
            return jsonResponse({
              available: true,
              match: { title: item.title, year: item.year, quality, server: server.name },
            });
          }
        }
      }

      return jsonResponse({ available: false, match: null });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("Plex proxy error:", error);
    return jsonResponse(
      { error: error.message || "Internal server error" },
      500
    );
  }
});
