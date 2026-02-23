import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { tmdbService } from '../../services/tmdb';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type { Season } from '../../services/tmdb';
import type { Database } from '../../types/database.types';

type TVShowProgress = Database['public']['Tables']['tv_show_progress']['Row'];
type BingeSession = Database['public']['Tables']['binge_sessions']['Row'];

interface EpisodeTrackerProps {
  tvId: number;
  numberOfSeasons: number;
}

export function EpisodeTracker({ tvId, numberOfSeasons }: EpisodeTrackerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonDetails, setSeasonDetails] = useState<Season | null>(null);
  const [progress, setProgress] = useState<TVShowProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<BingeSession | null>(null);
  const [autoMarkEnabled, setAutoMarkEnabled] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<string>('');

  useEffect(() => {
    loadSeasonData();
    loadBingeSession();
  }, [selectedSeason, tvId]);

  useEffect(() => {
    if (seasonDetails) {
      updateNextEpisodeCountdown();
      const interval = setInterval(updateNextEpisodeCountdown, 60000);
      return () => clearInterval(interval);
    }
  }, [seasonDetails, progress]);

  const updateNextEpisodeCountdown = useCallback(() => {
    if (!seasonDetails) return;

    const unwatchedEpisode = seasonDetails.episodes.find(ep =>
      !progress.some(p => p.episode_number === ep.episode_number && p.watched)
    );

    if (unwatchedEpisode?.air_date) {
      const airDate = new Date(unwatchedEpisode.air_date);
      const now = new Date();
      const diff = airDate.getTime() - now.getTime();

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
          setNextEpisodeCountdown(`${days}d ${hours}h until next episode`);
        } else if (hours > 0) {
          setNextEpisodeCountdown(`${hours}h ${minutes}m until next episode`);
        } else {
          setNextEpisodeCountdown(`${minutes}m until next episode`);
        }
      } else {
        setNextEpisodeCountdown('');
      }
    } else {
      setNextEpisodeCountdown('');
    }
  }, [seasonDetails, progress]);

  async function loadSeasonData() {
    setLoading(true);
    try {
      const [seasonData, progressData] = await Promise.all([
        tmdbService.getSeasonDetails(tvId, selectedSeason),
        user ? supabase
          .from('tv_show_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('tmdb_id', tvId)
          .eq('season_number', selectedSeason) : Promise.resolve({ data: [], error: null })
      ]);

      setSeasonDetails(seasonData);
      setProgress(progressData.data || []);
    } catch (error) {
      console.error('Error loading season data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadBingeSession() {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('binge_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('tmdb_id', tvId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSession(data);
    } catch (error) {
      console.error('Error loading binge session:', error);
    }
  }

  async function toggleEpisode(episodeNumber: number, watched: boolean) {
    if (!user) return;

    try {
      const existing = progress.find(p => p.episode_number === episodeNumber);

      if (existing) {
        const updateData: any = { watched, watched_at: watched ? new Date().toISOString() : null };
        await supabase
          .from('tv_show_progress')
          .update(updateData)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('tv_show_progress')
          .insert([{
            user_id: user.id,
            tmdb_id: tvId,
            season_number: selectedSeason,
            episode_number: episodeNumber,
            watched,
            watched_at: watched ? new Date().toISOString() : null,
          }]);
      }

      if (watched && autoMarkEnabled) {
        await autoMarkConsecutiveEpisodes(episodeNumber);
      }

      const episode = seasonDetails?.episodes.find(ep => ep.episode_number === episodeNumber);
      if (watched && episode && episodeNumber === seasonDetails?.episodes.length) {
        toast.success(`Season ${selectedSeason} finale completed!`);
      }

      await Promise.all([loadSeasonData(), loadBingeSession()]);
    } catch (error) {
      console.error('Error toggling episode:', error);
      toast.error('Failed to update episode status');
    }
  }

  async function autoMarkConsecutiveEpisodes(markedEpisode: number) {
    if (!user || !seasonDetails) return;

    const firstUnwatchedBefore = seasonDetails.episodes
      .filter(ep => ep.episode_number < markedEpisode)
      .find(ep => !progress.some(p => p.episode_number === ep.episode_number && p.watched));

    if (firstUnwatchedBefore) {
      try {
        const episodesToMark = seasonDetails.episodes.filter(
          ep => ep.episode_number >= firstUnwatchedBefore.episode_number && ep.episode_number < markedEpisode
        );

        for (const episode of episodesToMark) {
          const existing = progress.find(p => p.episode_number === episode.episode_number);
          if (existing) {
            await supabase
              .from('tv_show_progress')
              .update({ watched: true, watched_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('tv_show_progress')
              .insert([{
                user_id: user.id,
                tmdb_id: tvId,
                season_number: selectedSeason,
                episode_number: episode.episode_number,
                watched: true,
                watched_at: new Date().toISOString(),
              }]);
          }
        }

        toast.success(`Auto-marked ${episodesToMark.length} previous episodes`);
      } catch (error) {
        console.error('Error auto-marking episodes:', error);
      }
    }
  }

  async function endBingeSession() {
    if (!user || !currentSession) return;

    try {
      await supabase
        .from('binge_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', currentSession.id);

      toast.success(`Binge session ended: ${currentSession.episodes_watched} episodes (${currentSession.total_duration_minutes} min)`);
      setCurrentSession(null);
    } catch (error) {
      console.error('Error ending binge session:', error);
      toast.error('Failed to end session');
    }
  }

  async function setSeasonFinaleReminder(seasonNumber: number, episodeNumber: number, airDate: string) {
    if (!user) return;

    try {
      await supabase
        .from('episode_reminders')
        .insert([{
          user_id: user.id,
          tmdb_id: tvId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          air_date: airDate,
          is_season_finale: true,
        }]);

      toast.success('Season finale reminder set!');
    } catch (error) {
      console.error('Error setting reminder:', error);
      toast.error('Failed to set reminder');
    }
  }

  function isEpisodeWatched(episodeNumber: number): boolean {
    return progress.some(p => p.episode_number === episodeNumber && p.watched);
  }

  if (loading || !seasonDetails) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Episodes</h2>
        {nextEpisodeCountdown && (
          <div className="flex items-center gap-2 bg-primary-600/20 text-primary-400 px-3 py-1.5 rounded-full text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {nextEpisodeCountdown}
          </div>
        )}
      </div>

      {currentSession && (
        <div className="bg-gradient-to-r from-primary-600/20 to-primary-500/20 border border-primary-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                Binge Session Active
              </h3>
              <div className="text-sm text-gray-300">
                <span className="font-medium text-primary-400">{currentSession.episodes_watched}</span> episodes watched
                <span className="mx-2">•</span>
                <span className="font-medium text-primary-400">{currentSession.total_duration_minutes}</span> minutes
              </div>
            </div>
            <button
              onClick={endBingeSession}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex overflow-x-auto space-x-2 pb-2 scrollbar-hide">
          {Array.from({ length: numberOfSeasons }, (_, i) => i + 1).map((season) => (
            <button
              key={season}
              onClick={() => setSelectedSeason(season)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedSeason === season
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Season {season}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAutoMarkEnabled(!autoMarkEnabled)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ml-4 ${
            autoMarkEnabled
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          title="Auto-mark previous episodes when marking a later one"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Auto-mark
        </button>
      </div>

      <div className="space-y-3">
        {seasonDetails.episodes.map((episode, index) => {
          const watched = isEpisodeWatched(episode.episode_number);
          const isFinale = index === seasonDetails.episodes.length - 1;
          const isUpcoming = episode.air_date && new Date(episode.air_date) > new Date();

          return (
            <div
              key={episode.id}
              className={`flex items-start space-x-4 rounded-lg p-4 hover:bg-gray-600 transition-colors ${
                isFinale ? 'bg-gradient-to-r from-gray-700 to-amber-900/20 border border-amber-500/30' : 'bg-gray-700'
              }`}
            >
              <button
                onClick={() => toggleEpisode(episode.episode_number, !watched)}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  watched
                    ? 'bg-primary-600 border-primary-600'
                    : 'border-gray-500 hover:border-primary-500'
                }`}
              >
                {watched && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-medium ${watched ? 'text-gray-400 line-through' : 'text-white'}`}>
                    {episode.episode_number}. {episode.name}
                  </h3>
                  {isFinale && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-medium">
                      Season Finale
                    </span>
                  )}
                  {isUpcoming && !watched && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                      Upcoming
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{episode.overview}</p>
                <div className="flex items-center gap-4 mt-2">
                  {episode.air_date && (
                    <p className="text-xs text-gray-500">
                      {new Date(episode.air_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  )}
                  {isFinale && episode.air_date && isUpcoming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSeasonFinaleReminder(selectedSeason, episode.episode_number, episode.air_date);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Set Reminder
                    </button>
                  )}
                </div>
              </div>

              {episode.still_path && (
                <img
                  src={tmdbService.getImageUrl(episode.still_path)}
                  alt={episode.name}
                  className="hidden sm:block w-32 h-18 object-cover rounded"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
