import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { createRoutes } from '@/app/router';
import { createServices, loadInitialState, type AppServices } from '@/app/services';
import type { DatabaseSecurity } from '@/core/database';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from './database';

interface RenderAppOptions {
  security?: DatabaseSecurity;
  /** Runs against the services before the app starts, e.g. to store settings or data. */
  prepare?: (services: AppServices, profileId: string) => Promise<void>;
}

/**
 * Renders the complete app (providers, router, tab bar) against an in-memory database.
 * Services use the current time, so tests can control "today" with fake Date timers.
 */
export async function renderApp(initialPath = '/', options: RenderAppOptions = {}) {
  const db = await createTestDatabase();
  const services = createServices(
    { driver: db, security: options.security ?? ENCRYPTED_TEST_SECURITY },
    () => new Date(),
  );
  if (options.prepare) {
    const profile = await services.profile.ensureLocalProfile();
    await options.prepare(services, profile.id);
  }
  const initialState = await loadInitialState(services);
  const router = createMemoryRouter(createRoutes(), { initialEntries: [initialPath] });
  const view = render(
    <AppProviders services={services} initialState={initialState}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, db, services, router };
}
