import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NotificationMetadata {
  tmdb_id?: number;
  media_type?: string;
  recommendation_id?: string;
  request_id?: string;
  from_username?: string;
  new_status?: string;
}

interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
}

function getActionLink(n: Notification): string | null {
  const m = n.metadata;
  if (!m) return null;
  switch (n.notification_type) {
    case 'recommendation':
      return '/recommendations';
    case 'plex_request_update':
      if (m.tmdb_id && m.media_type) return `/details/${m.media_type}/${m.tmdb_id}`;
      return null;
    case 'permission_granted':
    case 'permission_revoked':
      return '/profile';
    case 'upcoming_episode':
    case 'season_finale':
    case 'series_returning':
      if (m.tmdb_id) return `/details/tv/${m.tmdb_id}`;
      return null;
    default:
      return null;
  }
}

function getActionLabel(type: string): string {
  switch (type) {
    case 'recommendation': return 'View Recommendations';
    case 'plex_request_update': return 'View Title';
    case 'permission_granted':
    case 'permission_revoked': return 'View Profile';
    case 'upcoming_episode':
    case 'season_finale':
    case 'series_returning': return 'View Show';
    default: return 'View';
  }
}

function getIcon(type: string) {
  switch (type) {
    case 'recommendation':
      return (
        <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </div>
      );
    case 'plex_request_update':
      return (
        <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        </div>
      );
    case 'permission_granted':
      return (
        <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    case 'permission_revoked':
      return (
        <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
      );
    case 'upcoming_episode':
    case 'series_returning':
      return (
        <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>
      );
    case 'season_finale':
      return (
        <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
  }
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: number) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async function markAllAsRead() {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async function deleteNotification(id: number) {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) { console.error('Error deleting notification:', error); return; }
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  async function clearAllNotifications() {
    if (!user) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (error) { console.error('Error clearing notifications:', error); return; }
    setNotifications([]);
  }

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
            <p className="text-gray-400">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Mark All Read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-gray-400 text-sm">
              {filter === 'unread'
                ? "You're all caught up!"
                : "You'll be notified here about recommendations, Plex requests, and more."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map(notification => {
              const actionLink = getActionLink(notification);
              return (
                <div
                  key={notification.id}
                  className={`bg-gray-800 rounded-xl p-4 transition-colors ${
                    !notification.is_read ? 'border-l-4 border-primary-500' : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getIcon(notification.notification_type)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h3 className={`font-semibold text-sm ${notification.is_read ? 'text-gray-300' : 'text-white'}`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-500 text-xs whitespace-nowrap">
                            {new Date(notification.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-gray-600 hover:text-gray-400 transition-colors"
                            aria-label="Dismiss notification"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{notification.message}</p>

                      <div className="flex items-center gap-3 flex-wrap">
                        {actionLink && (
                          <Link
                            to={actionLink}
                            onClick={() => { if (!notification.is_read) markAsRead(notification.id); }}
                            className="text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
                          >
                            {getActionLabel(notification.notification_type)} →
                          </Link>
                        )}
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
