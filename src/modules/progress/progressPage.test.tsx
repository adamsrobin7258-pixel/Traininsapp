import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { EMPTY_SET_VALUES } from '@/core/training';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { showProgressPeriod } from '@/test/progressPeriod';
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
        'Einstellungen',
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
      await showProgressPeriod('7 days');
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
    it('opens on Heute and switches to 7 and 30 days and back', async () => {
      await renderApp('/');
      const today = await main().findByRole('radio', { name: 'Heute' });
      expect(today).toHaveAttribute('aria-checked', 'true');
      expect(main().getByRole('radio', { name: '7 Tage' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(main().getByText('03.10.')).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '7 Tage' }));
      expect(main().getByRole('radio', { name: '7 Tage' })).toHaveAttribute('aria-checked', 'true');
      expect(main().getByText(/27\.09\. – 03\.10\./)).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '30 Tage' }));
      expect(main().getByRole('radio', { name: '30 Tage' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(main().getByText(/04\.09\. – 03\.10\./)).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: 'Heute' }));
      expect(main().getByText('03.10.')).toBeInTheDocument();
    });
  });

  it('shows the four areas in order, with small empty states and no invented zeros', async () => {
    await renderApp('/', {
      healthPlatform: new FakeHealthPlatform(),
      prepare: async (s, profileId) => {
        await s.healthSync.connect(profileId);
      },
    });
    await showProgressPeriod('7 Tage');
    const list = await main().findByRole('list', { name: 'Fortschritt' });
    await within(list).findByText('Noch keine Aktivitäten.');
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent.split(/(?=Noch)/)[0]),
    ).toEqual(['Training', 'Ernährung', 'Gewicht', 'Aktivitäten', 'Schritte']);
    expect(card(/^Training/).getByText('Noch keine Trainingsdaten.')).toBeInTheDocument();
    expect(
      await (await findCard(/^Ernährung/)).findByText('Noch keine Ernährungsdaten.'),
    ).toBeInTheDocument();
    expect(
      await (await findCard(/^Gewicht/)).findByText('Noch keine Gewichtsdaten.'),
    ).toBeInTheDocument();
    // Steps come only from Health Connect: connected without values → no data, never 0 steps.
    expect(card(/^Schritte/).getByText('Noch keine Schrittdaten.')).toBeInTheDocument();
    expect(main().queryByRole('img')).not.toBeInTheDocument();
    expect(main().queryByText(/^0 /)).not.toBeInTheDocument();
  });

  it('keeps areas without values compact and lets areas with values carry the page', async () => {
    await renderApp('/', {
      prepare: async (services, profileId) => {
        await eat(services, profileId, [['2026-10-03', 500]]);
      },
    });
    await (await findCard(/^Ernährung/)).findByText('Ø 500 kcal / Tag');
    const link = (name: RegExp) => main().getByRole('link', { name });
    expect(link(/^Ernährung/)).not.toHaveAttribute('data-empty');
    expect(link(/^Training/)).toHaveAttribute('data-empty', 'true');
    expect(link(/^Gewicht/)).toHaveAttribute('data-empty', 'true');
    // Compact, but still the whole card is one target of at least 44 px (checked in E2E).
    expect(card(/^Training/).getByText('Noch keine Trainingsdaten.')).toBeInTheDocument();
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
    it('counts Kalethra workouts, per week over 30 days and volume – not imported activities', async () => {
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
      await showProgressPeriod('7 Tage');
      const training = await findCard(/^Training/);
      expect(await training.findByText('2 Einheiten')).toBeInTheDocument();
      // Over exactly 7 days the weekly mean is the count itself: not repeated (Phase 17.3).
      expect(training.queryByText(/pro Woche/)).not.toBeInTheDocument();
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
          // A goal applies from the day it is saved: saved on 1 September.
          vi.setSystemTime(new Date(2026, 8, 1, 9));
          await services.nutrition.goals.save(profileId, {
            goalType: 'maintain',
            targets: {
              energyKcal: { auto: null, manual: 2300 },
              proteinG: { auto: null, manual: 160 },
            },
          });
          vi.setSystemTime(NOW);
        },
      });
      // Heute: the day against its goal – no "1 of 1 days logged" (Phase 17.3).
      const day = await findCard(/^Ernährung/);
      expect(await day.findByText('1.200 von 2.300 kcal')).toBeInTheDocument();
      expect(day.queryByText(/Tagen erfasst/)).not.toBeInTheDocument();

      await showProgressPeriod('7 Tage');
      const nutrition = await findCard(/^Ernährung/);
      // (2.000 + 1.200) / 2 – the five days without entries do not count as 0 – against the
      // goal of the same days.
      expect(await nutrition.findByText('Ø 1.600 von 2.300 kcal')).toBeInTheDocument();
      expect(nutrition.getByText('Ø 160 von 160 g Protein')).toBeInTheDocument();
      expect(nutrition.getByText('100 %')).toBeInTheDocument();
      // Gewicht halten: ±5 % range. 1 Oct (−13 %) is below; today (1.200) is still open.
      expect(nutrition.getByText('Im Kalorien-Zielbereich an 0 von 1 Tagen')).toBeInTheDocument();
      // Protein: 1 Oct reached (200 g), today (75 %) still open – not a miss.
      expect(nutrition.getByText('Proteinziel erreicht an 1 von 1 Tagen')).toBeInTheDocument();
      expect(nutrition.getByText('An 2 von 7 Tagen erfasst')).toBeInTheDocument();
      // The dashed reference line is named under the chart (Phase C.1).
      expect(nutrition.getByText('Ø Ziel')).toBeInTheDocument();

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
      expect(await nutrition.findByText(/von 220 g Protein$/)).toBeInTheDocument();
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
      await showProgressPeriod('7 Tage');
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

    it('today: the latest weight with its day – measured today', async () => {
      await renderApp('/', {
        prepare: async (s, profileId) => {
          await s.weight.save(profileId, '2026-09-28', 92.4);
          await s.weight.save(profileId, '2026-10-03', 91.8);
        },
      });
      const today = await findCard(/^Gewicht/);
      expect(await today.findByText('91,8 kg')).toBeInTheDocument();
      expect(today.getByText('heute')).toBeInTheDocument();
      // One day has nothing to compare: no comparison line, no invented change.
      expect(today.queryByText('Noch kein Vergleich im Zeitraum')).not.toBeInTheDocument();
      expect(today.queryByText(/kg heute|→/)).not.toBeInTheDocument();
      expect(today.queryByRole('img')).not.toBeInTheDocument();
    });

    it('today: an older latest weight shows its day, never as if measured today', async () => {
      await renderApp('/', {
        prepare: async (s, profileId) => {
          await s.weight.save(profileId, '2026-09-20', 93);
          await s.weight.save(profileId, '2026-09-28', 92.4);
        },
      });
      const today = await findCard(/^Gewicht/);
      expect(await today.findByText('92,4 kg')).toBeInTheDocument();
      expect(today.getByText('vom 28.09.')).toBeInTheDocument();
      expect(today.queryByText('heute')).not.toBeInTheDocument();
      expect(today.queryByText('Noch kein Vergleich im Zeitraum')).not.toBeInTheDocument();

      // 7 and 30 days keep the development of the period: the last 7 days hold one value only.
      await showProgressPeriod('7 Tage');
      expect(
        await card(/^Gewicht/).findByText('Noch kein Vergleich im Zeitraum'),
      ).toBeInTheDocument();
      await showProgressPeriod('30 Tage');
      expect(await card(/^Gewicht/).findByText(/^[-−]0,6 kg in 30 Tagen$/)).toBeInTheDocument();
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
      await showProgressPeriod('7 Tage');
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
      await showProgressPeriod('7 Tage');
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

  describe('goal attainment (Phase 14)', () => {
    /** Sets a target as if it had been chosen on 1 September. */
    async function target(
      services: AppServices,
      profileId: string,
      kind: 'trainingsPerWeek' | 'activeMinutesPerWeek' | 'stepsPerDay',
      value: number,
    ) {
      vi.setSystemTime(new Date(2026, 8, 1, 9));
      await services.targets.set(profileId, kind, value);
      vi.setSystemTime(NOW);
    }

    it('training: 3 of 4 with the goal from Einstellungen, a quiet bar and the percent', async () => {
      const { container } = await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await target(services, profileId, 'trainingsPerWeek', 4);
          for (const day of [28, 30, 2])
            await completedWorkout(services, profileId, new Date(2026, day > 3 ? 8 : 9, day, 18));
        },
      });
      await showProgressPeriod('7 Tage');
      const training = await findCard(/^Training/);
      expect(await training.findByText('3 von 4 Einheiten')).toBeInTheDocument();
      expect(training.getByText('75 %')).toBeInTheDocument();
      expect(training.getByText('Ziel: 4 pro Woche')).toBeInTheDocument();
      // The bar is decorative (aria-hidden) – the text carries the information.
      const meter = container.querySelector('[aria-hidden="true"] > span[style*="--meter-ratio"]');
      expect(meter?.getAttribute('style')).toContain('--meter-ratio: 0.75');
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('training: 5 of 4 keeps the real value and the bar at 100 %', async () => {
      const { container } = await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await target(services, profileId, 'trainingsPerWeek', 4);
          for (const day of [27, 28, 29, 30, 1])
            await completedWorkout(services, profileId, new Date(2026, day > 3 ? 8 : 9, day, 18));
        },
      });
      await showProgressPeriod('7 Tage');
      const training = await findCard(/^Training/);
      expect(await training.findByText('5 von 4 Einheiten')).toBeInTheDocument();
      expect(training.getByText('125 %')).toBeInTheDocument();
      const meter = container.querySelector('[aria-hidden="true"] > span[style*="--meter-ratio"]');
      expect(meter?.getAttribute('style')).toContain('--meter-ratio: 1');
    });

    it('today: no workout yet is no 0 % – only the weekly goal is shown', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await target(services, profileId, 'trainingsPerWeek', 4);
        },
      });
      await userEvent.click(await main().findByRole('radio', { name: 'Heute' }));
      const training = card(/^Training/);
      expect(await training.findByText('Ziel: 4 pro Woche')).toBeInTheDocument();
      expect(training.getByText('Noch keine Trainingsdaten.')).toBeInTheDocument();
      expect(training.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('activities: manual minutes against the weekly goal, shown even without Health Connect', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await target(services, profileId, 'activeMinutesPerWeek', 180);
          for (const [localDate, durationMin] of [
            ['2026-09-29', 60],
            ['2026-10-02', 75],
          ] as const) {
            await services.activities.create(profileId, {
              sportId: 'yoga',
              localDate,
              startTime: null,
              durationMin,
              distanceKm: null,
              intensity: null,
              variant: null,
              kcalOverride: 100,
            });
          }
        },
      });
      await showProgressPeriod('7 Tage');
      const activities = await findCard(/^Aktivitäten/);
      expect(await activities.findByText('135 von 180 aktiven Min.')).toBeInTheDocument();
      expect(activities.getByText('75 %')).toBeInTheDocument();
      expect(activities.getByText('Ziel: 180 Min. pro Woche')).toBeInTheDocument();
      expect(activities.getByText('2 Aktivitäten')).toBeInTheDocument();
    });

    it('steps: today against the step goal; over the week only days with data, opens Gesundheit', async () => {
      const platform = new FakeHealthPlatform();
      platform.steps = [
        { dayStart: localIso(2026, 10, 1, 0), value: 9_000 },
        { dayStart: localIso(2026, 10, 3, 0), value: 7_842 },
      ];
      const { router } = await renderApp('/', {
        healthPlatform: platform,
        prepare: async (services, profileId) => {
          await target(services, profileId, 'stepsPerDay', 10_000);
          await services.healthSync.connect(profileId);
        },
      });
      await showProgressPeriod('7 Tage');
      const week = await findCard(/^Schritte/);
      // (9.000 + 7.842) / 2 – the five days without data are no 0 steps.
      expect(await week.findByText('Ø 8.421 von 10.000 Schritten')).toBeInTheDocument();
      expect(
        week.getByText('An 2 von 7 Tagen mit Daten · Ziel an 0 von 2 Tagen erreicht'),
      ).toBeInTheDocument();
      // The goal is already in "von 10.000": no second goal line (Phase 17.3).
      expect(week.queryByText('Ziel: 10.000 pro Tag')).not.toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: 'Heute' }));
      expect(await card(/^Schritte/).findByText('7.842 von 10.000 Schritten')).toBeInTheDocument();
      expect(card(/^Schritte/).getByText('78 %')).toBeInTheDocument();
      expect(card(/^Schritte/).queryByText('Ziel: 10.000 pro Tag')).not.toBeInTheDocument();

      await userEvent.click(main().getByRole('link', { name: /^Schritte/ }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/health');
      });
    });

    it('steps: a day without data is "no data", never 0 of 10.000', async () => {
      await renderApp('/', {
        healthPlatform: new FakeHealthPlatform(),
        prepare: async (services, profileId) => {
          await target(services, profileId, 'stepsPerDay', 10_000);
          await services.healthSync.connect(profileId);
        },
      });
      await userEvent.click(await main().findByRole('radio', { name: 'Heute' }));
      const steps = await findCard(/^Schritte/);
      expect(await steps.findByText('Noch keine Schrittdaten für heute.')).toBeInTheDocument();
      expect(steps.queryByText(/^0 von/)).not.toBeInTheDocument();
      // Without a meter the goal is shown once as a note.
      expect(steps.getByText('Ziel: 10.000 pro Tag')).toBeInTheDocument();
      expect(steps.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('steps: the largest importable day (100.000) stays readable text', async () => {
      // The import keeps at most 100.000 steps a day (plausibility rule of the Health Connect
      // import); 999.999 can never reach this page – the calculation is tested for it separately.
      const platform = new FakeHealthPlatform();
      platform.steps = [{ dayStart: localIso(2026, 10, 3, 0), value: 100_000 }];
      await renderApp('/', {
        healthPlatform: platform,
        prepare: async (services, profileId) => {
          await target(services, profileId, 'stepsPerDay', 10_000);
          await services.healthSync.connect(profileId);
        },
      });
      await userEvent.click(await main().findByRole('radio', { name: 'Heute' }));
      const steps = await findCard(/^Schritte/);
      expect(await steps.findByText('100.000 von 10.000 Schritten')).toBeInTheDocument();
      // A day counts at most 100 % (Phase 16); the real value stays visible.
      expect(steps.getByText('100 %')).toBeInTheDocument();
    });

    it('steps stay hidden without Health Connect and without imported steps', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await target(services, profileId, 'stepsPerDay', 10_000);
        },
      });
      await (await findCard(/^Gewicht/)).findByText('Noch keine Gewichtsdaten.');
      expect(main().queryByRole('link', { name: /^Schritte/ })).not.toBeInTheDocument();
    });

    it('nutrition: carbohydrates and fat as plain attainment, at most 100 % – not in the score', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          vi.setSystemTime(new Date(2026, 8, 1, 9));
          await services.nutrition.goals.save(profileId, {
            goalType: 'maintain',
            targets: {
              energyKcal: { auto: null, manual: 2300 },
              proteinG: { auto: null, manual: 160 },
              carbsG: { auto: null, manual: 250 },
              fatG: { auto: null, manual: 30 },
            },
          });
          vi.setSystemTime(NOW);
          // Test food per 100 g: 100 kcal, 10 g protein, 10 g carbs, 2 g fat.
          await eat(services, profileId, [
            ['2026-10-01', 1800],
            ['2026-10-02', 1800],
          ]);
        },
      });
      await showProgressPeriod('7 Tage');
      const nutrition = await findCard(/^Ernährung/);
      expect(await nutrition.findByText('Ø 180 von 250 g Kohlenhydraten')).toBeInTheDocument();
      expect(nutrition.getByText('72 %')).toBeInTheDocument();
      // 36 g of 30 g fat: the real value stays, the attainment stops at 100 %.
      expect(nutrition.getByText('Ø 36 von 30 g Fett')).toBeInTheDocument();
      expect(nutrition.getAllByText('100 %').length).toBeGreaterThanOrEqual(1);
      expect(nutrition.queryByText(/gut|schlecht/i)).not.toBeInTheDocument();
    });

    it('nutrition (Abnehmen): the calorie goal is a limit', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          vi.setSystemTime(new Date(2026, 8, 1, 9));
          await services.nutrition.goals.save(profileId, {
            goalType: 'lose',
            targets: {
              energyKcal: { auto: null, manual: 2200 },
              proteinG: { auto: null, manual: 160 },
            },
          });
          vi.setSystemTime(NOW);
          // 2.100 and 2.200 kcal: kept; 2.500 kcal: over the limit.
          await eat(services, profileId, [
            ['2026-09-29', 2100],
            ['2026-09-30', 2200],
            ['2026-10-01', 2500],
          ]);
        },
      });
      await showProgressPeriod('7 Tage');
      const nutrition = await findCard(/^Ernährung/);
      expect(await nutrition.findByText('Ø 2.267 von 2.200 kcal')).toBeInTheDocument();
      expect(nutrition.getByText('Kalorienlimit eingehalten an 2 von 3 Tagen')).toBeInTheDocument();
      expect(nutrition.getByText('An 3 von 7 Tagen erfasst')).toBeInTheDocument();
    });

    it('weight: only the development in the period – no target weight, no percent', async () => {
      await renderApp('/', {
        prepare: async (s, profileId) => {
          await s.weight.save(profileId, '2026-09-10', 93);
          await s.weight.save(profileId, '2026-10-03', 91.8);
        },
      });
      await userEvent.click(await main().findByRole('radio', { name: '30 Tage' }));
      const weight = card(/^Gewicht/);
      expect(await weight.findByText('93,0 kg → 91,8 kg')).toBeInTheDocument();
      expect(weight.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('works in English', async () => {
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await target(services, profileId, 'trainingsPerWeek', 4);
          await completedWorkout(services, profileId, new Date(2026, 9, 2, 18));
        },
      });
      await showProgressPeriod('7 days');
      const training = await within(screen.getByRole('main')).findByRole('link', {
        name: /^Training/,
      });
      expect(await within(training).findByText('1 of 4 workouts')).toBeInTheDocument();
      expect(within(training).getByText('25%')).toBeInTheDocument();
      expect(within(training).getByText('Goal: 4 per week')).toBeInTheDocument();
    });
  });
});
