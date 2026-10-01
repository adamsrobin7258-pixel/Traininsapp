import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { EMPTY_SET_VALUES } from '@/core/training';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

/** A summary card on Today (the tab bar has links with the same area names). */
function cardLink(name: RegExp) {
  const link = screen.getAllByRole('link', { name }).find((element) => !element.closest('nav'));
  if (!link) throw new Error(`no card ${String(name)}`);
  return link;
}

function card(name: RegExp) {
  return within(cardLink(name));
}

/** Completes a workout on a given day (the clock is moved there and back). */
async function completedWorkout(services: AppServices, profileId: string, day: Date, minutes = 45) {
  vi.setSystemTime(day);
  const workout = await services.training.workouts.startFree(profileId);
  const exercise = await services.training.workouts.addExercise(
    profileId,
    workout.id,
    'sys.bench-press',
  );
  const detail = await services.training.workouts.getDetail(profileId, workout.id);
  const set = detail.exercises.find((e) => e.id === exercise)?.sets[0];
  if (!set) throw new Error('set expected');
  await services.training.workouts.updateSet(
    profileId,
    set.id,
    { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 },
    true,
  );
  vi.setSystemTime(new Date(day.getTime() + minutes * 60_000));
  await services.training.workouts.finish(profileId, workout.id);
  vi.setSystemTime(NOW);
}

describe('Today overview', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
  });

  it('is read-only: no inputs, no tracking actions', async () => {
    const { container } = await renderApp('/');
    await screen.findAllByRole('link', { name: /^Training/ });
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0);
    // Only navigation: the three area summaries plus the tab bar.
    const main = container.querySelector('main') ?? container;
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/eintragen$|hinzufügen|\+/)).not.toBeInTheDocument();
  });

  it('shows honest empty states', async () => {
    await renderApp('/');
    const training = card(/^Training/);
    expect(await training.findByText('Noch kein Training abgeschlossen')).toBeInTheDocument();
    expect(training.getByText('Kein Training geplant')).toBeInTheDocument();
    expect(training.getAllByText('0')).toHaveLength(2);

    const health = card(/^Gesundheit/);
    expect(await health.findByText('Noch kein Gewicht eingetragen')).toBeInTheDocument();
    expect(health.queryByRole('img')).not.toBeInTheDocument();

    const nutrition = card(/^Ernährung/);
    for (const label of ['Kalorien', 'Protein', /^Kohlen.?hydrate$/, 'Fett']) {
      expect(nutrition.getByText(label)).toBeInTheDocument();
    }
    // Calories and the three macros stay empty – nothing is invented.
    expect(nutrition.getAllByText('–')).toHaveLength(4);
    expect(nutrition.getByText('Noch nichts eingetragen')).toBeInTheDocument();
    expect(nutrition.getByText('0 ml Wasser')).toBeInTheDocument();
  });

  it('summarises training from the training data', async () => {
    await renderApp('/', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        await completedWorkout(services, profileId, new Date(2026, 8, 10, 18)); // 23 days ago
        await completedWorkout(services, profileId, new Date(2026, 8, 29, 18)); // 4 days ago
        await completedWorkout(services, profileId, new Date(2026, 9, 2, 18), 52); // yesterday
        const plan = await services.training.plans.createPlan(profileId, 'PPL');
        const day = await services.training.plans.addDay(profileId, plan.id, 'Push A');
        await services.training.plans.addExercise(profileId, day, 'sys.bench-press');
      },
    });
    const training = card(/^Training/);
    expect(await training.findByText('Krafttraining · Gestern · 52 min')).toBeInTheDocument();
    expect(training.getByText('Push A · PPL')).toBeInTheDocument();
    const [last7, last30] = training.getAllByText(/^\d+$/);
    expect(last7).toHaveTextContent('2');
    expect(last30).toHaveTextContent('3');
  });

  it('shows the running workout without taking over the training area', async () => {
    await renderApp('/', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        vi.setSystemTime(new Date(NOW.getTime() - 20 * 60_000));
        await services.training.workouts.startFree(profileId);
        vi.setSystemTime(NOW);
      },
    });
    expect(await card(/^Training/).findByText('Krafttraining · seit 20 min')).toBeInTheDocument();
  });

  it('shows weight, its change and a small trend from the health data', async () => {
    const { services } = await renderApp('/', {
      prepare: async (s, profileId) => {
        await s.weight.save(profileId, '2026-08-01', 94);
        await s.weight.save(profileId, '2026-09-10', 93);
        await s.weight.save(profileId, '2026-10-03', 91.8);
      },
    });
    const health = card(/^Gesundheit/);
    expect(await health.findByText('91,8 kg')).toBeInTheDocument();
    expect(health.getByText(/^[-−]1,2 kg seit 10\.09\.$/)).toBeInTheDocument();
    const trend = health.getByRole('img', { name: 'Gewichtsverlauf der letzten 3 Monate' });
    expect(trend.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(3);

    // Changes in Health show up on Today – Today stores nothing itself.
    const profileId = (await services.profile.ensureLocalProfile()).id;
    await services.weight.save(profileId, '2026-10-03', 90.5);
    const nav = within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));
    await userEvent.click(nav.getByRole('link', { name: 'Gesundheit' }));
    await userEvent.click(nav.getByRole('link', { name: 'Heute' }));
    expect(await card(/^Gesundheit/).findByText('90,5 kg')).toBeInTheDocument();
  });

  it('shows weight in pounds when set', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await s.settings.update('weightUnit', 'lb');
        await s.weight.save(profileId, '2026-10-03', 90);
      },
    });
    expect(await card(/^Gesundheit/).findByText('198,4 lb')).toBeInTheDocument();
  });

  it.each([
    [/^Training/, '/training'],
    [/^Gesundheit/, '/health'],
    [/^Ernährung/, '/nutrition'],
  ])('opens the area from %s', async (name, path) => {
    const { router } = await renderApp('/');
    await screen.findAllByRole('link', { name });
    await userEvent.click(cardLink(name));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path);
    });
  });

  it('works in English and dark mode', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    await renderApp('/', {
      prepare: async (s) => {
        await s.settings.update('theme', 'dark');
      },
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    await screen.findAllByRole('link', { name: /^Training/ });
    expect(cardLink(/^Health/)).toBeInTheDocument();
    expect(card(/^Nutrition/).getByText('Carbs')).toBeInTheDocument();
    expect(await card(/^Training/).findByText('No workout completed yet')).toBeInTheDocument();
  });

  it('shows today’s nutrition totals and goals from the food diary', async () => {
    await renderApp('/', {
      prepare: async (services, profileId) => {
        const n = services.nutrition;
        await n.meals.ensureDefaults(profileId);
        const [breakfast] = await n.meals.listActive(profileId);
        const oats = await n.foods.create(profileId, {
          name: 'Haferflocken',
          reference: { amount: 100, unit: 'g' },
          nutrients: {
            energyKcal: 370,
            proteinG: 13.5,
            carbsG: 58.7,
            fatG: 7,
            fiberG: null,
            sugarG: null,
            saturatedFatG: null,
          },
        });
        await n.diary.addFood(profileId, {
          localDate: '2026-10-03',
          mealId: breakfast?.id ?? '',
          foodId: oats.id,
          amount: 200,
          unit: 'g',
        });
        // Yesterday does not count for today.
        await n.diary.addFood(profileId, {
          localDate: '2026-10-02',
          mealId: breakfast?.id ?? '',
          foodId: oats.id,
          amount: 500,
          unit: 'g',
        });
        await n.goals.save(profileId, {
          effectiveFrom: '2026-10-01',
          goalType: 'maintain',
          targets: { energyKcal: { auto: 2500, manual: null } },
        });
      },
    });
    const nutrition = card(/^Ernährung/);
    // Calories are the one big number; the goal and what is left follow below.
    expect(await nutrition.findByText('740')).toBeInTheDocument();
    expect(nutrition.getByText('von 2.500 kcal · noch 1.760 kcal')).toBeInTheDocument();
    expect(nutrition.getByRole('progressbar', { name: 'Kalorien' })).toHaveAttribute(
      'aria-valuetext',
      '740 kcal von 2.500 kcal',
    );
    expect(nutrition.getByText('27 g')).toBeInTheDocument();
    expect(nutrition.getByText('117 g')).toBeInTheDocument();
    expect(nutrition.getByText('14 g')).toBeInTheDocument();
    expect(nutrition.queryByText('Noch nichts eingetragen')).not.toBeInTheDocument();

    // The meals of the day, with a preview of what was eaten (read only, opens the diary).
    const meals = within(screen.getByRole('list', { name: 'Mahlzeiten' }));
    expect(
      meals.getByRole('link', { name: /^Frühstück\s*Haferflocken\s*740 kcal/ }),
    ).toHaveAttribute('href', '/nutrition');
    expect(meals.getByRole('link', { name: /^Abendessen\s*Noch nichts\s*–/ })).toBeInTheDocument();
  });
});
