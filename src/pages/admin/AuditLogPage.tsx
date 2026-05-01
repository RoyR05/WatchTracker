import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';

interface AuditLog {
  id: number;
  admin_email: string;
  action_type: string;
  target_user_email: string | null;
  details: string;
  created_at: string;
  metadata: any;
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const actionTypes = [
    'all',
    'user_created',
    'user_updated',
    'user_deleted',
    'password_reset',
    'permission_granted',
    'permission_revoked',
    'share_revoked',
    'notification_sent',
    'bulk_permission_granted',
    'bulk_permission_revoked',
    'shares_synced',
  ];

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionTypeFilter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const [usersResult, logsResult] = await Promise.all([
        supabase.rpc('list_users_for_admin'),
        supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(500),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (logsResult.error) throw logsResult.error;

      const userMap = new Map((usersResult.data || []).map((u: any) => [u.id, u.email || 'Unknown']));

      const logsWithEmails = (logsResult.data || []).map((log: any) => ({
        ...log,
        admin_email: userMap.get(log.admin_user_id) || 'Unknown',
        target_user_email: log.target_user_id ? (userMap.get(log.target_user_id) || null) : null,
      }));

      setLogs(logsWithEmails);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      addToast('Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = logs;

    if (actionTypeFilter !== 'all') {
      filtered = filtered.filter((log) => log.action_type === actionTypeFilter);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.details.toLowerCase().includes(query) ||
          log.admin_email.toLowerCase().includes(query) ||
          log.target_user_email?.toLowerCase().includes(query) ||
          log.action_type.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  }

  function exportToCSV() {
    const headers = ['Date', 'Admin', 'Action Type', 'Target User', 'Details'];
    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toLocaleString(),
      log.admin_email,
      log.action_type,
      log.target_user_email || '-',
      log.details,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addToast('Audit log exported successfully', 'success');
  }

  function getActionColor(actionType: string): string {
    if (actionType.includes('granted') || actionType.includes('created')) {
      return 'bg-green-600';
    }
    if (actionType.includes('revoked') || actionType.includes('deleted')) {
      return 'bg-red-600';
    }
    if (actionType.includes('reset') || actionType.includes('updated')) {
      return 'bg-yellow-600';
    }
    return 'bg-blue-600';
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading audit log...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Audit Log</h1>
            <p className="text-gray-400">Complete history of administrative actions</p>
          </div>
          <button
            onClick={exportToCSV}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Export to CSV
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, user, or details..."
            className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Filter by Action Type
            </label>
            <select
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Actions' : type.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-4">
            Showing {filteredLogs.length} of {logs.length} total entries
          </div>

          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No audit logs found</div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span
                          className={`px-3 py-1 ${getActionColor(
                            log.action_type
                          )} text-white rounded text-xs font-medium`}
                        >
                          {log.action_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-xs">
                          by {log.admin_email}
                        </span>
                        {log.target_user_email && (
                          <span className="text-gray-400 text-xs">
                            → {log.target_user_email}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm mb-1">{log.details}</p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
                            View metadata
                          </summary>
                          <pre className="mt-2 text-xs text-gray-300 bg-gray-800 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-400 whitespace-nowrap ml-4">
                      <div>{new Date(log.created_at).toLocaleDateString()}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
