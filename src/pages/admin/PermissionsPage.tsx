import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';

interface User {
  id: string;
  email: string;
}

interface Permission {
  user_id: string;
  can_share_with_user_id: string;
  is_allowed: boolean;
}

export function PermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) throw authError;

      const userList = (authUsers?.users || []).map((u) => ({
        id: u.id,
        email: u.email || 'No email',
      }));

      const { data: perms, error: permsError } = await supabase
        .from('global_share_permissions')
        .select('*');

      if (permsError) throw permsError;

      setUsers(userList);
      setPermissions(perms || []);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast('Failed to load permissions data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function hasPermission(userId: string, canShareWithId: string): boolean {
    const perm = permissions.find(
      (p) => p.user_id === userId && p.can_share_with_user_id === canShareWithId
    );
    return perm?.is_allowed || false;
  }

  async function togglePermission(userId: string, canShareWithId: string) {
    try {
      const existingPerm = permissions.find(
        (p) => p.user_id === userId && p.can_share_with_user_id === canShareWithId
      );

      const newAllowedState = !existingPerm?.is_allowed;

      if (newAllowedState) {
        await supabase.rpc('grant_bidirectional_share', {
          user_a: userId,
          user_b: canShareWithId,
        });
      } else {
        await supabase.rpc('revoke_bidirectional_share', {
          user_a: userId,
          user_b: canShareWithId,
        });
      }

      const fromUser = users.find((u) => u.id === userId);
      const toUser = users.find((u) => u.id === canShareWithId);

      await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: newAllowedState ? 'permission_granted' : 'permission_revoked',
        p_title: newAllowedState ? 'Sharing Permission Granted' : 'Sharing Permission Revoked',
        p_message: newAllowedState
          ? `You can now share content with ${toUser?.email}`
          : `You can no longer share content with ${toUser?.email}`,
      });

      await supabase.rpc('create_notification', {
        p_user_id: canShareWithId,
        p_type: newAllowedState ? 'permission_granted' : 'permission_revoked',
        p_title: newAllowedState ? 'Sharing Permission Granted' : 'Sharing Permission Revoked',
        p_message: newAllowedState
          ? `You can now share content with ${fromUser?.email}`
          : `You can no longer share content with ${fromUser?.email}`,
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: newAllowedState ? 'permission_granted' : 'permission_revoked',
        p_target_user_id: userId,
        p_details: `${newAllowedState ? 'Granted' : 'Revoked'} bidirectional sharing between ${fromUser?.email} and ${toUser?.email}`,
      });

      addToast(
        `Permission ${newAllowedState ? 'granted' : 'revoked'} (bidirectional)`,
        'success'
      );

      await loadData();
    } catch (error: any) {
      console.error('Error toggling permission:', error);
      addToast(error.message || 'Failed to update permission', 'error');
    }
  }

  async function allowAllPermissions() {
    if (!confirm('Allow all users to share with all other users?')) return;

    try {
      const permissionsToCreate: any[] = [];

      for (const user of users) {
        for (const otherUser of users) {
          if (user.id !== otherUser.id) {
            permissionsToCreate.push({
              user_id: user.id,
              can_share_with_user_id: otherUser.id,
              is_allowed: true,
            });
          }
        }
      }

      const { error } = await supabase
        .from('global_share_permissions')
        .upsert(permissionsToCreate, {
          onConflict: 'user_id,can_share_with_user_id',
        });

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'bulk_permission_granted',
        p_details: 'Granted all users permission to share with all other users',
      });

      addToast('All permissions granted successfully', 'success');
      await loadData();
    } catch (error: any) {
      console.error('Error granting all permissions:', error);
      addToast(error.message || 'Failed to grant all permissions', 'error');
    }
  }

  async function revokeAllPermissions() {
    if (!confirm('Revoke all sharing permissions? This will prevent all users from sharing.')) return;

    try {
      const { error } = await supabase
        .from('global_share_permissions')
        .update({ is_allowed: false })
        .neq('user_id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        p_action_type: 'bulk_permission_revoked',
        p_details: 'Revoked all sharing permissions',
      });

      addToast('All permissions revoked successfully', 'success');
      await loadData();
    } catch (error: any) {
      console.error('Error revoking all permissions:', error);
      addToast(error.message || 'Failed to revoke all permissions', 'error');
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading permissions...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Global Share Permissions</h1>
            <p className="text-gray-400">Control who can share content with whom</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={allowAllPermissions}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Allow All
            </button>
            <button
              onClick={revokeAllPermissions}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              Revoke All
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="mb-4 text-sm text-gray-400">
            <p>✓ = Users can share with each other | ✗ = Sharing blocked</p>
            <p className="mt-1">Click any cell to toggle the permission (always bidirectional)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-gray-800 border border-gray-700 px-4 py-2 text-left text-xs font-medium text-gray-300">
                    User (can share with →)
                  </th>
                  {users.map((user) => (
                    <th
                      key={user.id}
                      className="border border-gray-700 px-2 py-2 text-xs text-gray-300 min-w-[120px]"
                    >
                      <div className="transform -rotate-45 origin-left whitespace-nowrap">
                        {user.email}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((fromUser) => (
                  <tr key={fromUser.id}>
                    <td className="sticky left-0 bg-gray-800 border border-gray-700 px-4 py-2 text-sm text-white font-medium">
                      {fromUser.email}
                    </td>
                    {users.map((toUser) => {
                      if (fromUser.id === toUser.id) {
                        return (
                          <td
                            key={toUser.id}
                            className="border border-gray-700 bg-gray-700 text-center"
                          >
                            <span className="text-gray-500">—</span>
                          </td>
                        );
                      }

                      const allowed = hasPermission(fromUser.id, toUser.id);

                      return (
                        <td
                          key={toUser.id}
                          className="border border-gray-700 text-center"
                        >
                          <button
                            onClick={() => togglePermission(fromUser.id, toUser.id)}
                            className={`w-full h-full py-3 transition-colors ${
                              allowed
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {allowed ? '✓' : '✗'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
          <h3 className="text-blue-400 font-semibold mb-2">How it works</h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• Permissions are always bidirectional: granting A to share with B also grants B to share with A</li>
            <li>• Green checkmarks mean sharing is allowed in both directions</li>
            <li>• Red crosses mean sharing is blocked in both directions</li>
            <li>• Both users receive notifications when permissions change</li>
            <li>• The admin can always share with everyone (broadcast enabled)</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
