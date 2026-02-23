import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useToast } from '../contexts/ToastContext';
import { tmdbService } from '../services/tmdb';
import type { Movie, TVShow } from '../services/tmdb';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<Movie | TVShow>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const toast = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setCurrentPage(1);
    try {
      const data = await tmdbService.searchMulti(query, 1);
      const filteredResults = data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
      setResults(filteredResults);
      setTotalPages(data.total_pages);
      if (filteredResults.length === 0) {
        toast.info('No results found. Try a different search term.');
      }
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
      const filteredResults = data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
      setResults(prev => [...prev, ...filteredResults]);
      setCurrentPage(nextPage);
    } catch (error) {
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Search Movies & TV Shows</h1>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for movies, TV shows..."
              className="w-full px-4 py-3 pl-12 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {loading && <SkeletonGrid count={20} />}

        {!loading && results.length > 0 && (
          <div>
            <p className="text-gray-400 mb-4">
              {results.length} results found
              {currentPage < totalPages && ` (Page ${currentPage} of ${totalPages})`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item, index) => (
                <MediaCard
                  key={`${item.id}-${index}`}
                  item={item}
                  mediaType={'title' in item ? 'movie' : 'tv'}
                />
              ))}
            </div>
            {currentPage < totalPages && (
              <div ref={observerTarget} className="mt-8">
                {loadingMore && <SkeletonGrid count={12} />}
              </div>
            )}
          </div>
        )}

        {!searched && !loading && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-gray-400">Start searching for your favorite movies and TV shows</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
