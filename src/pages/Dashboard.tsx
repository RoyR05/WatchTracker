import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { HorizontalScrollSection } from '../components/ui/HorizontalScrollSection';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { GestureTutorial } from '../components/ui/GestureTutorial';
import { MediaTypeSwitcher } from '../components/ui/MediaTypeSwitcher';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { useToast } from '../contexts/ToastContext';
import { tmdbService } from '../services/tmdb';
import { preferencesService } from '../services/preferences';
import { userSettingsService } from '../services/userSettings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { queryKeys } from '../lib/queryKeys';
import { CacheTTL } from '../services/cache';
import type { Movie, TVShow } from '../services/tmdb';

interface WatchlistItem {
  id: string;
  tmdb_id: number;
  media_type: string;
  status: string;
  title: string | null;
  poster_path: string | null;
  media_year: number | null;
}

/** Renders one watchlist card, fetching + caching the poster if it's missing from the DB row. */
function WatchlistCard({ item, statusLabel, badgeClass }: {
  item: WatchlistItem;
  statusLabel: string;
  badgeClass: string;
}) {
  const queryClient = useQueryClient();
  const [posterPath, setPosterPath] = useState<string | null>(item.poster_path);
  const [title, setTitle] = useState<string | null>(item.title);

  useEffect(() => {
    if (item.poster_path) return; // already stored — nothing to fetch
    let cancelled = false;

    async function fetchAndHeal() {
      try {
        const details = item.media_type === 'movie'
          ? await tmdbService.getMovieDetails(item.tmdb_id)
          : await tmdbService.getTVShowDetails(item.tmdb_id);

        if (cancelled) return;

        const fetchedTitle = 'title' in details ? details.title : (details as any).name;
        const date = 'release_date' in details ? details.release_date : (details as any).first_air_date;
        const year = date ? new Date(date).getFullYear() : null;

        setPosterPath(details.poster_path);
        setTitle(fetchedTitle);

        // Write back to DB so the next page-load is instant
        await supabase.from('watchlist_items').update({
          poster_path: details.poster_path,
          title: fetchedTitle,
          media_year: year,
        }).eq('id', item.id);

        // Bust the query cache so navigating away and back shows the poster immediately
        queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      } catch (e) {
        console.error('Failed to fetch poster for watchlist item', item.id, e);
      }
    }

    fetchAndHeal();
    return () => { cancelled = true; };
  }, [item.id, item.poster_path, item.media_type, item.tmdb_id, queryClient]);

  return (
    <Link to={`/details/${item.media_type}/${item.tmdb_id}`} className="relative block group">
      <div className={`absolute top-2 right-2 z-10 ${badgeClass} text-white text-xs px-2 py-1 rounded`}>
        {statusLabel}
      </div>
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
        <img
          src={posterPath
            ? `https://image.tmdb.org/t/p/w342${posterPath}`
            : tmdbService.getImageUrl(null)}
          alt={title ?? ''}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="mt-2">
        <h3 className="text-sm font-medium text-white line-clamp-1 group-hover:text-primary-400 transition-colors">
          {title}
        </h3>
        <p className="text-xs text-gray-400 mt-1">{item.media_year}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const [timeWindow, setTimeWindow] = useState<'day' | 'week'>('week');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [englishOnly, setEnglishOnly] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());

  // Load settings once, then enable all queries
  useEffect(() => {
    if (!user) return;
    userSettingsService.getEnglishOnlyFilter().then(val => {
      setEnglishOnly(val);
      setSettingsLoaded(true);
    });
  }, [user]);

  const enabled = !!user && settingsLoaded;

  // --- Discovery queries ---
  const {
    data: trendingPages,
    fetchNextPage: fetchMoreTrending,
    hasNextPage: hasMoreTrending,
    isFetchingNextPage: loadingMoreTrending,
    isLoading: loadingTrending,
  } = useInfiniteQuery({
    queryKey: queryKeys.trending(mediaType, timeWindow, englishOnly),
    queryFn: ({ pageParam }) => tmdbService.getTrending(mediaType, timeWindow, pageParam as number, englishOnly),
    getNextPageParam: (last, pages) => (last?.total_pages ?? 0) > pages.length ? pages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: CacheTTL.TRENDING,
    enabled,
  });

  const {
    data: anticipatedPages,
    fetchNextPage: fetchMoreAnticipated,
    hasNextPage: hasMoreAnticipated,
    isFetchingNextPage: loadingMoreAnticipated,
    isLoading: loadingAnticipated,
  } = useInfiniteQuery({
    queryKey: queryKeys.anticipated(mediaType, englishOnly),
    queryFn: ({ pageParam }) => tmdbService.getAnticipated(mediaType, pageParam as number, englishOnly),
    getNextPageParam: (last, pages) => (last?.total_pages ?? 0) > pages.length ? pages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: CacheTTL.DISCOVERY,
    enabled,
  });

  const {
    data: popularPages,
    fetchNextPage: fetchMorePopular,
    hasNextPage: hasMorePopular,
    isFetchingNextPage: loadingMorePopular,
    isLoading: loadingPopular,
  } = useInfiniteQuery({
    queryKey: queryKeys.popular(mediaType, englishOnly),
    queryFn: ({ pageParam }) => tmdbService.getPopular(mediaType, pageParam as number, englishOnly),
    getNextPageParam: (last, pages) => (last?.total_pages ?? 0) > pages.length ? pages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: CacheTTL.DISCOVERY,
    enabled,
  });

  // --- Watchlist queries (reads from DB metadata — no TMDB calls) ---
  const { data: watchingItems = [] } = useQuery({
    queryKey: queryKeys.watchlist(user?.id ?? '', 'watching'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_items').select('*').eq('user_id', user!.id).eq('status', 'watching')
        .order('updated_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 60 * 1000,
  });

  const { data: planToWatchItems = [] } = useQuery({
    queryKey: queryKeys.watchlist(user?.id ?? '', 'plan_to_watch'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_items').select('*').eq('user_id', user!.id).eq('status', 'plan_to_watch')
        .order('updated_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 60 * 1000,
  });

  // Flatten pages into item arrays
  const trending = useMemo(() => trendingPages?.pages.flatMap(p => p?.results ?? []) ?? [], [trendingPages]);
  const anticipated = useMemo(() => anticipatedPages?.pages.flatMap(p => p?.results ?? []) ?? [], [anticipatedPages]);
  const popular = useMemo(() => popularPages?.pages.flatMap(p => p?.results ?? []) ?? [], [popularPages]);

  // Batch-fetch preferences whenever items change
  useEffect(() => {
    if (!user || (trending.length === 0 && anticipated.length === 0 && popular.length === 0)) return;
    const allItems = [...trending, ...anticipated, ...popular].map(item => ({
      tmdbId: item.id,
      mediaType: ('title' in item ? 'movie' : 'tv') as 'movie' | 'tv',
    }));
    preferencesService.getPreferencesForItems(allItems, user.id).then(setPreferenceMap);
  }, [trending, anticipated, popular, user]);

  const isInitialLoading = !settingsLoaded || (enabled && (loadingTrending || loadingAnticipated || loadingPopular) && trending.length === 0);

  if (isInitialLoading) {
    return (
      <Layout>
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Currently Watching</h2>
            <SkeletonGrid count={6} />
          </section>
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Trending This Week</h2>
            <SkeletonGrid count={12} />
          </section>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <GestureTutorial />
      <div className="space-y-8">

        {/* Currently Watching — self-heals poster_path if missing */}
        <CollapsibleSection id="currently-watching" title="Currently Watching" itemCount={watchingItems.length}>
          {watchingItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchingItems.map(item => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  statusLabel="Watching"
                  badgeClass="bg-primary-600"
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No items in your watchlist yet. Start adding some content!</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Plan to Watch — self-heals poster_path if missing */}
        <CollapsibleSection id="plan-to-watch" title="Plan to Watch" itemCount={planToWatchItems.length}>
          {planToWatchItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {planToWatchItems.map(item => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  statusLabel="Plan to Watch"
                  badgeClass="bg-amber-600"
                />
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No items in your plan to watch list. Swipe right on content to add it!</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Discovery Filters */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Discovery Filters</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <MediaTypeSwitcher value={mediaType} onChange={setMediaType} />
              <div className="relative inline-flex items-center bg-gray-800 rounded-full p-1 border border-gray-700">
                {(['day', 'week'] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => setTimeWindow(w)}
                    className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${timeWindow === w ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                  >
                    {timeWindow === w && <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full shadow-lg" />}
                    <span className="relative z-10">{w === 'day' ? 'Today' : 'This Week'}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={async () => {
                  const newValue = !englishOnly;
                  setEnglishOnly(newValue);
                  await userSettingsService.setEnglishOnlyFilter(newValue);
                  toast.success(`English-only filter ${newValue ? 'enabled' : 'disabled'}`);
                }}
                className={`relative inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 border ${
                  englishOnly
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white border-primary-500 shadow-lg'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-300 border-gray-700'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                English Only
              </button>
            </div>
          </div>
        </div>

        <HorizontalScrollSection
          id="trending"
          title="Trending"
          itemCount={trending.length}
          loading={loadingTrending}
          loadingMore={loadingMoreTrending}
          hasMore={!!hasMoreTrending}
          page={trendingPages?.pages.length ?? 1}
          onLoadMore={() => fetchMoreTrending()}
        >
          {trending.map(item => {
            const type = 'title' in item ? 'movie' : 'tv';
            return (
              <div key={item.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                <MediaCard item={item} mediaType={type} initialPreference={preferenceMap.get(`${item.id}-${type}`) ?? null} />
              </div>
            );
          })}
        </HorizontalScrollSection>

        <HorizontalScrollSection
          id="anticipated"
          title="Anticipated"
          itemCount={anticipated.length}
          loading={loadingAnticipated}
          loadingMore={loadingMoreAnticipated}
          hasMore={!!hasMoreAnticipated}
          page={anticipatedPages?.pages.length ?? 1}
          onLoadMore={() => fetchMoreAnticipated()}
        >
          {anticipated.map(item => {
            const type = 'title' in item ? 'movie' : 'tv';
            return (
              <div key={item.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                <MediaCard item={item} mediaType={type} initialPreference={preferenceMap.get(`${item.id}-${type}`) ?? null} />
              </div>
            );
          })}
        </HorizontalScrollSection>

        <HorizontalScrollSection
          id="popular"
          title="Popular"
          itemCount={popular.length}
          loading={loadingPopular}
          loadingMore={loadingMorePopular}
          hasMore={!!hasMorePopular}
          page={popularPages?.pages.length ?? 1}
          onLoadMore={() => fetchMorePopular()}
        >
          {popular.map(item => {
            const type = 'title' in item ? 'movie' : 'tv';
            return (
              <div key={item.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                <MediaCard item={item} mediaType={type} initialPreference={preferenceMap.get(`${item.id}-${type}`) ?? null} />
              </div>
            );
          })}
        </HorizontalScrollSection>

      </div>
    </Layout>
  );
}
