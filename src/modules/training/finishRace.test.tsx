import { screen, waitFor, within } from '@testing-library/react';
import type * as ReactRouter from 'react-router';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';

/**
 * Regression (CI run #37): finishing reloads the active workout. When that reload arrives
 * before the screen's own navigation, the workout is already gone – the screen must still lead
 * to the finished workout with its summary, not to Training. A slow `navigate` makes the reload
 * win every time; without the fix the app takes a detour via /training.
 */
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return (...args: Parameters<typeof navigate>) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            void Promise.resolve(navigate(...(args as [never]))).then(() => {
              resolve();
            });
          }, 50);
        });
    },
  };
});

describe('finishing a workout', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the summary even when the reload is faster than the navigation', async () => {
    const { router } = await renderApp('/training/workout', {
      prepare: async (services, profileId) => {
        await services.training.workouts.startFree(profileId);
      },
    });
    const paths: string[] = [];
    router.subscribe((state) => paths.push(state.location.pathname));
    await userEvent.click(await screen.findByRole('button', { name: 'Training beenden' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Training beenden' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Training abgeschlossen' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/training\/workouts\//);
    });
    // Never a detour via Training: whichever navigation comes last, it is the summary. (In CI the
    // detour came last and the summary never opened.)
    expect(paths).not.toContain('/training');
    expect(paths.every((path) => path.startsWith('/training/workouts/'))).toBe(true);
  });
});
