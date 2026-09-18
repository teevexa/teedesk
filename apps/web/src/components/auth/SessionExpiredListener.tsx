import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const SESSION_EXPIRED_EVENT = 'teedesk:session-expired';

/**
 * Mounted once inside the router. When the API client gives up on refreshing
 * an expired session (see services/api.ts), it dispatches this event instead
 * of forcing `window.location.href` — that avoided a full page reload (and
 * the resulting loss of any in-memory SPA state) on every session expiry,
 * including ones triggered by an unrelated background request.
 */
export const SessionExpiredListener: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => {
      if (!location.pathname.startsWith('/login')) {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, [navigate, location.pathname]);

  return null;
};
