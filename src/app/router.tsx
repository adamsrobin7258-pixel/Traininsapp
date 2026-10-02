import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { appModules } from './modules';
import { LEGACY_REDIRECTS } from './routes';

/** Route tree derived from the module registry. Shared by the app and the tests. */
export function createRoutes(): RouteObject[] {
  return [
    {
      element: <AppLayout />,
      children: [
        ...appModules.map(({ path, Screen, subRoutes }) =>
          subRoutes?.length
            ? {
                path,
                children: [
                  { index: true, element: <Screen /> },
                  ...subRoutes.map((sub) => ({ path: sub.path, element: <sub.Screen /> })),
                ],
              }
            : { path, element: <Screen /> },
        ),
        ...LEGACY_REDIRECTS.map(({ from, to }) => ({
          path: from,
          element: <Navigate to={to} replace />,
        })),
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ];
}
