import { useEffect, useMemo, useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { openAppDatabase } from '@/core/database';
import { StartupError } from './layout/StartupError';
import { AppProviders } from './AppProviders';
import { createRoutes } from './router';
import { createServices, loadInitialState, type AppServices, type InitialState } from './services';

type BootState =
  | { status: 'loading' }
  | { status: 'ready'; services: AppServices; initialState: InitialState }
  | { status: 'error' };

const BOOT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms} ms`));
    }, ms);
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}

async function boot(): Promise<{ services: AppServices; initialState: InitialState }> {
  // Some SQLite failures (e.g. a broken WASM binary on web) never settle; fail visibly instead.
  const db = await withTimeout(openAppDatabase(), BOOT_TIMEOUT_MS);
  const services = createServices(db);
  return { services, initialState: await loadInitialState(services) };
}

/** Opens the database, loads settings and profile, then renders the app. */
export function AppRoot() {
  const [state, setState] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    boot().then(
      (result) => {
        if (!cancelled) setState({ status: 'ready', ...result });
      },
      (error: unknown) => {
        console.error('App startup failed', error);
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <StartupError
        onRetry={() => {
          setState({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }
  return (
    <AppProviders services={state.services} initialState={state.initialState}>
      <Router />
    </AppProviders>
  );
}

function Router() {
  const router = useMemo(() => createBrowserRouter(createRoutes()), []);
  return <RouterProvider router={router} />;
}
