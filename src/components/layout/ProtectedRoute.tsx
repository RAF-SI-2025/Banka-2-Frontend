import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Permission } from '../../types';

interface ProtectedRouteProps {
  requiredPermission?: Permission;
  adminOnly?: boolean;
}

export default function ProtectedRoute({
  requiredPermission,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, isLoading, hasPermission, isAdmin } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
