import { useState, useEffect } from 'react';
import { MediaCard } from '../media/MediaCard';
import { MediaTypeSwitcher } from '../ui/MediaTypeSwitcher';
import { tmdbService } from '../../services/tmdb';
import { useToast } from '../../contexts/ToastContext';
import { userSettingsService } from '../../services/userSettings';
import type { Movie, TVShow } from '../../services/tmdb';

type SortOption = 'popularity.desc' | 'vote_average.desc' | 'release_date.desc';

interface GenreResultsProps {
  genreId: number;
  genreName: string;
  onBack: () => void;
}

export function GenreResults({ genreId, genreName, onBack }: GenreResultsProps) {
  const [results, setResults] = useState<Array<Movie | TVShow>>([]);
  const [loading, setLoading] = useState(true);
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popularity.desc');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [englishOnly, setEnglishOnly] = useState(false);
  const toast = useToast();

  useEffect(() => {
    async function loadSettings() {
      const savedEnglishOnly = await userSettingsService.getEnglishOnlyFilter();
      setEnglishOnly(savedEnglishOnly);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    async function loadResults() {
      setLoading(true);
      setPage(1);
      setResults([]);

      try {
        if (mediaType === 'all') {
          const [movieData, tvData] = await Promise.all([
            tmdbService.discover('movie', {
              with_genres: genreId.toString(),
              sort_by: sortBy,
              page: '1',
              'vote_count.gte': '50',
              ...(englishOnly ? { with_original_language: 'en' } : {})
            }),
            tmdbService.discover('tv', {
              with_genres: genreId.toString(),
              sort_by: sortBy === 'release_date.desc' ? 'first_air_date.desc' : sortBy,
              page: '1',
              'vote_count.gte': '50',
              ...(englishOnly ? { with_original_language: 'en' } : {})
            })
          ]);

          const combined = [
            ...(movieData.results || []),
            ...(tvData.results || [])
          ];

          if (sortBy === 'vote_average.desc') {
            combined.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
          }

          setResults(combined.slice(0, 20));
          setHasMore(combined.length >= 20);
        } else {
          const data = await tmdbService.discover(mediaType, {
            with_genres: genreId.toString(),
            sort_by: mediaType === 'tv' && sortBy === 'release_date.desc' ? 'first_air_date.desc' : sortBy,
            page: '1',
            'vote_count.gte': '50',
            ...(englishOnly ? { with_original_language: 'en' } : {})
          });

          setResults(data.results || []);
          setHasMore((data.total_pages || 1) > 1);
        }
      } catch (error) {
        console.error('Error loading genre results:', error);
        toast.error('Failed to load results');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [genreId, mediaType, sortBy, englishOnly, toast]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      if (mediaType === 'all') {
        const [movieData, tvData] = await Promise.all([
          tmdbService.discover('movie', {
            with_genres: genreId.toString(),
            sort_by: sortBy,
            page: nextPage.toString(),
            'vote_count.gte': '50',
            ...(englishOnly ? { with_original_language: 'en' } : {})
          }),
          tmdbService.discover('tv', {
            with_genres: genreId.toString(),
            sort_by: sortBy === 'release_date.desc' ? 'first_air_date.desc' : sortBy,
            page: nextPage.toString(),
            'vote_count.gte': '50',
            ...(englishOnly ? { with_original_language: 'en' } : {})
          })
        ]);

        const combined = [
          ...(movieData.results || []),
          ...(tvData.results || [])
        ];

        if (combined.length > 0) {
          setResults(prev => [...prev, ...combined]);
          setPage(nextPage);
        } else {
          setHasMore(false);
        }
      } else {
        const data = await tmdbService.discover(mediaType, {
          with_genres: genreId.toString(),
          sort_by: mediaType === 'tv' && sortBy === 'release_date.desc' ? 'first_air_date.desc' : sortBy,
          page: nextPage.toString(),
          'vote_count.gte': '50',
          ...(englishOnly ? { with_original_language: 'en' } : {})
        });

        if (data.results && data.results.length > 0) {
          setResults(prev => [...prev, ...data.results]);
          setPage(nextPage);
          setHasMore(nextPage < (data.total_pages || 1));
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading more results:', error);
    } finally {
      setLoadingMore(false);
    }
  };

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
          <h2 className="text-2xl font-bold text-white">{genreName}</h2>
          <p className="text-sm text-gray-400">{results.length} results found</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Filters</h3>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <MediaTypeSwitcher
              value={mediaType}
              onChange={setMediaType}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-full text-white text-sm font-medium hover:border-primary-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Highest Rated</option>
              <option value="release_date.desc">Newly Released</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                mediaType={'title' in item ? 'movie' : 'tv'}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full font-semibold hover:from-primary-600 hover:to-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}

          {results.length === 0 && !loading && (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <p className="text-gray-400">No results found for this category</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
