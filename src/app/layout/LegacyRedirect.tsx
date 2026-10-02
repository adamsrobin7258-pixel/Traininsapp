import { generatePath, Navigate, useLocation, useParams } from 'react-router';

/**
 * Redirects an old address to its new place, replacing the history entry. Route parameters
 * (e.g. a plan id) are carried over; query and hash stay as they were.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`${generatePath(to, params)}${search}${hash}`} replace />;
}
