import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as Platform from '@/core/platform';
import { renderApp } from '@/test/renderApp';
import { backTarget, routePatterns } from './backNavigation';
import { appModules } from './modules';

const platform = vi.hoisted(() => ({
  handler: null as (() => void) | null,
  exitApp: vi.fn(),
}));

vi.mock('@/core/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof Platform>()),
  onSystemBack: (handler: () => void) => {
    platform.handler = handler;
    return () => {
      platform.handler = null;
    };
  },
  exitApp: platform.exitApp,
}));

/** Simulates the Android back button / gesture. */
async function pressBack() {
  await act(async () => {
    platform.handler?.();
    await Promise.resolve();
  });
}

describe('back target', () => {
  const patterns = routePatterns(appModules);

  it.each([
    ['/training/plans/abc', '/training/plans'],
    ['/training/plans', '/training'],
    ['/training/workout', '/training'],
    ['/training/workouts/xyz', '/training'],
    ['/training/exercises', '/training'],
    ['/training', '/'],
    ['/nutrition/foods', '/nutrition'],
    ['/nutrition/meals', '/nutrition'],
    ['/nutrition/templates', '/nutrition'],
    ['/nutrition/profile', '/nutrition'],
    ['/nutrition', '/'],
    ['/health', '/'],
    ['/profile', '/'],
  ])('%s → %s', (from, to) => {
    expect(backTarget(from, patterns)).toBe(to);
  });

  it('has nothing above "Today"', () => {
    expect(backTarget('/', patterns)).toBeNull();
  });
});

describe('system back', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
    platform.exitApp.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('goes up one level at a time and only then leaves the app', async () => {
    const { router, services } = await renderApp('/training');
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const plan = await services.training.plans.createPlan(profileId, 'Beine');
    await act(() => router.navigate(`/training/plans/${plan.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Beine' })).toBeInTheDocument();

    await pressBack();
    expect(router.state.location.pathname).toBe('/training/plans');
    await pressBack();
    expect(router.state.location.pathname).toBe('/training');
    await pressBack();
    expect(router.state.location.pathname).toBe('/');
    expect(platform.exitApp).not.toHaveBeenCalled();

    await pressBack();
    expect(platform.exitApp).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/');
  });

  it('closes an open sheet before navigating', async () => {
    const { router } = await renderApp('/training/plans');
    await userEvent.click(await screen.findByRole('button', { name: 'Neuer Plan' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/training/plans');

    await pressBack();
    expect(router.state.location.pathname).toBe('/training');
  });

  it('steps back through the nutrition add flow without leaving the diary', async () => {
    const { router } = await renderApp('/nutrition?day=2026-01-02');
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Neues Lebensmittel anlegen' }));
    expect(screen.getByRole('dialog', { name: 'Neues Lebensmittel' })).toBeInTheDocument();

    // Back from the food form returns to the search, not out of the flow.
    await pressBack();
    expect(
      await screen.findByRole('dialog', { name: 'Frühstück: hinzufügen' }),
    ).toBeInTheDocument();
    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/nutrition');

    await pressBack();
    expect(router.state.location.pathname).toBe('/');
    expect(platform.exitApp).not.toHaveBeenCalled();
  });

  it('closes online results first, then the add sheet', async () => {
    const { router } = await renderApp('/nutrition');
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.type(screen.getByLabelText('Lebensmittel suchen'), 'skyr');
    await userEvent.click(screen.getByRole('button', { name: 'Online suchen: „skyr“' }));
    expect(await screen.findByText('Keine Treffer bei Open Food Facts.')).toBeInTheDocument();

    await pressBack();
    expect(
      await screen.findByRole('button', { name: 'Online suchen: „skyr“' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/nutrition');
  });

  it('keeps an active workout when leaving it with back', async () => {
    const { router, services } = await renderApp('/training', {
      prepare: async (s, profileId) => {
        await s.training.exercises.ensureCatalog();
        const workout = await s.training.workouts.startFree(profileId);
        const exercise = await s.training.workouts.addExercise(
          profileId,
          workout.id,
          'sys.bench-press',
        );
        const detail = await s.training.workouts.getDetail(profileId, workout.id);
        const set = detail.exercises.find((e) => e.id === exercise)?.sets[0];
        if (!set) throw new Error('set expected');
        await s.training.workouts.updateSet(
          profileId,
          set.id,
          { weightKg: 80, reps: 8, durationS: null, distanceM: null, rpe: null },
          true,
        );
      },
    });
    await act(() => router.navigate('/training/workout'));
    expect(await screen.findByLabelText('Satz 1: Gewicht')).toHaveValue('80');

    await pressBack();
    expect(router.state.location.pathname).toBe('/training');
    // No confirmation, the workout is still running with its sets.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Laufendes Training')).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const active = await services.training.workouts.getActive(profileId);
    expect(active?.status).toBe('active');

    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(await screen.findByLabelText('Satz 1: Gewicht')).toHaveValue('80');
    expect(
      within(screen.getByRole('article', { name: 'Bankdrücken' })).getByRole('button', {
        name: 'Satz 1 wieder öffnen',
      }),
    ).toBeInTheDocument();
  });
});
