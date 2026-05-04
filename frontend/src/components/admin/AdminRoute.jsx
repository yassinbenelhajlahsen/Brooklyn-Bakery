import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';

export default function AdminRoute({ children }) {
  const { user, profile, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!profile) {
    return <div className="p-8 text-center text-muted">Loading…</div>;
  }
  if (profile.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
