import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { tmdbService } from '../services/tmdb';
import type { Database } from '../types/database.types';
import type { Movie, TVShow } from '../services/tmdb';

type CustomList = Database['public']['Tables']['custom_lists']['Row'];
type ListItem = Database['public']['Tables']['list_items']['Row'];

interface ListItemWithMedia extends ListItem {
  media?: Movie | TVShow;
  mediaLoading?: boolean;
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<CustomList | null>(null);
  const [items, setItems] = useState<ListItemWithMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const loadList = useCallback(async () => {
    if (!id || !user) return;

    setLoading(true);
    try {
      const { data: listData, error: listError } = await supabase
        .from('custom_lists')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (listError) throw listError;
      if (!listData) {
        toast.error('List not found');
        navigate('/lists');
        return;
      }

      setList(listData);
      setEditName(listData.name);
      setEditDescription(listData.description || '');
      setEditPublic(listData.is_public);

      const { data: itemsData, error: itemsError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', id)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;

      const itemsWithMedia: ListItemWithMedia[] = (itemsData || []).map(item => ({
        ...item,
        mediaLoading: true,
      }));
      setItems(itemsWithMedia);

      const mediaPromises = (itemsData || []).map(async (item) => {
        try {
          const media = item.media_type === 'movie'
            ? await tmdbService.getMovieDetails(item.tmdb_id)
            : await tmdbService.getTVShowDetails(item.tmdb_id);
          return { id: item.id, media };
        } catch {
          return { id: item.id, media: undefined };
        }
      });

      const mediaResults = await Promise.all(mediaPromises);
      setItems(prev => prev.map(item => {
        const result = mediaResults.find(r => r.id === item.id);
        return {
          ...item,
          media: result?.media,
          mediaLoading: false,
        };
      }));
    } catch (error) {
      console.error('Error loading list:', error);
      toast.error('Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [id, user, navigate, toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function removeItem(itemId: string) {
    setRemoving(itemId);
    try {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item removed from list');
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    } finally {
      setRemoving(null);
    }
  }

  async function saveEdits() {
    if (!list || !editName.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_lists')
        .update({
          name: editName.trim(),
          description: editDescription.trim(),
          is_public: editPublic,
        })
        .eq('id', list.id);

      if (error) throw error;

      setList(prev => prev ? {
        ...prev,
        name: editName.trim(),
        description: editDescription.trim(),
        is_public: editPublic,
      } : null);
      setEditing(false);
      toast.success('List updated');
    } catch (error) {
      console.error('Error updating list:', error);
      toast.error('Failed to update list');
    } finally {
      setSaving(false);
    }
  }

  function startEditNote(item: ListItemWithMedia) {
    setEditingNoteId(item.id);
    setEditNoteText(item.notes ?? '');
    setTimeout(() => noteInputRef.current?.focus(), 50);
  }

  async function saveItemNote(itemId: string) {
    try {
      const { error } = await supabase
        .from('list_items')
        .update({ notes: editNoteText.trim() })
        .eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, notes: editNoteText.trim() } : i));
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setEditingNoteId(null);
    }
  }

  function getTitle(media: Movie | TVShow): string {
    return 'title' in media ? media.title : media.name;
  }

  function getYear(media: Movie | TVShow): string {
    const date = 'release_date' in media ? media.release_date : media.first_air_date;
    return date ? new Date(date).getFullYear().toString() : 'N/A';
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-96 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] rounded-lg mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!list) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto text-center py-16">
          <p className="text-gray-400 mb-4">List not found</p>
          <button
            onClick={() => navigate('/lists')}
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Back to Lists
          </button>
        </div>
      </Layout>
    );
  }

  const isOwner = user?.id === list.user_id;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/lists')}
          className="flex items-center text-gray-400 hover:text-white transition-colors mb-6 group"
        >
          <svg className="w-5 h-5 mr-1 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Lists
        </button>

        {editing ? (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Edit List</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="editName" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  id="editName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="editDescription" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div className="flex items-center">
                <input
                  id="editPublic"
                  type="checkbox"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="editPublic" className="ml-2 text-sm text-gray-300">Make this list public</label>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={saveEdits}
                  disabled={saving || !editName.trim()}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(list.name);
                    setEditDescription(list.description || '');
                    setEditPublic(list.is_public);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{list.name}</h1>
                  {list.is_public && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded font-medium">Public</span>
                  )}
                </div>
                {list.description && (
                  <p className="text-gray-400 mt-2">{list.description}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-gray-400 hover:text-white transition-colors p-2"
                  title="Edit list"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2m0 2a2 2 0 00-2 2v1h4V6a2 2 0 00-2-2zm-2 3v9a2 2 0 002 2h10a2 2 0 002-2V7H5zm4 3h6m-6 4h4" />
            </svg>
            <p className="text-gray-400 text-lg mb-2">This list is empty</p>
            <p className="text-gray-500 text-sm mb-6">
              Search for movies and TV shows to add them to this list
            </p>
            <Link
              to="/search"
              className="inline-flex items-center px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Content
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                <Link
                  to={`/details/${item.media_type}/${item.tmdb_id}`}
                  className="block"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
                    {item.mediaLoading ? (
                      <Skeleton className="w-full h-full" />
                    ) : (
                      <img
                        src={tmdbService.getImageUrl(item.media?.poster_path ?? null)}
                        alt={item.media ? getTitle(item.media) : 'Loading...'}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        {item.media && (
                          <div className="flex items-center space-x-1 text-yellow-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-sm font-medium">
                              {item.media.vote_average ? item.media.vote_average.toFixed(1) : 'N/A'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    {item.mediaLoading ? (
                      <>
                        <Skeleton className="h-4 w-3/4 mb-1" />
                        <Skeleton className="h-3 w-1/3" />
                      </>
                    ) : (
                      <>
                        <h3 className="text-sm font-medium text-white line-clamp-1 group-hover:text-primary-400 transition-colors">
                          {item.media ? getTitle(item.media) : `Unknown ${item.media_type}`}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {item.media ? getYear(item.media) : ''}
                        </p>
                        {editingNoteId === item.id ? (
                          <div className="mt-1.5" onClick={e => e.preventDefault()}>
                            <textarea
                              ref={noteInputRef}
                              value={editNoteText}
                              onChange={e => setEditNoteText(e.target.value)}
                              rows={2}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                              placeholder="Add a note..."
                            />
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={e => { e.preventDefault(); saveItemNote(item.id); }}
                                className="text-xs px-2 py-0.5 bg-primary-600 text-white rounded"
                              >Save</button>
                              <button
                                onClick={e => { e.preventDefault(); setEditingNoteId(null); }}
                                className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-start gap-1 min-h-[1rem]">
                            {item.notes && item.notes.trim() ? (
                              <p className="text-xs text-gray-400 italic line-clamp-2 flex-1">{item.notes}</p>
                            ) : isOwner ? (
                              <span className="text-xs text-gray-600 italic flex-1">No note</span>
                            ) : null}
                            {isOwner && (
                              <button
                                onClick={e => { e.preventDefault(); startEditNote(item); }}
                                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary-400"
                                title="Edit note"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Link>
                {isOwner && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    disabled={removing === item.id}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from list"
                  >
                    {removing === item.id ? (
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
