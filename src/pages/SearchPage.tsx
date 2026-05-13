import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { tmdbService } from '../services/tmdb';
import { preferencesService } from '../services/preferences';
import type { Movie, TVShow } from '../services/tmdb';

type MediaFilter = 'all' | 'movie' | 'tv';

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [results, setResults] = useState<Array<Movie | TVShow>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const toast = useToast();

  useEffect(() => {
    if (!user || results.length === 0) return;
    const items = results.map(item => ({
      tmdbId: item.id,
      mediaType: ('title' in item ? 'movie' : 'tv') as 'movie' | 'tv',
    }));
    preferencesService.getPreferencesForItems(items, user.id).then(setPreferenceMap);
  }, [user, results]);

  const filteredResults = mediaFilter === 'all'
    ? results
    : results.filter(item =>
        mediaFilter === 'movie' ? 'title' in item : 'name' in item
      );

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setCurrentPage(1);
    try {
      const data = await tmdbService.searchMulti(query, 1);
      const filtered = (data.results as any[]).filter(
        item => item.media_type === 'movie' || item.media_type === 'tv'
      );
      setResults(filtered);
      setTotalPages(data.total_pages);
      if (filtered.length === 0) toast.info('No results found. Try a different search term.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to search');
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loadingMore || currentPage >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await tmdbService.searchMulti(query, nextPage);
      const filtered = (data.results as any[]).filter(
        item => item.media_type === 'movie' || item.media_type === 'tv'
      );
      setResults(prev => [...prev, ...filtered]);
      setCurrentPage(nextPage);
    } catch {
      toast.error('Failed to load more results');
    } finally {
      setLoadingMore(false);
    }
  }

  const { observerTarget } = useInfiniteScroll({
    hasMore: currentPage < totalPages,
    isLoading: loadingMore,
    onLoadMore: loadMore,
  });

  const filterButtons: { label: string; value: MediaFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Movies', value: 'movie' },
    { label: 'TV Shows', value: 'tv' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Search</h1>

        <form onSubmit={handleSearch} className="mb-4">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search movies, TV shows..."
              className="w-full px-4 py-3 pl-12 pr-28 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors text-sm font-medium"
            >
              Search
            </button>
          </div>
        </form>

        {/* Media type filter — only show after a search */}
        {searched && (
          <div className="flex gap-2 mb-6">
            {filterButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => setMediaFilter(btn.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  mediaFilter === btn.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {btn.label}
                {btn.value !== 'all' && results.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({results.filter(r => btn.value === 'movie' ? 'title' in r : 'name' in r).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading && <SkeletonGrid count={20} />}

        {!loading && filteredResults.length > 0 && (
          <div>
            <p className="text-gray-400 mb-4 text-sm">
              {filteredResults.length}{mediaFilter !== 'all' ? ` ${mediaFilter === 'movie' ? 'movie' : 'TV show'}` : ''} result{filteredResults.length !== 1 ? 's' : ''}
              {currentPage < totalPages && ` · page ${currentPage} of ${totalPages}`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredResults.map((item, index) => {
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
            {currentPage < totalPages && (
              <div ref={observerTarget} className="mt-8">
                {loadingMore && <SkeletonGrid count={12} />}
              </div>
            )}
          </div>
        )}

        {!loading && searched && filteredResults.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-white font-medium mb-1">No results found</p>
            <p className="text-gray-400 text-sm">
              {mediaFilter !== 'all'
                ? `No ${mediaFilter === 'movie' ? 'movies' : 'TV shows'} matched "${query}". Try switching the filter to All.`
                : `No results for "${query}". Try different keywords.`}
            </p>
          </div>
        )}

        {!searched && !loading && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-white font-medium mb-1">Search for anything</p>
            <p className="text-gray-400 text-sm">Find movies and TV shows to add to your watchlist</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
