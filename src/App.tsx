import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ProfileProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/:mediaType/:id" element={<DetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </ProfileProvider>
      </AuthProvider>
    </Router>
  );
}
