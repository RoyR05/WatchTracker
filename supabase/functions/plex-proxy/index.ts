import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPlexConfig(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("plex_server_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error("Failed to read Plex config: " + error.message);
  return data;
}

function normalizeTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const plexToken = Deno.env.get("PLEX_TOKEN");
    if (!plexToken) {
      return jsonResponse(
        { error: "PLEX_TOKEN not configured as an edge function secret" },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is authenticated
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action) {
      return jsonResponse({ error: "Missing action parameter" }, 400);
    }

    const config = await getPlexConfig(supabase);

    if (action === "test") {
      const serverUrl =
        url.searchParams.get("server_url") || config?.plex_server_url;
      if (!serverUrl) {
        return jsonResponse({ error: "No Plex server URL configured" }, 400);
      }

      const plexRes = await fetch(`${serverUrl}/?X-Plex-Token=${plexToken}`, {
        headers: { Accept: "application/json" },
      });

      if (!plexRes.ok) {
        return jsonResponse(
          { success: false, error: `Plex returned ${plexRes.status}` },
          200
        );
      }

      const plexData = await plexRes.json();
      return jsonResponse({
        success: true,
        serverName:
          plexData?.MediaContainer?.friendlyName || "Plex Media Server",
      });
    }

    if (action === "sections") {
      if (!config?.plex_server_url) {
        return jsonResponse({ error: "Plex server URL not configured" }, 400);
      }

      const plexRes = await fetch(
        `${config.plex_server_url}/library/sections?X-Plex-Token=${plexToken}`,
        { headers: { Accept: "application/json" } }
      );

      if (!plexRes.ok) {
        return jsonResponse(
          { error: `Plex returned ${plexRes.status}` },
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
      if (!config?.plex_server_url) {
        return jsonResponse({ error: "Plex server URL not configured" }, 400);
      }

      const title = url.searchParams.get("title");
      const year = url.searchParams.get("year");
      const mediaType = url.searchParams.get("media_type");

      if (!title) {
        return jsonResponse({ error: "Missing title parameter" }, 400);
      }

      const sectionId =
        mediaType === "tv"
          ? config.library_tv_section_id
          : config.library_movie_section_id;

      let searchUrl: string;
      if (sectionId) {
        searchUrl = `${config.plex_server_url}/library/sections/${sectionId}/all?X-Plex-Token=${plexToken}&title=${encodeURIComponent(title)}`;
      } else {
        searchUrl = `${config.plex_server_url}/search?X-Plex-Token=${plexToken}&query=${encodeURIComponent(title)}`;
      }

      const plexRes = await fetch(searchUrl, {
        headers: { Accept: "application/json" },
      });

      if (!plexRes.ok) {
        return jsonResponse(
          { available: false, error: `Plex returned ${plexRes.status}` },
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
