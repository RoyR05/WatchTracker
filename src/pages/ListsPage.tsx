import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShareListModal } from '../components/lists/ShareListModal';
import type { Database } from '../types/database.types';

type CustomList = Database['public']['Tables']['custom_lists']['Row'];

interface ListWithCount extends CustomList {
  item_count: number;
}

export default function ListsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lists, setLists] = useState<ListWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedList, setSelectedList] = useState<CustomList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!authLoading) {
      loadLists();
    }
  }, [user, authLoading]);

  async function loadLists() {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('custom_lists')
        .select('*, list_items(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const listsWithCounts: ListWithCount[] = (data || []).map((list: any) => ({
        ...list,
        item_count: list.list_items?.[0]?.count ?? 0,
        list_items: undefined,
      }));

      setLists(listsWithCounts);
    } catch (error) {
      console.error('Error loading lists:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load lists');
    } finally {
      setLoading(false);
    }
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();

    if (!user || !profile || !newListName.trim()) {
      const errorMsg = !user ? 'No user logged in' : !profile ? 'Profile not loaded' : 'List name is required';
      toast.error(`Unable to create list: ${errorMsg}`);
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_lists')
        .insert({
          user_id: user.id,
          name: newListName,
          description: newListDescription,
          is_public: isPublic,
        });

      if (error) throw error;

      toast.success('List created successfully!');
      setNewListName('');
      setNewListDescription('');
      setIsPublic(false);
      setShowCreateModal(false);
      await loadLists();
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create list');
    }
  }

  async function deleteList(listId: string) {
    if (!confirm('Are you sure you want to delete this list?')) return;

    try {
      const { error } = await supabase
        .from('custom_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;
      toast.success('List deleted successfully');
      await loadLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      toast.error('Failed to delete list');
    }
  }

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-6">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || !profile) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-400 px-6 py-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Profile Not Loaded</h2>
            <p className="text-sm">Please refresh the page or log out and log back in.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">My Lists</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
          >
            Create List
          </button>
        </div>

        {lists.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No lists yet. Create your first list to organize your content!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {lists.map((list) => (
              <div
                key={list.id}
                onClick={() => navigate(`/lists/${list.id}`)}
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-semibold text-white group-hover:text-primary-400 transition-colors">{list.name}</h3>
                      {list.is_public && (
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded">Public</span>
                      )}
                    </div>
                    {list.description && (
                      <p className="text-gray-400 mt-2 line-clamp-2">{list.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-gray-500">
                        {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-gray-700">|</span>
                      <span className="text-sm text-gray-500">
                        Created {new Date(list.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedList(list);
                        setShowShareModal(true);
                      }}
                      className="text-primary-400 hover:text-primary-300 transition-colors p-1"
                      title="Share list"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteList(list.id);
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                      title="Delete list"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-4">Create New List</h2>
              <form onSubmit={createList} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    List Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Favorites, To Watch Later"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="isPublic"
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isPublic" className="ml-2 text-sm text-gray-300">
                    Make this list public
                  </label>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Create List
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {selectedList && (
          <ShareListModal
            isOpen={showShareModal}
            onClose={() => {
              setShowShareModal(false);
              setSelectedList(null);
            }}
            listId={selectedList.id}
            listName={selectedList.name}
          />
        )}
      </div>
    </Layout>
  );
}
