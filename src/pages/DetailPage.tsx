import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { EpisodeTracker } from '../components/tv/EpisodeTracker';
import { RecommendModal } from '../components/recommendations/RecommendModal';
import { AddToListModal } from '../components/lists/AddToListModal';
import { SimilarContent } from '../components/media/SimilarContent';
import { tmdbService } from '../services/tmdb';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useToast } from '../contexts/ToastContext';
import { trackInteraction } from '../services/interactions';
import { preferencesService } from '../services/preferences';
import type { MovieDetails, TVShowDetails, CastMember, CrewMember, Video } from '../services/tmdb';
import type { Database } from '../types/database.types';

type WatchlistItem = Database['public']['Tables']['watchlist_items']['Row'];
type WatchlistStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';

export default function DetailPage() {
  const { mediaType, id } = useParams<{ mediaType: 'movie' | 'tv'; id: string }>();
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const toast = useToast();
  const [details, setDetails] = useState<MovieDetails | TVShowDetails | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null);
  const [preference, setPreference] = useState<'like' | 'dislike' | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showAllCast, setShowAllCast] = useState(false);

  useEffect(() => {
    async function loadDetails() {
      if (!id || !mediaType || !currentProfile) return;

      try {
        const [detailsData, creditsData, videosData, watchlistData, preferenceData] = await Promise.all([
          mediaType === 'movie'
            ? tmdbService.getMovieDetails(parseInt(id))
            : tmdbService.getTVShowDetails(parseInt(id)),
          mediaType === 'movie'
            ? tmdbService.getMovieCredits(parseInt(id))
            : tmdbService.getTVShowCredits(parseInt(id)),
          mediaType === 'movie'
            ? tmdbService.getMovieVideos(parseInt(id))
            : tmdbService.getTVShowVideos(parseInt(id)),
          supabase
            .from('watchlist_items')
            .select('*')
            .eq('profile_id', currentProfile.id)
            .eq('tmdb_id', parseInt(id))
            .eq('media_type', mediaType)
            .maybeSingle(),
          preferencesService.getPreference(parseInt(id), mediaType, currentProfile.id)
        ]);

        setDetails(detailsData);
        setCast(creditsData.cast);
        setCrew(creditsData.crew || []);

        const youtubeVideos = videosData.results.filter(
          (video) => video.site === 'YouTube'
        );
        setVideos(youtubeVideos);

        setWatchlistItem(watchlistData.data);
        setPreference(preferenceData);

        await trackInteraction(
          currentProfile.id,
          parseInt(id),
          mediaType,
          'viewed_detail',
          {
            genre_ids: detailsData.genres?.map((g: any) => g.id),
            cast: creditsData.cast.slice(0, 10).map((c: CastMember) => c.name),
            release_year: 'release_date' in detailsData
              ? new Date(detailsData.release_date).getFullYear()
              : undefined,
            first_air_year: 'first_air_date' in detailsData
              ? new Date(detailsData.first_air_date).getFullYear()
              : undefined
          }
        );
      } catch (error) {
        console.error('Error loading details:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDetails();
  }, [id, mediaType, currentProfile]);

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
    if (!user || !currentProfile || !id || !mediaType) {
      toast.error('Please sign in to like content');
      return;
    }

    setUpdating(true);
    try {
      if (preference === 'like') {
        await preferencesService.removePreference(parseInt(id), mediaType, 'like', currentProfile.id);
        setPreference(null);
        toast.success('Removed like');
      } else {
        const metadata = buildContentMetadata();
        await preferencesService.setPreference(parseInt(id), mediaType, 'like', currentProfile.id, metadata);
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
    if (!user || !currentProfile || !id || !mediaType) {
      toast.error('Please sign in to dislike content');
      return;
    }

    setUpdating(true);
    try {
      if (preference === 'dislike') {
        await preferencesService.removePreference(parseInt(id), mediaType, 'dislike', currentProfile.id);
        setPreference(null);
        toast.success('Removed dislike');
      } else {
        const metadata = buildContentMetadata();
        await preferencesService.setPreference(parseInt(id), mediaType, 'dislike', currentProfile.id, metadata);
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
    if (!user || !id || !mediaType || !currentProfile) return;

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

        if (status === 'completed') {
          await trackInteraction(currentProfile.id, parseInt(id), mediaType, 'completed');
        }
      } else {
        const newItem: Database['public']['Tables']['watchlist_items']['Insert'] = {
          user_id: user.id,
          profile_id: currentProfile.id,
          tmdb_id: parseInt(id),
          media_type: mediaType,
          status,
          started_at: status === 'watching' ? new Date().toISOString() : null,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        };

        const { data, error } = await supabase
          .from('watchlist_items')
          .insert(newItem)
          .select()
          .single();

        if (error) throw error;
        setWatchlistItem(data);

        await trackInteraction(currentProfile.id, parseInt(id), mediaType, 'added_to_watchlist');
        if (status === 'completed') {
          await trackInteraction(currentProfile.id, parseInt(id), mediaType, 'completed');
        }
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
                        <span className="text-white/40">•</span>
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
                        <span className="text-white/40">•</span>
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
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto py-8">
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

            <div className="mt-8">
              <SimilarContent mediaType={mediaType!} mediaId={parseInt(id!)} />
            </div>
          </div>
        </div>
      </div>

      <AddToListModal
        isOpen={showAddToListModal}
        onClose={() => setShowAddToListModal(false)}
        tmdbId={details.id}
        mediaType={mediaType!}
        title={title}
      />

      <RecommendModal
        isOpen={showRecommendModal}
        onClose={() => setShowRecommendModal(false)}
        tmdbId={details.id}
        mediaType={mediaType!}
        title={title}
      />
    </Layout>
  );
}
