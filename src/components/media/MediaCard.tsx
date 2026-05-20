import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tmdbService } from '../../services/tmdb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { AddToListModal } from '../lists/AddToListModal';
import { RecommendModal } from '../recommendations/RecommendModal';
import { preferencesService } from '../../services/preferences';
import type { Movie, TVShow } from '../../services/tmdb';
import type { Database } from '../../types/database.types';

interface MediaCardProps {
  item: Movie | TVShow;
  mediaType: 'movie' | 'tv';
  initialPreference?: 'like' | 'dislike' | null;
  onDislike?: (tmdbId: number) => void;
  onHide?: (tmdbId: number) => void;
}

type WatchlistStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';

export function MediaCard({ item, mediaType, initialPreference = null, onDislike, onHide }: MediaCardProps) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const title = 'title' in item ? item.title : item.name;
  const date = 'release_date' in item ? item.release_date : item.first_air_date;
  const year = date ? new Date(date).getFullYear() : 'N/A';
  const [imageError, setImageError] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [preference, setPreference] = useState<'like' | 'dislike' | null>(initialPreference);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (initialPreference !== null) return;
    async function loadPreference() {
      if (!user) return;
      const pref = await preferencesService.getPreference(item.id, mediaType, user.id);
      setPreference(pref);
    }
    loadPreference();
  }, [user, item.id, mediaType, initialPreference]);

  async function handleLike() {
    if (!user) {
      toast.error('Please sign in to like content');
      return;
    }

    try {
      if (preference === 'like') {
        await preferencesService.removePreference(item.id, mediaType, 'like', user.id);
        setPreference(null);
        toast.success('Removed like');
      } else {
        await preferencesService.setPreference(item.id, mediaType, 'like', user.id);
        setPreference('like');
        toast.success('Added to liked');
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    }
  }

  async function handleDislike() {
    if (!user) {
      toast.error('Please sign in to dislike content');
      return;
    }

    try {
      if (preference === 'dislike') {
        await preferencesService.removePreference(item.id, mediaType, 'dislike', user.id);
        setPreference(null);
        toast.success('Removed dislike');
      } else {
        await preferencesService.setPreference(item.id, mediaType, 'dislike', user.id);
        setPreference('dislike');
        toast.success('Added to disliked');
        onDislike?.(item.id);
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    }
  }

  async function addToWatchlist(status: WatchlistStatus) {
    if (!user) {
      toast.error('Please sign in to add to watchlist');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('watchlist_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('tmdb_id', item.id)
        .eq('media_type', mediaType)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('watchlist_items')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        toast.success(`Updated to ${status}`);
      } else {
        const newItem: Database['public']['Tables']['watchlist_items']['Insert'] = {
          user_id: user.id,
          tmdb_id: item.id,
          media_type: mediaType,
          status,
          title,
          poster_path: item.poster_path,
          media_year: typeof year === 'number' ? year : null,
        };

        await supabase.from('watchlist_items').insert(newItem);
        toast.success(`Added to ${status}`);
      }

      // Refresh every watchlist section on the dashboard
      queryClient.invalidateQueries({ queryKey: ['watchlist', user.id] });

      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      toast.error('Failed to update watchlist');
    }
  }

  const swipeGesture = useSwipeGesture({
    onSwipeRight: () => {
      addToWatchlist('plan_to_watch');
      animateSwipe(100);
    },
    onSwipeLeft: () => {
      addToWatchlist('completed');
      animateSwipe(-100);
    },
    threshold: 80,
  });

  function animateSwipe(offset: number) {
    setSwipeOffset(offset);
    setTimeout(() => setSwipeOffset(0), 300);
  }

  return (
    <>
      <div
        ref={cardRef}
        className="group block relative"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset !== 0 ? 'transform 0.3s ease-out' : 'none',
        }}
        {...swipeGesture}
      >
        <Link to={`/details/${mediaType}/${item.id}`} className="block">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
            <img
              src={imageError ? tmdbService.getImageUrl(null) : tmdbService.getImageUrl(item.poster_path, 'w342')}
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            {item.vote_average > 0 && (
              <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 pointer-events-none">
                <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs font-semibold text-white">{item.vote_average.toFixed(1)}</span>
              </div>
            )}
            {onHide && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onHide(item.id);
                }}
                className="absolute top-1.5 right-1.5 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-gray-300 hover:text-white hover:bg-black/80 transition-colors"
                title="Hide from feed"
                aria-label="Hide from feed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                </svg>
              </button>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 group-hover:delay-0">
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLike();
                  }}
                  className={`p-2 rounded-full backdrop-blur-sm transition-all ${
                    preference === 'like'
                      ? 'bg-green-500 text-white'
                      : 'bg-black/50 text-white hover:bg-green-500/80'
                  }`}
                  title={preference === 'like' ? 'Remove Like' : 'Like'}
                >
                  <svg className="w-5 h-5" fill={preference === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDislike();
                  }}
                  className={`p-2 rounded-full backdrop-blur-sm transition-all ${
                    preference === 'dislike'
                      ? 'bg-red-500 text-white'
                      : 'bg-black/50 text-white hover:bg-red-500/80'
                  }`}
                  title={preference === 'dislike' ? 'Remove Dislike' : 'Dislike'}
                >
                  <svg className="w-5 h-5" fill={preference === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-yellow-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-sm font-medium text-white line-clamp-1 group-hover:text-primary-400 transition-colors">
              {title}
            </h3>
            <p className="text-xs text-gray-400 mt-1">{year}</p>
          </div>
        </Link>

        {swipeOffset > 50 && (
          <div className="absolute top-1/2 left-4 -translate-y-1/2 bg-green-500 text-white px-3 py-2 rounded-full shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        )}

        {swipeOffset < -50 && (
          <div className="absolute top-1/2 right-4 -translate-y-1/2 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>

      <AddToListModal
        isOpen={showAddToListModal}
        tmdbId={item.id}
        mediaType={mediaType}
        title={title}
        onClose={() => setShowAddToListModal(false)}
      />

      <RecommendModal
        isOpen={showRecommendModal}
        tmdbId={item.id}
        mediaType={mediaType}
        title={title}
        onClose={() => setShowRecommendModal(false)}
      />
    </>
  );
}
