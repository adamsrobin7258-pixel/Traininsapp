import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { createRoutes } from '@/app/router';
import { createServices, loadInitialState } from '@/app/services';
import type { DatabaseSecurity } from '@/core/database';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY, fixedClock } from './database';

/** Renders the complete app (providers, router, tab bar) against an in-memory database. */
export async function renderApp(
  initialPath = '/',
  security: DatabaseSecurity = ENCRYPTED_TEST_SECURITY,
) {
  const db = await createTestDatabase();
  const services = createServices({ driver: db, security }, fixedClock());
  const initialState = await loadInitialState(services);
  const router = createMemoryRouter(createRoutes(), { initialEntries: [initialPath] });
  const view = render(
    <AppProviders services={services} initialState={initialState}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, db, services, router };
}
