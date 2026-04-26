import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { tmdbService } from '../../services/tmdb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useToast } from '../../contexts/ToastContext';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { useLongPress } from '../../hooks/useLongPress';
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { AddToListModal } from '../lists/AddToListModal';
import { RecommendModal } from '../recommendations/RecommendModal';
import { trackInteraction } from '../../services/interactions';
import { preferencesService } from '../../services/preferences';
import { plexService } from '../../services/plex';
import type { Movie, TVShow } from '../../services/tmdb';
import type { Database } from '../../types/database.types';

interface MediaCardProps {
  item: Movie | TVShow;
  mediaType: 'movie' | 'tv';
}

type WatchlistStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';

export function MediaCard({ item, mediaType }: MediaCardProps) {
  const { user } = useAuth();
  const { currentProfile } = useProfile();
  const toast = useToast();
  const navigate = useNavigate();
  const title = 'title' in item ? item.title : item.name;
  const date = 'release_date' in item ? item.release_date : item.first_air_date;
  const year = date ? new Date(date).getFullYear() : 'N/A';
  const [imageError, setImageError] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [preference, setPreference] = useState<'like' | 'dislike' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    async function loadPreference() {
      if (!user || !currentProfile) return;
      const pref = await preferencesService.getPreference(item.id, mediaType, currentProfile.id);
      setPreference(pref);
    }
    loadPreference();
  }, [user, currentProfile, item.id, mediaType]);

  async function handleLike() {
    if (!user || !currentProfile) {
      toast.error('Please sign in to like content');
      return;
    }

    try {
      if (preference === 'like') {
        await preferencesService.removePreference(item.id, mediaType, 'like', currentProfile.id);
        setPreference(null);
        toast.success('Removed like');
      } else {
        await preferencesService.setPreference(item.id, mediaType, 'like', currentProfile.id);
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
    if (!user || !currentProfile) {
      toast.error('Please sign in to dislike content');
      return;
    }

    try {
      if (preference === 'dislike') {
        await preferencesService.removePreference(item.id, mediaType, 'dislike', currentProfile.id);
        setPreference(null);
        toast.success('Removed dislike');
      } else {
        await preferencesService.setPreference(item.id, mediaType, 'dislike', currentProfile.id);
        setPreference('dislike');
        toast.success('Added to disliked');
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
    if (!user || !currentProfile) {
      toast.error('Please sign in to add to watchlist');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('watchlist_items')
        .select('id')
        .eq('profile_id', currentProfile.id)
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
          profile_id: currentProfile.id,
          tmdb_id: item.id,
          media_type: mediaType,
          status,
        };

        await supabase.from('watchlist_items').insert(newItem);
        await trackInteraction(currentProfile.id, item.id, mediaType, 'added_to_watchlist');
        toast.success(`Added to ${status}`);
      }

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

  const longPress = useLongPress({
    onLongPress: (e) => {
      e.preventDefault();
      const touch = 'touches' in e ? e.touches[0] : e as React.MouseEvent;
      setContextMenuPosition({
        x: touch.clientX,
        y: touch.clientY,
      });
      setShowContextMenu(true);
    },
  });

  function animateSwipe(offset: number) {
    setSwipeOffset(offset);
    setTimeout(() => setSwipeOffset(0), 300);
  }

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: preference === 'like' ? 'Remove Like' : 'Like',
      icon: (
        <svg className="w-5 h-5" fill={preference === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      ),
      onClick: handleLike,
    },
    {
      label: preference === 'dislike' ? 'Remove Dislike' : 'Dislike',
      icon: (
        <svg className="w-5 h-5" fill={preference === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
        </svg>
      ),
      onClick: handleDislike,
    },
    {
      label: 'View Details',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => navigate(`/details/${mediaType}/${item.id}`),
    },
    {
      label: 'Plan to Watch',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      onClick: () => addToWatchlist('plan_to_watch'),
    },
    {
      label: 'Watching',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => addToWatchlist('watching'),
    },
    {
      label: 'Completed',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => addToWatchlist('completed'),
    },
    {
      label: 'Add to List',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      onClick: () => setShowAddToListModal(true),
    },
    {
      label: 'Recommend',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      onClick: () => setShowRecommendModal(true),
    },
    {
      label: 'Check on Plex',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
        </svg>
      ),
      onClick: async () => {
        try {
          toast.info('Checking Plex...');
          const yearStr = typeof year === 'number' ? String(year) : null;
          const result = await plexService.checkAvailability(title, yearStr, mediaType);
          if (result.available) {
            const quality = result.match?.quality ? ` (${result.match.quality})` : '';
            toast.success(`Available on Plex${quality}`);
          } else {
            toast.error('Not on Plex');
          }
        } catch {
          toast.error('Failed to check Plex');
        }
      },
    },
  ];

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
        {...longPress}
      >
        <Link to={`/details/${mediaType}/${item.id}`} className="block">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
            <img
              src={imageError ? tmdbService.getImageUrl(null) : tmdbService.getImageUrl(item.poster_path)}
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {showContextMenu && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
        />
      )}

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
