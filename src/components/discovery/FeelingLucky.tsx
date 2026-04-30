import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { tmdbService } from '../../services/tmdb';

export const FeelingLucky = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleFeelingLucky = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const popularGenres = ['28', '35', '18', '878', '53', '27', '10749', '16'];
      const selectedGenres = [popularGenres[Math.floor(Math.random() * popularGenres.length)]];

      const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';

      const discoverResults = await tmdbService.discover(
        mediaType,
        {
          with_genres: selectedGenres.join(','),
          sort_by: 'vote_average.desc',
          'vote_count.gte': mediaType === 'movie' ? '500' : '100',
          page: String(Math.floor(Math.random() * 5) + 1)
        }
      );

      if (discoverResults && discoverResults.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(10, discoverResults.results.length));
        const selected = discoverResults.results[randomIndex];
        navigate(`/details/${mediaType}/${selected.id}`);
      } else {
        const fallbackResults = await tmdbService.getTrending(mediaType, 'week', 1);
        if (fallbackResults && fallbackResults.results.length > 0) {
          const randomIndex = Math.floor(Math.random() * fallbackResults.results.length);
          const selected = fallbackResults.results[randomIndex];
          navigate(`/details/${mediaType}/${selected.id}`);
        }
      }
    } catch (error) {
      console.error('Error in Feeling Lucky:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleFeelingLucky}
      disabled={loading}
      className="group relative overflow-hidden bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-700 hover:via-cyan-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
      <div className="relative flex items-center gap-3">
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Finding something...</span>
          </>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>I'm Feeling Lucky</span>
          </>
        )}
      </div>
    </button>
  );
};
