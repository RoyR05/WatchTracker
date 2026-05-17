import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BrandSplash } from '../ui/BrandSplash';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <BrandSplash />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && profile.approval_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}
