import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { PageTransition } from './components/ui/PageTransition';
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

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
        <Route path="/pending-approval" element={<PageTransition><PendingApprovalPage /></PageTransition>} />
        <Route path="/" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
        <Route path="/discovery" element={<ProtectedRoute><PageTransition><DiscoveryPage /></PageTransition></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><PageTransition><SearchPage /></PageTransition></ProtectedRoute>} />
        <Route path="/details/:mediaType/:id" element={<ProtectedRoute><PageTransition><DetailPage /></PageTransition></ProtectedRoute>} />
        <Route path="/person/:id" element={<ProtectedRoute><PageTransition><PersonPage /></PageTransition></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><PageTransition><ProfilePage /></PageTransition></ProtectedRoute>} />
        <Route path="/lists" element={<ProtectedRoute><PageTransition><ListsPage /></PageTransition></ProtectedRoute>} />
        <Route path="/lists/:id" element={<ProtectedRoute><PageTransition><ListDetailPage /></PageTransition></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><PageTransition><CalendarPage /></PageTransition></ProtectedRoute>} />
        <Route path="/social" element={<ProtectedRoute><PageTransition><SocialPage /></PageTransition></ProtectedRoute>} />
        <Route path="/recommendations" element={<ProtectedRoute><PageTransition><RecommendationsPage /></PageTransition></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><PageTransition><NotificationsPage /></PageTransition></ProtectedRoute>} />
        <Route path="/plex-requests" element={<ProtectedRoute><PageTransition><PlexRequestsPage /></PageTransition></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><PageTransition><AdminDashboard /></PageTransition></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><PageTransition><UsersPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/permissions" element={<AdminRoute><PageTransition><PermissionsPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/shares" element={<AdminRoute><PageTransition><SharesPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><PageTransition><AdminNotificationsPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/audit-log" element={<AdminRoute><PageTransition><AuditLogPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/plex-requests" element={<AdminRoute><PageTransition><AdminPlexRequestsPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/plex-settings" element={<AdminRoute><PageTransition><PlexSettingsPage /></PageTransition></AdminRoute>} />
        <Route path="/admin/approvals" element={<AdminRoute><PageTransition><UserApprovalPage /></PageTransition></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ToastContainer />
          <AnimatedRoutes />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
