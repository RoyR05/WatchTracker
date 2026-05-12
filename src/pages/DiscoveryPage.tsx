import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { FeelingLucky } from '../components/discovery/FeelingLucky';
import { MoodDiscovery } from '../components/discovery/MoodDiscovery';
import { GenreBrowser } from '../components/discovery/GenreBrowser';
import { GenreResults } from '../components/discovery/GenreResults';
import { MediaCard } from '../components/media/MediaCard';
import { tmdbService } from '../services/tmdb';
import { userSettingsService } from '../services/userSettings';
import { preferencesService } from '../services/preferences';
import { useAuth } from '../contexts/AuthContext';
import type { Movie, TVShow } from '../services/tmdb';

export default function DiscoveryPage() {
  const { user } = useAuth();
  const [selectedGenre, setSelectedGenre] = useState<{ id: number; name: string } | null>(null);
  const [trendingToday, setTrendingToday] = useState<Array<Movie | TVShow>>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());

  useEffect(() => {
    if (!user || trendingToday.length === 0) return;
    const items = trendingToday.map(item => ({
      tmdbId: item.id,
      mediaType: ('title' in item ? 'movie' : 'tv') as 'movie' | 'tv',
    }));
    preferencesService.getPreferencesForItems(items, user.id).then(setPreferenceMap);
  }, [user, trendingToday]);

  useEffect(() => {
    async function loadSettings() {
      const savedEnglishOnly = await userSettingsService.getEnglishOnlyFilter();
      setEnglishOnly(savedEnglishOnly);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    async function loadTrendingToday() {
      setLoadingTrending(true);
      try {
        const data = await tmdbService.getTrending('all', 'day', 1, englishOnly);
        if (data && data.results) {
          setTrendingToday(data.results.slice(0, 10));
        }
      } catch (error) {
        console.error('Error loading trending today:', error);
      } finally {
        setLoadingTrending(false);
      }
    }

    loadTrendingToday();
  }, [englishOnly]);

  const handleGenreSelect = (genreId: number, genreName: string) => {
    setSelectedGenre({ id: genreId, name: genreName });
  };

  const handleBackToGenres = () => {
    setSelectedGenre(null);
  };

  if (selectedGenre) {
    return (
      <Layout>
        <GenreResults
          genreId={selectedGenre.id}
          genreName={selectedGenre.name}
          onBack={handleBackToGenres}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Discover</h1>
          <p className="text-gray-400">Explore new movies and TV shows</p>
        </div>

        <section className="flex justify-center">
          <FeelingLucky />
        </section>

        <section>
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Today's Top Trending</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                Updated hourly
              </div>
            </div>

            {loadingTrending ? (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-32 sm:w-40">
                    <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                {trendingToday.map((item, index) => {
                  const mt = 'title' in item ? 'movie' : 'tv';
                  return (
                    <div key={item.id} className="flex-shrink-0 w-32 sm:w-40 snap-start relative">
                      <div className="absolute -top-2 -left-2 z-10 w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        {index + 1}
                      </div>
                      <MediaCard
                        item={item}
                        mediaType={mt}
                        initialPreference={preferenceMap.get(`${item.id}-${mt}`) ?? null}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <MoodDiscovery />

        <GenreBrowser onGenreSelect={handleGenreSelect} />
      </div>
    </Layout>
  );
}
