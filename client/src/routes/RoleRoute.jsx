import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FullPageSpinner } from '../components/common/Spinner';
import { dashboardPathForRole } from '../lib/roles';

export default function RoleRoute({ roles }) {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(role)) return <Navigate to={dashboardPathForRole(role)} replace />;
  return <Outlet />;
}
