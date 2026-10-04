import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { FOCUS_ROUTES } from '../routes';
import { appModules } from '../modules';
import { SystemBackHandler } from './SystemBackHandler';
import { TabBar } from './TabBar';

export function AppLayout() {
  const { pathname } = useLocation();
  const focused = FOCUS_ROUTES.includes(pathname);
  return (
    <>
      <Outlet />
      {focused ? null : <TabBar modules={appModules} />}
      <ScrollRestoration />
      <SystemBackHandler />
    </>
  );
}
