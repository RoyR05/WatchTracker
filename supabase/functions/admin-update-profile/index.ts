import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const isAllowed = origin === siteUrl || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (siteUrl || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: adminCheck } = await adminClient.from('admin_config').select('admin_user_id').eq('admin_user_id', caller.id).maybeSingle();
    if (!adminCheck) return new Response(JSON.stringify({ error: 'Access denied: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { user_id, username } = await req.json();
    if (!user_id || !username?.trim()) return new Response(JSON.stringify({ error: 'user_id and username are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ username: username.trim(), updated_at: new Date().toISOString() })
      .eq('id', user_id);

    if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await adminClient.rpc('log_admin_action', {
      p_action_type: 'profile_updated',
      p_target_user_id: user_id,
      p_details: `Admin updated username to "${username.trim()}"`,
    }).maybeSingle();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
