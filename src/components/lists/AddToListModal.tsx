import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../types/database.types';

type CustomList = Database['public']['Tables']['custom_lists']['Row'];
type ListItem = Database['public']['Tables']['list_items']['Row'];

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
}

export function AddToListModal({ isOpen, onClose, tmdbId, mediaType, title }: AddToListModalProps) {
  const { user, profile } = useAuth();
  const [lists, setLists] = useState<CustomList[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user, tmdbId, mediaType]);

  async function loadData() {
    if (!user) {
      console.log('[AddToList] No user, skipping load');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('[AddToList] Loading data for user:', user.id);
      setError(null);
      const [listsData, itemsData] = await Promise.all([
        supabase
          .from('custom_lists')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        supabase
          .from('list_items')
          .select('*, custom_lists!inner(user_id)')
          .eq('tmdb_id', tmdbId)
          .eq('media_type', mediaType)
          .eq('custom_lists.user_id', user.id)
      ]);

      if (listsData.error) {
        console.error('[AddToList] Error loading lists:', listsData.error);
        throw listsData.error;
      }
      if (itemsData.error) {
        console.error('[AddToList] Error loading list items:', itemsData.error);
        throw itemsData.error;
      }

      console.log('[AddToList] Loaded:', { lists: listsData.data?.length, items: itemsData.data?.length });
      setLists(listsData.data || []);
      setListItems(itemsData.data || []);
    } catch (error) {
      console.error('[AddToList] Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load lists');
    } finally {
      setLoading(false);
    }
  }

  async function toggleListItem(listId: string, isInList: boolean) {
    if (!user) return;

    setUpdating(listId);
    try {
      setError(null);
      if (isInList) {
        const item = listItems.find(i => i.list_id === listId);
        if (item) {
          const { error } = await supabase
            .from('list_items')
            .delete()
            .eq('id', item.id);

          if (error) throw error;
          setListItems(listItems.filter(i => i.id !== item.id));
        }
      } else {
        const { data, error } = await supabase
          .from('list_items')
          .insert({
            list_id: listId,
            tmdb_id: tmdbId,
            media_type: mediaType,
          })
          .select()
          .single();

        if (error) throw error;
        setListItems([...listItems, data]);
      }
    } catch (error) {
      console.error('Error toggling list item:', error);
      setError(error instanceof Error ? error.message : 'Failed to update list');
    } finally {
      setUpdating(null);
    }
  }

  async function createListAndAdd() {
    console.log('[AddToList] Create list and add called', { user: user?.id, profile: profile?.id, name: newListName });

    if (!user || !profile || !newListName.trim()) {
      const errorMsg = !user ? 'No user logged in' : !profile ? 'Profile not loaded' : 'List name is required';
      console.error('[AddToList] Cannot create list:', errorMsg);
      setError(`Unable to create list: ${errorMsg}. Please try logging out and back in.`);
      return;
    }

    setUpdating('creating');
    try {
      setError(null);
      console.log('[AddToList] Creating new list...');
      const { data: newList, error: listError } = await supabase
        .from('custom_lists')
        .insert({
          user_id: user.id,
          name: newListName,
        })
        .select()
        .single();

      if (listError) {
        console.error('[AddToList] List creation error:', listError);
        console.error('[AddToList] Error code:', listError.code);
        console.error('[AddToList] Error details:', listError.details);
        console.error('[AddToList] Error hint:', listError.hint);
        console.error('[AddToList] Error message:', listError.message);
        throw listError;
      }

      console.log('[AddToList] List created, adding item...');
      const { data: newItem, error: itemError } = await supabase
        .from('list_items')
        .insert({
          list_id: newList.id,
          tmdb_id: tmdbId,
          media_type: mediaType,
        })
        .select()
        .single();

      if (itemError) {
        console.error('[AddToList] Item creation error:', itemError);
        throw itemError;
      }

      console.log('[AddToList] Success! List and item created');
      setLists([...lists, newList]);
      setListItems([...listItems, newItem]);
      setNewListName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('[AddToList] Error creating list:', error);
      let message = 'Failed to create list';
      if (error instanceof Error) {
        message = error.message;
      }
      if (typeof error === 'object' && error !== null) {
        const err = error as any;
        if (err.code) message += ` (Code: ${err.code})`;
        if (err.hint) message += ` - Hint: ${err.hint}`;
        if (err.details) message += ` - Details: ${err.details}`;
      }
      setError(message);
    } finally {
      setUpdating(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Add to List</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">Select lists to add "{title}"</p>

        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <>
            {lists.length === 0 && !showCreateForm ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No lists yet</p>
                <button
                  onClick={() => {
                    if (!profile) {
                      setError('Profile not loaded. Please try logging out and back in.');
                      return;
                    }
                    setError(null);
                    setShowCreateForm(true);
                  }}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create First List
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {lists.map((list) => {
                    const isInList = listItems.some(item => item.list_id === list.id);
                    const isUpdating = updating === list.id;

                    return (
                      <button
                        key={list.id}
                        onClick={() => toggleListItem(list.id, isInList)}
                        disabled={isUpdating}
                        className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                          isInList
                            ? 'bg-primary-600/20 border border-primary-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                      >
                        <span className="font-medium">{list.name}</span>
                        <div className="flex items-center space-x-2">
                          {isUpdating ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          ) : isInList ? (
                            <svg className="w-5 h-5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!showCreateForm && (
                  <button
                    onClick={() => {
                      if (!profile) {
                        setError('Profile not loaded. Please try logging out and back in.');
                        return;
                      }
                      setError(null);
                      setShowCreateForm(true);
                    }}
                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create New List</span>
                  </button>
                )}
              </>
            )}

            {showCreateForm && (
              <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                <h3 className="text-white font-medium mb-3">Create New List</h3>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name"
                  className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      createListAndAdd();
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={createListAndAdd}
                    disabled={!newListName.trim() || updating === 'creating'}
                    className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {updating === 'creating' ? 'Creating...' : 'Create & Add'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewListName('');
                    }}
                    className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
