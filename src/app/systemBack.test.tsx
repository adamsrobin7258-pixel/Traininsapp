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
    ['/training/workout', '/training'],
    ['/training/workouts/xyz', '/training'],
    ['/training/activities', '/training'],
    ['/training', '/'],
    ['/nutrition', '/'],
    // Einstellungen → Meine Inhalte: the content pages of nutrition and training.
    ['/settings/content/foods', '/settings/content'],
    ['/settings/content/meals', '/settings/content'],
    ['/settings/content/templates', '/settings/content'],
    ['/settings/content/templates/abc', '/settings/content/templates'],
    ['/settings/content/recipes', '/settings/content'],
    ['/settings/content/plans/abc', '/settings/content/plans'],
    ['/settings/content/plans', '/settings/content'],
    ['/settings/content/exercises', '/settings/content'],
    ['/health', '/'],
    ['/settings/profile', '/settings'],
    ['/settings/goals', '/settings'],
    ['/settings/content', '/settings'],
    ['/settings/app', '/settings'],
    ['/settings', '/'],
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
    await act(() => router.navigate(`/settings/content/plans/${plan.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Beine' })).toBeInTheDocument();

    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content/plans');
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content');
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings');
    await pressBack();
    expect(router.state.location.pathname).toBe('/');
    expect(platform.exitApp).not.toHaveBeenCalled();

    await pressBack();
    expect(platform.exitApp).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/');
  });

  it('goes from a settings page to Einstellungen, then to Fortschritt', async () => {
    const { router } = await renderApp('/settings/goals');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ziele' })).toBeInTheDocument();
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await pressBack();
    expect(router.state.location.pathname).toBe('/');
    expect(platform.exitApp).not.toHaveBeenCalled();
  });

  it.each([
    ['/nutrition/foods', '/settings/content/foods'],
    ['/nutrition/meals', '/settings/content/meals'],
    ['/nutrition/templates', '/settings/content/templates'],
    ['/training/plans', '/settings/content/plans'],
    ['/training/exercises', '/settings/content/exercises'],
  ])('redirects the old address %s to %s and goes back to Meine Inhalte', async (from, to) => {
    const { router } = await renderApp(from);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(to);
    });
    // Replaced, not pushed: the old address leaves no entry in the history.
    expect(router.state.historyAction).toBe('REPLACE');
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content');
  });

  it('closes the food selection of a template first, then goes up to the template list', async () => {
    const { router, services } = await renderApp('/');
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const n = services.nutrition;
    const food = await n.foods.create(profileId, {
      name: 'Haferflocken',
      reference: { amount: 100, unit: 'g' },
      nutrients: {
        energyKcal: 370,
        proteinG: 13,
        carbsG: 59,
        fatG: 7,
        fiberG: null,
        sugarG: null,
        saturatedFatG: null,
      },
    });
    const template = await n.meals.saveMeal(profileId, {
      name: 'Haferbrei',
      items: [{ foodId: food.id, amount: 60, unit: 'g' }],
    });
    await act(() => router.navigate(`/settings/content/templates/${template.id}`));
    await userEvent.click(await screen.findByRole('button', { name: 'Lebensmittel hinzufügen' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe(`/settings/content/templates/${template.id}`);
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content/templates');
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content');
  });

  it('keeps the plan id when redirecting an old plan address', async () => {
    const { router, services } = await renderApp('/');
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const plan = await services.training.plans.createPlan(profileId, 'Push');
    await act(() => router.navigate(`/training/plans/${plan.id}`));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/settings/content/plans/${plan.id}`);
    });
    expect(router.state.historyAction).toBe('REPLACE');
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content/plans');
  });

  it('a redirected old address behaves like the new page for back', async () => {
    const { router } = await renderApp('/nutrition/profile');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings/goals');
    });
    await pressBack();
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('closes an open sheet before navigating', async () => {
    const { router } = await renderApp('/settings/content/plans');
    await userEvent.click(await screen.findByRole('button', { name: 'Neuer Plan' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/settings/content/plans');

    await pressBack();
    expect(router.state.location.pathname).toBe('/settings/content');
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

  it('returns from a chosen BLS food to the search, then closes the add sheet', async () => {
    const { router } = await renderApp('/nutrition');
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.type(screen.getByLabelText('Lebensmittel suchen'), 'apfel');
    await userEvent.click(await screen.findByRole('button', { name: /Apfel, roh/ }));
    expect(await screen.findByLabelText('Menge')).toBeInTheDocument();

    await pressBack();
    expect(await screen.findByLabelText('Lebensmittel suchen')).toBeInTheDocument();
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
      within(screen.getByRole('article', { name: 'Langhantel-Bankdrücken' })).getByRole('button', {
        name: 'Satz 1 wieder öffnen',
      }),
    ).toBeInTheDocument();
  });

  it('training: the rest timer and the exercise picker close first, then back to Training', async () => {
    const { router } = await renderApp('/training', {
      prepare: async (s, profileId) => {
        await s.training.exercises.ensureCatalog();
        await s.settings.update('restTimerSeconds', 60);
        const workout = await s.training.workouts.startFree(profileId);
        await s.training.workouts.addExercise(profileId, workout.id, 'sys.bench-press');
      },
    });
    await act(() => router.navigate('/training/workout'));
    await userEvent.type(await screen.findByLabelText('Satz 1: Gewicht'), '60');
    await userEvent.type(screen.getByLabelText('Satz 1: Wdh.'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    expect(await screen.findByRole('timer')).toBeInTheDocument();

    // The picker opened over the timer closes first, then the timer, then the page.
    await userEvent.click(screen.getByRole('button', { name: 'Übung ersetzen' }));
    expect(await screen.findByRole('dialog', { name: 'Übung ersetzen' })).toBeInTheDocument();
    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/training/workout');
    await pressBack();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/training/workout');
    await pressBack();
    expect(router.state.location.pathname).toBe('/training');
  });

  it('training: the summary of a finished workout closes first, then back to Training', async () => {
    const { router } = await renderApp('/training', {
      prepare: async (s, profileId) => {
        await s.training.exercises.ensureCatalog();
        const workout = await s.training.workouts.startFree(profileId);
        await s.training.workouts.addExercise(profileId, workout.id, 'sys.bench-press');
        const [exercise] = (await s.training.workouts.getDetail(profileId, workout.id)).exercises;
        await s.training.workouts.updateSet(
          profileId,
          exercise?.sets[0]?.id ?? '',
          { weightKg: 80, reps: 8, durationS: null, distanceM: null, rpe: null },
          true,
        );
      },
    });
    await act(() => router.navigate('/training/workout'));
    await userEvent.click(await screen.findByRole('button', { name: 'Training beenden' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Training beenden' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Training abgeschlossen' }),
    ).toBeInTheDocument();
    await pressBack();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toMatch(/^\/training\/workouts\//);
    await pressBack();
    expect(router.state.location.pathname).toBe('/training');
  });
});
