import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { plexService } from '../../services/plex';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import type { PlexClient, PlexDevicePermission } from '../../services/plex';

interface UserProfile {
  id: string;
  username: string;
}

interface AssignmentRow extends PlexDevicePermission {
  user_profiles: { username: string };
}

export function PlexDevicesPage() {
  const toast = useToast();

  const [clients, setClients] = useState<PlexClient[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  // Per-client assign form state
  const [assignForm, setAssignForm] = useState<Record<string, { userId: string; friendlyName: string }>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.allSettled([loadClients(), loadAssignments(), loadUsers()]);
  }

  async function loadClients() {
    setLoadingClients(true);
    try {
      const data = await plexService.getActiveClients();
      setClients(data);
      // Initialise form state for each client
      setAssignForm(prev => {
        const next = { ...prev };
        for (const c of data) {
          if (!next[c.clientIdentifier]) {
            next[c.clientIdentifier] = { userId: '', friendlyName: c.name };
          }
        }
        return next;
      });
    } catch {
      toast.error('Could not load active Plex clients.');
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadAssignments() {
    setLoadingAssignments(true);
    try {
      const data = await plexService.getAllDevicePermissions();
      setAssignments(data as AssignmentRow[]);
    } catch {
      toast.error('Could not load device assignments.');
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username')
      .order('username');
    setUsers((data ?? []) as UserProfile[]);
  }

  function assignmentsForClient(clientIdentifier: string) {
    return assignments.filter(a => a.client_identifier === clientIdentifier);
  }

  async function handleAssign(clientIdentifier: string) {
    const form = assignForm[clientIdentifier];
    if (!form?.userId || !form?.friendlyName.trim()) {
      toast.error('Select a user and enter a friendly name.');
      return;
    }
    setAssigning(clientIdentifier);
    try {
      await plexService.assignDevice(form.userId, clientIdentifier, form.friendlyName.trim());
      toast.success('Device assigned.');
      await loadAssignments();
      // Reset user selection
      setAssignForm(prev => ({ ...prev, [clientIdentifier]: { ...prev[clientIdentifier], userId: '' } }));
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('This device is already assigned to that user.');
      } else {
        toast.error('Failed to assign device.');
      }
    } finally {
      setAssigning(null);
    }
  }

  async function handleUnassign(id: string) {
    setUnassigning(id);
    try {
      await plexService.unassignDevice(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Assignment removed.');
    } catch {
      toast.error('Failed to remove assignment.');
    } finally {
      setUnassigning(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Plex Device Management</h1>
            <p className="text-gray-400 mt-1">Assign TVs and players to users so they can remote-play from the Detail page.</p>
          </div>
          <button
            onClick={loadClients}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 text-sm font-medium transition-colors"
          >
            ↻ Refresh Clients
          </button>
        </div>

        {/* Section A — Active Plex Clients */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Active Plex Clients</h2>
          {loadingClients ? (
            <div className="flex items-center gap-3 text-gray-400 py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-500" />
              Loading active clients from Plex…
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
              No active Plex player clients found. Make sure a device is online and signed in to the Master Plex account.
            </div>
          ) : (
            <div className="space-y-4">
              {clients.map(client => {
                const existing = assignmentsForClient(client.clientIdentifier);
                const form = assignForm[client.clientIdentifier] ?? { userId: '', friendlyName: client.name };
                const isBusy = assigning === client.clientIdentifier;

                return (
                  <div key={client.clientIdentifier} className="bg-gray-800 rounded-lg p-5 space-y-4">
                    {/* Client header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📺</span>
                          <span className="text-white font-semibold">{client.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-600/30 text-green-300 font-medium">Online</span>
                        </div>
                        <p className="text-gray-400 text-sm mt-0.5">
                          {client.product}{client.platform ? ` · ${client.platform}` : ''}
                        </p>
                        <p className="text-gray-600 text-xs mt-0.5 font-mono">{client.clientIdentifier}</p>
                      </div>
                    </div>

                    {/* Current assignments for this client */}
                    {existing.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assigned to</p>
                        <div className="flex flex-wrap gap-2">
                          {existing.map(a => (
                            <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-full text-sm">
                              <span className="text-white font-medium">{a.user_profiles.username}</span>
                              <span className="text-gray-400">"{a.friendly_name}"</span>
                              <button
                                onClick={() => handleUnassign(a.id)}
                                disabled={unassigning === a.id}
                                className="text-gray-500 hover:text-red-400 transition-colors ml-1 disabled:opacity-50"
                                title="Remove assignment"
                              >
                                {unassigning === a.id ? '…' : '×'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add assignment form */}
                    <div className="border-t border-gray-700 pt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add Assignment</p>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">User</label>
                          <select
                            value={form.userId}
                            onChange={e => setAssignForm(prev => ({ ...prev, [client.clientIdentifier]: { ...prev[client.clientIdentifier], userId: e.target.value } }))}
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                          >
                            <option value="">Select user…</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Friendly name</label>
                          <input
                            type="text"
                            value={form.friendlyName}
                            onChange={e => setAssignForm(prev => ({ ...prev, [client.clientIdentifier]: { ...prev[client.clientIdentifier], friendlyName: e.target.value } }))}
                            placeholder="e.g. Guest Room TV"
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                          />
                        </div>
                        <button
                          onClick={() => handleAssign(client.clientIdentifier)}
                          disabled={isBusy || !form.userId || !form.friendlyName.trim()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          {isBusy ? 'Assigning…' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section B — All Assignments */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">All Assignments</h2>
          {loadingAssignments ? (
            <div className="flex items-center gap-3 text-gray-400 py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-500" />
              Loading…
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
              No device assignments yet. Use the form above to assign a player to a user.
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Friendly Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Client Identifier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3 text-white font-medium">{a.user_profiles.username}</td>
                      <td className="px-4 py-3 text-gray-300">📺 {a.friendly_name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{a.client_identifier}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUnassign(a.id)}
                          disabled={unassigning === a.id}
                          className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                        >
                          {unassigning === a.id ? 'Removing…' : 'Unassign'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
