import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const isAllowed = origin === siteUrl || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (siteUrl || 'https://rflixs.rainey.app'),
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify caller's JWT using the service key client (more reliable than userClient pattern)
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify caller is admin
    const { data: adminCheck } = await adminClient.from('admin_config').select('admin_user_id').eq('admin_user_id', caller.id).maybeSingle();
    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Access denied: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Delete related data first (in case FK constraints don't cascade)
    await adminClient.from('watchlist_items').delete().eq('user_id', user_id);
    await adminClient.from('user_preferences').delete().eq('user_id', user_id);
    await adminClient.from('notifications').delete().eq('user_id', user_id);
    await adminClient.from('recommendations').delete().or(`from_user_id.eq.${user_id},to_user_id.eq.${user_id}`);
    await adminClient.from('global_share_permissions').delete().eq('user_id', user_id);
    await adminClient.from('global_share_permissions').delete().eq('can_share_with_user_id', user_id);
    await adminClient.from('profiles').delete().eq('id', user_id);

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await adminClient.rpc('log_admin_action', {
      p_action_type: 'user_deleted',
      p_target_user_id: caller.id,
      p_details: `Deleted user ${user_id}`,
    }).maybeSingle();

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
