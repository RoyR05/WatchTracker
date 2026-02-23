import { useEffect, useState, useRef, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { GestureTutorial } from '../components/ui/GestureTutorial';
import { FeelingLucky } from '../components/discovery/FeelingLucky';
import { MoodDiscovery } from '../components/discovery/MoodDiscovery';
import { MediaTypeSwitcher } from '../components/ui/MediaTypeSwitcher';
import { CollapsibleSection } from '../components/ui/CollapsibleSection';
import { useToast } from '../contexts/ToastContext';
import { useProfile } from '../contexts/ProfileContext';
import { tmdbService } from '../services/tmdb';
import { userSettingsService } from '../services/userSettings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Movie, TVShow, MovieDetails, TVShowDetails } from '../services/tmdb';
import type { Database } from '../types/database.types';

type WatchlistItem = Database['public']['Tables']['watchlist_items']['Row'];

export default function Dashboard() {
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const [trending, setTrending] = useState<Array<Movie | TVShow>>([]);
  const [anticipated, setAnticipated] = useState<Array<Movie | TVShow>>([]);
  const [popular, setPopular] = useState<Array<Movie | TVShow>>([]);
  const [watchingMedia, setWatchingMedia] = useState<Array<{ media: MovieDetails | TVShowDetails; mediaType: 'movie' | 'tv' }>>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<'day' | 'week'>('week');
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [englishOnly, setEnglishOnly] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingAnticipated, setLoadingAnticipated] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [trendingPage, setTrendingPage] = useState(1);
  const [anticipatedPage, setAnticipatedPage] = useState(1);
  const [popularPage, setPopularPage] = useState(1);
  const [hasMoreTrending, setHasMoreTrending] = useState(true);
  const [hasMoreAnticipated, setHasMoreAnticipated] = useState(true);
  const [hasMorePopular, setHasMorePopular] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreAnticipated, setLoadingMoreAnticipated] = useState(false);
  const [loadingMorePopular, setLoadingMorePopular] = useState(false);
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

  const loadMoreTrending = useCallback(async () => {
    if (loadingMore || !hasMoreTrending) return;

    setLoadingMore(true);
    try {
      const nextPage = trendingPage + 1;
      const trendingData = await tmdbService.getTrending(mediaType, timeWindow, nextPage, englishOnly);

      if (trendingData && trendingData.results && trendingData.results.length > 0) {
        setTrending(prev => [...prev, ...trendingData.results]);
        setTrendingPage(nextPage);

        if (nextPage >= trendingData.total_pages || trendingData.results.length === 0) {
          setHasMoreTrending(false);
        }
      } else {
        setHasMoreTrending(false);
      }
    } catch (error) {
      console.error('Error loading more trending:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreTrending, trendingPage, timeWindow, mediaType, englishOnly]);

  const loadMoreAnticipated = useCallback(async () => {
    if (loadingMoreAnticipated || !hasMoreAnticipated) return;

    setLoadingMoreAnticipated(true);
    try {
      const nextPage = anticipatedPage + 1;
      const data = await tmdbService.getAnticipated(mediaType, nextPage, englishOnly);

      if (data && data.results && data.results.length > 0) {
        setAnticipated(prev => [...prev, ...data.results]);
        setAnticipatedPage(nextPage);

        if (nextPage >= data.total_pages || data.results.length === 0) {
          setHasMoreAnticipated(false);
        }
      } else {
        setHasMoreAnticipated(false);
      }
    } catch (error) {
      console.error('Error loading more anticipated:', error);
    } finally {
      setLoadingMoreAnticipated(false);
    }
  }, [loadingMoreAnticipated, hasMoreAnticipated, anticipatedPage, mediaType, englishOnly]);

  const loadMorePopular = useCallback(async () => {
    if (loadingMorePopular || !hasMorePopular) return;

    setLoadingMorePopular(true);
    try {
      const nextPage = popularPage + 1;
      const data = await tmdbService.getPopular(mediaType, nextPage, englishOnly);

      if (data && data.results && data.results.length > 0) {
        setPopular(prev => [...prev, ...data.results]);
        setPopularPage(nextPage);

        if (nextPage >= data.total_pages || data.results.length === 0) {
          setHasMorePopular(false);
        }
      } else {
        setHasMorePopular(false);
      }
    } catch (error) {
      console.error('Error loading more popular:', error);
    } finally {
      setLoadingMorePopular(false);
    }
  }, [loadingMorePopular, hasMorePopular, popularPage, mediaType, englishOnly]);

  useEffect(() => {
    async function loadUserSettings() {
      if (!user) return;
      const savedEnglishOnly = await userSettingsService.getEnglishOnlyFilter();
      setEnglishOnly(savedEnglishOnly);
    }

    loadUserSettings();
  }, [user]);

  useEffect(() => {
    async function loadDashboard() {
      if (!currentProfile) return;

      try {
        const trendingPromise = tmdbService.getTrending(mediaType, timeWindow, 1, englishOnly);
        const anticipatedPromise = tmdbService.getAnticipated(mediaType, 1, englishOnly);
        const popularPromise = tmdbService.getPopular(mediaType, 1, englishOnly);
        const watchlistPromise = supabase
          .from('watchlist_items')
          .select('*')
          .eq('profile_id', currentProfile.id)
          .eq('status', 'watching')
          .order('updated_at', { ascending: false })
          .limit(10);

        const [trendingData, anticipatedData, popularData, watchlistData] = await Promise.all([
          trendingPromise,
          anticipatedPromise,
          popularPromise,
          watchlistPromise
        ]);

        if (trendingData && trendingData.results) {
          setTrending(trendingData.results);
          setTrendingPage(1);
          setHasMoreTrending(trendingData.total_pages > 1);
        }

        if (anticipatedData && anticipatedData.results) {
          setAnticipated(anticipatedData.results);
          setAnticipatedPage(1);
          setHasMoreAnticipated(anticipatedData.total_pages > 1);
        }

        if (popularData && popularData.results) {
          setPopular(popularData.results);
          setPopularPage(1);
          setHasMorePopular(popularData.total_pages > 1);
        }

        if (watchlistData.data && watchlistData.data.length > 0) {
          const mediaDetails = await Promise.all(
            watchlistData.data.map(async (item) => {
              try {
                const details = item.media_type === 'movie'
                  ? await tmdbService.getMovieDetails(item.tmdb_id)
                  : await tmdbService.getTVShowDetails(item.tmdb_id);
                return { media: details, mediaType: item.media_type };
              } catch (error) {
                console.error(`Error loading details for ${item.media_type} ${item.tmdb_id}:`, error);
                return null;
              }
            })
          );
          setWatchingMedia(mediaDetails.filter((item): item is { media: MovieDetails | TVShowDetails; mediaType: 'movie' | 'tv' } => item !== null));
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    if (user && currentProfile) {
      loadDashboard();
    } else if (user && !currentProfile) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [user, currentProfile, englishOnly]);

  useEffect(() => {
    async function loadTrending() {
      if (!currentProfile) return;
      setLoadingTrending(true);
      setTrendingPage(1);
      setHasMoreTrending(true);
      try {
        const trendingData = await tmdbService.getTrending(mediaType, timeWindow, 1, englishOnly);
        if (trendingData && trendingData.results) {
          setTrending(trendingData.results);
          setHasMoreTrending(trendingData.total_pages > 1);
        }
      } catch (error) {
        console.error('Error loading trending:', error);
      } finally {
        setLoadingTrending(false);
      }
    }

    loadTrending();
  }, [timeWindow, mediaType]);

  useEffect(() => {
    async function loadAnticipated() {
      setLoadingAnticipated(true);
      setAnticipatedPage(1);
      setHasMoreAnticipated(true);
      try {
        const data = await tmdbService.getAnticipated(mediaType, 1, englishOnly);
        if (data && data.results) {
          setAnticipated(data.results);
          setHasMoreAnticipated(data.total_pages > 1);
        }
      } catch (error) {
        console.error('Error loading anticipated:', error);
      } finally {
        setLoadingAnticipated(false);
      }
    }

    if (currentProfile) {
      loadAnticipated();
    }
  }, [mediaType, currentProfile]);

  useEffect(() => {
    async function loadPopular() {
      setLoadingPopular(true);
      setPopularPage(1);
      setHasMorePopular(true);
      try {
        const data = await tmdbService.getPopular(mediaType, 1, englishOnly);
        if (data && data.results) {
          setPopular(data.results);
          setHasMorePopular(data.total_pages > 1);
        }
      } catch (error) {
        console.error('Error loading popular:', error);
      } finally {
        setLoadingPopular(false);
      }
    }

    if (currentProfile) {
      loadPopular();
    }
  }, [mediaType, currentProfile]);

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
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

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const scrollRightAnticipated = () => {
    const container = anticipatedScrollRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
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

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const scrollRightPopular = () => {
    const container = popularScrollRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;

      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

      if (scrollPercentage > 0.8 && hasMoreTrending && !loadingMore) {
        loadMoreTrending();
      }
    };

    container.addEventListener('scroll', handleScroll);
    updateScrollButtons();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreTrending, loadingMore, loadMoreTrending, updateScrollButtons]);

  useEffect(() => {
    updateScrollButtons();
  }, [trending, updateScrollButtons]);

  useEffect(() => {
    const container = anticipatedScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;

      setCanScrollLeftAnticipated(scrollLeft > 0);
      setCanScrollRightAnticipated(scrollLeft < scrollWidth - clientWidth - 10);

      if (scrollPercentage > 0.8 && hasMoreAnticipated && !loadingMoreAnticipated) {
        loadMoreAnticipated();
      }
    };

    container.addEventListener('scroll', handleScroll);
    updateScrollButtonsAnticipated();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreAnticipated, loadingMoreAnticipated, loadMoreAnticipated, updateScrollButtonsAnticipated]);

  useEffect(() => {
    updateScrollButtonsAnticipated();
  }, [anticipated, updateScrollButtonsAnticipated]);

  useEffect(() => {
    const container = popularScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const scrollPercentage = (scrollLeft + clientWidth) / scrollWidth;

      setCanScrollLeftPopular(scrollLeft > 0);
      setCanScrollRightPopular(scrollLeft < scrollWidth - clientWidth - 10);

      if (scrollPercentage > 0.8 && hasMorePopular && !loadingMorePopular) {
        loadMorePopular();
      }
    };

    container.addEventListener('scroll', handleScroll);
    updateScrollButtonsPopular();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMorePopular, loadingMorePopular, loadMorePopular, updateScrollButtonsPopular]);

  useEffect(() => {
    updateScrollButtonsPopular();
  }, [popular, updateScrollButtonsPopular]);

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

        <section className="flex justify-center">
          <FeelingLucky />
        </section>

        <MoodDiscovery />

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

          {/* Desktop Navigation Arrows */}
          <div className="hidden md:flex items-center gap-2 mb-4">
            <button
              onClick={scrollLeft}
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
              onClick={scrollRight}
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
          {loadingTrending ? (
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
              {(hasMoreTrending || trendingPage === 1) && !loadingMore && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <button
                    onClick={loadMoreTrending}
                    className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-base font-semibold">Load More</span>
                    <span className="text-xs text-gray-400">Page {trendingPage + 1}</span>
                  </button>
                </div>
              )}
              {loadingMore && (
                <div className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              )}
              {!hasMoreTrending && trending.length > 0 && (
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
          {loadingAnticipated ? (
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
              {(hasMoreAnticipated || anticipatedPage === 1) && !loadingMoreAnticipated && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <button
                    onClick={loadMoreAnticipated}
                    className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-base font-semibold">Load More</span>
                    <span className="text-xs text-gray-400">Page {anticipatedPage + 1}</span>
                  </button>
                </div>
              )}
              {loadingMoreAnticipated && (
                <div className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              )}
              {!hasMoreAnticipated && anticipated.length > 0 && (
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
          {loadingPopular ? (
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
              {(hasMorePopular || popularPage === 1) && !loadingMorePopular && (
                <div className="flex-shrink-0 w-40 sm:w-48 flex items-center justify-center">
                  <button
                    onClick={loadMorePopular}
                    className="w-full h-full min-h-[240px] bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg border-2 border-dashed border-gray-600 hover:border-primary-500 transition-all duration-200 flex flex-col items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-base font-semibold">Load More</span>
                    <span className="text-xs text-gray-400">Page {popularPage + 1}</span>
                  </button>
                </div>
              )}
              {loadingMorePopular && (
                <div className="flex-shrink-0 w-40 sm:w-48">
                  <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                </div>
              )}
              {!hasMorePopular && popular.length > 0 && (
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
