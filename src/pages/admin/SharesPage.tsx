import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';

interface ShareData {
  id: string;
  list_id: string;
  list_name: string;
  owner_email: string;
  shared_with_email: string;
  can_edit: boolean;
  created_at: string;
  has_permission: boolean;
  list_owner_id: string;
  shared_with_user_id: string;
}

export function SharesPage() {
  const [shares, setShares] = useState<ShareData[]>([]);
  const [filteredShares, setFilteredShares] = useState<ShareData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'allowed' | 'blocked'>('all');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadShares();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shares, searchQuery, filterType]);

  async function loadShares() {
    setLoading(true);
    try {
      const [usersResult, sharesResult, permsResult] = await Promise.all([
        supabase.rpc('list_users_for_admin'),
        supabase
          .from('list_shares')
          .select(`
            id,
            list_id,
            can_edit,
            created_at,
            shared_with_user_id,
            custom_lists!inner(name, user_id)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('global_share_permissions').select('user_id, can_share_with_user_id, is_allowed'),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (sharesResult.error) throw sharesResult.error;

      const userMap = new Map<string, string>((usersResult.data || []).map((u: any) => [u.id, u.email || 'Unknown']));

      const sharesWithDetails = (sharesResult.data || []).map((share: any) => {
        const listOwnerId = share.custom_lists.user_id;
        const perm = (permsResult.data || []).find(
          (p: any) => p.user_id === listOwnerId && p.can_share_with_user_id === share.shared_with_user_id
        );

        return {
          id: share.id,
          list_id: share.list_id,
          list_name: share.custom_lists.name,
          owner_email: userMap.get(listOwnerId) || 'Unknown',
          shared_with_email: userMap.get(share.shared_with_user_id) || 'Unknown',
          can_edit: share.can_edit,
          created_at: share.created_at,
          has_permission: perm?.is_allowed || false,
          list_owner_id: listOwnerId,
          shared_with_user_id: share.shared_with_user_id,
        };
      });

      setShares(sharesWithDetails);
    } catch (error) {
      console.error('Error loading shares:', error);
      addToast('Failed to load shares', 'error');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = shares;

    if (filterType === 'allowed') {
      filtered = filtered.filter((s) => s.has_permission);
    } else if (filterType === 'blocked') {
      filtered = filtered.filter((s) => !s.has_permission);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.list_name.toLowerCase().includes(query) ||
          s.owner_email.toLowerCase().includes(query) ||
          s.shared_with_email.toLowerCase().includes(query)
      );
    }

    setFilteredShares(filtered);
  }

  async function revokeShare(shareId: string, listName: string, ownerEmail: string, recipientEmail: string) {
    if (!confirm(`Revoke share of "${listName}" with ${recipientEmail}?`)) return;

    try {
      const { error } = await supabase
        .from('list_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'share_revoked',
        p_details: `Revoked share of list "${listName}" from ${ownerEmail} to ${recipientEmail}`,
      });

      addToast('Share revoked successfully', 'success');
      await loadShares();
    } catch (error: any) {
      console.error('Error revoking share:', error);
      addToast(error.message || 'Failed to revoke share', 'error');
    }
  }

  async function syncPermissions() {
    if (!confirm('Remove all shares that violate current global permissions?')) return;

    try {
      const blockedShares = shares.filter((s) => !s.has_permission);

      for (const share of blockedShares) {
        await supabase
          .from('list_shares')
          .delete()
          .eq('id', share.id);
      }

      await supabase.rpc('log_admin_action', {
        p_action_type: 'shares_synced',
        p_details: `Removed ${blockedShares.length} shares that violated global permissions`,
      });

      addToast(`Removed ${blockedShares.length} unauthorized shares`, 'success');
      await loadShares();
    } catch (error: any) {
      console.error('Error syncing permissions:', error);
      addToast(error.message || 'Failed to sync permissions', 'error');
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading shares...</div>
      </AdminLayout>
    );
  }

  const blockedCount = shares.filter((s) => !s.has_permission).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Share Management</h1>
            <p className="text-gray-400">Monitor and manage all list shares</p>
          </div>
          {blockedCount > 0 && (
            <button
              onClick={syncPermissions}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              Sync Permissions ({blockedCount} blocked)
            </button>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by list name, owner, or recipient..."
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
          />

          <div className="flex space-x-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterType === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All ({shares.length})
            </button>
            <button
              onClick={() => setFilterType('allowed')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterType === 'allowed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Allowed ({shares.filter((s) => s.has_permission).length})
            </button>
            <button
              onClick={() => setFilterType('blocked')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filterType === 'blocked'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Blocked ({blockedCount})
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    List Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Shared With
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Permission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredShares.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      No shares found
                    </td>
                  </tr>
                ) : (
                  filteredShares.map((share) => (
                    <tr key={share.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm text-white font-medium">
                        {share.list_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {share.owner_email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {share.shared_with_email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <span className="px-2 py-1 bg-gray-600 rounded text-xs">
                          {share.can_edit ? 'Can Edit' : 'View Only'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {share.has_permission ? (
                          <span className="px-2 py-1 bg-green-600 text-white rounded text-xs">
                            ✓ Allowed
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-600 text-white rounded text-xs">
                            ✗ Blocked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {new Date(share.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => revokeShare(share.id, share.list_name, share.owner_email, share.shared_with_email)}
                          className="text-red-400 hover:text-red-300 font-medium"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
