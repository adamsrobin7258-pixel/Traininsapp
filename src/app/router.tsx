import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { appModules } from './modules';

/** Route tree derived from the module registry. Shared by the app and the tests. */
export function createRoutes(): RouteObject[] {
  return [
    {
      element: <AppLayout />,
      children: [
        ...appModules.map(({ path, Screen }) => ({ path, element: <Screen /> })),
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ];
}
