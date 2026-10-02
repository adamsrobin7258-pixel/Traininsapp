import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { EMPTY_SET_VALUES } from '@/core/training';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

function main() {
  return within(screen.getByRole('main'));
}

/** One of the four progress cards (the whole card is one link). */
function card(name: RegExp) {
  return within(main().getByRole('link', { name }));
}

async function findCard(name: RegExp) {
  return within(await main().findByRole('link', { name }));
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
    type: 'strengthTraining',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: kcal,
    distanceM: null,
    source: 'Pixel Watch',
  } satisfies HealthWorkout;
}

/** A food with 100 kcal and 10 g protein per 100 g, eaten in grams on the given days. */
async function eat(services: AppServices, profileId: string, days: [string, number][]) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [meal] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    name: 'Testessen',
    reference: { amount: 100, unit: 'g' },
    nutrients: {
      energyKcal: 100,
      proteinG: 10,
      carbsG: 10,
      fatG: 2,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    },
  });
  for (const [localDate, grams] of days) {
    await n.diary.addFood(profileId, {
      localDate,
      mealId: meal?.id ?? '',
      foodId: food.id,
      amount: grams,
      unit: 'g',
    });
  }
}

describe('Fortschritt – the main page', () => {
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

  describe('navigation', () => {
    it('is called "Fortschritt" and is the start page; there is no "Heute" tab', async () => {
      const { router } = await renderApp('/');
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Fortschritt' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
      const nav = within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));
      expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Fortschritt',
        'Training',
        'Ernährung',
        'Gesundheit',
        'Profil',
      ]);
      expect(nav.getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      // "Heute" is no tab (Phase 7.1) – since Phase 9 only a period of the score and cards.
      expect(nav.queryByRole('link', { name: /Heute/ })).not.toBeInTheDocument();
    });

    it('is read-only: no inputs – only the period switch and the score details', async () => {
      const { container } = await renderApp('/');
      await main().findByRole('link', { name: /^Training/ });
      expect(container.querySelectorAll('main input, main textarea, main select')).toHaveLength(0);
      // The one button opens the explanation of the Kalethra score (Phase 9).
      const buttons = await main().findAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName(/Details zum Kalethra-Score$/);
      expect(
        main()
          .getAllByRole('radio')
          .map((radio) => radio.textContent),
      ).toEqual(['Heute', '7 Tage', '30 Tage']);
    });

    it.each([
      [/^Training/, '/training'],
      [/^Ernährung/, '/nutrition'],
      [/^Gewicht/, '/health'],
    ])('the %s card opens its area, and back returns here', async (name, path) => {
      const { router } = await renderApp('/');
      await userEvent.click(await main().findByRole('link', { name }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path);
      });
      await router.navigate(-1);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/');
      });
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Fortschritt' }),
      ).toBeInTheDocument();
      await router.navigate(1);
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
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Progress' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '7 days' })).toHaveAttribute('aria-checked', 'true');
      expect(await main().findByText('No training data yet.')).toBeInTheDocument();
      expect(await main().findByText('Kalethra score')).toBeInTheDocument();
      const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
      expect(nav.queryByRole('link', { name: /Today/ })).not.toBeInTheDocument();
    });
  });

  describe('period', () => {
    it('defaults to the last 7 days and switches to 30 days and back', async () => {
      await renderApp('/');
      const week = await main().findByRole('radio', { name: '7 Tage' });
      expect(week).toHaveAttribute('aria-checked', 'true');
      expect(main().getByText(/27\.09\. – 03\.10\./)).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '30 Tage' }));
      expect(main().getByRole('radio', { name: '30 Tage' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(main().getByText(/04\.09\. – 03\.10\./)).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '7 Tage' }));
      expect(main().getByText(/27\.09\. – 03\.10\./)).toBeInTheDocument();
    });
  });

  it('shows the four areas in order, with small empty states and no invented zeros', async () => {
    await renderApp('/', {
      healthPlatform: new FakeHealthPlatform(),
      prepare: async (s, profileId) => {
        await s.healthSync.connect(profileId);
      },
    });
    const list = await main().findByRole('list', { name: 'Fortschritt' });
    await within(list).findByText('Noch keine Aktivitäten.');
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent.split(/(?=Noch)/)[0]),
    ).toEqual(['Training', 'Ernährung', 'Gewicht', 'Aktivitäten']);
    expect(card(/^Training/).getByText('Noch keine Trainingsdaten.')).toBeInTheDocument();
    expect(
      await (await findCard(/^Ernährung/)).findByText('Noch keine Ernährungsdaten.'),
    ).toBeInTheDocument();
    expect(
      await (await findCard(/^Gewicht/)).findByText('Noch keine Gewichtsdaten.'),
    ).toBeInTheDocument();
    expect(main().queryByRole('img')).not.toBeInTheDocument();
    expect(main().queryByText(/^0 /)).not.toBeInTheDocument();
  });

  it('no longer shows any daily content', async () => {
    await renderApp('/', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        // A running workout and food today – both belong to their areas, not to this page.
        await services.training.workouts.startFree(profileId);
        await eat(services, profileId, [['2026-10-03', 500]]);
      },
    });
    await (await findCard(/^Ernährung/)).findByText('Ø 500 kcal / Tag');
    for (const text of [
      'Laufendes Training',
      'Training fortsetzen',
      /Heute (kein|noch kein|abgeschlossen)/,
      'Noch nichts eingetragen',
      /Wasser/,
      'Gesundheit heute',
      'Aktivitäten heute',
    ]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('list', { name: 'Mahlzeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  describe('training', () => {
    it('counts Kalethra workouts, per week and volume – not imported activities', async () => {
      const platform = new FakeHealthPlatform();
      // A watch-recorded strength session yesterday: an activity, not a Kalethra workout.
      platform.workouts = [session('hc', 2, 7, 50, 400)];
      const { router } = await renderApp('/', {
        healthPlatform: platform,
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await completedWorkout(services, profileId, new Date(2026, 8, 10, 18)); // 23 days ago
          await completedWorkout(services, profileId, new Date(2026, 8, 29, 18)); // 4 days ago
          await completedWorkout(services, profileId, new Date(2026, 9, 2, 18)); // yesterday
          await services.healthSync.connect(profileId);
        },
      });
      const training = await findCard(/^Training/);
      expect(await training.findByText('2 Einheiten')).toBeInTheDocument();
      expect(training.getByText('Ø 2 pro Woche')).toBeInTheDocument();
      expect(training.getByText('1.280 kg Volumen')).toBeInTheDocument();
      expect(
        training.getByRole('img', { name: 'Trainingstage: an 2 von 7 Tagen trainiert' }),
      ).toBeInTheDocument();
      expect(await (await findCard(/^Aktivitäten/)).findByText('1 Aktivität')).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '30 Tage' }));
      expect(await card(/^Training/).findByText('3 Einheiten')).toBeInTheDocument();
      expect(card(/^Training/).getByText('Ø 0,7 pro Woche')).toBeInTheDocument();
      expect(card(/^Training/).getByText('1.920 kg Volumen')).toBeInTheDocument();

      await userEvent.click(main().getByRole('link', { name: /^Training/ }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/training');
      });
    });
  });

  describe('nutrition', () => {
    it('averages logged days only and compares with the goal of the same days', async () => {
      const { router } = await renderApp('/', {
        prepare: async (services, profileId) => {
          await eat(services, profileId, [
            ['2026-10-01', 2000],
            ['2026-10-03', 1200],
          ]);
          await services.nutrition.goals.save(profileId, {
            effectiveFrom: '2026-09-01',
            goalType: 'maintain',
            targets: {
              energyKcal: { auto: null, manual: 2300 },
              proteinG: { auto: null, manual: 160 },
            },
          });
        },
      });
      const nutrition = await findCard(/^Ernährung/);
      // (2.000 + 1.200) / 2 – the five days without entries do not count as 0.
      expect(await nutrition.findByText('Ø 1.600 kcal / Tag')).toBeInTheDocument();
      expect(nutrition.getByText('Ø 160 g Protein / Tag')).toBeInTheDocument();
      expect(nutrition.getByText('Tagesziel Ø 2.300 kcal · 160 g Protein')).toBeInTheDocument();
      expect(nutrition.getByText('An 2 von 7 Tagen erfasst')).toBeInTheDocument();

      await userEvent.click(main().getByRole('link', { name: /^Ernährung/ }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/nutrition');
      });
    });

    it('uses a custom protein target unchanged', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.profile.updateBodyData(await services.profile.ensureLocalProfile(), {
            sex: 'male',
            birthDate: '1990-05-01',
            heightCm: 177,
          });
          for (const date of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'])
            await services.weight.save(profileId, date, 92);
          await services.nutrition.goals.saveProfile(profileId, {
            params: {
              goalType: 'lose',
              goalLevel: 'moderate',
              activityLevel: 'moderate',
              includeTraining: false,
              targetWeightKg: null,
            },
            overrides: {},
            waterMl: null,
          });
          await services.nutrition.goals.setProfileOverride(profileId, 'proteinG', 220);
          await eat(services, profileId, [['2026-10-03', 1000]]);
        },
      });
      const nutrition = await findCard(/^Ernährung/);
      expect(await nutrition.findByText(/· 220 g Protein$/)).toBeInTheDocument();
    });
  });

  describe('weight', () => {
    it('shows the current weight, the change in the period and a small chart', async () => {
      const { router } = await renderApp('/', {
        prepare: async (s, profileId) => {
          await s.weight.save(profileId, '2026-08-01', 94);
          await s.weight.save(profileId, '2026-09-10', 93);
          await s.weight.save(profileId, '2026-10-03', 91.8);
        },
      });
      const week = await findCard(/^Gewicht/);
      expect(await week.findByText('91,8 kg')).toBeInTheDocument();
      expect(week.getByText('Noch kein Vergleich im Zeitraum')).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '30 Tage' }));
      const month = card(/^Gewicht/);
      expect(await month.findByText(/^[-−]1,2 kg in 30 Tagen$/)).toBeInTheDocument();
      expect(
        month.getByRole('img', {
          name: 'Gewichtsverlauf von 93,0 kg am 10.09. bis 91,8 kg am 03.10.',
        }),
      ).toBeInTheDocument();

      await userEvent.click(main().getByRole('link', { name: /^Gewicht/ }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/health');
      });
    });

    it('shows weight in pounds when set', async () => {
      await renderApp('/', {
        prepare: async (s, profileId) => {
          await s.settings.update('weightUnit', 'lb');
          await s.weight.save(profileId, '2026-10-03', 90);
        },
      });
      expect(await (await findCard(/^Gewicht/)).findByText('198,4 lb')).toBeInTheDocument();
    });

    it('lets an own entry win over an imported one and shows Health Connect values', async () => {
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
      const weight = await findCard(/^Gewicht/);
      // Today: own 92 kg wins over the imported 95 kg; 30.09. comes from Health Connect.
      expect(await weight.findByText('92,0 kg')).toBeInTheDocument();
      expect(weight.getByText(/^[-−]0,6 kg in 7 Tagen$/)).toBeInTheDocument();
      expect(screen.queryByText('95,0 kg')).not.toBeInTheDocument();
    });

    it('marks a current value that comes from Health Connect', async () => {
      const platform = new FakeHealthPlatform();
      platform.weights = [
        { id: 'a', measuredAt: localIso(2026, 10, 2, 7), kg: 91.4, source: 'Waage' },
      ];
      await renderApp('/', {
        healthPlatform: platform,
        prepare: async (s, profileId) => {
          await s.weight.save(profileId, '2026-09-28', 92);
          await s.healthSync.connect(profileId);
        },
      });
      const weight = await findCard(/^Gewicht/);
      expect(await weight.findByText('91,4 kg')).toBeInTheDocument();
      expect(weight.getByText('Wert aus Health Connect')).toBeInTheDocument();
    });
  });

  describe('activities', () => {
    it('appears with imported activities and opens Training → Aktivitäten', async () => {
      const platform = new FakeHealthPlatform();
      platform.workouts = [session('a', 3, 7, 42, 386), session('b', 1, 18, 30, 250)];
      const { router } = await renderApp('/', {
        healthPlatform: platform,
        prepare: async (s, profileId) => {
          await s.healthSync.connect(profileId);
        },
      });
      const activities = await findCard(/^Aktivitäten/);
      expect(await activities.findByText('2 Aktivitäten')).toBeInTheDocument();
      expect(activities.getByText('1 h 12 min')).toBeInTheDocument();
      expect(activities.getByText('636 aktive kcal')).toBeInTheDocument();
      // Kept apart: they do not count as Kalethra training.
      expect(card(/^Training/).getByText('Noch keine Trainingsdaten.')).toBeInTheDocument();

      await userEvent.click(main().getByRole('link', { name: /^Aktivitäten/ }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/training/activities');
      });
    });

    it('appears with an active connection even without activities', async () => {
      await renderApp('/', {
        healthPlatform: new FakeHealthPlatform(),
        prepare: async (s, profileId) => {
          await s.healthSync.connect(profileId);
        },
      });
      expect(
        await (await findCard(/^Aktivitäten/)).findByText('Noch keine Aktivitäten.'),
      ).toBeInTheDocument();
    });

    it('stays hidden without connection and without activities', async () => {
      await renderApp('/');
      await (await findCard(/^Gewicht/)).findByText('Noch keine Gewichtsdaten.');
      expect(main().queryByRole('link', { name: /^Aktivitäten/ })).not.toBeInTheDocument();
    });

    it('stays visible for imported activities after disconnecting without deleting', async () => {
      const platform = new FakeHealthPlatform();
      platform.workouts = [session('a', 3, 7, 42, 386)];
      await renderApp('/', {
        healthPlatform: platform,
        prepare: async (s, profileId) => {
          await s.healthSync.connect(profileId);
          await s.healthSync.disconnect(profileId, { deleteImported: false });
        },
      });
      expect(await (await findCard(/^Aktivitäten/)).findByText('1 Aktivität')).toBeInTheDocument();
    });
  });
});
