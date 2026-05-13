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

interface UserProfile {
  username: string | null;
  avatar_url: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function adminFetch(endpoint: string, body: object, token: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

interface DrawerProps {
  user: UserData;
  onClose: () => void;
  onRefresh: () => void;
  onDeleted: () => void;
}

function UserDetailsDrawer({ user, onClose, onRefresh, onDeleted }: DrawerProps) {
  const { addToast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data ?? { username: null, avatar_url: null });
        setNewUsername(data?.username ?? '');
      });
  }, [user.id]);

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await adminFetch('admin-update-user-password', { user_id: user.id, new_password: newPassword }, session!.access_token);
      await supabase.rpc('log_admin_action', { p_action_type: 'password_reset', p_target_user_id: user.id, p_details: `Reset password for ${user.email}` });
      addToast('Password reset successfully', 'success');
      setShowPasswordReset(false);
      setNewPassword('');
    } catch (err: any) {
      addToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleUpdateUsername() {
    if (!newUsername.trim()) { addToast('Username cannot be empty', 'error'); return; }
    setSavingUsername(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await adminFetch('admin-update-profile', { user_id: user.id, username: newUsername.trim() }, session!.access_token);
      setProfile(p => p ? { ...p, username: newUsername.trim() } : p);
      setEditingUsername(false);
      addToast('Username updated', 'success');
      onRefresh();
    } catch (err: any) {
      addToast(err.message || 'Failed to update username', 'error');
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleDeleteUser() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await adminFetch('admin-delete-user', { user_id: user.id }, session!.access_token);
      addToast(`User ${user.email} deleted`, 'success');
      onDeleted();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete user', 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    setNewPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
  }

  const initials = (profile?.username || user.email).charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-800 h-full w-full max-w-lg overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-600" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-white">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white">{profile?.username || '—'}</h2>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none flex-shrink-0">×</button>
        </div>

        <div className="flex-1 p-6 space-y-5">

          {/* Stats */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Account Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Joined</span>
                <span className="text-white">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Lists</span>
                <span className="text-white">{user.lists_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Shares</span>
                <span className="text-white">{user.shares_count}</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-400 flex-shrink-0">User ID</span>
                <span className="text-white font-mono text-xs text-right break-all">{user.id}</span>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Username</h3>
              {!editingUsername && (
                <button onClick={() => setEditingUsername(true)} className="text-xs text-primary-400 hover:text-primary-300 font-medium">
                  Edit
                </button>
              )}
            </div>
            {editingUsername ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500 focus:border-primary-500 focus:outline-none text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateUsername}
                    disabled={savingUsername}
                    className="flex-1 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {savingUsername ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingUsername(false); setNewUsername(profile?.username ?? ''); }}
                    className="flex-1 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white">
                {profile?.username ?? <span className="text-gray-500 italic">No username set</span>}
              </p>
            )}
          </div>

          {/* Reset Password */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Password</h3>
            {!showPasswordReset ? (
              <button
                onClick={() => setShowPasswordReset(true)}
                className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
              >
                Reset Password
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg border border-gray-500 focus:border-primary-500 focus:outline-none text-sm"
                  />
                  <button onClick={generatePassword} className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500 whitespace-nowrap">
                    Generate
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetPassword}
                    disabled={savingPassword}
                    className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingPassword ? 'Saving…' : 'Confirm Reset'}
                  </button>
                  <button
                    onClick={() => { setShowPasswordReset(false); setNewPassword(''); }}
                    className="flex-1 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete — danger zone */}
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
            <p className="text-xs text-gray-400 mb-3">
              Permanently deletes this user and all their data including watchlist, preferences, and shares. This cannot be undone.
            </p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                Delete User
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-300 font-medium">
                  Are you absolutely sure? All data for {user.email} will be permanently removed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteUser}
                    disabled={deleting}
                    className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Yes, Delete Permanently'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('list_users_for_admin');
      if (error) throw error;
      setUsers((data || []).map((row: any) => ({
        id: row.id,
        email: row.email || 'No email',
        created_at: row.created_at,
        profile_count: row.profile_count || 0,
        lists_count: row.lists_count || 0,
        shares_count: row.shares_count || 0,
      })));
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <AdminLayout><div className="text-white text-center py-12">Loading users…</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
            <p className="text-gray-400">Manage all users in the system</p>
          </div>
          <div className="text-white bg-gray-800 px-4 py-2 rounded-lg text-sm">
            Total: <span className="font-bold">{users.length}</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by email or user ID…"
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
          />
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                {['Email', 'Lists', 'Shares', 'Joined', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No users found</td></tr>
              ) : filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-white">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{user.lists_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{user.shares_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-primary-400 hover:text-primary-300 font-medium"
                    >
                      Manage →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <UserDetailsDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRefresh={loadUsers}
          onDeleted={() => { setSelectedUser(null); loadUsers(); }}
        />
      )}
    </AdminLayout>
  );
}
