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

async function discoverServerUri(plexToken: string): Promise<{ uri: string; name: string }> {
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

  const server = servers[0];
  const connections = server.connections || [];

  // Prefer: relay > remote https > remote http > local
  const relay = connections.find((c) => c.relay);
  const remoteHttps = connections.find((c) => !c.local && !c.relay && c.protocol === "https");
  const remoteHttp = connections.find((c) => !c.local && !c.relay);
  const local = connections.find((c) => c.local);

  const best = relay || remoteHttps || remoteHttp || local;
  if (!best) {
    throw new Error("No reachable connections found for your Plex server");
  }

  return { uri: best.uri, name: server.name };
}

async function getServerUri(
  plexToken: string,
  config: { plex_server_url?: string | null } | null
): Promise<{ uri: string; name: string; method: string }> {
  // If a manual URL is configured, try it first
  if (config?.plex_server_url) {
    try {
      const testRes = await fetch(
        `${config.plex_server_url}/?X-Plex-Token=${plexToken}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) }
      );
      if (testRes.ok) {
        const data = await testRes.json();
        return {
          uri: config.plex_server_url,
          name: data?.MediaContainer?.friendlyName || "Plex Media Server",
          method: "direct",
        };
      }
    } catch {
      // Direct connection failed, fall through to discovery
    }
  }

  // Auto-discover via plex.tv
  const discovered = await discoverServerUri(plexToken);
  return { ...discovered, method: "cloud" };
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
      const overrideUrl = url.searchParams.get("server_url");
      const testConfig = overrideUrl
        ? { plex_server_url: overrideUrl }
        : config;

      try {
        const server = await getServerUri(plexToken, testConfig);
        return jsonResponse({
          success: true,
          serverName: server.name,
          connectionMethod: server.method,
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: err.message || "Could not connect to Plex server",
        });
      }
    }

    if (action === "discover") {
      try {
        const discovered = await discoverServerUri(plexToken);
        return jsonResponse({
          success: true,
          serverName: discovered.name,
          serverUri: discovered.uri,
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: err.message || "Discovery failed",
        });
      }
    }

    if (action === "sections") {
      let serverUri: string;
      try {
        const server = await getServerUri(plexToken, config);
        serverUri = server.uri;
      } catch (err) {
        return jsonResponse(
          { error: err.message || "Cannot reach Plex server. Check your settings." },
          400
        );
      }

      const plexRes = await fetch(
        `${serverUri}/library/sections?X-Plex-Token=${plexToken}`,
        { headers: { Accept: "application/json" } }
      );

      if (!plexRes.ok) {
        return jsonResponse(
          { error: `Plex returned status ${plexRes.status}` },
          plexRes.status
        );
      }

      const plexData = await plexRes.json();
      const sections = (
        plexData?.MediaContainer?.Directory || []
      ).map((s: Record<string, unknown>) => ({
        id: String(s.key),
        title: s.title,
        type: s.type,
      }));

      return jsonResponse({ sections });
    }

    if (action === "search") {
      let serverUri: string;
      try {
        const server = await getServerUri(plexToken, config);
        serverUri = server.uri;
      } catch (err) {
        return jsonResponse(
          { available: false, error: err.message || "Cannot reach Plex server" },
          200
        );
      }

      const title = url.searchParams.get("title");
      const year = url.searchParams.get("year");
      const mediaType = url.searchParams.get("media_type");

      if (!title) {
        return jsonResponse({ error: "Missing title parameter" }, 400);
      }

      const sectionId =
        mediaType === "tv"
          ? config?.library_tv_section_id
          : config?.library_movie_section_id;

      let searchUrl: string;
      if (sectionId) {
        searchUrl = `${serverUri}/library/sections/${sectionId}/all?X-Plex-Token=${plexToken}&title=${encodeURIComponent(title)}`;
      } else {
        searchUrl = `${serverUri}/search?X-Plex-Token=${plexToken}&query=${encodeURIComponent(title)}`;
      }

      const plexRes = await fetch(searchUrl, {
        headers: { Accept: "application/json" },
      });

      if (!plexRes.ok) {
        return jsonResponse(
          { available: false, error: `Plex returned status ${plexRes.status}` },
          200
        );
      }

      const plexData = await plexRes.json();
      const results = plexData?.MediaContainer?.Metadata || [];
      const normalizedSearchTitle = normalizeTitleForComparison(title);

      let bestMatch = null;
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
          bestMatch = { title: item.title, year: item.year, quality };
          break;
        }
      }

      return jsonResponse({
        available: !!bestMatch,
        match: bestMatch,
      });
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
