import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { tmdbService } from '../services/tmdb';
import { preferencesService } from '../services/preferences';
import type { Movie, TVShow } from '../services/tmdb';

// TMDB watch-provider IDs (US region)
const PROVIDERS = [
  { id: 8, name: 'Netflix' },
  { id: 337, name: 'Disney+' },
  { id: 9, name: 'Prime Video' },
  { id: 350, name: 'Apple TV+' },
  { id: 1899, name: 'Max' },
  { id: 15, name: 'Hulu' },
  { id: 531, name: 'Paramount+' },
  { id: 386, name: 'Peacock' },
];

export default function NetworksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [providerId, setProviderId] = useState(PROVIDERS[0].id);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('tv');
  const [results, setResults] = useState<Array<Movie | TVShow>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());

  useEffect(() => {
    if (!user || results.length === 0) return;
    const items = results.map(item => ({
      tmdbId: item.id,
      mediaType: ('title' in item ? 'movie' : 'tv') as 'movie' | 'tv',
    }));
    preferencesService.getPreferencesForItems(items, user.id).then(setPreferenceMap);
  }, [user, results]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setPage(1);
      try {
        const data = await tmdbService.discoverByProvider(mediaType, providerId, 1);
        if (cancelled) return;
        setResults(data.results || []);
        setTotalPages(data.total_pages || 0);
      } catch {
        if (!cancelled) toast.error('Failed to load titles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [providerId, mediaType]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await tmdbService.discoverByProvider(mediaType, providerId, next);
      setResults(prev => [...prev, ...(data.results || [])]);
      setPage(next);
    } catch {
      toast.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, totalPages, mediaType, providerId, toast]);

  const { observerTarget } = useInfiniteScroll({
    hasMore: page < totalPages,
    isLoading: loadingMore,
    onLoadMore: loadMore,
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Networks</h1>
          <p className="text-gray-400 mt-1 text-sm">Browse what's on each streaming service.</p>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setProviderId(p.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                providerId === p.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {(['tv', 'movie'] as const).map(mt => (
            <button
              key={mt}
              onClick={() => setMediaType(mt)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                mediaType === mt
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {mt === 'tv' ? 'TV Shows' : 'Movies'}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonGrid count={18} />
        ) : results.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-white font-medium mb-1">Nothing found</p>
            <p className="text-gray-400 text-sm">Try a different service or switch Movies/TV.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item, index) => {
                const mt = 'title' in item ? 'movie' : 'tv';
                return (
                  <MediaCard
                    key={`${item.id}-${index}`}
                    item={item}
                    mediaType={mt}
                    initialPreference={preferenceMap.get(`${item.id}-${mt}`) ?? null}
                  />
                );
              })}
            </div>
            {page < totalPages && (
              <div ref={observerTarget} className="mt-8">
                {loadingMore && <SkeletonGrid count={12} />}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
