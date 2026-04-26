import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';
import { plexService } from '../../services/plex';
import { tmdbService } from '../../services/tmdb';
import { supabase } from '../../lib/supabase';
import type { PlexRequest } from '../../services/plex';

const statusConfig: Record<PlexRequest['status'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-600/30 text-yellow-200 border-yellow-600/40' },
  approved: { label: 'Approved', color: 'bg-blue-600/30 text-blue-200 border-blue-600/40' },
  added: { label: 'Added', color: 'bg-green-600/30 text-green-200 border-green-600/40' },
  rejected: { label: 'Rejected', color: 'bg-red-600/30 text-red-200 border-red-600/40' },
  bad_file: { label: 'Bad File', color: 'bg-orange-600/30 text-orange-200 border-orange-600/40' },
};

type RequestWithUser = PlexRequest & { profiles?: { username: string } | null };

export default function AdminPlexRequestsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<RequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await plexService.getAllRequests(filter);
      setRequests(data as RequestWithUser[]);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(requestId: string, status: PlexRequest['status'], notes?: string) {
    setActioningId(requestId);
    try {
      await plexService.updateRequestStatus(requestId, status, notes);

      const request = requests.find(r => r.id === requestId);
      if (request) {
        await createNotification(request, status, notes);
      }

      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, status, admin_notes: notes || r.admin_notes } : r)
      );
      toast.success(`Request ${status}`);
      setShowRejectInput(null);
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Failed to update request');
    } finally {
      setActioningId(null);
    }
  }

  async function createNotification(request: RequestWithUser, newStatus: string, notes?: string) {
    const statusMessages: Record<string, string> = {
      approved: `Your request for "${request.title}" has been approved and will be added to Plex soon.`,
      added: `"${request.title}" has been added to Plex and is now available to watch.`,
      rejected: `Your request for "${request.title}" was not added.${notes ? ` Reason: ${notes}` : ''}`,
    };

    const message = statusMessages[newStatus];
    if (!message) return;

    await supabase.from('notifications').insert({
      user_id: request.user_id,
      notification_type: 'plex_request_update',
      title: `Plex Request ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      message,
      metadata: {
        tmdb_id: request.tmdb_id,
        media_type: request.media_type,
        request_id: request.id,
        new_status: newStatus,
      },
    });
  }

  const tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'bad_file', label: 'Bad File' },
    { key: 'approved', label: 'Approved' },
    { key: 'added', label: 'Added' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  const pendingCount = requests.length;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Plex Requests</h1>
          <Link
            to="/admin/plex-settings"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Plex Settings
          </Link>
        </div>

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
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No {filter !== 'all' ? filter : ''} requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(request => {
              const cfg = statusConfig[request.status];
              const username = request.profiles?.username || 'Unknown User';
              const isActioning = actioningId === request.id;

              return (
                <div
                  key={request.id}
                  className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50"
                >
                  <div className="flex items-start gap-4">
                    <Link to={`/details/${request.media_type}/${request.tmdb_id}`} className="flex-shrink-0">
                      <img
                        src={tmdbService.getImageUrl(request.poster_path)}
                        alt={request.title}
                        className="w-14 h-20 object-cover rounded-md"
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          to={`/details/${request.media_type}/${request.tmdb_id}`}
                          className="text-white font-medium hover:text-amber-400 transition-colors"
                        >
                          {request.title}
                        </Link>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>By: {username}</span>
                        <span className="uppercase">{request.media_type}</span>
                        <span>{new Date(request.created_at).toLocaleDateString()}</span>
                      </div>
                      {request.admin_notes && (
                        <p className="text-xs text-gray-400 mt-1">Notes: {request.admin_notes}</p>
                      )}
                    </div>

                    {(request.status === 'pending' || request.status === 'approved' || request.status === 'bad_file') && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {request.status === 'pending' && (
                          <button
                            onClick={() => handleAction(request.id, 'approved')}
                            disabled={isActioning}
                            className="px-3 py-1.5 rounded-md bg-blue-600/30 text-blue-200 hover:bg-blue-600/50 text-xs font-medium transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {(request.status === 'pending' || request.status === 'approved') && (
                          <button
                            onClick={() => handleAction(request.id, 'added')}
                            disabled={isActioning}
                            className="px-3 py-1.5 rounded-md bg-green-600/30 text-green-200 hover:bg-green-600/50 text-xs font-medium transition-colors"
                          >
                            Mark Added
                          </button>
                        )}
                        {request.status === 'bad_file' && (
                          <button
                            onClick={() => handleAction(request.id, 'added')}
                            disabled={isActioning}
                            className="px-3 py-1.5 rounded-md bg-green-600/30 text-green-200 hover:bg-green-600/50 text-xs font-medium transition-colors"
                          >
                            Resolved
                          </button>
                        )}
                        {request.status === 'pending' && (
                          <>
                            {showRejectInput === request.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Reason (optional)"
                                  value={rejectNotes[request.id] || ''}
                                  onChange={e => setRejectNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
                                  className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-xs w-40 focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  onClick={() => handleAction(request.id, 'rejected', rejectNotes[request.id])}
                                  disabled={isActioning}
                                  className="px-3 py-1.5 rounded-md bg-red-600/30 text-red-200 hover:bg-red-600/50 text-xs font-medium transition-colors"
                                >
                                  Confirm
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowRejectInput(request.id)}
                                className="px-3 py-1.5 rounded-md bg-red-600/20 text-red-300 hover:bg-red-600/40 text-xs font-medium transition-colors"
                              >
                                Reject
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
