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
  seasons?: Array<{ season_number: number; episode_count: number }>;
  showStatus?: string;       // TMDB status: "Ended", "Canceled", "Returning Series", etc.
  onAutoComplete?: () => void; // Called when the last episode of a finished show is marked watched
}

function isShowEnded(status?: string): boolean {
  if (!status) return false;
  return ['Ended', 'Canceled', 'Cancelled'].includes(status);
}

export function EpisodeTracker({ tvId, numberOfSeasons, seasons, showStatus, onAutoComplete }: EpisodeTrackerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonDetails, setSeasonDetails] = useState<Season | null>(null);
  const [progress, setProgress] = useState<TVShowProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<BingeSession | null>(null);
  const [autoMarkEnabled, setAutoMarkEnabled] = useState(() => {
    const stored = localStorage.getItem('episodeTracker.autoMark');
    return stored === null ? true : stored === 'true'; // default ON
  });
  const [markingSeason, setMarkingSeason] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('episodeTracker.autoMark', String(autoMarkEnabled));
  }, [autoMarkEnabled]);

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
      const { error: upsertError } = await supabase
        .from('tv_show_progress')
        .upsert(
          {
            user_id: user.id,
            tmdb_id: tvId,
            season_number: selectedSeason,
            episode_number: episodeNumber,
            watched,
            watched_at: watched ? new Date().toISOString() : null,
          },
          { onConflict: 'user_id,tmdb_id,season_number,episode_number' }
        );

      if (upsertError) throw upsertError;

      if (watched && autoMarkEnabled) {
        await autoMarkConsecutiveEpisodes(episodeNumber);
      }

      const episode = seasonDetails?.episodes.find(ep => ep.episode_number === episodeNumber);
      if (watched && episode && episodeNumber === seasonDetails?.episodes.length) {
        toast.success(`Season ${selectedSeason} finale completed!`);
      }

      await Promise.all([loadSeasonData(), loadBingeSession()]);

      // Auto-complete: if this was the last episode of the last season of a finished show
      if (watched && isShowEnded(showStatus) && selectedSeason === numberOfSeasons && onAutoComplete && seasonDetails) {
        const maxEp = Math.max(...seasonDetails.episodes.map(e => e.episode_number));
        if (episodeNumber === maxEp) {
          const { data: prog } = await supabase
            .from('tv_show_progress')
            .select('episode_number, watched')
            .eq('user_id', user.id)
            .eq('tmdb_id', tvId)
            .eq('season_number', selectedSeason);
          const watchedSet = new Set((prog ?? []).filter(p => p.watched).map(p => p.episode_number));
          const allDone = seasonDetails.episodes.every(e => watchedSet.has(e.episode_number));
          if (allDone) {
            onAutoComplete();
            toast.success('All episodes watched — marked as Completed!');
          }
        }
      }
    } catch (error) {
      console.error('Error toggling episode:', error);
      toast.error('Failed to update episode status');
    }
  }

  async function autoMarkConsecutiveEpisodes(markedEpisode: number) {
    if (!user || !seasonDetails) return;

    const crossSeason = !!seasons && selectedSeason > 1;
    setAutoFilling(true);
    try {
      const now = new Date().toISOString();
      const rows: Array<{
        user_id: string;
        tmdb_id: number;
        season_number: number;
        episode_number: number;
        watched: boolean;
        watched_at: string;
      }> = [];

      if (crossSeason) {
        // Single DB query: load all progress for this show across every season
        const { data: allProgress } = await supabase
          .from('tv_show_progress')
          .select('season_number, episode_number, watched')
          .eq('user_id', user.id)
          .eq('tmdb_id', tvId);

        const isWatched = (s: number, e: number) =>
          (allProgress ?? []).some(p => p.season_number === s && p.episode_number === e && p.watched);

        // All prior seasons (skip season 0 / specials)
        const priorSeasons = seasons!.filter(s => s.season_number > 0 && s.season_number < selectedSeason);
        for (const season of priorSeasons) {
          for (let ep = 1; ep <= season.episode_count; ep++) {
            if (!isWatched(season.season_number, ep)) {
              rows.push({ user_id: user.id, tmdb_id: tvId, season_number: season.season_number, episode_number: ep, watched: true, watched_at: now });
            }
          }
        }

        // Current season: episodes before the clicked one (TMDB list for exact numbering)
        for (const ep of seasonDetails.episodes) {
          if (ep.episode_number < markedEpisode && !isWatched(selectedSeason, ep.episode_number)) {
            rows.push({ user_id: user.id, tmdb_id: tvId, season_number: selectedSeason, episode_number: ep.episode_number, watched: true, watched_at: now });
          }
        }
      } else {
        // Single-season only: use local progress state (no extra DB call)
        for (const ep of seasonDetails.episodes) {
          if (ep.episode_number < markedEpisode && !progress.some(p => p.episode_number === ep.episode_number && p.watched)) {
            rows.push({ user_id: user.id, tmdb_id: tvId, season_number: selectedSeason, episode_number: ep.episode_number, watched: true, watched_at: now });
          }
        }
      }

      if (rows.length === 0) return;

      const { error: autoError } = await supabase
        .from('tv_show_progress')
        .upsert(rows, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

      if (autoError) throw autoError;

      if (crossSeason && selectedSeason > 1) {
        const priorCount = selectedSeason - 1;
        toast.success(`Auto-filled ${rows.length} episode${rows.length !== 1 ? 's' : ''} across ${priorCount} previous season${priorCount !== 1 ? 's' : ''}`);
      } else {
        toast.success(`Auto-filled ${rows.length} previous episode${rows.length !== 1 ? 's' : ''} as watched`);
      }
    } catch (error) {
      console.error('Error auto-marking episodes:', error);
      toast.error('Failed to auto-fill previous episodes');
    } finally {
      setAutoFilling(false);
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

  async function handleMarkSeasonWatched() {
    if (!user || !seasonDetails || markingSeason) return;

    const unwatchedEpisodes = seasonDetails.episodes.filter(
      ep => !progress.some(p => p.episode_number === ep.episode_number && p.watched)
    );

    if (unwatchedEpisodes.length === 0) return;

    setMarkingSeason(true);
    try {
      const now = new Date().toISOString();
      const rows = unwatchedEpisodes.map(ep => ({
        user_id: user.id,
        tmdb_id: tvId,
        season_number: selectedSeason,
        episode_number: ep.episode_number,
        watched: true,
        watched_at: now,
      }));

      // Single batch upsert. The unique constraint (user_id, tmdb_id, season_number, episode_number)
      // upserts cleanly whether rows previously existed (as unwatched) or not.
      const { error } = await supabase
        .from('tv_show_progress')
        .upsert(rows, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

      if (error) throw error;

      toast.success(
        `Season ${selectedSeason} marked watched (${unwatchedEpisodes.length} episode${unwatchedEpisodes.length === 1 ? '' : 's'})`
      );
      await loadSeasonData();

      // Auto-complete: marking the entire last season of a finished show = show complete
      if (isShowEnded(showStatus) && selectedSeason === numberOfSeasons && onAutoComplete) {
        onAutoComplete();
        toast.success('All episodes watched — marked as Completed!');
      }
    } catch (err) {
      console.error('Error marking season as watched:', err);
      toast.error('Failed to mark season as watched');
    } finally {
      setMarkingSeason(false);
    }
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
          title="When marking an episode watched, also mark earlier unwatched episodes in this season"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Auto-fill gaps
        </button>
      </div>

      {seasonDetails && seasonDetails.episodes.length > 0 && (() => {
        const unwatchedCount = seasonDetails.episodes.filter(
          ep => !progress.some(p => p.episode_number === ep.episode_number && p.watched)
        ).length;
        const allWatched = unwatchedCount === 0;
        return (
          <button
            onClick={handleMarkSeasonWatched}
            disabled={markingSeason || allWatched || autoFilling}
            className={`w-full mb-4 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              allWatched
                ? 'bg-green-600/20 text-green-400 cursor-default'
                : 'bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {markingSeason ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Marking {unwatchedCount} episode{unwatchedCount === 1 ? '' : 's'}…
              </>
            ) : allWatched ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Season {selectedSeason} fully watched
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Mark all {unwatchedCount} unwatched episode{unwatchedCount === 1 ? '' : 's'} in Season {selectedSeason} as watched
              </>
            )}
          </button>
        );
      })()}

      <div className="space-y-3">
        {(() => {
          const maxEpisodeNumber = Math.max(...seasonDetails.episodes.map(e => e.episode_number));
          return seasonDetails.episodes.map((episode) => {
          const watched = isEpisodeWatched(episode.episode_number);
          const isFinale = episode.episode_number === maxEpisodeNumber;
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
                disabled={autoFilling}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
                    <p className="text-xs text-gray-400">
                      {new Date(episode.air_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  )}
                  {isFinale && episode.air_date && isUpcoming && !watched && (
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
        });
        })()}
      </div>
    </div>
  );
}
