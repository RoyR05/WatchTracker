import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { HorizontalScrollSection } from '../components/ui/HorizontalScrollSection';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { MediaTypeSwitcher } from '../components/ui/MediaTypeSwitcher';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { DashboardCustomizeDrawer } from '../components/ui/DashboardCustomizeDrawer';
import { useToast } from '../contexts/ToastContext';
import { tmdbService } from '../services/tmdb';
import { preferencesService } from '../services/preferences';
import { userSettingsService } from '../services/userSettings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { queryKeys } from '../lib/queryKeys';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { PushOptInBanner } from '../components/notifications/PushOptInBanner';
import { releasesLabel } from '../utils/releaseBucket';
import type { Movie, TVShow, TVShowDetails } from '../services/tmdb';

interface WatchlistItem {
  id: string;
  tmdb_id: number;
  media_type: string;
  status: string;
  title: string | null;
  poster_path: string | null;
  media_year: number | null;
  release_date: string | null;
  next_air_date: string | null;
  last_air_date: string | null;
  show_status: string | null;
}

function isVisibleOnDashboard(item: WatchlistItem, hideWeeks: number, showDays: number): boolean {
  if (item.media_type !== 'tv') return true;
  if (['Ended', 'Canceled'].includes(item.show_status ?? '')) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (item.next_air_date) {
    const next = new Date(item.next_air_date);
    const daysUntil = Math.ceil((next.getTime() - today.getTime()) / 86_400_000);
    if (daysUntil <= showDays) return true;
  }

  if (item.last_air_date) {
    const last = new Date(item.last_air_date);
    const daysSince = Math.ceil((today.getTime() - last.getTime()) / 86_400_000);
    if (daysSince <= hideWeeks * 7) return true;
  }

  // No schedule data yet — fail-open so items never silently vanish
  if (!item.next_air_date && !item.last_air_date) return true;

  return false;
}

/** Pure display card — poster override supplied by Dashboard's sequential backfill. */
function WatchlistCard({ item, statusLabel, badgeClass, posterOverride, showDays, showReleaseDate }: {
  item: WatchlistItem;
  statusLabel: string;
  badgeClass: string;
  posterOverride?: string | null;
  showDays: number;
  showReleaseDate?: boolean;
}) {
  const effectivePoster = posterOverride ?? item.poster_path;

  const returnsLabel = (() => {
    // For "Coming Soon" cards, show the movie/series release date instead of the next-episode date.
    if (showReleaseDate) return releasesLabel(item.release_date);
    if (!item.next_air_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(item.next_air_date);
    const daysUntil = Math.ceil((next.getTime() - today.getTime()) / 86_400_000);
    if (daysUntil > showDays) return null;
    if (daysUntil <= 0) return 'Airing now';
    return `Returns ${next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  })();

  return (
    <Link to={`/details/${item.media_type}/${item.tmdb_id}`} className="relative block group">
      <div className={`absolute top-2 right-2 z-10 ${badgeClass} text-white text-xs px-2 py-1 rounded`}>
        {statusLabel}
      </div>
      {returnsLabel && (
        <div className="absolute top-8 right-2 z-10 bg-amber-500 text-white text-xs px-2 py-1 rounded mt-1">
          {returnsLabel}
        </div>
      )}
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
        <img
          src={effectivePoster
            ? `https://image.tmdb.org/t/p/w342${effectivePoster}`
            : tmdbService.getImageUrl(null)}
          alt={item.title ?? ''}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="mt-2">
        <h3 className="text-sm font-medium text-white line-clamp-1 group-hover:text-primary-400 transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1">{item.media_year}</p>
      </div>
    </Link>
  );
}

const TMDB_IDS = new Set(['trending', 'anticipated', 'popular']);
const DEFAULT_SECTION_ORDER = ['currently-watching', 'plan-to-watch', 'coming-soon', 'trending', 'anticipated', 'popular'];

export default function Dashboard() {
  useScrollRestoration();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [timeWindow, setTimeWindow] = useState<'day' | 'week'>('week');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [englishOnly, setEnglishOnly] = useState(false);
  const [hiatusHideWeeks, setHiatusHideWeeks] = useState(3);
  const [hiatusShowDays, setHiatusShowDays] = useState(14);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [localDislikes, setLocalDislikes] = useState<Set<number>>(new Set());
  // poster overrides populated by sequential backfill (itemId → posterPath)
  const [posterOverrides, setPosterOverrides] = useState<Map<string, string>>(new Map());
  const backfilledIds = useRef<Set<string>>(new Set());

  // Dashboard layout
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Load settings once, then enable all queries
  useEffect(() => {
    if (!user) return;
    Promise.all([
      userSettingsService.getEnglishOnlyFilter(),
      userSettingsService.getHiatusSettings(),
      userSettingsService.getDashboardSectionOrder(),
      userSettingsService.getDashboardHiddenSections(),
    ]).then(([englishOnlyVal, hiatus, order, hidden]) => {
      setEnglishOnly(englishOnlyVal);
      setHiatusHideWeeks(hiatus.hideWeeks);
      setHiatusShowDays(hiatus.showDays);
      setSectionOrder(order);
      setHiddenSections(hidden);
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 10 * 60 * 1000,
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
    staleTime: 10 * 60 * 1000,
    enabled,
  });

  // --- Watchlist queries (reads from DB metadata — no TMDB calls) ---
  const { data: watchingItems = [] } = useQuery({
    queryKey: queryKeys.watchlist(user?.id ?? '', 'watching'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_items').select('*').eq('user_id', user!.id).eq('status', 'watching')
        .order('updated_at', { ascending: false }).limit(50);
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

  // Coming Soon — plan_to_watch titles whose release date is still in the future.
  const { data: comingSoonItems = [] } = useQuery({
    queryKey: queryKeys.watchlist(user?.id ?? '', 'coming_soon'),
    queryFn: async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('watchlist_items').select('*').eq('user_id', user!.id).eq('status', 'plan_to_watch')
        .gt('release_date', todayIso)
        .order('release_date', { ascending: true }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 60 * 1000,
  });

  // Sequential backfill — one TMDB request at a time so we never rate-limit.
  // Populates poster_path/title/media_year for all items, and additionally
  // next_air_date/last_air_date/show_status for TV shows (needed for hiatus hiding).
  useEffect(() => {
    const allItems = [...watchingItems, ...planToWatchItems] as WatchlistItem[];
    const toFetch = allItems.filter(
      item => (!item.poster_path
          || item.release_date === null
          || (item.media_type === 'tv' && item.last_air_date === null))
        && !backfilledIds.current.has(item.id)
    );
    if (toFetch.length === 0) return;

    let cancelled = false;

    async function runBackfill() {
      for (const item of toFetch) {
        if (cancelled) break;
        backfilledIds.current.add(item.id);
        try {
          const details = item.media_type === 'movie'
            ? await tmdbService.getMovieDetails(item.tmdb_id)
            : await tmdbService.getTVShowDetails(item.tmdb_id);

          if (cancelled) break;

          const poster = details.poster_path;
          const fetchedTitle = 'title' in details ? details.title : (details as any).name;
          const date = 'release_date' in details ? details.release_date : (details as any).first_air_date;
          const mediaYear = date ? new Date(date).getFullYear() : null;
          const releaseDate = date || null;

          const tvDetails = item.media_type === 'tv' ? (details as TVShowDetails) : null;
          const nextAirDate = tvDetails?.next_episode_to_air?.air_date ?? null;
          const lastAirDate = tvDetails?.last_episode_to_air?.air_date ?? null;
          const showStatus = tvDetails?.status ?? null;

          // Update display immediately — no need to wait for DB
          if (poster) {
            setPosterOverrides(prev => new Map(prev).set(item.id, poster));
          }

          // Write back to DB so next load is instant
          await supabase.from('watchlist_items').update({
            poster_path: poster,
            title: fetchedTitle,
            media_year: mediaYear,
            release_date: releaseDate,
            next_air_date: nextAirDate,
            last_air_date: lastAirDate,
            show_status: showStatus,
          }).eq('id', item.id);

        } catch (e) {
          console.error('Poster backfill failed for item', item.id, e);
          backfilledIds.current.delete(item.id); // allow retry on next render
        }
      }
      // Refresh query cache so navigating away and back loads from DB
      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ['watchlist', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['watchlist-full', user?.id] });
      }
    }

    runBackfill();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchingItems, planToWatchItems]);

  // Derive disliked IDs from preferenceMap (existing dislikes) + localDislikes (new this session)
  const dislikedIds = useMemo(() => {
    const ids = new Set<number>(localDislikes);
    for (const [key, pref] of preferenceMap) {
      if (pref === 'dislike') ids.add(parseInt(key.split('-')[0]));
    }
    return ids;
  }, [preferenceMap, localDislikes]);

  // Flatten pages into item arrays, filtering out explicitly disliked titles
  const trending = useMemo(() => (trendingPages?.pages.flatMap(p => p?.results ?? []) ?? []).filter(i => !dislikedIds.has(i.id)), [trendingPages, dislikedIds]);
  const anticipated = useMemo(() => (anticipatedPages?.pages.flatMap(p => p?.results ?? []) ?? []).filter(i => !dislikedIds.has(i.id)), [anticipatedPages, dislikedIds]);
  const popular = useMemo(() => (popularPages?.pages.flatMap(p => p?.results ?? []) ?? []).filter(i => !dislikedIds.has(i.id)), [popularPages, dislikedIds]);

  // Batch-fetch preferences whenever items change
  useEffect(() => {
    if (!user || (trending.length === 0 && anticipated.length === 0 && popular.length === 0)) return;
    const allItems = [...trending, ...anticipated, ...popular].map(item => ({
      tmdbId: item.id,
      mediaType: ('title' in item ? 'movie' : 'tv') as 'movie' | 'tv',
    }));
    preferencesService.getPreferencesForItems(allItems, user.id).then(setPreferenceMap);
  }, [trending, anticipated, popular, user]);

  // ── Layout customization handlers ────────────────────────────────────────

  const handleLayoutChange = useCallback((order: string[], hidden: Set<string>) => {
    setSectionOrder(order);
    setHiddenSections(hidden);
    userSettingsService.saveDashboardLayout(order, hidden);
  }, []);

  const handleLayoutReset = useCallback(() => {
    const defaultOrder = ['currently-watching', 'plan-to-watch', 'coming-soon', 'trending', 'anticipated', 'popular'];
    const defaultHidden = new Set<string>();
    setSectionOrder(defaultOrder);
    setHiddenSections(defaultHidden);
    userSettingsService.resetDashboardLayout();
  }, []);

  // ── Section renderers (stable references, recreated only when deps change) ──

  const renderCurrentlyWatching = useCallback(() => {
    const visibleWatching = watchingItems.filter(
      item => isVisibleOnDashboard(item as WatchlistItem, hiatusHideWeeks, hiatusShowDays)
    );
    const hiddenCount = watchingItems.length - visibleWatching.length;
    return (
      <CollapsibleSection id="currently-watching" title="Currently Watching" itemCount={watchingItems.length}>
        {visibleWatching.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {visibleWatching.map(item => (
                <WatchlistCard
                  key={item.id}
                  item={item as WatchlistItem}
                  statusLabel="Watching"
                  badgeClass="bg-primary-600"
                  posterOverride={posterOverrides.get(item.id)}
                  showDays={hiatusShowDays}
                />
              ))}
            </div>
            {hiddenCount > 0 && (
              <p className="text-xs text-gray-500 mt-3">
                {hiddenCount} show{hiddenCount !== 1 ? 's' : ''} on hiatus hidden —{' '}
                <Link to="/watchlist" className="text-gray-400 hover:text-white underline">view all in Watchlist</Link>
              </p>
            )}
          </>
        ) : watchingItems.length > 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">All your current shows are on hiatus.</p>
            <Link to="/watchlist" className="text-sm text-primary-400 hover:text-primary-300 mt-2 inline-block">View full Watchlist</Link>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No items in your watchlist yet. Start adding some content!</p>
          </div>
        )}
      </CollapsibleSection>
    );
  }, [watchingItems, hiatusHideWeeks, hiatusShowDays, posterOverrides]);

  const renderPlanToWatch = useCallback(() => (
    <CollapsibleSection id="plan-to-watch" title="Plan to Watch" itemCount={planToWatchItems.length}>
      {planToWatchItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {planToWatchItems.map(item => (
            <WatchlistCard
              key={item.id}
              item={item as WatchlistItem}
              statusLabel="Plan to Watch"
              badgeClass="bg-amber-600"
              posterOverride={posterOverrides.get(item.id)}
              showDays={hiatusShowDays}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No items in your plan to watch list. Swipe right on content to add it!</p>
        </div>
      )}
    </CollapsibleSection>
  ), [planToWatchItems, posterOverrides, hiatusShowDays]);

  const renderComingSoon = useCallback(() => {
    if (comingSoonItems.length === 0) return null;
    return (
      <CollapsibleSection id="coming-soon" title="Coming Soon" itemCount={comingSoonItems.length}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {comingSoonItems.map(item => (
            <WatchlistCard
              key={item.id}
              item={item as WatchlistItem}
              statusLabel="Coming Soon"
              badgeClass="bg-indigo-600"
              posterOverride={posterOverrides.get(item.id)}
              showDays={hiatusShowDays}
              showReleaseDate
            />
          ))}
        </div>
      </CollapsibleSection>
    );
  }, [comingSoonItems, posterOverrides, hiatusShowDays]);

  const renderDiscoveryFilters = useCallback(() => (
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
  ), [mediaType, timeWindow, englishOnly, toast]);

  const renderTrending = useCallback(() => (
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
            <MediaCard item={item} mediaType={type} initialPreference={preferenceMap.get(`${item.id}-${type}`) ?? null} onDislike={(id) => setLocalDislikes(prev => new Set(prev).add(id))} disableSwipe />
          </div>
        );
      })}
    </HorizontalScrollSection>
  ), [trending, loadingTrending, loadingMoreTrending, hasMoreTrending, trendingPages, fetchMoreTrending, preferenceMap]);

  const renderAnticipated = useCallback(() => (
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
            <MediaCard item={item} mediaType={type} initialPreference={preferenceMap.get(`${item.id}-${type}`) ?? null} onDislike={(id) => setLocalDislikes(prev => new Set(prev).add(id))} disableSwipe />
          </div>
        );
      })}
    </HorizontalScrollSection>
  ), [anticipated, loadingAnticipated, loadingMoreAnticipated, hasMoreAnticipated, anticipatedPages, fetchMoreAnticipated, preferenceMap]);

  const renderPopular = useCallback(() => (
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
            <MediaCard item={item} mediaType={type} initialPreference={preferenceMap.get(`${item.id}-${type}`) ?? null} onDislike={(id) => setLocalDislikes(prev => new Set(prev).add(id))} disableSwipe />
          </div>
        );
      })}
    </HorizontalScrollSection>
  ), [popular, loadingPopular, loadingMorePopular, hasMorePopular, popularPages, fetchMorePopular, preferenceMap]);

  const sectionRenderers: Record<string, () => React.ReactNode | null> = {
    'currently-watching': renderCurrentlyWatching,
    'plan-to-watch':      renderPlanToWatch,
    'coming-soon':        renderComingSoon,
    'trending':           renderTrending,
    'anticipated':        renderAnticipated,
    'popular':            renderPopular,
  };

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

  // Compute the first visible TMDB section to know where to inject Discovery Filters
  const visibleOrder = sectionOrder.filter(id => !hiddenSections.has(id));
  const firstTmdbIndex = visibleOrder.findIndex(id => TMDB_IDS.has(id));

  return (
    <Layout>
      <div className="space-y-8">

        {/* Push notification opt-in banner — shown once to users who haven't enabled push yet */}
        {user && <PushOptInBanner userId={user.id} />}

        {/* Dashboard header with Customize button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <button
            onClick={() => setCustomizerOpen(true)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            aria-label="Customize dashboard layout"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Customize
          </button>
        </div>

        {/* Dynamic section render loop */}
        {visibleOrder.map((id, idx) => {
          const isTmdb = TMDB_IDS.has(id);
          const isFirstTmdb = idx === firstTmdbIndex;
          const renderer = sectionRenderers[id];
          if (!renderer) return null;
          const content = renderer();
          if (content === null) return null; // e.g. Coming Soon when empty
          return (
            <div key={id}>
              {isTmdb && isFirstTmdb && renderDiscoveryFilters()}
              <div className={isTmdb && isFirstTmdb ? 'mt-8' : ''}>
                {content}
              </div>
            </div>
          );
        })}

      </div>

      {/* Customize drawer — rendered outside the scrollable area */}
      {customizerOpen && (
        <DashboardCustomizeDrawer
          order={sectionOrder}
          hidden={hiddenSections}
          onClose={() => setCustomizerOpen(false)}
          onChange={handleLayoutChange}
          onReset={handleLayoutReset}
        />
      )}
    </Layout>
  );
}
