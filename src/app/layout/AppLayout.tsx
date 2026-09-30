import { Outlet, ScrollRestoration } from 'react-router';
import { appModules } from '../modules';
import { SystemBackHandler } from './SystemBackHandler';
import { TabBar } from './TabBar';

export function AppLayout() {
  return (
    <>
      <Outlet />
      <TabBar modules={appModules} />
      <ScrollRestoration />
      <SystemBackHandler />
    </>
  );
}
