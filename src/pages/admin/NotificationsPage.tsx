import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';

interface User {
  id: string;
  email: string;
}

interface Notification {
  id: number;
  user_email: string;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [notificationType, setNotificationType] = useState('announcement');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersResult, notifsResult] = await Promise.all([
        supabase.rpc('list_users_for_admin'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (notifsResult.error) throw notifsResult.error;

      const userList = (usersResult.data || []).map((u: any) => ({
        id: u.id,
        email: u.email || 'No email',
      }));

      const userMap = new Map(userList.map((u) => [u.id, u.email]));

      const notifsWithEmails = (notifsResult.data || []).map((notif: any) => ({
        ...notif,
        user_email: userMap.get(notif.user_id) || 'Unknown',
      }));

      setUsers(userList);
      setNotifications(notifsWithEmails);
    } catch (error) {
      console.error('Error loading data:', error);
      addToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function sendNotifications() {
    if (selectedUsers.length === 0) {
      addToast('Please select at least one user', 'error');
      return;
    }

    if (!title.trim() || !message.trim()) {
      addToast('Please fill in title and message', 'error');
      return;
    }

    try {
      for (const userId of selectedUsers) {
        await supabase.rpc('create_notification', {
          p_user_id: userId,
          p_type: notificationType,
          p_title: title,
          p_message: message,
        });

        await supabase.rpc('log_admin_action', {
          p_action_type: 'notification_sent',
          p_target_user_id: userId,
          p_details: `Sent notification: ${title}`,
        });
      }

      addToast(`Sent notifications to ${selectedUsers.length} user(s)`, 'success');
      setShowComposer(false);
      setSelectedUsers([]);
      setTitle('');
      setMessage('');
      await loadData();
    } catch (error: any) {
      console.error('Error sending notifications:', error);
      addToast(error.message || 'Failed to send notifications', 'error');
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function selectAllUsers() {
    setSelectedUsers(users.map((u) => u.id));
  }

  function deselectAllUsers() {
    setSelectedUsers([]);
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-white text-center py-12">Loading notifications...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
            <p className="text-gray-400">Send and manage user notifications</p>
          </div>
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            {showComposer ? 'Cancel' : '+ New Notification'}
          </button>
        </div>

        {showComposer && (
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">Compose Notification</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipients
              </label>
              <div className="flex space-x-2 mb-3">
                <button
                  onClick={selectAllUsers}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllUsers}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Deselect All
                </button>
                <span className="text-gray-400 text-sm py-1">
                  ({selectedUsers.length} selected)
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto bg-gray-700 p-3 rounded">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-white truncate">{user.email}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notification Type
              </label>
              <select
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
              >
                <option value="announcement">Announcement</option>
                <option value="update">Update</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Notification message"
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:outline-none"
              />
            </div>

            <button
              onClick={sendNotifications}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Send Notifications
            </button>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      No notifications sent yet
                    </td>
                  </tr>
                ) : (
                  notifications.map((notif) => (
                    <tr key={notif.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm text-white">
                        {notif.user_email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <span className="px-2 py-1 bg-gray-600 rounded text-xs">
                          {notif.notification_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-white font-medium">
                        {notif.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                        {notif.message}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {notif.is_read ? (
                          <span className="text-gray-400">Read</span>
                        ) : (
                          <span className="text-primary-400 font-medium">Unread</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                        {new Date(notif.created_at).toLocaleString()}
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
