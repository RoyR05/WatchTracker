import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';
import { userSettingsService } from '../../services/userSettings';
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

type FallbackEntry = {
  moodId: string;
  moodLabel: string;
  item: Movie | TVShow;
  mediaType: 'movie' | 'tv';
};

export const MoodDiscovery = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [fallbacks, setFallbacks] = useState<FallbackEntry[]>([]);
  const [rerolling, setRerolling] = useState<string | null>(null);

  useEffect(() => {
    userSettingsService.getEnglishOnlyFilter().then(setEnglishOnly);
  }, []);

  function toggleMood(moodId: string) {
    setNoResults(false);
    setFallbacks([]);
    setSelectedMoods(prev => {
      if (prev.includes(moodId)) return prev.filter(id => id !== moodId);
      if (prev.length >= 2) return [prev[1], moodId]; // drop oldest, add new
      return [...prev, moodId];
    });
  }

  async function fetchFallbackForMood(moodId: string): Promise<FallbackEntry | null> {
    const mood = MOODS.find(m => m.id === moodId);
    if (!mood) return null;
    try {
      const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';
      const params: Record<string, string> = {
        with_genres: mood.genres.join('|'),
        sort_by: 'popularity.desc',
        page: String(Math.floor(Math.random() * 3) + 1),
      };
      if (englishOnly) params['with_original_language'] = 'en';
      const res = await tmdbService.discover(mediaType, params);
      if (!res?.results?.length) return null;
      const item = res.results[Math.floor(Math.random() * Math.min(10, res.results.length))];
      return { moodId, moodLabel: mood.label, item: item as Movie | TVShow, mediaType };
    } catch {
      return null;
    }
  }

  const handleDiscover = async () => {
    if (selectedMoods.length === 0) return;

    setLoading(true);
    setNoResults(false);
    setFallbacks([]);
    try {
      // Union genres from all selected moods — use | (OR) not , (AND)
      const genres = [...new Set(
        selectedMoods.flatMap(id => MOODS.find(m => m.id === id)?.genres ?? [])
      )];

      const mediaType = Math.random() > 0.5 ? 'movie' : 'tv';

      const params: Record<string, string> = {
        with_genres: genres.join('|'),
        sort_by: 'popularity.desc',
        page: String(Math.floor(Math.random() * 3) + 1),
      };
      if (englishOnly) params['with_original_language'] = 'en';

      const discoverResults = await tmdbService.discover(mediaType, params);

      if (discoverResults && discoverResults.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(10, discoverResults.results.length));
        const selected = discoverResults.results[randomIndex];
        navigate(`/details/${mediaType}/${selected.id}`);
      } else {
        // No combined results — show per-mood fallbacks
        setNoResults(true);
        const entries = await Promise.all(selectedMoods.map(fetchFallbackForMood));
        setFallbacks(entries.filter((e): e is FallbackEntry => e !== null));
      }
    } catch (error) {
      console.error('Error in mood discovery:', error);
    } finally {
      setLoading(false);
    }
  };

  async function rerollFallback(moodId: string) {
    setRerolling(moodId);
    try {
      const entry = await fetchFallbackForMood(moodId);
      if (entry) {
        setFallbacks(prev => prev.map(f => f.moodId === moodId ? entry : f));
      }
    } finally {
      setRerolling(null);
    }
  }

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

      {/* Fallback UI — shown when combined mood search returns no results */}
      {noResults && fallbacks.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-400 text-center">
            Nothing matched both moods together — here's one for each:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fallbacks.map(fb => {
              const title = 'title' in fb.item ? fb.item.title : (fb.item as any).name;
              const isRerolling = rerolling === fb.moodId;
              return (
                <div key={fb.moodId} className="bg-gray-800 rounded-xl p-4 flex gap-3 items-start">
                  <Link to={`/details/${fb.mediaType}/${fb.item.id}`} className="flex-shrink-0 w-16">
                    <img
                      src={tmdbService.getImageUrl(fb.item.poster_path, 'w342')}
                      className="w-full aspect-[2/3] object-cover rounded-lg"
                      alt=""
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary-400 font-medium mb-1">For {fb.moodLabel}</p>
                    <p className="text-white font-semibold text-sm line-clamp-2">{title}</p>
                    {fb.item.vote_average > 0 && (
                      <p className="text-amber-400 text-xs mt-0.5">★ {fb.item.vote_average.toFixed(1)}</p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Link
                        to={`/details/${fb.mediaType}/${fb.item.id}`}
                        className="text-xs px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={() => rerollFallback(fb.moodId)}
                        disabled={isRerolling}
                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {isRerolling ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : 'Try another →'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => { setNoResults(false); setFallbacks([]); }}
              className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
            >
              Change moods
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
