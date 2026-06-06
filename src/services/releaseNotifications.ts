import { supabase } from '../lib/supabase';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const STORAGE_KEY = 'releaseNotifLastCheck';
const GRACE_DAYS = 2; // only fire for titles released within the last couple of days

interface ReleasedItem {
  tmdb_id: number;
  media_type: string;
  title: string | null;
  release_date: string | null;
}

/**
 * Runs at most once per day (gated by localStorage timestamp).
 * Finds plan-to-watch titles whose release date has just arrived and creates an
 * in-app "now available" notification. The notifications-INSERT webhook fans this
 * out to push automatically. Deduped per title via dedup_key so re-runs are safe.
 */
export async function checkReleaseNotifications(userId: string): Promise<void> {
  const last = localStorage.getItem(STORAGE_KEY);
  if (last && Date.now() - parseInt(last) < CHECK_INTERVAL_MS) return;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const fromIso = new Date(today.getTime() - GRACE_DAYS * 86400000).toISOString().slice(0, 10);

    // plan-to-watch titles that became available within the grace window
    const { data: items, error } = await supabase
      .from('watchlist_items')
      .select('tmdb_id, media_type, title, release_date')
      .eq('user_id', userId)
      .eq('status', 'plan_to_watch')
      .gte('release_date', fromIso)
      .lte('release_date', todayIso);

    if (error || !items?.length) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      return;
    }

    const toInsert = (items as ReleasedItem[]).map((item) => {
      const when = item.release_date
        ? new Date(item.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '';
      return {
        user_id: userId,
        notification_type: 'release_available',
        title: `${item.title ?? 'A title on your watchlist'} is now available`,
        message: when ? `Released ${when} — it's on your watchlist.` : `It's on your watchlist.`,
        metadata: {
          tmdb_id: item.tmdb_id,
          media_type: item.media_type,
          release_date: item.release_date,
        },
        dedup_key: `release_${item.tmdb_id}`,
        is_read: false,
      };
    });

    if (toInsert.length > 0) {
      await supabase
        .from('notifications')
        .upsert(toInsert as any, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true });
    }
  } catch (err) {
    console.error('checkReleaseNotifications error:', err);
  } finally {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }
}
