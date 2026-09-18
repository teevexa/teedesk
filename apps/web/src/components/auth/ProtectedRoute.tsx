import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { LoadingScreen } from '@/components/shared/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, fetchMe } = useAuthStore();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);

  // Re-validate the session against the server once when the protected
  // shell first mounts, rather than trusting the persisted `user` from
  // localStorage indefinitely — fetchMe() already clears auth on failure
  // (e.g. the account was deactivated, or the session was revoked
  // server-side), so a stale/invalid session gets redirected to login here
  // instead of only surfacing once some other authenticated call 401s.
  useEffect(() => {
    if (isAuthenticated) {
      fetchMe().finally(() => setIsValidating(false));
    } else {
      setIsValidating(false);
    }
    // Intentionally mount-only — this should run once per protected-shell
    // mount, not re-run every time fetchMe's own result changes isAuthenticated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isValidating) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
