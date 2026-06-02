// @ts-nocheck — Deno types; compiled by Supabase, not tsc
import webPush from 'npm:web-push@3';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET       = Deno.env.get('CRON_SECRET') ?? '';

webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const body = await req.json().catch(() => ({}));

  try {
    // ── Path 1: Supabase database webhook (INSERT on notifications table) ──────
    if (body.table === 'notifications' && body.type === 'INSERT') {
      const sent = await sendForNotification(body.record);
      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Path 2: Vercel cron call for episode reminders ─────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    if (body.type === 'reminders') {
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS });
      }
      const sent = await processEpisodeReminders();
      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: false, reason: 'Unknown request type' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[send-push-notification] error:', err?.message ?? err);
    return new Response(JSON.stringify({ ok: false, error: err?.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function dbFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Sends a push notification to all of a user's registered devices
 * for a given notifications table record.
 * Returns the number of subscriptions successfully pushed.
 */
async function sendForNotification(record: any): Promise<number> {
  const res = await dbFetch(
    `push_subscriptions?user_id=eq.${record.user_id}&select=id,endpoint,p256dh,auth`
  );
  const subs = await res.json();
  if (!Array.isArray(subs) || subs.length === 0) return 0;

  const url = deepLinkForNotification(record);
  const payload = JSON.stringify({
    title: record.title ?? 'RaineyFlixs',
    body: record.message ?? '',
    tag: record.id,
    url,
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Subscription expired — remove it so we stop trying
        await dbFetch(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' });
        console.log('[push] removed expired subscription', sub.id);
      } else {
        console.error('[push] sendNotification error', err?.statusCode, err?.message);
      }
    }
  }
  return sent;
}

/**
 * Maps a notification record to a deep-link URL inside the app.
 */
function deepLinkForNotification(record: any): string {
  const meta = record.metadata ?? {};
  if (meta.tmdb_id && meta.media_type) {
    return `/details/${meta.media_type}/${meta.tmdb_id}`;
  }
  switch (record.notification_type) {
    case 'recommendation': return '/recommendations';
    case 'plex_request_update': return '/plex-requests';
    case 'season_finale':
    case 'upcoming_episode':
    case 'series_returning':
      return meta.tmdb_id ? `/details/tv/${meta.tmdb_id}` : '/notifications';
    default: return '/notifications';
  }
}

/**
 * Processes episode_reminders where air_date is today and reminder_sent = false.
 * Sends a push to each user's devices and marks the reminder as sent.
 */
async function processEpisodeReminders(): Promise<number> {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  const res = await dbFetch(
    `episode_reminders?air_date=eq.${today}&reminder_sent=eq.false&select=*`
  );
  const reminders = await res.json();
  if (!Array.isArray(reminders) || reminders.length === 0) return 0;

  let totalSent = 0;

  for (const reminder of reminders) {
    // Look up show title from watchlist_items
    const wlRes = await dbFetch(
      `watchlist_items?user_id=eq.${reminder.user_id}&tmdb_id=eq.${reminder.tmdb_id}&media_type=eq.tv&select=title`
    );
    const wlItems = await wlRes.json();
    const showTitle = wlItems?.[0]?.title ?? 'Your show';

    const type = reminder.is_season_finale ? 'season_finale' : 'upcoming_episode';
    const title = reminder.is_season_finale
      ? `Season Finale Tonight!`
      : `New Episode Today`;
    const message = reminder.is_season_finale
      ? `${showTitle} S${reminder.season_number} finale airs today`
      : `${showTitle} S${reminder.season_number}E${reminder.episode_number} airs today`;

    // Build a synthetic notification record compatible with sendForNotification
    const syntheticRecord = {
      user_id: reminder.user_id,
      title,
      message,
      id: `reminder-${reminder.id}`,
      notification_type: type,
      metadata: { tmdb_id: reminder.tmdb_id, media_type: 'tv' },
    };

    const sent = await sendForNotification(syntheticRecord);
    totalSent += sent;

    // Mark reminder as sent regardless of push success (prevent spam on retry)
    await dbFetch(`episode_reminders?id=eq.${reminder.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ reminder_sent: true }),
      headers: { Prefer: 'return=minimal' },
    });
  }

  return totalSent;
}
