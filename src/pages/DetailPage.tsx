import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { SimilarContent } from '../components/media/SimilarContent';
import { tmdbService } from '../services/tmdb';
import { useToast } from '../contexts/ToastContext';
import type { MovieDetails, TVShowDetails } from '../services/tmdb';

export default function DetailPage() {
  const { mediaType, id } = useParams<{ mediaType: 'movie' | 'tv'; id: string }>();
  const toast = useToast();
  const [details, setDetails] = useState<MovieDetails | TVShowDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetails() {
      if (!mediaType || !id) return;
      try {
        setLoading(true);
        const data = mediaType === 'movie'
          ? await tmdbService.getMovieDetails(parseInt(id))
          : await tmdbService.getTVShowDetails(parseInt(id));
        setDetails(data);
      } catch (error) {
        toast.error('Failed to load details');
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [id, mediaType, toast]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8">Loading...</div>
      </Layout>
    );
  }

  if (!details) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p>Content not found</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300">Back to search</Link>
        </div>
      </Layout>
    );
  }

  const title = 'title' in details ? details.title : details.name;
  const releaseDate = 'release_date' in details ? details.release_date : details.first_air_date;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">← Back to search</Link>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="md:col-span-1">
            <img
              src={tmdbService.getImageUrl(details.poster_path)}
              alt={title}
              className="w-full rounded-lg"
            />
          </div>

          <div className="md:col-span-3">
            <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
            <div className="flex items-center gap-4 mb-4 text-gray-300">
              <span>Rating: {details.vote_average.toFixed(1)}/10</span>
              <span className="text-gray-500">|</span>
              <span>{releaseDate}</span>
            </div>

            {details.genres && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {details.genres.map(genre => (
                    <span key={genre.id} className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                      {genre.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {'runtime' in details && details.runtime > 0 && (
              <p className="text-gray-300 mb-4">Runtime: {details.runtime} minutes</p>
            )}

            {'number_of_seasons' in details && (
              <p className="text-gray-300 mb-4">Seasons: {details.number_of_seasons}</p>
            )}

            <p className="text-gray-300 leading-relaxed">
              {details.overview}
            </p>
          </div>
        </div>

        {mediaType && id && (
          <div className="mt-12">
            <SimilarContent mediaType={mediaType as 'movie' | 'tv'} mediaId={parseInt(id)} />
          </div>
        )}
      </div>
    </Layout>
  );
}
