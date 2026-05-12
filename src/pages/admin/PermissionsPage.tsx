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
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const { addToast } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersResult, permsResult] = await Promise.all([
        supabase.rpc('list_users_for_admin'),
        supabase.from('global_share_permissions').select('*'),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (permsResult.error) throw permsResult.error;

      const userList: User[] = (usersResult.data || []).map((u: any) => ({
        id: u.id,
        email: u.email || 'No email',
      }));

      setUsers(userList);
      setPermissions(permsResult.data || []);

      // Auto-select first user on initial load
      if (userList.length > 0) {
        setSelectedUserId(prev => prev ?? userList[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      addToast('Failed to load permissions data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function hasPermission(userId: string, canShareWithId: string): boolean {
    return permissions.some(
      p => p.user_id === userId && p.can_share_with_user_id === canShareWithId && p.is_allowed
    );
  }

  function getShareCount(userId: string): number {
    return users.filter(u => u.id !== userId && hasPermission(userId, u.id)).length;
  }

  /** Optimistically update local state for a bidirectional toggle. */
  function applyOptimisticToggle(userA: string, userB: string, allow: boolean) {
    setPermissions(prev => {
      const without = prev.filter(
        p => !(
          (p.user_id === userA && p.can_share_with_user_id === userB) ||
          (p.user_id === userB && p.can_share_with_user_id === userA)
        )
      );
      if (!allow) return without;
      return [
        ...without,
        { user_id: userA, can_share_with_user_id: userB, is_allowed: true },
        { user_id: userB, can_share_with_user_id: userA, is_allowed: true },
      ];
    });
  }

  async function togglePermission(userId: string, canShareWithId: string) {
    if (saving) return;
    const currentlyAllowed = hasPermission(userId, canShareWithId);
    applyOptimisticToggle(userId, canShareWithId, !currentlyAllowed);
    setSaving(true);
    try {
      if (!currentlyAllowed) {
        await supabase.rpc('grant_bidirectional_share', { user_a: userId, user_b: canShareWithId });
      } else {
        await supabase.rpc('revoke_bidirectional_share', { user_a: userId, user_b: canShareWithId });
      }
      addToast(`Sharing ${currentlyAllowed ? 'revoked' : 'granted'} (bidirectional)`, 'success');
    } catch (error: any) {
      applyOptimisticToggle(userId, canShareWithId, currentlyAllowed); // roll back
      addToast(error.message || 'Failed to update permission', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function allowAllForUser(userId: string) {
    setSaving(true);
    try {
      for (const other of users.filter(u => u.id !== userId)) {
        await supabase.rpc('grant_bidirectional_share', { user_a: userId, user_b: other.id });
      }
      addToast('All permissions granted for this user', 'success');
      await loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to grant permissions', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function revokeAllForUser(userId: string) {
    setSaving(true);
    try {
      for (const other of users.filter(u => u.id !== userId)) {
        await supabase.rpc('revoke_bidirectional_share', { user_a: userId, user_b: other.id });
      }
      addToast('All permissions revoked for this user', 'success');
      await loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to revoke permissions', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function allowAllPermissions() {
    if (!confirm('Allow all users to share with all other users?')) return;
    setSaving(true);
    try {
      const rows: any[] = [];
      for (const a of users) {
        for (const b of users) {
          if (a.id !== b.id) rows.push({ user_id: a.id, can_share_with_user_id: b.id, is_allowed: true });
        }
      }
      const { error } = await supabase
        .from('global_share_permissions')
        .upsert(rows, { onConflict: 'user_id,can_share_with_user_id' });
      if (error) throw error;
      addToast('All permissions granted', 'success');
      await loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to grant all permissions', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function revokeAllPermissions() {
    if (!confirm('Revoke ALL sharing permissions for every user?')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('global_share_permissions')
        .update({ is_allowed: false })
        .neq('user_id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      addToast('All permissions revoked', 'success');
      await loadData();
    } catch (error: any) {
      addToast(error.message || 'Failed to revoke all permissions', 'error');
    } finally {
      setSaving(false);
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId) ?? null;
  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredOthers = users
    .filter(u => u.id !== selectedUserId)
    .filter(u => u.email.toLowerCase().includes(permSearch.toLowerCase()));

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading permissions…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-80px)] gap-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white">Global Share Permissions</h1>
            <p className="text-gray-400 text-sm mt-0.5">Select a user on the left to manage who they can share with</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={allowAllPermissions}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              Allow All
            </button>
            <button
              onClick={revokeAllPermissions}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
            >
              Revoke All
            </button>
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Left panel — user list */}
          <div className="w-72 flex-shrink-0 bg-gray-800 rounded-lg flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-700 flex-shrink-0">
              <input
                type="text"
                placeholder="Search users…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.map(user => {
                const count = getShareCount(user.id);
                const total = users.length - 1;
                const isSelected = user.id === selectedUserId;
                const statusColor =
                  count === total ? 'text-green-400' :
                  count === 0    ? 'text-red-400'   :
                                   'text-amber-400';
                return (
                  <button
                    key={user.id}
                    onClick={() => { setSelectedUserId(user.id); setPermSearch(''); }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-700/50 transition-colors ${
                      isSelected
                        ? 'bg-primary-600/20 border-l-2 border-l-primary-500'
                        : 'hover:bg-gray-700/60'
                    }`}
                  >
                    <p className="text-sm font-medium text-white truncate">
                      {user.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    <p className={`text-xs mt-1 font-medium ${statusColor}`}>
                      Shares with {count} of {total}
                    </p>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">No users found</p>
              )}
            </div>
          </div>

          {/* Right panel — permission toggles */}
          {selectedUser ? (
            <div className="flex-1 bg-gray-800 rounded-lg flex flex-col overflow-hidden min-w-0">

              {/* Panel header */}
              <div className="p-4 border-b border-gray-700 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-white truncate">
                      {selectedUser.email.split('@')[0]}
                    </h2>
                    <p className="text-sm text-gray-400 truncate">{selectedUser.email}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => allowAllForUser(selectedUser.id)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium disabled:opacity-50"
                    >
                      Allow All
                    </button>
                    <button
                      onClick={() => revokeAllForUser(selectedUser.id)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium disabled:opacity-50"
                    >
                      Deny All
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search users…"
                  value={permSearch}
                  onChange={e => setPermSearch(e.target.value)}
                  className="mt-3 w-full px-3 py-2 bg-gray-700 text-white rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Permission rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-700/50">
                {filteredOthers.map(other => {
                  const allowed = hasPermission(selectedUser.id, other.id);
                  return (
                    <div
                      key={other.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {other.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{other.email}</p>
                      </div>

                      <button
                        onClick={() => togglePermission(selectedUser.id, other.id)}
                        disabled={saving}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex-shrink-0 ml-4 ${
                          allowed
                            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {/* Toggle pill */}
                        <span
                          className={`relative inline-block w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                            allowed ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                              allowed ? 'left-[18px]' : 'left-0.5'
                            }`}
                          />
                        </span>
                        <span className="w-16 text-left">{allowed ? 'Can share' : 'Blocked'}</span>
                      </button>
                    </div>
                  );
                })}
                {filteredOthers.length === 0 && (
                  <p className="p-8 text-center text-gray-500 text-sm">No users match your search</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Select a user to manage their permissions</p>
            </div>
          )}
        </div>

        {/* ── Footer note ── */}
        <p className="text-xs text-gray-500 flex-shrink-0">
          Permissions are always <span className="text-gray-400 font-medium">bidirectional</span> — enabling sharing for one user automatically enables it for the other.
        </p>

      </div>
    </AdminLayout>
  );
}
