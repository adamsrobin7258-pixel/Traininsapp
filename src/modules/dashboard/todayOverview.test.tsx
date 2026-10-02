import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { EMPTY_SET_VALUES } from '@/core/training';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

/** A summary card on Today (the tab bar has links with the same area names). */
function cardLink(name: RegExp) {
  const link = screen
    .getAllByRole('link', { name })
    .find((element) => !element.closest('nav') && !element.closest('section'));
  if (!link) throw new Error(`no card ${String(name)}`);
  return link;
}

function card(name: RegExp) {
  return within(cardLink(name));
}

/** "Dein Fortschritt" and one of its rows. */
function progress() {
  return within(screen.getByRole('region', { name: 'Dein Fortschritt' }));
}

function progressRow(name: RegExp) {
  return within(progress().getByRole('link', { name }));
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

function session(id: string, day: number, hour: number, minutes: number, kcal: number | null) {
  const start = localIso(2026, 10, day, hour);
  return {
    id,
    type: 'running',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
    distanceM: null,
    source: 'Pixel Watch',
  } satisfies HealthWorkout;
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

  it('is read-only: no inputs, no tracking actions – only the period switch', async () => {
    const { container } = await renderApp('/');
    await screen.findAllByRole('link', { name: /^Training/ });
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0);
    // Only navigation plus the "Woche / Monat" switch of the progress section.
    const main = container.querySelector('main') ?? container;
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(
      within(main)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Woche', 'Monat']);
    expect(screen.queryByText(/eintragen$|hinzufügen|\+/)).not.toBeInTheDocument();
  });

  it('shows honest, small empty states', async () => {
    await renderApp('/');
    const training = card(/^Training/);
    expect(await training.findByText('Heute kein Training geplant')).toBeInTheDocument();

    const nutrition = card(/^Ernährung/);
    for (const label of ['Kalorien', 'Protein', /^Kohlen.?hydrate$/, 'Fett']) {
      expect(nutrition.getByText(label)).toBeInTheDocument();
    }
    // Calories and the three macros stay empty – nothing is invented.
    expect(nutrition.getAllByText('–')).toHaveLength(4);
    expect(nutrition.getByText('Noch nichts eingetragen')).toBeInTheDocument();
    expect(nutrition.getByText('0 ml Wasser')).toBeInTheDocument();

    // Without data for today, activities and health take no space at all.
    expect(screen.queryByText('Aktivitäten heute')).not.toBeInTheDocument();
    expect(screen.queryByText('Gesundheit heute')).not.toBeInTheDocument();

    expect(await progress().findByText('Noch keine Trainingsdaten.')).toBeInTheDocument();
    expect(await progress().findByText('Noch keine Ernährungsdaten.')).toBeInTheDocument();
    expect(await progress().findByText('Noch keine Gewichtsdaten.')).toBeInTheDocument();
    // No Health Connect: no activity row that could only say "nothing".
    expect(progress().queryByText('Aktivitäten')).not.toBeInTheDocument();
    // No invented zeros or charts.
    expect(progress().queryByRole('img')).not.toBeInTheDocument();
    expect(progress().queryByText(/^0 /)).not.toBeInTheDocument();
  });

  it('shows today’s training only and moves counts to the progress section', async () => {
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
    expect(await training.findByText('Heute noch kein Training')).toBeInTheDocument();
    expect(training.getByText('Push A · PPL')).toBeInTheDocument();
    // Yesterday's workout is history – not today's business.
    expect(training.queryByText(/52 min/)).not.toBeInTheDocument();

    const row = progressRow(/^Training/);
    expect(await row.findByText('2 Einheiten')).toBeInTheDocument();
    expect(row.getByText('Ø 2 pro Woche')).toBeInTheDocument();
    expect(row.getByText('1.280 kg Volumen')).toBeInTheDocument();
    expect(
      row.getByRole('img', { name: 'Trainingstage: an 2 von 7 Tagen trainiert' }),
    ).toBeInTheDocument();

    await userEvent.click(progress().getByRole('radio', { name: 'Monat' }));
    expect(await progressRow(/^Training/).findByText('3 Einheiten')).toBeInTheDocument();
    expect(progressRow(/^Training/).getByText('1.920 kg Volumen')).toBeInTheDocument();
    expect(progress().getByText(/04\.09\. – 03\.10\./)).toBeInTheDocument();
  });

  it('shows a workout finished today', async () => {
    await renderApp('/', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        await completedWorkout(services, profileId, new Date(2026, 9, 3, 7), 52);
      },
    });
    const training = card(/^Training/);
    expect(await training.findByText('Heute abgeschlossen')).toBeInTheDocument();
    expect(training.getByText('Krafttraining · 52 min')).toBeInTheDocument();
  });

  it('shows the running workout with its progress and the next step', async () => {
    const { router } = await renderApp('/', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        vi.setSystemTime(new Date(NOW.getTime() - 20 * 60_000));
        const workout = await services.training.workouts.startFree(profileId);
        for (const id of ['sys.bench-press', 'sys.back-squat']) {
          await services.training.workouts.addExercise(profileId, workout.id, id);
        }
        const detail = await services.training.workouts.getDetail(profileId, workout.id);
        const first = detail.exercises[0]?.sets[0];
        if (!first) throw new Error('set expected');
        await services.training.workouts.updateSet(
          profileId,
          first.id,
          { ...EMPTY_SET_VALUES, weightKg: 60, reps: 10 },
          true,
        );
        vi.setSystemTime(NOW);
      },
    });
    const training = card(/^Training/);
    expect(await training.findByText('Krafttraining · seit 20 min')).toBeInTheDocument();
    expect(training.getByText('1 von 2 Übungen abgeschlossen')).toBeInTheDocument();
    expect(training.getByText('Training fortsetzen')).toBeInTheDocument();
    await userEvent.click(cardLink(/^Training/));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/training/workout');
    });
  });

  it('shows weight, its change and a small chart in the progress section', async () => {
    const { services } = await renderApp('/', {
      prepare: async (s, profileId) => {
        await s.weight.save(profileId, '2026-08-01', 94);
        await s.weight.save(profileId, '2026-09-10', 93);
        await s.weight.save(profileId, '2026-10-03', 91.8);
      },
    });
    // Week: one value in it – the current weight, but nothing to compare yet.
    const weekRow = progressRow(/^Gewicht/);
    expect(await weekRow.findByText('91,8 kg')).toBeInTheDocument();
    expect(weekRow.getByText('Noch kein Vergleich im Zeitraum')).toBeInTheDocument();
    expect(weekRow.queryByRole('img')).not.toBeInTheDocument();

    await userEvent.click(progress().getByRole('radio', { name: 'Monat' }));
    const monthRow = progressRow(/^Gewicht/);
    expect(await monthRow.findByText(/^[-−]1,2 kg in 30 Tagen$/)).toBeInTheDocument();
    const chart = monthRow.getByRole('img', {
      name: 'Gewichtsverlauf von 93,0 kg am 10.09. bis 91,8 kg am 03.10.',
    });
    expect(chart.querySelectorAll('circle')).toHaveLength(3);

    // Changes in Health show up on Today – Today stores nothing itself.
    const profileId = (await services.profile.ensureLocalProfile()).id;
    await services.weight.save(profileId, '2026-10-03', 90.5);
    const nav = within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));
    await userEvent.click(nav.getByRole('link', { name: 'Gesundheit' }));
    await userEvent.click(nav.getByRole('link', { name: 'Heute' }));
    expect(await progressRow(/^Gewicht/).findByText('90,5 kg')).toBeInTheDocument();
  });

  it('shows weight in pounds when set', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await s.settings.update('weightUnit', 'lb');
        await s.weight.save(profileId, '2026-10-03', 90);
      },
    });
    expect(await progressRow(/^Gewicht/).findByText('198,4 lb')).toBeInTheDocument();
  });

  it('lets an own weight win over an imported one', async () => {
    const platform = new FakeHealthPlatform();
    platform.weights = [
      { id: 'a', measuredAt: localIso(2026, 10, 3, 7), kg: 95, source: 'Waage' },
      { id: 'b', measuredAt: localIso(2026, 9, 30, 7), kg: 92.6, source: 'Waage' },
    ];
    await renderApp('/', {
      healthPlatform: platform,
      prepare: async (s, profileId) => {
        await s.weight.save(profileId, '2026-10-03', 92);
        await s.healthSync.connect(profileId);
      },
    });
    const row = progressRow(/^Gewicht/);
    // Today: own 92 kg wins over the imported 95 kg; 30.09. comes from Health Connect.
    expect(await row.findByText('92,0 kg')).toBeInTheDocument();
    expect(row.getByText(/^[-−]0,6 kg in 7 Tagen$/)).toBeInTheDocument();
    expect(row.queryByText('Wert aus Health Connect')).not.toBeInTheDocument();
    expect(screen.queryByText('95,0 kg')).not.toBeInTheDocument();
  });

  it.each([
    [/^Training/, '/training'],
    [/^Ernährung/, '/nutrition'],
  ])('opens the area from the card %s', async (name, path) => {
    const { router } = await renderApp('/');
    await screen.findAllByRole('link', { name });
    await userEvent.click(cardLink(name));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path);
    });
  });

  it.each([
    [/^Training/, '/training'],
    [/^Ernährung/, '/nutrition'],
    [/^Gewicht/, '/health'],
  ])('opens the area from the progress row %s', async (name, path) => {
    const { router } = await renderApp('/');
    await progress().findAllByRole('link', { name });
    await userEvent.click(progress().getByRole('link', { name }));
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
    expect(card(/^Nutrition/).getByText('Carbs')).toBeInTheDocument();
    expect(await card(/^Training/).findByText('No workout planned today')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your progress' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
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
    // The meals themselves are in the diary – no second meal list on Today.
    expect(screen.queryByRole('list', { name: 'Mahlzeiten' })).not.toBeInTheDocument();

    // Progress: two logged days (02.10. 1.850 kcal, 03.10. 740 kcal) – days without entries
    // are not counted as 0.
    const row = progressRow(/^Ernährung/);
    expect(await row.findByText('Ø 1.295 kcal / Tag')).toBeInTheDocument();
    expect(row.getByText('Ø 47 g Protein / Tag')).toBeInTheDocument();
    expect(row.getByText('Tagesziel Ø 2.500 kcal')).toBeInTheDocument();
    expect(row.getByText('An 2 von 7 Tagen erfasst')).toBeInTheDocument();
    expect(
      row.getByRole('img', {
        name: 'Kalorien pro Tag an 2 erfassten Tagen, Durchschnitt 1.295 kcal',
      }),
    ).toBeInTheDocument();
  });

  it('summarises today’s activities and health values from Health Connect', async () => {
    const platform = new FakeHealthPlatform();
    platform.workouts = [session('a', 3, 7, 42, 386), session('b', 1, 18, 30, 250)];
    platform.steps = [{ dayStart: localIso(2026, 10, 3), value: 6543 }];
    platform.activeEnergy = [{ dayStart: localIso(2026, 10, 3), value: 321 }];
    const { router } = await renderApp('/', {
      healthPlatform: platform,
      prepare: async (s, profileId) => {
        await s.healthSync.connect(profileId);
      },
    });
    await screen.findAllByRole('link', { name: /^Aktivitäten heute/ });
    const activities = card(/^Aktivitäten heute/);
    expect(await activities.findByText('Laufen · 42 min')).toBeInTheDocument();
    expect(activities.getByText('386 aktive kcal')).toBeInTheDocument();

    await screen.findAllByRole('link', { name: /^Gesundheit heute/ });
    const health = card(/^Gesundheit heute/);
    expect(health.getByText('6.543')).toBeInTheDocument();
    expect(health.getByText('321')).toBeInTheDocument();

    // Progress: both activities of the week, kept apart from Kalethra workouts.
    const row = progressRow(/^Aktivitäten/);
    expect(await row.findByText('2 Aktivitäten')).toBeInTheDocument();
    expect(row.getByText('1 h 12 min')).toBeInTheDocument();
    expect(row.getByText('636 aktive kcal')).toBeInTheDocument();
    expect(progressRow(/^Training/).getByText('Noch keine Trainingsdaten.')).toBeInTheDocument();

    await userEvent.click(cardLink(/^Aktivitäten heute/));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/training/activities');
    });
  });

  it('sums several activities of today into one line', async () => {
    const platform = new FakeHealthPlatform();
    platform.workouts = [
      session('a', 3, 6, 42, 386),
      session('b', 3, 7, 30, 180),
      session('c', 3, 8, 12, null),
    ];
    await renderApp('/', {
      healthPlatform: platform,
      prepare: async (s, profileId) => {
        await s.healthSync.connect(profileId);
      },
    });
    await screen.findAllByRole('link', { name: /^Aktivitäten heute/ });
    const activities = card(/^Aktivitäten heute/);
    expect(await activities.findByText('3 Aktivitäten · 1 h 24 min')).toBeInTheDocument();
    expect(activities.getByText('566 aktive kcal')).toBeInTheDocument();
  });

  it('shows "no activities yet" when connected without activities', async () => {
    await renderApp('/', {
      healthPlatform: new FakeHealthPlatform(),
      prepare: async (s, profileId) => {
        await s.healthSync.connect(profileId);
      },
    });
    expect(await progress().findByText('Noch keine Aktivitäten.')).toBeInTheDocument();
    expect(screen.queryByText('Aktivitäten heute')).not.toBeInTheDocument();
  });
});
