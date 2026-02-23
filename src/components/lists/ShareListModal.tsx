import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ListShare = Database['public']['Tables']['list_shares']['Row'];

interface ShareListModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
}

interface ShareWithProfile extends ListShare {
  profiles: Profile;
}

export function ShareListModal({ isOpen, onClose, listId, listName }: ShareListModalProps) {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, listId]);

  async function loadShares() {
    try {
      setLoading(true);
      console.log('[ShareList] Loading shares for list:', listId);
      const { data, error } = await supabase
        .from('list_shares')
        .select('*, profiles(*)')
        .eq('list_id', listId);

      if (error) throw error;
      console.log('[ShareList] Loaded shares:', data?.length || 0);
      setShares(data as ShareWithProfile[] || []);
    } catch (error) {
      console.error('[ShareList] Error loading shares:', error);
      setError(error instanceof Error ? error.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers() {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      console.log('[ShareList] Searching for users:', searchQuery);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user?.id || '')
        .limit(5);

      if (error) throw error;

      const alreadySharedIds = shares.map(s => s.shared_with_user_id);
      const filtered = (data || []).filter(profile => !alreadySharedIds.includes(profile.id));

      console.log('[ShareList] Found users:', filtered.length);
      setSearchResults(filtered);
    } catch (error) {
      console.error('[ShareList] Error searching users:', error);
      setError(error instanceof Error ? error.message : 'Failed to search users');
    } finally {
      setSearching(false);
    }
  }

  async function shareWithUser(userId: string, canEdit: boolean) {
    try {
      setError(null);
      console.log('[ShareList] Sharing list with user:', userId, 'canEdit:', canEdit);

      const { error } = await supabase
        .from('list_shares')
        .insert({
          list_id: listId,
          shared_with_user_id: userId,
          can_edit: canEdit,
        });

      if (error) throw error;

      console.log('[ShareList] List shared successfully');
      setSearchQuery('');
      setSearchResults([]);
      await loadShares();
    } catch (error) {
      console.error('[ShareList] Error sharing list:', error);
      setError(error instanceof Error ? error.message : 'Failed to share list');
    }
  }

  async function removeShare(shareId: string) {
    try {
      setError(null);
      console.log('[ShareList] Removing share:', shareId);

      const { error } = await supabase
        .from('list_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      console.log('[ShareList] Share removed successfully');
      await loadShares();
    } catch (error) {
      console.error('[ShareList] Error removing share:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove share');
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Share List</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">Share "{listName}" with other users</p>

        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Search users by username
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type username..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {searching && (
            <div className="mt-2 flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 space-y-2">
              {searchResults.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {profile.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-white font-medium">{profile.username}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => shareWithUser(profile.id, false)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                      title="View only"
                    >
                      View
                    </button>
                    <button
                      onClick={() => shareWithUser(profile.id, true)}
                      className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors"
                      title="Can edit"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="mt-2 text-sm text-gray-400">No users found</p>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Shared with</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : shares.length === 0 ? (
            <p className="text-gray-400 text-sm">Not shared with anyone yet</p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    {share.profiles.avatar_url ? (
                      <img
                        src={share.profiles.avatar_url}
                        alt={share.profiles.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {share.profiles.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{share.profiles.username}</p>
                      <p className="text-xs text-gray-400">
                        {share.can_edit ? 'Can edit' : 'View only'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeShare(share.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Remove access"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
