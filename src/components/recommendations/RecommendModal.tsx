import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PlexAvailability } from '../../services/plex';

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
}

type WatchlistStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';
type RecStatus = 'pending' | 'viewed' | 'added' | 'watched' | 'dismissed';

const WATCHLIST_BADGE: Record<WatchlistStatus, { label: string; className: string }> = {
  watching:      { label: 'Watching',      className: 'bg-cyan-900/60 text-cyan-300 border-cyan-700' },
  completed:     { label: 'Completed',     className: 'bg-green-900/60 text-green-300 border-green-700' },
  plan_to_watch: { label: 'On their list', className: 'bg-yellow-900/60 text-yellow-300 border-yellow-700' },
  dropped:       { label: 'Dropped',       className: 'bg-gray-700/60 text-gray-400 border-gray-600' },
};

const REC_BADGE: Record<RecStatus, { label: string; className: string }> = {
  pending:   { label: 'Rec pending',    className: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  viewed:    { label: 'Rec seen',       className: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  added:     { label: 'Added from rec', className: 'bg-green-900/60 text-green-300 border-green-700' },
  watched:   { label: 'Already watched', className: 'bg-green-900/60 text-green-300 border-green-700' },
  dismissed: { label: 'Dismissed',      className: 'bg-red-900/60 text-red-300 border-red-700' },
};

interface RecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  initialNote?: string;
  plexAvailability?: PlexAvailability | null;
}

export function RecommendModal({
  isOpen, onClose, tmdbId, mediaType, title, initialNote, plexAvailability,
}: RecommendModalProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlistStatuses, setWatchlistStatuses] = useState<Map<string, WatchlistStatus>>(new Map());
  const [priorRecs, setPriorRecs] = useState<Map<string, RecStatus>>(new Map());
  const [sendError, setSendError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAll();
      setSelectedUsers([]);
      setMessage(initialNote ?? '');
      setSearchQuery('');
      setSendError(null);
      setDupWarning(false);
    }
  }, [isOpen, tmdbId, mediaType]);

  async function loadAll() {
    setLoading(true);
    try {
      const [friendsRes, watchlistRes, recsRes] = await Promise.all([
        // 6.3 — mutual-share friends only
        supabase.rpc('get_mutual_share_friends'),
        // 6.4 — watchlist status for this title among those friends
        supabase.rpc('get_friends_watchlist_status', {
          p_tmdb_id: tmdbId,
          p_media_type: mediaType,
        }),
        // prior recommendations I sent for this title
        supabase
          .from('recommendations')
          .select('to_user_id, status')
          .eq('from_user_id', user?.id)
          .eq('tmdb_id', tmdbId)
          .eq('media_type', mediaType),
      ]);

      setFriends((friendsRes.data as Friend[]) || []);

      const wMap = new Map<string, WatchlistStatus>();
      for (const row of (watchlistRes.data as { user_id: string; status: string }[]) || []) {
        wMap.set(row.user_id, row.status as WatchlistStatus);
      }
      setWatchlistStatuses(wMap);

      const rMap = new Map<string, RecStatus>();
      for (const row of (recsRes.data as { to_user_id: string; status: string }[]) || []) {
        // keep the most-recent one (query returns latest first via default order)
        if (!rMap.has(row.to_user_id)) {
          rMap.set(row.to_user_id, row.status as RecStatus);
        }
      }
      setPriorRecs(rMap);
    } catch (err) {
      console.error('RecommendModal loadAll error:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleUser(userId: string) {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
    setSendError(null);
    setDupWarning(false);
  }

  async function handleSend(force = false) {
    if (selectedUsers.length === 0) return;

    // Warn if any selected user has a pending/viewed rec
    if (!force) {
      const hasDup = selectedUsers.some(uid => {
        const s = priorRecs.get(uid);
        return s === 'pending' || s === 'viewed';
      });
      if (hasDup) {
        setDupWarning(true);
        return;
      }
    }

    setSending(true);
    setSendError(null);
    try {
      const rows = selectedUsers.map(toUserId => ({
        from_user_id: user?.id,
        to_user_id: toUserId,
        tmdb_id: tmdbId,
        media_type: mediaType,
        message: message.trim(),
      }));

      const { error } = await supabase.from('recommendations').insert(rows);
      if (error) {
        if (error.code === '23505') {
          setSendError('A recommendation already exists for one or more of the selected users.');
        } else {
          throw error;
        }
        return;
      }
      onClose();
    } catch (err) {
      console.error('Error sending recommendations:', err);
      setSendError('Failed to send recommendations. Please try again.');
    } finally {
      setSending(false);
      setDupWarning(false);
    }
  }

  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">Recommend to Friends</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Recommending: <span className="text-white font-medium">{title}</span>
          </p>

          {/* Plex availability banner (6.6) */}
          {plexAvailability?.available && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-900/30 border border-green-700/50 rounded-lg">
              <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-green-300">
                This is already on Plex
                {plexAvailability.match?.quality && ` (${plexAvailability.match.quality})`}
                {plexAvailability.match?.server && ` · ${plexAvailability.match.server}`}
                — your friends can watch it now!
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add a personal message (optional)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Why do you recommend this?"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select friends
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full px-3 py-2 mb-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            {loading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500 mx-auto" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <p className="text-gray-400 text-center py-4 text-sm">
                {friends.length === 0
                  ? 'No mutual friends yet — the admin needs to grant mutual sharing permissions.'
                  : 'No friends match your search.'}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {filteredFriends.map(f => {
                  const wStatus = watchlistStatuses.get(f.id);
                  const rStatus = priorRecs.get(f.id);
                  const isSelected = selectedUsers.includes(f.id);

                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleUser(f.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt={f.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold">
                            {f.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{f.username}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {wStatus && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${WATCHLIST_BADGE[wStatus].className}`}>
                              {WATCHLIST_BADGE[wStatus].label}
                            </span>
                          )}
                          {rStatus && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${REC_BADGE[rStatus].className}`}>
                              {REC_BADGE[rStatus].label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Checkmark */}
                      {isSelected && (
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Errors / warnings */}
          {sendError && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/50 rounded-lg px-3 py-2">
              {sendError}
            </p>
          )}

          {dupWarning && (
            <div className="text-sm text-orange-300 bg-orange-900/20 border border-orange-700/50 rounded-lg px-3 py-2">
              <p className="font-medium mb-1">Heads up</p>
              <p className="text-orange-400/80 text-xs">
                One or more selected friends already have a pending or viewed recommendation from you for this title.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSend(true)}
                  disabled={sending}
                  className="px-3 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  Send Anyway
                </button>
                <button
                  onClick={() => setDupWarning(false)}
                  className="px-3 py-1 bg-gray-600 text-gray-200 rounded text-xs hover:bg-gray-500 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSend(false)}
            disabled={selectedUsers.length === 0 || sending || dupWarning}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending…' : `Send to ${selectedUsers.length || 0}`}
          </button>
        </div>
      </div>
    </div>
  );
}
