import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { tmdbService } from '../services/tmdb';
import type { Database } from '../types/database.types';

type WatchlistItem = Database['public']['Tables']['watchlist_items']['Row'];

interface UpcomingEpisode {
  id: number;
  name: string;
  air_date: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  show_id: number;
  show_name: string;
  show_poster: string | null;
}

interface UpcomingMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

interface CalendarEvent {
  id: string;
  type: 'episode' | 'movie';
  date: string;
  title: string;
  subtitle?: string;
  mediaId: number;
  mediaType: 'tv' | 'movie';
  posterPath: string | null;
}

type ViewMode = 'list' | 'calendar';

export default function CalendarPage() {
  const { user } = useAuth();
  const [upcomingEpisodes, setUpcomingEpisodes] = useState<UpcomingEpisode[]>([]);
  const [upcomingMovies, setUpcomingMovies] = useState<UpcomingMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadUpcomingContent();
  }, [user]);

  async function loadUpcomingContent() {
    if (!user) return;

    try {
      setError(null);
      setLoading(true);

      const { data: watchlistItems, error: watchlistError } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['watching', 'plan_to_watch']);

      if (watchlistError) throw watchlistError;

      const tvShows = watchlistItems?.filter(item => item.media_type === 'tv') || [];
      const movies = watchlistItems?.filter(item => item.media_type === 'movie') || [];

      const episodesPromises = tvShows.map(async (show) => {
        try {
          const details = await tmdbService.getTVShowDetails(show.tmdb_id);
          const today = new Date();
          const episodes: UpcomingEpisode[] = [];

          for (const season of details.seasons) {
            if (season.season_number === 0) continue;

            try {
              const seasonDetails = await tmdbService.getSeasonDetails(show.tmdb_id, season.season_number);

              for (const episode of seasonDetails.episodes) {
                if (episode.air_date) {
                  const airDate = new Date(episode.air_date);
                  if (airDate >= today) {
                    episodes.push({
                      id: episode.id,
                      name: episode.name,
                      air_date: episode.air_date,
                      episode_number: episode.episode_number,
                      season_number: episode.season_number,
                      still_path: episode.still_path,
                      show_id: show.tmdb_id,
                      show_name: details.name,
                      show_poster: details.poster_path,
                    });
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching season ${season.season_number} for show ${show.tmdb_id}:`, err);
            }
          }

          return episodes;
        } catch (err) {
          console.error(`Error fetching show details for ${show.tmdb_id}:`, err);
          return [];
        }
      });

      const moviesPromises = movies.map(async (movie) => {
        try {
          const details = await tmdbService.getMovieDetails(movie.tmdb_id);
          if (details.release_date && details.status === 'Released') {
            const releaseDate = new Date(details.release_date);
            const today = new Date();
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(today.getDate() + 30);

            if (releaseDate >= today && releaseDate <= thirtyDaysFromNow) {
              return {
                id: details.id,
                title: details.title,
                release_date: details.release_date,
                poster_path: details.poster_path,
              };
            }
          }
          return null;
        } catch (err) {
          console.error(`Error fetching movie details for ${movie.tmdb_id}:`, err);
          return null;
        }
      });

      const episodesResults = await Promise.all(episodesPromises);
      const allEpisodes = episodesResults.flat();
      allEpisodes.sort((a, b) => new Date(a.air_date).getTime() - new Date(b.air_date).getTime());
      setUpcomingEpisodes(allEpisodes.slice(0, 50));

      const moviesResults = await Promise.all(moviesPromises);
      const filteredMovies = moviesResults.filter((movie): movie is UpcomingMovie => movie !== null);
      filteredMovies.sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());
      setUpcomingMovies(filteredMovies);

    } catch (err) {
      console.error('Error loading upcoming content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load upcoming content');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  function getDaysDiff(dateString: string): number {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getCalendarEvents(): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    upcomingEpisodes.forEach(episode => {
      events.push({
        id: `ep-${episode.show_id}-${episode.season_number}-${episode.episode_number}`,
        type: 'episode',
        date: episode.air_date,
        title: episode.show_name,
        subtitle: `S${episode.season_number}E${episode.episode_number}`,
        mediaId: episode.show_id,
        mediaType: 'tv',
        posterPath: episode.show_poster,
      });
    });

    upcomingMovies.forEach(movie => {
      events.push({
        id: `movie-${movie.id}`,
        type: 'movie',
        date: movie.release_date,
        title: movie.title,
        mediaId: movie.id,
        mediaType: 'movie',
        posterPath: movie.poster_path,
      });
    });

    return events;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Upcoming Releases</h1>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded-lg">
            <p className="font-semibold">Error loading calendar</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {upcomingEpisodes.length === 0 && upcomingMovies.length === 0 && !loading && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-lg">No upcoming releases found</p>
            <p className="text-gray-500 text-sm mt-2">Add TV shows or movies to your watchlist to see upcoming episodes and releases here.</p>
          </div>
        )}

        {viewMode === 'calendar' && (upcomingEpisodes.length > 0 || upcomingMovies.length > 0) && (
          <CalendarGrid
            events={getCalendarEvents()}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
          />
        )}

        {viewMode === 'list' && upcomingEpisodes.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Upcoming Episodes</h2>
            <div className="space-y-4">
              {upcomingEpisodes.map((episode) => {
                const daysUntil = getDaysDiff(episode.air_date);
                return (
                  <Link
                    key={`${episode.show_id}-${episode.season_number}-${episode.episode_number}`}
                    to={`/details/tv/${episode.show_id}`}
                    className="block bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex">
                      <div className="w-32 h-20 flex-shrink-0 bg-gray-700">
                        <img
                          src={tmdbService.getImageUrl(episode.still_path, 'w500')}
                          alt={episode.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-white font-medium">{episode.show_name}</h3>
                          <p className="text-sm text-gray-400">
                            S{episode.season_number}E{episode.episode_number}: {episode.name}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-white font-medium">{formatDate(episode.air_date)}</p>
                          <p className="text-xs text-gray-500">
                            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {viewMode === 'list' && upcomingMovies.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Upcoming Movies</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {upcomingMovies.map((movie) => (
                <Link
                  key={movie.id}
                  to={`/details/movie/${movie.id}`}
                  className="group block"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
                    <img
                      src={tmdbService.getImageUrl(movie.poster_path)}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                      {formatDate(movie.release_date)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary-400 transition-colors">
                      {movie.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
