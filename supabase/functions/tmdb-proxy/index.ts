import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const SITE_URL = Deno.env.get('SITE_URL') ?? '';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const isAllowed =
    origin === SITE_URL ||
    origin.endsWith('.vercel.app') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');
  const allowedOrigin = isAllowed ? origin : (SITE_URL || 'https://rflixs.rainey.app');
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

const ALLOWED_ENDPOINT_PREFIXES = [
  '/search/multi',
  '/trending/',
  '/movie/',
  '/tv/',
  '/person/',
  '/discover/movie',
  '/discover/tv',
  '/genre/',
  '/watch/providers/',
];

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isAllowed = ALLOWED_ENDPOINT_PREFIXES.some(prefix => endpoint.startsWith(prefix));
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Endpoint not allowed" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!TMDB_API_KEY) {
      return new Response(
        JSON.stringify({ error: "TMDB API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    url.searchParams.delete("endpoint");
    url.searchParams.set("api_key", TMDB_API_KEY);

    const tmdbUrl = `${TMDB_BASE_URL}${endpoint}?${url.searchParams.toString()}`;

    const response = await fetch(tmdbUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
