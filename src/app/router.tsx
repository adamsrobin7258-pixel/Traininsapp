import { Navigate, type RouteObject } from 'react-router';
import { contentRoutePath } from './backNavigation';
import { AppLayout } from './layout/AppLayout';
import { LegacyRedirect } from './layout/LegacyRedirect';
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
        // Content management pages of the areas, mounted below Einstellungen → Meine Inhalte.
        ...appModules.flatMap(({ contentRoutes }) =>
          (contentRoutes ?? []).map((sub) => ({
            path: contentRoutePath(sub.path),
            element: <sub.Screen />,
          })),
        ),
        ...LEGACY_REDIRECTS.map(({ from, to }) => ({
          path: from,
          element: <LegacyRedirect to={to} />,
        })),
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ];
}
