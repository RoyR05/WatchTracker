import { useEffect, useState, useRef, useCallback } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { GestureTutorial } from '../components/ui/GestureTutorial';
import { MediaTypeSwitcher } from '../components/ui/MediaTypeSwitcher';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { useToast } from '../contexts/ToastContext';
import { tmdbService } from '../services/tmdb';
import { userSettingsService } from '../services/userSettings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { queryKeys } from '../lib/queryKeys';
import type { Movie, TVShow, MovieDetails, TVShowDetails } from '../services/tmdb';

export default function Dashboard() {
  const { user } = useAuth();
  const [timeWindow, setTimeWindow] = useState<'day' | 'week'>('week');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [englishOnly, setEnglishOnly] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const anticipatedScrollRef = useRef<HTMLDivElement>(null);
  const popularScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [canScrollLeftAnticipated, setCanScrollLeftAnticipated] = useState(false);
  const [canScrollRightAnticipated, setCanScrollRightAnticipated] = useState(true);
  const [canScrollLeftPopular, setCanScrollLeftPopular] = useState(false);
  const [canScrollRightPopular, setCanScrollRightPopular] = useState(true);
  const toast = useToast();

  useEffect(() => {
    async function loadUserSettings() {
      if (!user) return;
      const savedEnglishOnly = await userSettingsService.getEnglishOnlyFilter();
      setEnglishOnly(savedEnglishOnly);
      setSettingsLoaded(true);
    }
    loadUserSettings();
  }, [user]);

  const trendingQuery = useInfiniteQuery({
    queryKey: queryKeys.trending(mediaType, timeWindow, englishOnly),
    queryFn: ({ pageParam = 1 }) => tmdbService.getTrending(mediaType, timeWindow, pageParam, englishOnly),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || allPages.length >= lastPage.total_pages) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && settingsLoaded,
  });

  const anticipatedQuery = useInfiniteQuery({
    queryKey: queryKeys.anticipated(mediaType, englishOnly),
    queryFn: ({ pageParam = 1 }) => tmdbService.getAnticipated(mediaType, pageParam, englishOnly),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || allPages.length >= lastPage.total_pages) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && settingsLoaded,
  });

  const popularQuery = useInfiniteQuery({
    queryKey: queryKeys.popular(mediaType, englishOnly),
    queryFn: ({ pageParam = 1 }) => tmdbService.getPopular(mediaType, pageParam, englishOnly),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || allPages.length >= lastPage.total_pages) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && settingsLoaded,
  });

  const watchingQuery = useQuery({
    queryKey: queryKeys.watchlist(user?.id || '', 'watching'),
    queryFn: async () => {
      const { data } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'watching')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return [];

      const mediaDetails = await Promise.all(
        data.map(async (item) => {
          try {
            const details = item.media_type === 'movie'
              ? await tmdbService.getMovieDetails(item.tmdb_id)
              : await tmdbService.getTVShowDetails(item.tmdb_id);
            return { media: details, mediaType: item.media_type as 'movie' | 'tv' };
          } catch {
            return null;
          }
        })
      );
      return mediaDetails.filter((item): item is { media: MovieDetails | TVShowDetails; mediaType: 'movie' | 'tv' } => item !== null);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const planToWatchQuery = useQuery({
    queryKey: queryKeys.watchlist(user?.id || '', 'plan_to_watch'),
    queryFn: async () => {
      const { data } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'plan_to_watch')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return [];

      const mediaDetails = await Promise.all(
        data.map(async (item) => {
          try {
            const details = item.media_type === 'movie'
              ? await tmdbService.getMovieDetails(item.tmdb_id)
              : await tmdbService.getTVShowDetails(item.tmdb_id);
            return { media: details, mediaType: item.media_type as 'movie' | 'tv' };
          } catch {
            return null;
          }
        })
      );
      return mediaDetails.filter((item): item is { media: MovieDetails | TVShowDetails; mediaType: 'movie' | 'tv' } => item !== null);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const trending = trendingQuery.data?.pages.flatMap(p => p?.results || []) || [];
  const anticipated = anticipatedQuery.data?.pages.flatMap(p => p?.results || []) || [];
  const popular = popularQuery.data?.pages.flatMap(p => p?.results || []) || [];
  const watchingMedia = watchingQuery.data || [];
  const planToWatchMedia = planToWatchQuery.data || [];

  const loading = !settingsLoaded || (trendingQuery.isLoading && watchingQuery.isLoading);

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scrollLeftFn = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: -(container.clientWidth * 0.8), behavior: 'smooth' });
  };

  const scrollRightFn = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
  };

  const updateScrollButtonsAnticipated = useCallback(() => {
    const container = anticipatedScrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeftAnticipated(scrollLeft > 0);
    setCanScrollRightAnticipated(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scrollLeftAnticipated = () => {
    const container = anticipatedScrollRef.current;
    if (!container) return;
    container.scrollBy({ left: -(container.clientWidth * 0.8), behavior: 'smooth' });
  };

  const scrollRightAnticipated = () => {
    const container = anticipatedScrollRef.current;
    if (!container) return;
    container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
  };

  const updateScrollButtonsPopular = useCallback(() => {
    const container = popularScrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeftPopular(scrollLeft > 0);
    setCanScrollRightPopular(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scrollLeftPopular = () => {
    const container = popularScrollRef.current;
    if (!container) return;
    container.scrollBy({ left: -(container.clientWidth * 0.8), behavior: 'smooth' });
  };

  const scrollRightPopular = () => {
    const container = popularScrollRef.current;
    if (!container) return;
    container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

      if (scrollPercentage > 0.8 && trendingQuery.hasNextPage && !trendingQuery.isFetchingNextPage) {
        trendingQuery.fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll);
    updateScrollButtons();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [trendingQuery.hasNextPage, trendingQuery.isFetchingNextPage, updateScrollButtons]);

  useEffect(() => { updateScrollButtons(); }, [trending, updateScrollButtons]);

  useEffect(() => {
    const container = anticipatedScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
      setCanScrollLeftAnticipated(scrollLeft > 0);
      setCanScrollRightAnticipated(scrollLeft < scrollWidth - clientWidth - 10);

      if (scrollPercentage > 0.8 && anticipatedQuery.hasNextPage && !anticipatedQuery.isFetchingNextPage) {
        anticipatedQuery.fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll);
    updateScrollButtonsAnticipated();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [anticipatedQuery.hasNextPage, anticipatedQuery.isFetchingNextPage, updateScrollButtonsAnticipated]);

  useEffect(() => { updateScrollButtonsAnticipated(); }, [anticipated, updateScrollButtonsAnticipated]);

  useEffect(() => {
    const container = popularScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
      setCanScrollLeftPopular(scrollLeft > 0);
      setCanScrollRightPopular(scrollLeft < scrollWidth - clientWidth - 10);

      if (scrollPercentage > 0.8 && popularQuery.hasNextPage && !popularQuery.isFetchingNextPage) {
        popularQuery.fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll);
    updateScrollButtonsPopular();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [popularQuery.hasNextPage, popularQuery.isFetchingNextPage, updateScrollButtonsPopular]);

  useEffect(() => { updateScrollButtonsPopular(); }, [popular, updateScrollButtonsPopular]);

  if (loading) {
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
        <CollapsibleSection
          id="currently-watching"
          title="Currently Watching"
          itemCount={watchingMedia.length}
        >
          {watchingMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchingMedia.map((item) => (
                <div key={item.media.id} className="relative">
                  <div className="absolute top-2 right-2 z-10 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                    Watching
                  </div>
                  <MediaCard
                    item={item.media}
                    mediaType={item.mediaType}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No items in your watchlist yet. Start adding some content!</p>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="plan-to-watch"
          title="Plan to Watch"
          itemCount={planToWatchMedia.length}
        >
          {planToWatchMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {planToWatchMedia.map((item) => (
                <div key={item.media.id} className="relative">
                  <div className="absolute top-2 right-2 z-10 bg-amber-600 text-white text-xs px-2 py-1 rounded">
                    Plan to Watch
                  </div>
                  <MediaCard
                    item={item.media}
                    mediaType={item.mediaType}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No items in your plan to watch list. Swipe right on content to add it!</p>
            </div>
          )}
        </CollapsibleSection>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Discovery Filters</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <MediaTypeSwitcher
                value={mediaType}
                onChange={setMediaType}
              />
              <div className="relative inline-flex items-center bg-gray-800 rounded-full p-1 border border-gray-700">
                <button
                  onClick={() => setTimeWindow('day')}
                  className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                    timeWindow === 'day'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {timeWindow === 'day' && (
                    <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full shadow-lg" />
                  )}
                  <span className="relative z-10">Today</span>
                </button>
                <button
                  onClick={() => setTimeWindow('week')}
                  className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                    timeWindow === 'week'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {timeWindow === 'week' && (
                    <span className="absolute inset-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full shadow-lg" />
                  )}
                  <span className="relative z-10">This Week</span>
                </button>
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

        <CollapsibleSection
          id="trending"
          title="Trending"
          itemCount={trending.length}
        >
          <div className="hidden md:flex items-center gap-2 mb-4">
            <button
              onClick={scrollLeftFn}
              disabled={!canScrollLeft}
              className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
                canScrollLeft
                  ? 'hover:bg-gray-700 hover:border-primary-500 text-white'
                  : 'opacity-40 cursor-not-allowed text-gray-600'
              }`}
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollRightFn}
              disabled={!canScrollRight}
              className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
                canScrollRight
                  ? 'hover:bg-gray-700 hover:border-primary-500 text-white'
                  : 'opacity-40 cursor-not-allowed text-gray-600'
              }`}
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-sm text-gray-400 ml-2">
              {canScrollRight ? 'Scroll to see more' : 'End of trending'}
            </span>
          </div>
          {trendingQuery.isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            >
              {trending.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                  <MediaCard
                    item={item}
                    mediaType={'title' in item ? 'movie' : 'tv'}
                  />
                </div>
              ))}
              {trendingQuery.hasNextPage && !trendingQuery.isFetchingNextPage && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <button
                    onClick={() => trendingQuery.fetchNextPage()}
                    className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-base font-semibold">Load More</span>
                  </button>
                </div>
              )}
              {trendingQuery.isFetchingNextPage && (
                <div className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              )}
              {!trendingQuery.hasNextPage && trending.length > 0 && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <div className="text-gray-500 text-sm text-center px-4">
                    End of trending
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="anticipated"
          title="Anticipated"
          itemCount={anticipated.length}
        >
          <div className="hidden md:flex items-center gap-2 mb-4">
            <button
              onClick={scrollLeftAnticipated}
              disabled={!canScrollLeftAnticipated}
              className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
                canScrollLeftAnticipated
                  ? 'hover:bg-gray-700 hover:border-primary-500 text-white'
                  : 'opacity-40 cursor-not-allowed text-gray-600'
              }`}
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollRightAnticipated}
              disabled={!canScrollRightAnticipated}
              className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
                canScrollRightAnticipated
                  ? 'hover:bg-gray-700 hover:border-primary-500 text-white'
                  : 'opacity-40 cursor-not-allowed text-gray-600'
              }`}
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-sm text-gray-400 ml-2">
              {canScrollRightAnticipated ? 'Scroll to see more' : 'End of anticipated'}
            </span>
          </div>
          {anticipatedQuery.isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={anticipatedScrollRef}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            >
              {anticipated.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                  <MediaCard
                    item={item}
                    mediaType={'title' in item ? 'movie' : 'tv'}
                  />
                </div>
              ))}
              {anticipatedQuery.hasNextPage && !anticipatedQuery.isFetchingNextPage && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <button
                    onClick={() => anticipatedQuery.fetchNextPage()}
                    className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-base font-semibold">Load More</span>
                  </button>
                </div>
              )}
              {anticipatedQuery.isFetchingNextPage && (
                <div className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              )}
              {!anticipatedQuery.hasNextPage && anticipated.length > 0 && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <div className="text-gray-500 text-sm text-center px-4">
                    End of anticipated
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="popular"
          title="Popular"
          itemCount={popular.length}
        >
          <div className="hidden md:flex items-center gap-2 mb-4">
            <button
              onClick={scrollLeftPopular}
              disabled={!canScrollLeftPopular}
              className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
                canScrollLeftPopular
                  ? 'hover:bg-gray-700 hover:border-primary-500 text-white'
                  : 'opacity-40 cursor-not-allowed text-gray-600'
              }`}
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollRightPopular}
              disabled={!canScrollRightPopular}
              className={`p-2 rounded-lg bg-gray-800 border border-gray-700 transition-all duration-200 ${
                canScrollRightPopular
                  ? 'hover:bg-gray-700 hover:border-primary-500 text-white'
                  : 'opacity-40 cursor-not-allowed text-gray-600'
              }`}
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-sm text-gray-400 ml-2">
              {canScrollRightPopular ? 'Scroll to see more' : 'End of popular'}
            </span>
          </div>
          {popularQuery.isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={popularScrollRef}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            >
              {popular.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-40 sm:w-48 snap-start">
                  <MediaCard
                    item={item}
                    mediaType={'title' in item ? 'movie' : 'tv'}
                  />
                </div>
              ))}
              {popularQuery.hasNextPage && !popularQuery.isFetchingNextPage && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <button
                    onClick={() => popularQuery.fetchNextPage()}
                    className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-base font-semibold">Load More</span>
                  </button>
                </div>
              )}
              {popularQuery.isFetchingNextPage && (
                <div className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              )}
              {!popularQuery.hasNextPage && popular.length > 0 && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <div className="text-gray-500 text-sm text-center px-4">
                    End of popular
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </Layout>
  );
}
