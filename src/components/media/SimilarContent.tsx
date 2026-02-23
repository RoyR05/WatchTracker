import { useState, useEffect } from 'react';
import { MediaCard } from './MediaCard';
import { tmdbService, type Movie, type TVShow } from '../../services/tmdb';

interface SimilarContentProps {
  mediaType: 'movie' | 'tv';
  mediaId: number;
}

export function SimilarContent({ mediaType, mediaId }: SimilarContentProps) {
  const [similar, setSimilar] = useState<Array<Movie | TVShow>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadSimilar() {
      try {
        setLoading(true);
        setError(false);
        const data = mediaType === 'movie'
          ? await tmdbService.getSimilarMovies(mediaId)
          : await tmdbService.getSimilarTVShows(mediaId);

        setSimilar((data.results || []).slice(0, 12));
      } catch (err) {
        console.error('Failed to load similar content:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadSimilar();
  }, [mediaId, mediaType]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Similar {mediaType === 'movie' ? 'Movies' : 'TV Shows'}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || similar.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">
        Similar {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {similar.map((item) => (
          <MediaCard
            key={item.id}
            id={item.id}
            title={'title' in item ? item.title : item.name}
            posterPath={item.poster_path}
            mediaType={mediaType}
            rating={item.vote_average}
          />
        ))}
      </div>
    </div>
  );
}
