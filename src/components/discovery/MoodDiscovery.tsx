import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import type { Movie, TVShow } from '../../services/tmdb';

interface Mood {
  id: string;
  label: string;
  emoji: string;
  genres: string[];
  description: string;
}

const MOODS: Mood[] = [
  {
    id: 'chill',
    label: 'Chill & Relax',
    emoji: '😌',
    genres: ['35', '10751', '16'],
    description: 'Light comedies and feel-good content'
  },
  {
    id: 'excited',
    label: 'Action Packed',
    emoji: '🔥',
    genres: ['28', '12', '878'],
    description: 'High-octane action and adventure'
  },
  {
    id: 'emotional',
    label: 'Emotional',
    emoji: '😢',
    genres: ['18', '10749'],
    description: 'Drama and romance that touches the heart'
  },
  {
    id: 'scared',
    label: 'Thrill Me',
    emoji: '😱',
    genres: ['27', '53', '9648'],
    description: 'Horror, thriller, and mystery'
  },
  {
    id: 'laugh',
    label: 'Make Me Laugh',
    emoji: '😂',
    genres: ['35'],
    description: 'Pure comedy gold'
  },
  {
    id: 'think',
    label: 'Make Me Think',
    emoji: '🤔',
    genres: ['99', '36', '878'],
    description: 'Thought-provoking documentaries and sci-fi'
  },
  {
    id: 'adventure',
    label: 'Adventure Time',
    emoji: '🗺️',
    genres: ['12', '14', '10751'],
    description: 'Epic journeys and fantasy worlds'
  },
  {
    id: 'mystery',
    label: 'Solve a Mystery',
    emoji: '🔍',
    genres: ['9648', '80', '53'],
    description: 'Crime and mystery thrillers'
  }
];

export const MoodDiscovery = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleMoodClick = async (mood: Mood) => {
    setLoading(mood.id);
    try {
      const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';

      const discoverResults = await tmdbService.discover(
        mediaType,
        {
          with_genres: mood.genres.join(','),
          sort_by: 'popularity.desc',
          page: String(Math.floor(Math.random() * 3) + 1)
        }
      );

      if (discoverResults && discoverResults.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(10, discoverResults.results.length));
        const selected = discoverResults.results[randomIndex];
        navigate(`/details/${mediaType}/${selected.id}`);
      }
    } catch (error) {
      console.error('Error in mood discovery:', error);
    } finally {
      setLoading(null);
    }
  };

  const displayedMoods = expanded ? MOODS : MOODS.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">How Are You Feeling?</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayedMoods.map((mood) => (
          <button
            key={mood.id}
            onClick={() => handleMoodClick(mood)}
            disabled={loading === mood.id}
            className="group relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 rounded-lg p-6 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700 hover:border-primary-500"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">{mood.emoji}</span>
              <h3 className="text-white font-semibold text-center">{mood.label}</h3>
              <p className="text-gray-400 text-xs text-center">{mood.description}</p>
              {loading === mood.id && (
                <svg className="animate-spin h-5 w-5 text-primary-500 mt-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {!expanded && (
        <div className="flex justify-center">
          <button
            onClick={() => setExpanded(true)}
            className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-2"
          >
            Show More Moods
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {expanded && (
        <div className="flex justify-center">
          <button
            onClick={() => setExpanded(false)}
            className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-2"
          >
            Show Less
            <svg className="w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
