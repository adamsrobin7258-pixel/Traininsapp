import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { createRoutes } from '@/app/router';
import { createServices, loadInitialState } from '@/app/services';
import { createTestDatabase, fixedClock } from './database';

/** Renders the complete app (providers, router, tab bar) against an in-memory database. */
export async function renderApp(initialPath = '/') {
  const db = await createTestDatabase();
  const services = createServices(db, fixedClock());
  const initialState = await loadInitialState(services);
  const router = createMemoryRouter(createRoutes(), { initialEntries: [initialPath] });
  const view = render(
    <AppProviders services={services} initialState={initialState}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, db, services, router };
}
