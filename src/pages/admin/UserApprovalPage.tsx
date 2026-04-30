import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PendingUser {
  id: string;
  username: string;
  bio: string;
  created_at: string;
  approval_status: string;
  email?: string;
}

export function UserApprovalPage() {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPendingUsers();
  }, []);

  async function loadPendingUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error) {
      console.error('Error loading pending users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!user) return;
    setActionLoading(userId);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'account_approved',
        p_title: 'Account Approved',
        p_message: 'Your account has been approved. You can now access WatchTracker.',
        p_metadata: {},
      });

      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error approving user:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(userId: string) {
    if (!user) return;
    setActionLoading(userId);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error rejecting user:', error);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">User Approvals</h1>
          <p className="text-gray-400 mt-1">Review and approve new user registrations</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-400">No pending approvals</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((pendingUser) => (
              <div
                key={pendingUser.id}
                className="bg-gray-800 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium text-lg">
                    {pendingUser.username[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{pendingUser.username}</h3>
                    <p className="text-gray-400 text-sm">
                      Signed up {new Date(pendingUser.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handleApprove(pendingUser.id)}
                    disabled={actionLoading === pendingUser.id}
                    className="flex-1 sm:flex-none px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === pendingUser.id ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(pendingUser.id)}
                    disabled={actionLoading === pendingUser.id}
                    className="flex-1 sm:flex-none px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
