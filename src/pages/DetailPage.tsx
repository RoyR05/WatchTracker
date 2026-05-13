﻿﻿﻿﻿﻿import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/layout/Layout';
import { EpisodeTracker } from '../components/tv/EpisodeTracker';
import { RecommendModal } from '../components/recommendations/RecommendModal';
import { AddToListModal } from '../components/lists/AddToListModal';
import { tmdbService } from '../services/tmdb';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { preferencesService } from '../services/preferences';
import { plexService } from '../services/plex';
import { queryKeys } from '../lib/queryKeys';
import type { PlexAvailability, PlexRequest } from '../services/plex';
import type { MovieDetails, TVShowDetails, Video, CastMember, CrewMember, VideosResponse } from '../services/tmdb';
import type { Database } from '../types/database.types';

type WatchlistItem = Database['public']['Tables']['watchlist_items']['Row'];
type WatchlistStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';

export default function DetailPage() {
  const { mediaType, id } = useParams<{ mediaType: 'movie' | 'tv'; id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const tmdbId = parseInt(id || '0');

  // TMDB data â€” cached via React Query (instant on back-navigation)
  const { data: details, isLoading: detailsLoading } = useQuery<MovieDetails | TVShowDetails>({
    queryKey: mediaType === 'movie' ? queryKeys.movieDetails(tmdbId) : queryKeys.tvDetails(tmdbId),
    queryFn: () => mediaType === 'movie'
      ? tmdbService.getMovieDetails(tmdbId)
      : tmdbService.getTVShowDetails(tmdbId),
    enabled: !!id && !!mediaType,
    staleTime: 30 * 60 * 1000,
  });

  const { data: credits } = useQuery<{ cast: CastMember[]; crew: CrewMember[] }>({
    queryKey: mediaType === 'movie' ? queryKeys.movieCredits(tmdbId) : queryKeys.tvCredits(tmdbId),
    queryFn: () => mediaType === 'movie'
      ? tmdbService.getMovieCredits(tmdbId)
      : tmdbService.getTVShowCredits(tmdbId),
    enabled: !!id && !!mediaType,
    staleTime: 30 * 60 * 1000,
  });

  const { data: videosData } = useQuery<VideosResponse>({
    queryKey: mediaType === 'movie' ? queryKeys.movieVideos(tmdbId) : queryKeys.tvVideos(tmdbId),
    queryFn: () => mediaType === 'movie'
      ? tmdbService.getMovieVideos(tmdbId)
      : tmdbService.getTVShowVideos(tmdbId),
    enabled: !!id && !!mediaType,
    staleTime: 30 * 60 * 1000,
  });

  const cast = credits?.cast ?? [];
  const crew = credits?.crew ?? [];
  const videos: Video[] = (videosData?.results ?? []).filter(v => v.site === 'YouTube');
  const loading = detailsLoading;

  // Watchlist + preference â€” kept as local state (mutated frequently)
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null);
  const [preference, setPreference] = useState<'like' | 'dislike' | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showAllCast, setShowAllCast] = useState(false);
  const [plexStatus, setPlexStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'error'>('idle');
  const [plexAvailability, setPlexAvailability] = useState<PlexAvailability | null>(null);
  const [plexRequest, setPlexRequest] = useState<PlexRequest | null>(null);
  const [plexSubmitting, setPlexSubmitting] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState('');
  const [noteIsPrivate, setNoteIsPrivate] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  interface FriendNote {
    user_id: string;
    username: string;
    avatar_url: string | null;
    notes: string;
    status: string;
    updated_at: string;
  }
  const [friendsNotes, setFriendsNotes] = useState<FriendNote[]>([]);

  useEffect(() => {
    if (!id || !mediaType || !user) return;
    Promise.all([
      supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)
        .maybeSingle(),
      preferencesService.getPreference(tmdbId, mediaType),
      plexService.checkExistingRequest(tmdbId, mediaType as 'movie' | 'tv'),
    ]).then(([watchlistData, preferenceData, existingRequest]) => {
      setWatchlistItem(watchlistData.data);
      setPreference(preferenceData);
      if (existingRequest) setPlexRequest(existingRequest);
    });
  }, [id, mediaType, user]);

  // Sync note text/privacy when watchlistItem loads or changes
  useEffect(() => {
    if (watchlistItem) {
      setNoteText(watchlistItem.notes ?? '');
      setNoteIsPrivate(watchlistItem.note_is_private ?? false);
    }
  }, [watchlistItem?.id]);

  // Load friends' notes
  useEffect(() => {
    if (!tmdbId || !mediaType) return;
    supabase.rpc('get_friends_notes', { p_tmdb_id: tmdbId, p_media_type: mediaType })
      .then(({ data }) => { if (data) setFriendsNotes(data as FriendNote[]); });
  }, [tmdbId, mediaType]);

  async function saveNote() {
    if (!watchlistItem) return;
    setNoteSaving(true);
    try {
      await supabase.from('watchlist_items')
        .update({ notes: noteText, note_is_private: noteIsPrivate, updated_at: new Date().toISOString() })
        .eq('id', watchlistItem.id);
    } finally { setNoteSaving(false); }
  }

  async function toggleNotePrivacy() {
    const newVal = !noteIsPrivate;
    setNoteIsPrivate(newVal);
    if (watchlistItem) {
      await supabase.from('watchlist_items')
        .update({ note_is_private: newVal, updated_at: new Date().toISOString() })
        .eq('id', watchlistItem.id);
    }
  }

  function buildContentMetadata() {
    if (!details) return undefined;

    const directors = crew
      .filter(c => c.job === 'Director')
      .slice(0, 3)
      .map(c => ({ id: c.id, name: c.name }));

    const title = 'title' in details ? details.title : details.name;
    const releaseDate = 'release_date' in details ? details.release_date : details.first_air_date;
    const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : undefined;

    return {
      title,
      poster_path: details.poster_path,
      genres: details.genres?.map(g => ({ id: g.id, name: g.name })),
      release_year: releaseYear,
      cast: cast.slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        character: c.character
      })),
      director: directors,
      runtime: 'runtime' in details ? details.runtime : undefined,
      overview: details.overview
    };
  }

  async function handleLike() {
    if (!user || !id || !mediaType) {
      toast.error('Please sign in to like content');
      return;
    }

    setUpdating(true);
    try {
      if (preference === 'like') {
        await preferencesService.removePreference(tmdbId, mediaType, 'like');
        setPreference(null);
        toast.success('Removed like');
      } else {
        const metadata = buildContentMetadata();
        await preferencesService.setPreference(tmdbId, mediaType, 'like', undefined, metadata);
        setPreference('like');
        toast.success('Added to liked');
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDislike() {
    if (!user || !id || !mediaType) {
      toast.error('Please sign in to dislike content');
      return;
    }

    setUpdating(true);
    try {
      if (preference === 'dislike') {
        await preferencesService.removePreference(tmdbId, mediaType, 'dislike');
        setPreference(null);
        toast.success('Removed dislike');
      } else {
        const metadata = buildContentMetadata();
        await preferencesService.setPreference(tmdbId, mediaType, 'dislike', undefined, metadata);
        setPreference('dislike');
        toast.success('Added to disliked');
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    } finally {
      setUpdating(false);
    }
  }

  async function updateWatchlistStatus(status: WatchlistStatus) {
    if (!user || !id || !mediaType) return;

    setUpdating(true);
    try {
      if (watchlistItem) {
        const updates: any = { status };
        if (status === 'completed' && !watchlistItem.completed_at) {
          updates.completed_at = new Date().toISOString();
        }
        if (status === 'watching' && !watchlistItem.started_at) {
          updates.started_at = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from('watchlist_items')
          .update(updates)
          .eq('id', watchlistItem.id)
          .select()
          .single();

        if (error) throw error;
        setWatchlistItem(data);

      } else {
        const itemTitle = details ? ('title' in details ? details.title : details.name) : undefined;
        const itemPosterPath = details?.poster_path || undefined;
        const itemYear = details
          ? ('release_date' in details && details.release_date
            ? new Date(details.release_date).getFullYear()
            : 'first_air_date' in details && details.first_air_date
              ? new Date(details.first_air_date).getFullYear()
              : undefined)
          : undefined;

        const newItem: any = {
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: mediaType,
          status,
          started_at: status === 'watching' ? new Date().toISOString() : null,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          title: itemTitle,
          poster_path: itemPosterPath,
          media_year: itemYear,
        };

        const { data, error } = await supabase
          .from('watchlist_items')
          .insert(newItem)
          .select()
          .single();

        if (error) throw error;
        setWatchlistItem(data);

      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
    } finally {
      setUpdating(false);
    }
  }

  async function removeFromWatchlist() {
    if (!watchlistItem) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('id', watchlistItem.id);

      if (error) throw error;
      setWatchlistItem(null);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleCheckPlex() {
    if (!details || !mediaType) return;

    setPlexStatus('checking');
    try {
      const titleStr = 'title' in details ? details.title : details.name;
      const dateStr = 'release_date' in details ? details.release_date : details.first_air_date;
      const yearStr = dateStr ? String(new Date(dateStr).getFullYear()) : null;

      const [availability, existingRequest] = await Promise.all([
        plexService.checkAvailability(titleStr, yearStr, mediaType),
        plexService.checkExistingRequest(tmdbId, mediaType),
      ]);

      setPlexAvailability(availability);
      setPlexRequest(existingRequest);
      setPlexStatus(availability.available ? 'available' : 'unavailable');
    } catch (error: any) {
      console.error('Error checking Plex:', error);
      const msg = error?.message || 'Failed to check Plex availability';
      setPlexStatus('error');
      toast.error(msg);
    }
  }

  async function handlePlexRequest() {
    if (!user || !details || !mediaType || !id) return;

    setPlexSubmitting(true);
    try {
      const titleStr = 'title' in details ? details.title : details.name;
      const request = await plexService.submitRequest(
        user.id,
        null,
        tmdbId,
        mediaType,
        titleStr,
        details.poster_path
      );
      setPlexRequest(request);
      toast.success('Request submitted');
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('A request already exists for this title');
      } else {
        console.error('Error submitting request:', error);
        toast.error('Failed to submit request');
      }
    } finally {
      setPlexSubmitting(false);
    }
  }

  async function handleReportBadFile() {
    if (!user || !details || !mediaType || !id) return;

    setPlexSubmitting(true);
    try {
      const titleStr = 'title' in details ? details.title : details.name;
      const request = await plexService.reportBadFile(
        user.id,
        null,
        tmdbId,
        mediaType,
        titleStr,
        details.poster_path
      );
      setPlexRequest(request);
      toast.success('Bad file reported');
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('A report already exists for this title');
      } else {
        console.error('Error reporting bad file:', error);
        toast.error('Failed to report bad file');
      }
    } finally {
      setPlexSubmitting(false);
    }
  }

  if (loading || !details) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  const title = 'title' in details ? details.title : details.name;
  const date = 'release_date' in details ? details.release_date : details.first_air_date;
  const year = date ? new Date(date).getFullYear() : 'N/A';
  const formattedDate = date ? new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Layout>
      <div className="-mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="relative">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${tmdbService.getImageUrl(details.backdrop_path, 'original')})`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to right, rgba(31.5, 10.5, 10.5, 1) calc((50vw - 170px) - 340px), rgba(31.5, 10.5, 10.5, 0.84) 50%, rgba(31.5, 10.5, 10.5, 0.84) 100%)'
              }}
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-shrink-0">
                <img
                  src={tmdbService.getImageUrl(details.poster_path, 'w500')}
                  alt={title}
                  className="w-full md:w-80 rounded-lg shadow-2xl"
                />
              </div>

              <div className="flex-1 space-y-6 py-4">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                    {title}
                    <span className="ml-3 font-normal text-white/70">({year})</span>
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 text-white/90 text-base">
                    {formattedDate && (
                      <>
                        <span>{formattedDate}</span>
                        <span className="text-white/40">â€¢</span>
                      </>
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      {details.genres.map((genre, index) => (
                        <span key={genre.id}>
                          {genre.name}
                          {index < details.genres.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                    {'runtime' in details && details.runtime > 0 && (
                      <>
                        <span className="text-white/40">â€¢</span>
                        <span>{formatRuntime(details.runtime)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center">
                    <div className="relative">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="rgba(255, 255, 255, 0.1)"
                          strokeWidth="4"
                          fill="rgba(8, 28, 34, 1)"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke={details.vote_average >= 7 ? '#21d07a' : details.vote_average >= 5 ? '#d2d531' : '#db2360'}
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${(details.vote_average / 10) * 175.93} 175.93`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {Math.round(details.vote_average * 10)}
                          <sup className="text-xs">%</sup>
                        </span>
                      </div>
                    </div>
                    <span className="ml-2 text-white font-semibold">User<br/>Score</span>
                  </div>

                  <button
                    onClick={handleLike}
                    disabled={updating}
                    className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                      preference === 'like'
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-gray-900/70 hover:bg-green-600/80 text-white'
                    }`}
                    title={preference === 'like' ? 'Remove Like' : 'Like'}
                  >
                    <svg className="w-6 h-6" fill={preference === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  </button>

                  <button
                    onClick={handleDislike}
                    disabled={updating}
                    className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
                      preference === 'dislike'
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-gray-900/70 hover:bg-red-600/80 text-white'
                    }`}
                    title={preference === 'dislike' ? 'Remove Dislike' : 'Dislike'}
                  >
                    <svg className="w-6 h-6" fill={preference === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setShowAddToListModal(true)}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-900/70 hover:bg-gray-900 text-white transition-colors"
                    title="Add to list"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setShowRecommendModal(true)}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-900/70 hover:bg-gray-900 text-white transition-colors"
                    title="Recommend"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>

                  {videos.length > 0 && (
                    <a
                      href={`https://www.youtube.com/watch?v=${(videos.find(v => v.type === 'Trailer' && v.official) || videos.find(v => v.type === 'Trailer') || videos[0]).key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium transition-all backdrop-blur-sm"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      <span>Play Trailer</span>
                    </a>
                  )}
                </div>

                <div>
                  <h3 className="text-white/70 italic text-lg mb-2">{details.tagline || 'Watch and Track'}</h3>
                  <h2 className="text-xl font-semibold text-white mb-2">Overview</h2>
                  <p className="text-white/90 leading-relaxed">{details.overview}</p>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-white/20">
                  <button
                    onClick={() => updateWatchlistStatus('watching')}
                    disabled={updating || watchlistItem?.status === 'watching'}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      watchlistItem?.status === 'watching'
                        ? 'bg-cyan-600 text-white shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    Watching
                  </button>
                  <button
                    onClick={() => updateWatchlistStatus('completed')}
                    disabled={updating || watchlistItem?.status === 'completed'}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      watchlistItem?.status === 'completed'
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    Completed
                  </button>
                  <button
                    onClick={() => updateWatchlistStatus('plan_to_watch')}
                    disabled={updating || watchlistItem?.status === 'plan_to_watch'}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      watchlistItem?.status === 'plan_to_watch'
                        ? 'bg-yellow-600 text-white shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    Plan to Watch
                  </button>
                  <button
                    onClick={() => updateWatchlistStatus('dropped')}
                    disabled={updating || watchlistItem?.status === 'dropped'}
                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                      watchlistItem?.status === 'dropped'
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    Dropped
                  </button>
                  {watchlistItem && (
                    <button
                      onClick={removeFromWatchlist}
                      disabled={updating}
                      className="px-4 py-2 bg-red-600/30 text-red-200 rounded-md font-medium hover:bg-red-600/50 transition-colors backdrop-blur-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Plex Availability Section */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/20">
                  {plexStatus === 'idle' && (
                    <>
                      <button
                        onClick={handleCheckPlex}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600/20 text-amber-200 hover:bg-amber-600/40 font-medium transition-all backdrop-blur-sm"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                        </svg>
                        Check on Plex
                      </button>
                      {!plexRequest && user && (
                        <button
                          onClick={handlePlexRequest}
                          disabled={plexSubmitting}
                          className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 text-white/70 hover:bg-white/20 font-medium transition-all backdrop-blur-sm text-sm"
                        >
                          {plexSubmitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white/60"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                          Request to Add
                        </button>
                      )}
                      {plexRequest && (
                        <span className={`px-3 py-2 rounded-md text-sm font-medium backdrop-blur-sm ${
                          plexRequest.status === 'pending' ? 'bg-yellow-600/30 text-yellow-200' :
                          plexRequest.status === 'approved' ? 'bg-blue-600/30 text-blue-200' :
                          plexRequest.status === 'added' ? 'bg-green-600/30 text-green-200' :
                          plexRequest.status === 'bad_file' ? 'bg-orange-600/30 text-orange-200' :
                          'bg-red-600/30 text-red-200'
                        }`}>
                          {plexRequest.status === 'pending' && 'Requested — Pending'}
                          {plexRequest.status === 'approved' && 'Request Approved'}
                          {plexRequest.status === 'added' && 'Added to Plex'}
                          {plexRequest.status === 'bad_file' && 'Bad File Reported'}
                          {plexRequest.status === 'rejected' && 'Request Rejected'}
                        </span>
                      )}
                    </>
                  )}

                  {plexStatus === 'checking' && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 text-white/70 backdrop-blur-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-amber-400"></div>
                      Checking Plex...
                    </div>
                  )}

                  {plexStatus === 'available' && (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600/30 text-green-200 font-medium backdrop-blur-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Available on Plex
                        {plexAvailability?.match?.server && (
                          <span className="ml-1 px-2 py-0.5 rounded text-xs bg-green-600/40 text-green-100">
                            {plexAvailability.match.server}
                          </span>
                        )}
                        {plexAvailability?.match?.quality && (
                          <span className="ml-1 px-2 py-0.5 rounded text-xs bg-green-600/50 text-green-100">
                            {plexAvailability.match.quality}
                          </span>
                        )}
                      </div>
                      {!plexRequest && (
                        <button
                          onClick={handleReportBadFile}
                          disabled={plexSubmitting}
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-600/20 text-orange-200 hover:bg-orange-600/40 text-sm font-medium transition-all backdrop-blur-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Report Bad File
                        </button>
                      )}
                      {plexRequest?.status === 'bad_file' && (
                        <span className="px-3 py-2 rounded-md bg-orange-600/30 text-orange-200 text-sm font-medium backdrop-blur-sm">
                          Bad file reported
                        </span>
                      )}
                    </>
                  )}

                  {plexStatus === 'unavailable' && (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 text-white/60 font-medium backdrop-blur-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Not on Plex
                        {plexAvailability?.serversSearched && plexAvailability.serversSearched > 1 && (
                          <span className="text-xs text-white/40 ml-1">
                            ({plexAvailability.serversSearched} servers checked)
                          </span>
                        )}
                      </div>
                      {!plexRequest && user && (
                        <button
                          onClick={handlePlexRequest}
                          disabled={plexSubmitting}
                          className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600/30 text-amber-200 hover:bg-amber-600/50 font-medium transition-all backdrop-blur-sm"
                        >
                          {plexSubmitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-amber-400"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                          Request to Add
                        </button>
                      )}
                      {plexRequest && (
                        <span className={`px-3 py-2 rounded-md text-sm font-medium backdrop-blur-sm ${
                          plexRequest.status === 'pending' ? 'bg-yellow-600/30 text-yellow-200' :
                          plexRequest.status === 'approved' ? 'bg-blue-600/30 text-blue-200' :
                          plexRequest.status === 'added' ? 'bg-green-600/30 text-green-200' :
                          'bg-red-600/30 text-red-200'
                        }`}>
                          {plexRequest.status === 'pending' && 'Requested - Pending'}
                          {plexRequest.status === 'approved' && 'Request Approved'}
                          {plexRequest.status === 'added' && 'Added to Plex'}
                          {plexRequest.status === 'rejected' && 'Request Rejected'}
                        </span>
                      )}
                    </>
                  )}

                  {plexStatus === 'error' && (
                    <button
                      onClick={handleCheckPlex}
                      className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-600/20 text-red-200 hover:bg-red-600/40 font-medium transition-all backdrop-blur-sm"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry Plex Check
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto py-8">
            {/* My Note */}
            {watchlistItem && (
              <div className="mb-8 bg-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">My Note</h2>
                  <button
                    onClick={toggleNotePrivacy}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      noteIsPrivate
                        ? 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                        : 'bg-green-900/30 border-green-700 text-green-400 hover:border-green-600'
                    }`}
                    title={noteIsPrivate ? 'Private — click to share with friends' : 'Shared with friends — click to make private'}
                  >
                    {noteIsPrivate ? (
                      <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg><span>Private</span></>
                    ) : (
                      <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg><span>Shared</span></>
                    )}
                  </button>
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add your thoughts about this title..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none mb-3"
                />
                <button
                  onClick={saveNote}
                  disabled={noteSaving}
                  className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {noteSaving ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            )}

            {/* Friends' Notes */}
            {friendsNotes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-3">Friends' Notes</h2>
                <div className="space-y-3">
                  {friendsNotes.map(fn => (
                    <div key={fn.user_id} className="bg-gray-800 rounded-xl p-4 flex gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                        {fn.avatar_url ? (
                          <img src={fn.avatar_url} alt={fn.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-gray-300">{fn.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{fn.username}</span>
                          <span className="text-xs text-gray-500">{new Date(fn.updated_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{fn.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cast.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Top Billed Cast</h2>
                  {cast.length > 10 && !showAllCast && (
                    <button
                      onClick={() => setShowAllCast(true)}
                      className="text-blue-500 hover:text-blue-400 font-medium text-sm transition-colors"
                    >
                      View All Cast ({cast.length})
                    </button>
                  )}
                  {showAllCast && (
                    <button
                      onClick={() => setShowAllCast(false)}
                      className="text-blue-500 hover:text-blue-400 font-medium text-sm transition-colors"
                    >
                      Show Less
                    </button>
                  )}
                </div>
                <div className={showAllCast ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' : 'flex overflow-x-auto gap-4 pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800'}>
                  {(showAllCast ? cast : cast.slice(0, 10)).map((member) => (
                    <Link
                      key={member.id}
                      to={`/person/${member.id}`}
                      className={`${showAllCast ? '' : 'flex-none'} w-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all group`}
                    >
                      <img
                        src={tmdbService.getImageUrl(member.profile_path, 'w500')}
                        alt={member.name}
                        className="w-full h-44 object-cover group-hover:opacity-75 transition-opacity"
                      />
                      <div className="p-3">
                        <p className="font-semibold text-white text-sm truncate group-hover:text-blue-500 transition-colors">{member.name}</p>
                        <p className="text-gray-400 text-xs truncate">{member.character}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {mediaType === 'tv' && 'number_of_seasons' in details && watchlistItem && (
              <div className="max-w-7xl mx-auto py-8">
                <EpisodeTracker
                  tvId={details.id}
                  numberOfSeasons={details.number_of_seasons}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        tmdbId={details.id}
        mediaType={mediaType!}
        title={title}
        watchlistNote={noteText}
      />

      <RecommendModal
        isOpen={showRecommendModal}
        onClose={() => setShowRecommendModal(false)}
        tmdbId={details.id}
        mediaType={mediaType!}
        title={title}
        initialNote={noteText}
      />
    </Layout>
  );
}



