import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import ProfilePage from './pages/ProfilePage';
import ListsPage from './pages/ListsPage';
import ListDetailPage from './pages/ListDetailPage';
import CalendarPage from './pages/CalendarPage';
import SocialPage from './pages/SocialPage';
import RecommendationsPage from './pages/RecommendationsPage';
import { PersonPage } from './pages/PersonPage';
import { NotificationsPage } from './pages/NotificationsPage';
import DiscoveryPage from './pages/DiscoveryPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersPage } from './pages/admin/UsersPage';
import { PermissionsPage } from './pages/admin/PermissionsPage';
import { SharesPage } from './pages/admin/SharesPage';
import { NotificationsPage as AdminNotificationsPage } from './pages/admin/NotificationsPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import PlexRequestsPage from './pages/PlexRequestsPage';
import AdminPlexRequestsPage from './pages/admin/PlexRequestsPage';
import PlexSettingsPage from './pages/admin/PlexSettingsPage';
import { UserApprovalPage } from './pages/admin/UserApprovalPage';

function App() {
  return (
    <Router>
      <AuthProvider>
          <ToastProvider>
            <ToastContainer />
            <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/discovery"
            element={
              <ProtectedRoute>
                <DiscoveryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/details/:mediaType/:id"
            element={
              <ProtectedRoute>
                <DetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/person/:id"
            element={
              <ProtectedRoute>
                <PersonPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lists"
            element={
              <ProtectedRoute>
                <ListsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lists/:id"
            element={
              <ProtectedRoute>
                <ListDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social"
            element={
              <ProtectedRoute>
                <SocialPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recommendations"
            element={
              <ProtectedRoute>
                <RecommendationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plex-requests"
            element={
              <ProtectedRoute>
                <PlexRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/permissions"
            element={
              <AdminRoute>
                <PermissionsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/shares"
            element={
              <AdminRoute>
                <SharesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <AdminRoute>
                <AdminNotificationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <AdminRoute>
                <AuditLogPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/plex-requests"
            element={
              <AdminRoute>
                <AdminPlexRequestsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/plex-settings"
            element={
              <AdminRoute>
                <PlexSettingsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/approvals"
            element={
              <AdminRoute>
                <UserApprovalPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
