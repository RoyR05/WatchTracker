import { useState, useEffect, useCallback } from 'react';
import { MediaCard } from '../media/MediaCard';
import { SkeletonGrid } from '../ui/Skeleton';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { tmdbService } from '../../services/tmdb';
import { preferencesService } from '../../services/preferences';
import type { Movie, TVShow } from '../../services/tmdb';

interface NetworkResultsProps {
  providerId: number;
  providerName: string;
  onBack: () => void;
}

export function NetworkResults({ providerId, providerName, onBack }: NetworkResultsProps) {
  const { user } = useAuth();
  const toast = useToast();
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
  }, [providerId, mediaType, toast]);

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-primary-500 transition-all duration-200 text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{providerName}</h2>
          <p className="text-sm text-gray-400">Browse the catalog</p>
        </div>
      </div>

      <div className="flex gap-2">
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
          <p className="text-gray-400 text-sm">Try switching Movies/TV.</p>
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
  );
}
