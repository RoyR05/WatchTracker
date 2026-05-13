import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { tmdbService } from '../../services/tmdb';
import { preferencesService } from '../../services/preferences';
import { userSettingsService } from '../../services/userSettings';
import { supabase } from '../../lib/supabase';
import type { Movie, TVShow } from '../../services/tmdb';

type PickReason = 'watchlist' | 'taste' | 'wildcard';

interface QueueEntry {
  item: Movie | TVShow;
  mediaType: 'movie' | 'tv';
  reason: PickReason;
}

const ALL_GENRE_IDS = [28, 35, 18, 878, 53, 27, 10749, 16, 99, 36, 9648, 12, 14, 80];
const QUEUE_TARGET = 8;
const REFILL_THRESHOLD = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWeightedGenre(
  weights: Map<number, number>,
  skipped: Map<number, number>
): number {
  // Apply skip penalty: divide weight by (skips + 1)
  const adjusted = new Map<number, number>();
  const base = weights.size > 0 ? weights : new Map(ALL_GENRE_IDS.map(g => [g, 1]));
  for (const [g, w] of base) {
    adjusted.set(g, w / ((skipped.get(g) ?? 0) + 1));
  }
  const total = [...adjusted.values()].reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (const [g, w] of adjusted) {
    r -= w;
    if (r <= 0) return g;
  }
  return [...adjusted.keys()][0];
}

export const FeelingLucky = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [current, setCurrent] = useState<QueueEntry | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [filling, setFilling] = useState(false);
  const [skippedGenres, setSkippedGenres] = useState<Map<number, number>>(new Map());
  const [englishOnly, setEnglishOnly] = useState(false);
  const englishOnlyRef = useRef(englishOnly);
  const skippedRef = useRef(skippedGenres);

  useEffect(() => { englishOnlyRef.current = englishOnly; }, [englishOnly]);
  useEffect(() => { skippedRef.current = skippedGenres; }, [skippedGenres]);

  useEffect(() => {
    userSettingsService.getEnglishOnlyFilter().then(setEnglishOnly);
  }, []);

  // ─── Queue builder ────────────────────────────────────────────────────────
  const buildEntries = useCallback(async (count: number): Promise<QueueEntry[]> => {
    if (!user) return [];
    const results: QueueEntry[] = [];
    const en = englishOnlyRef.current;
    const skipped = skippedRef.current;

    // Get liked preferences with genre metadata once
    const liked = await preferencesService.getPreferences().then(prefs =>
      prefs.filter(p => p.preference_type === 'like')
    );

    // Build genre weight map from liked content_metadata
    const genreWeights = new Map<number, number>();
    for (const pref of liked) {
      for (const g of pref.content_metadata?.genres ?? []) {
        genreWeights.set(g.id, (genreWeights.get(g.id) ?? 0) + 1);
      }
    }

    for (let i = 0; i < count; i++) {
      try {
        const roll = Math.random();
        let entry: QueueEntry | null = null;

        // 30% — resurface from Plan to Watch list
        if (roll < 0.30) {
          const { data } = await supabase
            .from('watchlist_items')
            .select('tmdb_id, media_type, title, poster_path')
            .eq('user_id', user.id)
            .eq('status', 'plan_to_watch')
            .limit(50);

          if (data && data.length > 0) {
            const picked = shuffle(data)[0];
            const mediaType = picked.media_type as 'movie' | 'tv';
            // fetch minimal details so we get a proper item shape
            const details = mediaType === 'movie'
              ? await tmdbService.getMovieDetails(picked.tmdb_id)
              : await tmdbService.getTVShowDetails(picked.tmdb_id);
            entry = { item: details as unknown as Movie | TVShow, mediaType, reason: 'watchlist' };
          }
        }

        // 50% — discover based on weighted liked genres
        if (!entry && roll < 0.80) {
          const genre = pickWeightedGenre(genreWeights, skipped);
          const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';
          const params: Record<string, string> = {
            with_genres: String(genre),
            sort_by: 'vote_average.desc',
            'vote_count.gte': mediaType === 'movie' ? '500' : '100',
            page: String(Math.floor(Math.random() * 5) + 1),
          };
          if (en) params['with_original_language'] = 'en';
          const res = await tmdbService.discover(mediaType, params);
          if (res?.results?.length) {
            const item = res.results[Math.floor(Math.random() * Math.min(10, res.results.length))];
            entry = { item: item as Movie | TVShow, mediaType, reason: 'taste' };
          }
        }

        // 20% wildcard — genre outside user's usual set
        if (!entry) {
          const likedGenreIds = new Set(genreWeights.keys());
          const unusual = ALL_GENRE_IDS.filter(g => !likedGenreIds.has(g));
          const pool = unusual.length > 0 ? unusual : ALL_GENRE_IDS;
          const genre = pool[Math.floor(Math.random() * pool.length)];
          const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';
          const params: Record<string, string> = {
            with_genres: String(genre),
            sort_by: 'popularity.desc',
            page: String(Math.floor(Math.random() * 3) + 1),
          };
          if (en) params['with_original_language'] = 'en';
          const res = await tmdbService.discover(mediaType, params);
          if (res?.results?.length) {
            const item = res.results[Math.floor(Math.random() * Math.min(10, res.results.length))];
            entry = { item: item as Movie | TVShow, mediaType, reason: 'wildcard' };
          }
        }

        if (entry) results.push(entry);
      } catch {
        // skip this slot silently
      }
    }
    return results;
  }, [user]);

  const refillQueue = useCallback(async () => {
    if (filling) return;
    setFilling(true);
    try {
      const entries = await buildEntries(QUEUE_TARGET);
      setQueue(prev => [...prev, ...entries]);
    } finally {
      setFilling(false);
    }
  }, [filling, buildEntries]);

  // ─── Initial load ─────────────────────────────────────────────────────────
  const handleFeelingLucky = async () => {
    if (!user || initialLoading) return;
    setInitialLoading(true);
    try {
      const entries = await buildEntries(QUEUE_TARGET);
      if (entries.length > 0) {
        const [first, ...rest] = entries;
        setCurrent(first);
        setQueue(rest);
      }
    } finally {
      setInitialLoading(false);
    }
  };

  // ─── Next ─────────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (!current) return;

    // Track skip for session learning
    const primaryGenre = (current.item as any).genre_ids?.[0] as number | undefined;
    if (primaryGenre) {
      setSkippedGenres(prev => new Map(prev).set(primaryGenre, (prev.get(primaryGenre) ?? 0) + 1));
    }

    const [next, ...rest] = queue;
    setCurrent(next ?? null);
    setQueue(rest);

    if (rest.length < REFILL_THRESHOLD && !filling) refillQueue();
  };

  // ─── Reason badge ─────────────────────────────────────────────────────────
  const reasonBadge: Record<PickReason, { label: string; className: string }> = {
    watchlist: { label: 'From your watchlist',   className: 'bg-amber-900/40 text-amber-300 border-amber-700' },
    taste:     { label: 'Based on your taste',   className: 'bg-primary-900/40 text-primary-300 border-primary-700' },
    wildcard:  { label: 'Wildcard pick',         className: 'bg-purple-900/40 text-purple-300 border-purple-700' },
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (current) {
    const title = 'title' in current.item ? current.item.title : (current.item as any).name;
    const poster = current.item.poster_path;
    const year = (() => {
      const d = 'release_date' in current.item ? current.item.release_date : (current.item as any).first_air_date;
      return d ? new Date(d).getFullYear() : null;
    })();
    const badge = reasonBadge[current.reason];

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          {/* Poster card */}
          <Link
            to={`/details/${current.mediaType}/${current.item.id}`}
            className="group relative block w-40 sm:w-48 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl ring-2 ring-primary-500/40 hover:ring-primary-500 transition-all"
          >
            <div className="aspect-[2/3]">
              <img
                src={tmdbService.getImageUrl(poster, 'w342')}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <span className="text-white text-xs font-medium">View details</span>
            </div>
          </Link>

          {/* Info + actions */}
          <div className="flex flex-col gap-3 min-w-0">
            <div>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full border mb-2 ${badge.className}`}>
                {badge.label}
              </span>
              <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">{title}</h3>
              {year && <p className="text-gray-400 text-sm mt-0.5">{year} · {current.mediaType === 'movie' ? 'Movie' : 'TV Show'}</p>}
              {current.item.vote_average > 0 && (
                <p className="text-amber-400 text-sm mt-1">★ {current.item.vote_average.toFixed(1)}</p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link
                to={`/details/${current.mediaType}/${current.item.id}`}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Details
              </Link>
              <button
                onClick={handleNext}
                disabled={queue.length === 0 && filling}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {filling && queue.length === 0 ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                )}
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleFeelingLucky}
      disabled={initialLoading || !user}
      className="group relative overflow-hidden bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-700 hover:via-cyan-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      <div className="relative flex items-center gap-3">
        {initialLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Finding something for you...</span>
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>I'm Feeling Lucky</span>
          </>
        )}
      </div>
    </button>
  );
};
