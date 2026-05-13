import { supabase } from '../lib/supabase';
import { tmdbService } from './tmdb';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const STORAGE_KEY = 'episodeNotifLastCheck';
const DAYS_AHEAD = 7;

interface WatchingShow {
  tmdb_id: number;
  title: string | null;
}

/**
 * Runs at most once per day (gated by localStorage timestamp).
 * For each "watching" TV show, checks TMDB for the next episode airing
 * within the next 7 days and upserts in-app notifications.
 */
export async function checkUpcomingEpisodeNotifications(userId: string): Promise<void> {
  // Rate-limit: once per day
  const last = localStorage.getItem(STORAGE_KEY);
  if (last && Date.now() - parseInt(last) < CHECK_INTERVAL_MS) return;

  try {
    // Fetch user's "watching" TV shows
    const { data: shows, error } = await supabase
      .from('watchlist_items')
      .select('tmdb_id, title')
      .eq('user_id', userId)
      .eq('media_type', 'tv')
      .eq('status', 'watching');

    if (error || !shows?.length) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      return;
    }

    const cutoff = new Date(Date.now() + DAYS_AHEAD * 86400000);
    const toInsert: Record<string, unknown>[] = [];

    for (const show of shows as WatchingShow[]) {
      try {
        const details = await tmdbService.getTVShowDetails(show.tmdb_id);
        const nextEp = (details as any).next_episode_to_air;
        if (!nextEp?.air_date) continue;

        const airDate = new Date(nextEp.air_date);
        if (airDate > cutoff) continue;

        const daysUntil = Math.max(0, Math.ceil((airDate.getTime() - Date.now()) / 86400000));
        const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;

        const showName = (details as any).name ?? show.title ?? 'Unknown Show';
        const seasons: Array<{ season_number: number; episode_count: number }> = (details as any).seasons ?? [];
        const season = seasons.find((s) => s.season_number === nextEp.season_number);

        // Classify the episode
        const isFinal = season && nextEp.episode_number === season.episode_count;
        const isReturn = nextEp.episode_number === 1 && nextEp.season_number > 1;

        type EpType = 'upcoming_episode' | 'season_finale' | 'series_returning';
        const type: EpType = isFinal ? 'season_finale' : isReturn ? 'series_returning' : 'upcoming_episode';
        const dedupKey = `ep_${show.tmdb_id}_s${nextEp.season_number}e${nextEp.episode_number}`;

        const titles: Record<EpType, string> = {
          upcoming_episode: `New episode of ${showName} airs ${when}`,
          season_finale: `Season ${nextEp.season_number} finale of ${showName} airs ${when}`,
          series_returning: `${showName} returns for Season ${nextEp.season_number} ${when}`,
        };
        const messages: Record<EpType, string> = {
          upcoming_episode: `S${nextEp.season_number}E${nextEp.episode_number}: "${nextEp.name}" — ${nextEp.air_date}`,
          season_finale: `Don't miss the finale! S${nextEp.season_number}E${nextEp.episode_number}: "${nextEp.name}"`,
          series_returning: `S${nextEp.season_number}E${nextEp.episode_number}: "${nextEp.name}" — ${nextEp.air_date}`,
        };

        toInsert.push({
          user_id: userId,
          notification_type: type,
          title: titles[type],
          message: messages[type],
          metadata: {
            tmdb_id: show.tmdb_id,
            media_type: 'tv',
            season_number: nextEp.season_number,
            episode_number: nextEp.episode_number,
            air_date: nextEp.air_date,
          },
          dedup_key: dedupKey,
          is_read: false,
        });
      } catch {
        // Skip this show silently — TMDB may 404 or be rate-limited
      }
    }

    if (toInsert.length > 0) {
      await supabase
        .from('notifications')
        .upsert(toInsert as any, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true });
    }
  } catch (err) {
    console.error('checkUpcomingEpisodeNotifications error:', err);
  } finally {
    // Always update timestamp so we don't hammer TMDB on every load
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }
}
