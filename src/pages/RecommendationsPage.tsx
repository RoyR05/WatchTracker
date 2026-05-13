import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { tmdbService } from '../services/tmdb';

interface Recommendation {
  id: string;
  from_user_id: string;
  to_user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  message: string;
  status: 'pending' | 'viewed' | 'added' | 'watched' | 'dismissed';
  created_at: string;
  viewed_at: string | null;
  actioned_at: string | null;
  from_user: {
    username: string;
    avatar_url: string | null;
  };
  to_user: {
    username: string;
    avatar_url: string | null;
  };
}

interface MediaDetails {
  title: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
}

export default function RecommendationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [mediaDetails, setMediaDetails] = useState<Record<string, MediaDetails>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [user, activeTab]);

  async function loadRecommendations() {
    if (!user) return;

    setLoading(true);
    try {
      const query = supabase
        .from('recommendations')
        .select(`
          *,
          from_user:profiles!recommendations_from_user_id_fkey(username, avatar_url),
          to_user:profiles!recommendations_to_user_id_fkey(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'received') {
        query.eq('to_user_id', user.id);
      } else {
        query.eq('from_user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const recs = (data || []).map(rec => ({
        ...rec,
        from_user: Array.isArray(rec.from_user) ? rec.from_user[0] : rec.from_user,
        to_user: Array.isArray(rec.to_user) ? rec.to_user[0] : rec.to_user,
      }));

      setRecommendations(recs);

      const uniqueKeys = [...new Set(recs.map(r => `${r.media_type}-${r.tmdb_id}`))];
      const detailEntries = await Promise.all(
        uniqueKeys.map(async key => {
          const [type, idStr] = key.split('-');
          try {
            const data = type === 'movie'
              ? await tmdbService.getMovieDetails(parseInt(idStr))
              : await tmdbService.getTVShowDetails(parseInt(idStr));
            return [key, {
              title: 'title' in data ? data.title : data.name,
              poster_path: data.poster_path,
              release_date: 'release_date' in data ? data.release_date : undefined,
              first_air_date: 'first_air_date' in data ? data.first_air_date : undefined,
            }] as const;
          } catch {
            return null;
          }
        })
      );
      const details: Record<string, MediaDetails> = {};
      for (const entry of detailEntries) {
        if (entry) details[entry[0]] = entry[1];
      }
      setMediaDetails(details);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(recId: string, status: Recommendation['status']) {
    setUpdating(recId);
    try {
      const { error } = await supabase
        .from('recommendations')
        .update({ status })
        .eq('id', recId);

      if (error) throw error;

      setRecommendations(prev =>
        prev.map(rec => rec.id === recId ? { ...rec, status } : rec)
      );
    } catch (error) {
      console.error('Error updating recommendation:', error);
    } finally {
      setUpdating(null);
    }
  }

  const pendingCount = recommendations.filter(r => r.status === 'pending').length;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Recommendations</h1>
          <p className="text-gray-400">Share and discover great content with friends</p>
        </div>

        <div className="flex space-x-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'received'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Received
            {activeTab === 'received' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'sent'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Sent
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <p className="text-gray-400">
              {activeTab === 'received'
                ? "You haven't received any recommendations yet"
                : "You haven't sent any recommendations yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => {
              const mediaKey = `${rec.media_type}-${rec.tmdb_id}`;
              const media = mediaDetails[mediaKey];
              const isReceived = activeTab === 'received';

              return (
                <div
                  key={rec.id}
                  className={`bg-gray-800 rounded-lg overflow-hidden transition-all ${
                    rec.status === 'pending' && isReceived ? 'ring-2 ring-primary-500' : ''
                  }`}
                >
                  <div className="flex">
                    <Link
                      to={`/details/${rec.media_type}/${rec.tmdb_id}`}
                      className="flex-shrink-0 w-24 sm:w-32"
                    >
                      {media ? (
                        <img
                          src={tmdbService.getImageUrl(media.poster_path)}
                          alt={media.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                          </svg>
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 p-4 sm:p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <Link
                            to={`/details/${rec.media_type}/${rec.tmdb_id}`}
                            className="text-lg font-semibold text-white hover:text-primary-400 transition-colors"
                          >
                            {media?.title || 'Loading...'}
                          </Link>
                          <p className="text-sm text-gray-400 mt-1">
                            {isReceived ? (
                              <>
                                Recommended by <span className="text-primary-400 font-medium">{rec.from_user.username}</span>
                              </>
                            ) : (
                              <>
                                Recommended to <span className="text-primary-400 font-medium">{rec.to_user.username}</span>
                              </>
                            )}
                            {' • '}
                            {new Date(rec.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            rec.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : rec.status === 'watched'
                              ? 'bg-green-500/20 text-green-400'
                              : rec.status === 'added'
                              ? 'bg-blue-500/20 text-blue-400'
                              : rec.status === 'dismissed'
                              ? 'bg-gray-500/20 text-gray-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                        </span>
                      </div>

                      {rec.message && (
                        <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                          <p className="text-gray-300 text-sm italic">"{rec.message}"</p>
                        </div>
                      )}

                      {isReceived && rec.status === 'pending' && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => updateStatus(rec.id, 'added')}
                            disabled={updating === rec.id}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                          >
                            Add to Watchlist
                          </button>
                          <button
                            onClick={() => updateStatus(rec.id, 'watched')}
                            disabled={updating === rec.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            Already Watched
                          </button>
                          <button
                            onClick={() => updateStatus(rec.id, 'dismissed')}
                            disabled={updating === rec.id}
                            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            Not Interested
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
