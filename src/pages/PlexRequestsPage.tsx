import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { plexService } from '../services/plex';
import { tmdbService } from '../services/tmdb';
import type { PlexRequest } from '../services/plex';

const statusConfig: Record<PlexRequest['status'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-600/30 text-yellow-200' },
  approved: { label: 'Approved', color: 'bg-blue-600/30 text-blue-200' },
  added: { label: 'Added', color: 'bg-green-600/30 text-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-600/30 text-red-200' },
  bad_file: { label: 'Bad File', color: 'bg-orange-600/30 text-orange-200' },
};

export default function PlexRequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<PlexRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (user) loadRequests();
  }, [user]);

  async function loadRequests() {
    try {
      const data = await plexService.getMyRequests(user!.id);
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(requestId: string) {
    try {
      await plexService.cancelRequest(requestId);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Request cancelled');
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request');
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'bad_file', label: 'Bad File' },
    { key: 'approved', label: 'Approved' },
    { key: 'added', label: 'Added' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">My Plex Requests</h1>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({requests.filter(r => r.status === tab.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            <p className="text-lg font-medium">No requests yet</p>
            <p className="text-sm mt-1">Check Plex availability on any title's detail page to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(request => {
              const cfg = statusConfig[request.status];
              return (
                <div
                  key={request.id}
                  className="flex items-center gap-4 bg-gray-800/60 rounded-lg p-4 border border-gray-700/50"
                >
                  <Link to={`/details/${request.media_type}/${request.tmdb_id}`} className="flex-shrink-0">
                    <img
                      src={tmdbService.getImageUrl(request.poster_path)}
                      alt={request.title}
                      className="w-14 h-20 object-cover rounded-md"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/details/${request.media_type}/${request.tmdb_id}`}
                      className="text-white font-medium hover:text-amber-400 transition-colors line-clamp-1"
                    >
                      {request.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 uppercase">{request.media_type}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-xs text-gray-400">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {request.admin_notes && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        Admin: {request.admin_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                        title="Cancel request"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
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
