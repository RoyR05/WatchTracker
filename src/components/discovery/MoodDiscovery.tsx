import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import { userSettingsService } from '../../services/userSettings';

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
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [englishOnly, setEnglishOnly] = useState(false);

  useEffect(() => {
    userSettingsService.getEnglishOnlyFilter().then(setEnglishOnly);
  }, []);

  function toggleMood(moodId: string) {
    setSelectedMoods(prev => {
      if (prev.includes(moodId)) return prev.filter(id => id !== moodId);
      if (prev.length >= 2) return [prev[1], moodId]; // drop oldest, add new
      return [...prev, moodId];
    });
  }

  const handleDiscover = async () => {
    if (selectedMoods.length === 0) return;

    setLoading(true);
    try {
      // Union genres from all selected moods
      const genres = [...new Set(
        selectedMoods.flatMap(id => MOODS.find(m => m.id === id)?.genres ?? [])
      )];

      const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';

      const params: Record<string, string> = {
        with_genres: genres.join(','),
        sort_by: 'popularity.desc',
        page: String(Math.floor(Math.random() * 3) + 1),
      };
      if (englishOnly) params['with_original_language'] = 'en';

      const discoverResults = await tmdbService.discover(mediaType, params);

      if (discoverResults && discoverResults.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(10, discoverResults.results.length));
        const selected = discoverResults.results[randomIndex];
        navigate(`/details/${mediaType}/${selected.id}`);
      }
    } catch (error) {
      console.error('Error in mood discovery:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayedMoods = expanded ? MOODS : MOODS.slice(0, 4);
  const activeMoodLabels = selectedMoods.map(id => MOODS.find(m => m.id === id)?.label ?? '').filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">How Are You Feeling?</h2>
        <p className="text-sm text-gray-400">Pick up to 2 moods</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayedMoods.map((mood) => {
          const isSelected = selectedMoods.includes(mood.id);
          return (
            <button
              key={mood.id}
              onClick={() => toggleMood(mood.id)}
              disabled={loading}
              className={`group relative overflow-hidden rounded-lg p-6 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border ${
                isSelected
                  ? 'bg-primary-600/30 border-primary-500 ring-2 ring-primary-500/50'
                  : 'bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 border-gray-700 hover:border-primary-500'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">{mood.emoji}</span>
                <h3 className="text-white font-semibold text-center">{mood.label}</h3>
                <p className="text-gray-400 text-xs text-center">{mood.description}</p>
                {isSelected && (
                  <div className="mt-1 w-2 h-2 rounded-full bg-primary-400" />
                )}
              </div>
            </button>
          );
        })}
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

      {selectedMoods.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          {activeMoodLabels.length > 0 && (
            <p className="text-sm text-gray-400">
              Showing: <span className="text-white font-medium">{activeMoodLabels.join(' + ')}</span>
            </p>
          )}
          <button
            onClick={handleDiscover}
            disabled={loading}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Finding something...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Find Something
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
