import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import ProfilePage from './pages/ProfilePage';
import ListsPage from './pages/ListsPage';
import ListDetailPage from './pages/ListDetailPage';
import CalendarPage from './pages/CalendarPage';
import SocialPage from './pages/SocialPage';
import RecommendationsPage from './pages/RecommendationsPage';
import ManageProfilesPage from './pages/ManageProfilesPage';
import { PersonPage } from './pages/PersonPage';
import { ProfileSelector } from './components/profile/ProfileSelector';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProfileProvider>
          <ToastProvider>
            <ToastContainer />
            <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/profiles/select"
            element={
              <ProtectedRoute>
                <ProfileSelector />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles/manage"
            element={
              <ProtectedRoute>
                <ManageProfilesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
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
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </ProfileProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
