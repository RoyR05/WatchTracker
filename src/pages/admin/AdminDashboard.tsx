import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AdminLayout } from '../../components/layout/AdminLayout';

interface DashboardStats {
  totalUsers: number;
  activePermissions: number;
  unreadNotifications: number;
  totalLists: number;
  totalShares: number;
  recentActions: number;
}

interface RecentAction {
  id: number;
  action_type: string;
  details: string;
  created_at: string;
  target_user_email?: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activePermissions: 0,
    unreadNotifications: 0,
    totalLists: 0,
    totalShares: 0,
    recentActions: 0,
  });
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [usersCount, permissionsCount, notificationsCount, listsCount, sharesCount, actionsResult] = await Promise.all([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('global_share_permissions').select('id', { count: 'exact', head: true }).eq('is_allowed', true),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('custom_lists').select('id', { count: 'exact', head: true }),
        supabase.from('list_shares').select('id', { count: 'exact', head: true }),
        supabase
          .from('admin_audit_log')
          .select(`
            id,
            action_type,
            details,
            created_at,
            target_user_id
          `)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setStats({
        totalUsers: usersCount.count || 0,
        activePermissions: permissionsCount.count || 0,
        unreadNotifications: notificationsCount.count || 0,
        totalLists: listsCount.count || 0,
        totalShares: sharesCount.count || 0,
        recentActions: actionsResult.count || 0,
      });

      if (actionsResult.data) {
        const actionsWithEmails = await Promise.all(
          actionsResult.data.map(async (action) => {
            if (action.target_user_id) {
              const { data: userData } = await supabase.auth.admin.getUserById(action.target_user_id);
              return {
                ...action,
                target_user_email: userData?.user?.email,
              };
            }
            return action;
          })
        );
        setRecentActions(actionsWithEmails);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'bg-brand-card border border-white/10', link: '/admin/users' },
    { label: 'Active Permissions', value: stats.activePermissions, icon: '🔐', color: 'bg-brand-card border border-white/10', link: '/admin/permissions' },
    { label: 'Unread Notifications', value: stats.unreadNotifications, icon: '🔔', color: 'bg-brand-card border border-white/10', link: '/admin/notifications' },
    { label: 'Total Lists', value: stats.totalLists, icon: '📝', color: 'bg-brand-card border border-white/10', link: '/admin/users' },
    { label: 'Active Shares', value: stats.totalShares, icon: '🔗', color: 'bg-brand-card border border-white/10', link: '/admin/shares' },
    { label: 'Recent Actions', value: stats.recentActions, icon: '📋', color: 'bg-brand-card border border-white/10', link: '/admin/audit-log' },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading dashboard...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Overview of your WatchTracker system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card) => (
            <Link
              key={card.label}
              to={card.link}
              className={`${card.color} rounded-lg p-6 shadow-lg hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-opacity-90 text-sm font-medium">{card.label}</p>
                  <p className="text-white text-3xl font-bold mt-2">{card.value}</p>
                </div>
                <div className="text-4xl">{card.icon}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
            <Link to="/admin/audit-log" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
              View All →
            </Link>
          </div>

          <div className="space-y-4">
            {recentActions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No recent activity</p>
            ) : (
              recentActions.map((action) => (
                <div key={action.id} className="flex items-start space-x-4 p-4 bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-primary-400 text-sm font-medium">{action.action_type}</span>
                      {action.target_user_email && (
                        <span className="text-gray-400 text-sm">→ {action.target_user_email}</span>
                      )}
                    </div>
                    <p className="text-white text-sm mt-1">{action.details}</p>
                  </div>
                  <div className="text-gray-400 text-xs whitespace-nowrap">
                    {new Date(action.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => window.location.href = '/admin/users'}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 text-left transition-colors"
          >
            <div className="text-2xl mb-2">➕</div>
            <h3 className="text-white font-semibold mb-1">Manage Users</h3>
            <p className="text-gray-400 text-sm">Add, edit, or remove users from the system</p>
          </button>

          <button
            onClick={() => window.location.href = '/admin/permissions'}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 text-left transition-colors"
          >
            <div className="text-2xl mb-2">🔐</div>
            <h3 className="text-white font-semibold mb-1">Manage Permissions</h3>
            <p className="text-gray-400 text-sm">Control who can share content with whom</p>
          </button>

          <button
            onClick={() => window.location.href = '/admin/notifications'}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg p-6 text-left transition-colors"
          >
            <div className="text-2xl mb-2">📧</div>
            <h3 className="text-white font-semibold mb-1">Send Notification</h3>
            <p className="text-gray-400 text-sm">Notify users about important updates</p>
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
