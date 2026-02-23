import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  profile_count: number;
  lists_count: number;
  shares_count: number;
}

interface UserDetailsDrawerProps {
  user: UserData | null;
  onClose: () => void;
  onRefresh: () => void;
}

function UserDetailsDrawer({ user, onClose, onRefresh }: UserDetailsDrawerProps) {
  const { addToast } = useToast();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  if (!user) return null;

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (error) throw error;

      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'password_reset',
        p_title: 'Password Reset',
        p_message: 'Your password has been reset by the administrator. Please use your new password to log in.',
      });

      await supabase.rpc('log_admin_action', {
        p_action_type: 'password_reset',
        p_target_user_id: user.id,
        p_details: `Reset password for user ${user.email}`,
      });

      addToast('Password reset successfully', 'success');
      setShowPasswordReset(false);
      setNewPassword('');
      onRefresh();
    } catch (error: any) {
      addToast(error.message || 'Failed to reset password', 'error');
    }
  }

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
      <div className="bg-gray-800 h-full w-full max-w-2xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">User Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Basic Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">User ID:</span>
                  <span className="text-white font-mono text-xs">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white">{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Statistics</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-400">{user.profile_count}</div>
                  <div className="text-gray-400 text-xs">Profiles</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{user.lists_count}</div>
                  <div className="text-gray-400 text-xs">Lists</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">{user.shares_count}</div>
                  <div className="text-gray-400 text-xs">Shares</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowPasswordReset(!showPasswordReset)}
                  className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Reset Password
                </button>

                {showPasswordReset && (
                  <div className="bg-gray-600 rounded-lg p-4 space-y-3">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={generatePassword}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                      >
                        Generate
                      </button>
                    </div>
                    <button
                      onClick={handleResetPassword}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Confirm Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter((user) =>
          user.email.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) throw authError;

      const usersWithStats = await Promise.all(
        (authUsers?.users || []).map(async (user) => {
          const [profilesCount, listsCount, sharesCount] = await Promise.all([
            supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('custom_lists').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('list_shares').select('id', { count: 'exact', head: true }).eq('shared_with_user_id', user.id),
          ]);

          return {
            id: user.id,
            email: user.email || 'No email',
            created_at: user.created_at,
            profile_count: profilesCount.count || 0,
            lists_count: listsCount.count || 0,
            shares_count: sharesCount.count || 0,
          };
        })
      );

      setUsers(usersWithStats);
      setFilteredUsers(usersWithStats);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading users...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
            <p className="text-gray-400">Manage all users in the system</p>
          </div>
          <div className="text-white bg-gray-800 px-4 py-2 rounded-lg">
            Total Users: <span className="font-bold">{users.length}</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email or user ID..."
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Profiles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Lists
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Shares
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {user.profile_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {user.lists_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {user.shares_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          View Details
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

      {selectedUser && (
        <UserDetailsDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRefresh={loadUsers}
        />
      )}
    </AdminLayout>
  );
}
