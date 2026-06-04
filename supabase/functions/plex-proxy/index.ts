import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const isAllowed = origin === siteUrl || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (siteUrl || 'https://rflixs.rainey.app'),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

const PLEX_CLIENT_ID = "watchtracker-plex-proxy";
const CACHE_TTL_MS = 10 * 60 * 1000;

function makeJsonResponse(cors: Record<string, string>) {
  return (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
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

/** Remove trailing edition info from Plex result titles before matching.
 *  "The Dark Knight (Director's Cut)" → "The Dark Knight"
 *  Does NOT strip year parens — those are handled by the year filter.
 */
function stripEditionInfo(title: string): string {
  return title
    .replace(/\s*\((director'?s cut|extended|unrated|theatrical|special edition|remastered|anniversary edition|collector'?s edition|ultimate edition|bonus features?|bonus disc|bonus content)\)\s*$/i, "")
    .trim();
}

function computeF1(normA: string, normB: string): number {
  const wordsA = normA.split(" ").filter(Boolean);
  const wordsB = normB.split(" ").filter(Boolean);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let matchCount = 0;
  for (const w of setA) {
    if (setB.has(w)) matchCount++;
  }
  const precision = matchCount / setA.size;
  const recall = matchCount / setB.size;
  if (precision === 0 && recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function titleSimilarity(searchTitle: string, resultTitle: string): number {
  const cleanedResult = stripEditionInfo(resultTitle);
  const normSearch = removeArticles(normalize(searchTitle));
  const normResult = removeArticles(normalize(resultTitle));
  const normClean = removeArticles(normalize(cleanedResult));

  if (normSearch === normResult || normSearch === normClean) return 1.0;

  // Try both with and without edition info stripped from the result; take the best
  return Math.max(
    computeF1(normSearch, normResult),
    computeF1(normSearch, normClean),
  );
}

interface ServerInfo {
  uri: string;
  name: string;
  accessToken: string;
  machineIdentifier: string;
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
  clientIdentifier: string;
  presence: boolean;
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
    if (uri) results.push({ uri, name: server.name, accessToken: server.accessToken || plexToken, machineIdentifier: server.clientIdentifier || "" });
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
  server: ServerInfo
): { title: string; year: number | null; quality: string | null; server: string; score: number; ratingKey: string; serverUri: string; serverMachineId: string } | null {
  let best: { title: string; year: number | null; quality: string | null; server: string; score: number; ratingKey: string; serverUri: string; serverMachineId: string } | null = null;

  for (const item of items) {
    const itemTitle = (item.title as string) || "";
    const itemYear = item.year ? String(item.year) : null;
    const itemType = item.type as string;

    if (mediaType === "tv" && itemType && itemType !== "show" && itemType !== "season" && itemType !== "episode") continue;
    if (mediaType === "movie" && itemType && itemType !== "movie") continue;

    const score = titleSimilarity(searchTitle, itemTitle);
    if (score < 0.6) continue;

    // Allow ±1 year — theatrical year (TMDB) can differ from streaming release year (Plex catalog)
    const yearMatch = !year || !itemYear ||
      Math.abs(parseInt(itemYear, 10) - parseInt(year, 10)) <= 1;
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
      const ratingKey = String(item.ratingKey || "");
      best = { title: itemTitle, year: item.year as number | null, quality, server: server.name, score, ratingKey, serverUri: server.uri, serverMachineId: server.machineIdentifier };
    }
  }
  return best;
}

// --- SECTION SEARCH (extracted so it can run in parallel with hub search) ---
// Searches all configured sections across ALL matching servers (not just the first).
// Falls back to scanning every section on every server if configured sections miss.
async function runSectionSearch(
  title: string,
  year: string | null,
  mediaType: string | null,
  servers: ServerInfo[],
  config: Record<string, unknown> | null
): Promise<ReturnType<typeof findBestMatch>> {
  const cachedSections = mediaType === "tv" ? config?.auto_tv_section_id : config?.auto_movie_section_id;

  // Build search tasks: for each configured section entry, search it on EVERY server
  // that matches the stored server name (not just the first — there may be multiple
  // servers with the same name, e.g. two "RRFlix" connections with different URIs).
  const tasks: Array<() => Promise<ReturnType<typeof findBestMatch>>> = [];

  if (cachedSections) {
    try {
      const sections = JSON.parse(cachedSections as string) as { server: string; id: string }[];
      for (const sec of sections) {
        // Find ALL servers with this name, not just the first
        const matchingServers = servers.filter((s) => s.name === sec.server);
        for (const server of matchingServers) {
          const s = server;
          const sId = sec.id;
          tasks.push(async () => {
            const path = `/library/sections/${sId}/all?title=${encodeURIComponent(title)}`;
            const data = await plexFetch(s.uri, path, s.accessToken) as
              { MediaContainer?: { Metadata?: Array<Record<string, unknown>> } } | null;
            if (!data) return null;
            const items = data?.MediaContainer?.Metadata ?? [];
            console.log(`[Section] Server=${s.name} section=${sId} returned ${items.length} items for: ${title}`);
            return findBestMatch(items, title, year, mediaType, s);
          });
        }
      }
    } catch { /* ignore parse error, fall through to full scan */ }
  }

  // If no tasks built (sections not configured or parse failed), scan ALL sections
  // on ALL servers — slightly slower but catches servers not in the config.
  if (tasks.length === 0) {
    for (const server of servers) {
      const s = server;
      tasks.push(async () => {
        const sectionsData = await plexFetch(s.uri, "/library/sections", s.accessToken) as
          { MediaContainer?: { Directory?: Array<{ key: string; type: string }> } } | null;
        if (!sectionsData) return null;
        const dirs = sectionsData?.MediaContainer?.Directory ?? [];
        const sectionType = mediaType === "tv" ? "show" : "movie";
        const matchingSections = dirs.filter((d) => d.type === sectionType);
        let best: ReturnType<typeof findBestMatch> = null;
        for (const sec of matchingSections) {
          const path = `/library/sections/${sec.key}/all?title=${encodeURIComponent(title)}`;
          const data = await plexFetch(s.uri, path, s.accessToken) as
            { MediaContainer?: { Metadata?: Array<Record<string, unknown>> } } | null;
          if (!data) continue;
          const items = data?.MediaContainer?.Metadata ?? [];
          console.log(`[Section fallback] Server=${s.name} section=${sec.key} returned ${items.length} items for: ${title}`);
          const match = findBestMatch(items, title, year, mediaType, s);
          if (match && (!best || match.score > best.score)) best = match;
        }
        return best;
      });
    }
  }

  if (tasks.length === 0) return null;

  try {
    const results = await Promise.allSettled(tasks.map((t) => t()));
    let best: ReturnType<typeof findBestMatch> = null;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        if (!best || r.value.score > best.score) best = r.value;
      }
    }
    return best;
  } catch { return null; }
}

// --- PLEX DISCOVER SEARCH — queries Plex's cloud streaming catalog ---
// Covers content available via Plex's free FAST tier and partner streaming services
// that are never in the local Plex server library.
async function searchPlexDiscover(
  title: string,
  year: string | null,
  mediaType: string | null,
  plexToken: string
): Promise<{ title: string; year: number | null } | null> {
  try {
    // type=1 = movies, type=2 = shows in Plex's discover API
    const typeParam = mediaType === "movie" ? "&type=1" : mediaType === "tv" ? "&type=2" : "";
    const url = `https://discover.provider.plex.tv/library/search?query=${encodeURIComponent(title)}&limit=10${typeParam}&X-Plex-Token=${plexToken}&X-Plex-Client-Identifier=${PLEX_CLIENT_ID}&X-Plex-Platform=Web`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.log("[Discover] HTTP", res.status, "for:", title);
      return null;
    }

    const data = await res.json() as { MediaContainer?: { Metadata?: Array<Record<string, unknown>> } };
    const items = data?.MediaContainer?.Metadata ?? [];
    console.log("[Discover]", items.length, "results for:", title,
      "| keys:", items[0] ? Object.keys(items[0]).slice(0, 8).join(",") : "none");

    for (const item of items) {
      const itemTitle = (item.title as string) ?? "";
      const itemYear = item.year ? String(item.year) : null;
      const itemType = item.type as string;

      if (mediaType === "movie" && itemType && itemType !== "movie") continue;
      if (mediaType === "tv" && itemType && itemType !== "show" && itemType !== "season" && itemType !== "episode") continue;

      const score = titleSimilarity(title, itemTitle);
      if (score < 0.6) continue;

      const yearMatch = !year || !itemYear ||
        Math.abs(parseInt(itemYear, 10) - parseInt(year, 10)) <= 1;
      if (!yearMatch && score < 0.95) continue;

      console.log("[Discover] Match:", itemTitle, itemYear, "score:", score.toFixed(2));
      return { title: itemTitle, year: item.year as number | null };
    }
    return null;
  } catch (err) {
    console.error("[Discover] Error:", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const jsonResponse = makeJsonResponse(corsHeaders);

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

      // Run hub search, section search, and Plex Discover cloud search ALL in parallel.
      // Previously: hub (8s timeout) → THEN section search → THEN nothing.
      // Now: all three start simultaneously; fastest positive result wins.
      //   • Hub search: 4s timeout (was 8s — it consistently times out anyway, so fail fast)
      //   • Section search: typically 0.1–0.5s (direct library lookup, already fast)
      //   • Discover search: 1–3s (Plex cloud API for streaming-only content)
      const [hubBest, sectionBest, discoverMatch] = await Promise.all([
        // 1. Hub search across all servers (shorter timeout to fail fast)
        Promise.allSettled(
          servers.map(async (server) => {
            const path = `/hubs/search?query=${encodeURIComponent(title)}&includeCollections=0&includeExternalMedia=0`;
            const data = await plexFetch(server.uri, path, server.accessToken, 4000) as
              { MediaContainer?: { Hub?: Array<{ Metadata?: Array<Record<string, unknown>> }> } } | null;
            if (!data) return null;
            const allItems: Array<Record<string, unknown>> = [];
            for (const hub of data?.MediaContainer?.Hub ?? []) {
              if (hub.Metadata) allItems.push(...hub.Metadata);
            }
            return findBestMatch(allItems, title, year, mediaType, server);
          })
        ).then((results) => {
          let best: ReturnType<typeof findBestMatch> = null;
          for (const r of results) {
            if (r.status === "fulfilled" && r.value) {
              if (!best || r.value.score > best.score) best = r.value;
            }
          }
          return best;
        }),
        // 2. Section search — runs concurrently, fast if sections are configured
        runSectionSearch(title, year, mediaType, servers, config),
        // 3. Plex Discover — cloud streaming catalog (covers FAST/partner streaming content)
        searchPlexDiscover(title, year, mediaType, plexToken),
      ]);

      // Best local result (hub or section)
      type LocalBest = { title: string; year: number | null; quality: string | null; server: string; score: number; ratingKey: string; serverUri: string; serverMachineId: string };
      const localBest = ([hubBest, sectionBest] as Array<LocalBest | null>)
        .filter((x): x is LocalBest => x !== null)
        .reduce<LocalBest | null>((a, b) => (!a || b.score > a.score) ? b : a, null);

      if (localBest) {
        return jsonResponse({
          available: true,
          match: {
            title: localBest.title,
            year: localBest.year,
            quality: localBest.quality,
            server: localBest.server,
            ratingKey: localBest.ratingKey,
            serverUri: localBest.serverUri,
            serverMachineId: localBest.serverMachineId,
          },
          serversSearched: servers.length,
        });
      }

      // Local not found — check Plex's cloud streaming catalog result
      if (discoverMatch) {
        return jsonResponse({
          available: true,
          match: {
            title: discoverMatch.title,
            year: discoverMatch.year,
            quality: null,            // streaming content has no local resolution info
            server: "Plex Streaming",
            ratingKey: "",
            serverUri: "",
            serverMachineId: "",
          },
          serversSearched: servers.length,
        });
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

    // --- CLIENTS — list all currently-online Plex player devices ---
    if (action === "clients") {
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
        return jsonResponse({ error: `Plex.tv returned ${res.status}` }, 502);
      }
      const resources: PlexResource[] = await res.json();
      const clients = resources
        .filter((r) => r.provides.includes("player") && r.presence)
        .map((r) => ({
          clientIdentifier: r.clientIdentifier,
          name: r.name,
          product: (r as Record<string, unknown>).product ?? "",
          platform: (r as Record<string, unknown>).platform ?? "",
        }));
      return jsonResponse({ clients });
    }

    // --- PLAY — fire remote playback on an assigned device ---
    if (action === "play") {
      // 1. Authenticate the caller via JWT
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
      if (authErr || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const clientIdentifier = url.searchParams.get("clientIdentifier");
      const ratingKey = url.searchParams.get("ratingKey");
      const serverUri = url.searchParams.get("serverUri");
      const serverMachineId = url.searchParams.get("serverMachineId");

      if (!clientIdentifier || !ratingKey || !serverUri || !serverMachineId) {
        return jsonResponse({ error: "Missing required parameters" }, 400);
      }

      // 2. Authorization: user must have this device explicitly assigned to them
      const { data: perm } = await supabase
        .from("plex_device_permissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("client_identifier", clientIdentifier)
        .maybeSingle();

      if (!perm) {
        return jsonResponse({ error: "Device not assigned to this user" }, 403);
      }

      // 3. Two-step Plex remote-play: create play queue, then companion playMedia.
      // Plex companion protocol expects key=/playQueues/{id}, not a raw media key.
      // Each server may have its own accessToken distinct from the master PLEX_TOKEN —
      // use the server-specific token (from the cached server list) so the /playQueues
      // call is not rejected with 401.
      let serverToken = plexToken;
      try {
        const servers = await getCachedServers(plexToken, supabase, config);
        const matchedServer = servers.find((s) => s.machineIdentifier === serverMachineId);
        if (matchedServer?.accessToken) serverToken = matchedServer.accessToken;
      } catch { /* fall back to master token */ }

      const plexHeaders = {
        "Accept": "application/json",
        "X-Plex-Token": serverToken,
        "X-Plex-Client-Identifier": PLEX_CLIENT_ID,
        "X-Plex-Product": "WatchTracker",
        "X-Plex-Device": "WatchTracker Server",
      };

      // Step 1: create play queue on the server
      const queueUri = `server://${serverMachineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`;
      const queueParams = new URLSearchParams({
        type: "video",
        uri: queueUri,
        shuffle: "0",
        repeat: "0",
        continuous: "1",
        "X-Plex-Token": serverToken,
      });
      let playQueueKey: string;
      try {
        const queueRes = await fetch(`${serverUri}/playQueues?${queueParams}`, {
          method: "POST",
          headers: plexHeaders,
          signal: AbortSignal.timeout(8000),
        });
        if (!queueRes.ok) {
          return jsonResponse({ success: false, error: `Queue creation failed (${queueRes.status})` });
        }
        const queueData = await queueRes.json() as { MediaContainer?: { playQueueID?: number } };
        const queueId = queueData?.MediaContainer?.playQueueID;
        if (!queueId) {
          return jsonResponse({ success: false, error: "No playQueueID in Plex response" });
        }
        playQueueKey = `/playQueues/${queueId}`;
      } catch (e: unknown) {
        return jsonResponse({ success: false, error: `Queue error: ${e instanceof Error ? e.message : String(e)}` });
      }

      // Step 2: companion playMedia via server proxy.
      // The server proxies the command to the subscribed player (X-Plex-Target-Client-Identifier).
      // Params tell the player how to reach the server and what to play.
      const commandID = Date.now();

      // Parse server connection details so the player knows how to reach the server.
      let serverAddress = serverUri;
      let serverPort = "32400";
      let serverProtocol = "https";
      try {
        const serverUrl = new URL(serverUri);
        serverAddress = serverUrl.hostname;
        serverPort = serverUrl.port || (serverUrl.protocol === "https:" ? "443" : "80");
        serverProtocol = serverUrl.protocol.replace(":", "");
      } catch { /* use defaults */ }

      const playParams = new URLSearchParams({
        key: `/library/metadata/${ratingKey}`,            // raw media key (NOT the play queue)
        containerKey: `${playQueueKey}?window=100&own=1`, // play queue for continuous playback context
        offset: "0",
        machineIdentifier: serverMachineId,
        address: serverAddress,                            // player uses this to reach server
        port: serverPort,
        protocol: serverProtocol,
        token: serverToken,                                // player uses this to auth with server
        type: "video",
        providerIdentifier: "com.plexapp.plugins.library",
        commandID: String(commandID),
      });

      let playOk = false;
      let playError: string | undefined;
      try {
        const playRes = await fetch(`${serverUri}/player/playback/playMedia?${playParams}`, {
          headers: {
            "Accept": "application/json",
            "X-Plex-Token": plexToken,                    // master token — controller auth
            "X-Plex-Client-Identifier": PLEX_CLIENT_ID,
            "X-Plex-Product": "WatchTracker",
            "X-Plex-Device": "WatchTracker Server",
            "X-Plex-Target-Client-Identifier": clientIdentifier, // tells server which player to route to
          },
          signal: AbortSignal.timeout(10000),
        });
        playOk = playRes.ok;
        if (!playOk) playError = `Play command failed (${playRes.status})`;
      } catch (e: unknown) {
        playError = `Play timed out: ${e instanceof Error ? e.message : String(e)}`;
      }
      return jsonResponse({ success: playOk, error: playError });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("Plex proxy error:", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
