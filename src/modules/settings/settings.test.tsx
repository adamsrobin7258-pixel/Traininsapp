import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

const main = () => within(screen.getByRole('main'));
const dialog = () => within(screen.getByRole('dialog'));
const nav = () => within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

function section(name: string) {
  const heading = screen.getByRole('heading', { level: 2, name });
  const element = heading.closest('section');
  if (!element) throw new Error(`no section ${name}`);
  return within(element);
}

/** Man, born 1990-05-01, 180 cm, 90 kg every day of the last week, automatic goals. */
async function person(services: AppServices, profileId: string) {
  const profile = await services.profile.ensureLocalProfile();
  await services.profile.updateBodyData(profile, {
    sex: 'male',
    birthDate: '1990-05-01',
    heightCm: 180,
  });
  for (let day = 27; day <= 30; day++) await services.weight.save(profileId, `2026-09-${day}`, 90);
  for (let day = 1; day <= 3; day++) await services.weight.save(profileId, `2026-10-0${day}`, 90);
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
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Einstellungen', () => {
  it('is a tab with four compact entries that open their pages and lead back', async () => {
    const { router } = await renderApp('/');
    await userEvent.click(nav().getByRole('link', { name: 'Einstellungen' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Einstellungen' }),
    ).toBeInTheDocument();
    const entries = () => within(main().getByRole('list', { name: 'Einstellungen' }));
    expect(
      entries()
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/settings/profile', '/settings/goals', '/settings/content', '/settings/app']);
    for (const [name, heading, path] of [
      [/^Profil/, 'Profil', '/settings/profile'],
      [/^Ziele/, 'Ziele', '/settings/goals'],
      [/^Meine Inhalte/, 'Meine Inhalte', '/settings/content'],
      [/^App/, 'App', '/settings/app'],
    ] as const) {
      await userEvent.click(entries().getByRole('link', { name }));
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      await userEvent.click(main().getByRole('link', { name: /Einstellungen/ }));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Einstellungen' }),
      ).toBeInTheDocument();
    }
  });
});

const oats = {
  name: 'Haferflocken',
  reference: { amount: 100, unit: 'g' as const },
  nutrients: { energyKcal: 370, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
};

/** Two foods, a template from one of them and a plan – own content to manage. */
async function content(services: AppServices, profileId: string) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [breakfast] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    ...oats,
    nutrients: { ...oats.nutrients, fiberG: null, sugarG: null, saturatedFatG: null },
  });
  await n.foods.create(profileId, {
    ...oats,
    name: 'Skyr',
    nutrients: {
      energyKcal: 63,
      proteinG: 11,
      carbsG: 4,
      fatG: 0.2,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    },
  });
  await n.meals.saveMeal(profileId, {
    name: 'Frühstück klassisch',
    mealId: breakfast?.id ?? null,
    items: [{ foodId: food.id, amount: 60, unit: 'g' }],
  });
  await services.training.plans.createPlan(profileId, 'Ganzkörper');
}

describe('Einstellungen → Meine Inhalte', () => {
  it('lists nutrition and training content with counts, recipes included', async () => {
    await renderApp('/settings/content', { prepare: content });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Meine Inhalte' }),
    ).toBeInTheDocument();
    const nutrition = within(main().getByRole('list', { name: 'Ernährung' }));
    const training = within(main().getByRole('list', { name: 'Training' }));
    expect(nutrition.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/settings/content/foods',
      '/settings/content/meals',
      '/settings/content/templates',
      '/settings/content/recipes',
    ]);
    expect(training.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/settings/content/plans',
      '/settings/content/exercises',
    ]);
    // Short descriptions and the number of existing entries (4 default meals of the day).
    expect(
      await nutrition.findByRole('link', { name: /^Lebensmittel2 · Eigene/ }),
    ).toBeInTheDocument();
    expect(
      nutrition.getByRole('link', { name: /^Mahlzeiten des Tages4 · Abschnitte.*Frühstück/ }),
    ).toBeInTheDocument();
    expect(nutrition.getByRole('link', { name: /^Vorlagen1 · / })).toBeInTheDocument();
    expect(
      await training.findByRole('link', { name: /^Trainingspläne1 · Trainingstage/ }),
    ).toBeInTheDocument();
    expect(training.getByRole('link', { name: /^Übungen.*Favoriten/ })).toBeInTheDocument();
    expect(nutrition.getByRole('link', { name: /^Rezepte0 · Zutaten/ })).toBeInTheDocument();
  });

  it.each([
    [/^Lebensmittel/, 'Lebensmittel', '/settings/content/foods'],
    [/^Mahlzeiten des Tages/, 'Mahlzeiten des Tages', '/settings/content/meals'],
    [/^Vorlagen/, 'Vorlagen', '/settings/content/templates'],
    [/^Trainingspläne/, 'Trainingspläne', '/settings/content/plans'],
    [/^Übungen/, 'Übungen', '/settings/content/exercises'],
  ])('opens %s at its new address and leads back to Meine Inhalte', async (name, heading, path) => {
    const { router } = await renderApp('/settings/content');
    await userEvent.click(await main().findByRole('link', { name }));
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    // The tab bar shows where the page lives now.
    expect(nav().getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(main().getByRole('link', { name: 'Meine Inhalte' }));
    expect(router.state.location.pathname).toBe('/settings/content');
  });

  it('Ernährung only tracks: no management links, the quick accesses stay', async () => {
    await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        await content(services, profileId);
        const [breakfast] = await services.nutrition.meals.listActive(profileId);
        const [food] = await services.nutrition.foods.list(profileId);
        if (!breakfast || !food) throw new Error('missing test data');
        await services.nutrition.diary.addFood(profileId, {
          foodId: food.id,
          amount: 60,
          unit: 'g',
          localDate: '2026-10-03',
          mealId: breakfast.id,
        });
      },
    });
    expect(
      await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }),
    ).toBeInTheDocument();
    // The former "Verwalten" section with foods, meals and templates is gone.
    expect(main().queryByRole('heading', { name: 'Verwalten' })).not.toBeInTheDocument();
    expect(main().queryByRole('link', { name: /verwalten|Lebensmittel|Vorlagen/ })).toBeNull();
    // Quick accesses: save a meal as template, apply templates and create a food while adding.
    expect(
      await main().findByRole('button', { name: 'Als Vorlage speichern' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Frühstück: hinzufügen' }));
    expect(
      dialog().getByRole('button', { name: 'Neues Lebensmittel anlegen' }),
    ).toBeInTheDocument();
    expect(dialog().getByRole('button', { name: /Barcode scannen/ })).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('radio', { name: 'Vorlagen' }));
    expect(dialog().getByRole('button', { name: /^Frühstück klassisch/ })).toBeInTheDocument();
  });

  it('a food created while logging appears in Meine Inhalte – and the other way round', async () => {
    await renderApp('/nutrition', { prepare: content });
    // Quick access in the add sheet: same form, same service.
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'Quark');
    await userEvent.click(dialog().getByRole('button', { name: 'Neues Lebensmittel anlegen' }));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '67');
    await userEvent.type(dialog().getByLabelText('Protein (g)'), '12');
    await userEvent.type(dialog().getByLabelText('Kohlenhydrate (g)'), '4');
    await userEvent.type(dialog().getByLabelText('Fett (g)'), '0,2');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await screen.findByLabelText('Menge');
    // Back steps to the search first, then closes the sheet.
    await userEvent.keyboard('{Escape}');
    await screen.findByLabelText('Lebensmittel suchen');
    await userEvent.keyboard('{Escape}');
    await closed();

    await userEvent.click(nav().getByRole('link', { name: 'Einstellungen' }));
    await userEvent.click(await main().findByRole('link', { name: /^Meine Inhalte/ }));
    await userEvent.click(await main().findByRole('link', { name: /^Lebensmittel/ }));
    expect(await main().findByRole('button', { name: /^Quark/ })).toBeInTheDocument();

    // Created centrally → offered while logging.
    await userEvent.click(main().getByRole('button', { name: 'Neues Lebensmittel' }));
    await userEvent.type(dialog().getByLabelText('Name'), 'Hüttenkäse');
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '98');
    await userEvent.type(dialog().getByLabelText('Protein (g)'), '12');
    await userEvent.type(dialog().getByLabelText('Kohlenhydrate (g)'), '3');
    await userEvent.type(dialog().getByLabelText('Fett (g)'), '4');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    await userEvent.click(nav().getByRole('link', { name: 'Ernährung' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    expect(await dialog().findByRole('button', { name: /^Hüttenkäse/ })).toBeInTheDocument();
  });

  it('deleting a plan returns to the plan list; finished workouts keep the plan name', async () => {
    const { router, db } = await renderApp('/settings/content/plans', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        const plan = await services.training.plans.createPlan(profileId, 'Ganzkörper');
        const day = await services.training.plans.addDay(profileId, plan.id, 'Tag A');
        await services.training.plans.addExercise(profileId, day, 'sys.back-squat');
        const workout = await services.training.workouts.startFromPlan(profileId, day);
        await services.training.workouts.finish(profileId, workout.id);
      },
    });
    const before = await db.query('SELECT id, plan_name, plan_day_name FROM workouts');
    await userEvent.click(await main().findByRole('link', { name: /^Ganzkörper/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ganzkörper' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Starten' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Plan löschen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings/content/plans');
    });
    expect(main().queryByRole('link', { name: /^Ganzkörper/ })).not.toBeInTheDocument();
    // History stays: same workout, same snapshot names; only the plan reference is cleared.
    expect(await db.query('SELECT id, plan_name, plan_day_name FROM workouts')).toEqual(before);
    expect(await db.query('SELECT plan_id FROM workouts')).toEqual([{ plan_id: null }]);
  });
});

describe('Einstellungen → Profil', () => {
  it('saves name, sex, birth date and height through the profile – and nothing else', async () => {
    const { services } = await renderApp('/settings/profile');
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    await userEvent.type(await screen.findByLabelText('Name'), 'Anna{Enter}');
    await userEvent.click(screen.getByRole('radio', { name: 'Weiblich' }));
    await userEvent.type(screen.getByLabelText('Geburtsdatum'), '1992-03-14');
    await userEvent.type(screen.getByLabelText('Körpergröße (cm)'), '168');
    await userEvent.click(screen.getByRole('button', { name: 'Persönliche Daten speichern' }));
    expect(await screen.findByText(/Gespeichert/)).toBeInTheDocument();
    const profile = await services.profile.ensureLocalProfile();
    expect(profile).toMatchObject({
      displayName: 'Anna',
      sex: 'female',
      birthDate: '1992-03-14',
      heightCm: 168,
    });
    // Saving the profile creates no goal.
    expect(await services.nutrition.goals.list(profile.id)).toEqual([]);
  });

  it('rejects an implausible height and keeps the stored data', async () => {
    const { services } = await renderApp('/settings/profile');
    await userEvent.type(await screen.findByLabelText('Körpergröße (cm)'), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Persönliche Daten speichern' }));
    expect(await screen.findByText(/Körpergröße/, { selector: 'p' })).toBeInTheDocument();
    expect((await services.profile.ensureLocalProfile()).heightCm).toBeNull();
  });

  it('shows the weight read-only and leads to Gesundheit to record it', async () => {
    const { router } = await renderApp('/settings/profile', {
      prepare: async (s, profileId) => {
        await s.weight.save(profileId, '2026-10-02', 84.6);
      },
    });
    const weight = section('Gewicht');
    expect(await weight.findByText(/84,6 kg/)).toBeInTheDocument();
    expect(weight.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Gewicht in kg/)).not.toBeInTheDocument();
    await userEvent.click(weight.getByRole('link', { name: 'Gewicht unter Gesundheit erfassen' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/health');
    });
  });

  it('a change of the body data updates the automatic nutrition goals', async () => {
    const { services } = await renderApp('/settings/profile', { prepare: person });
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const before = await services.nutrition.goals.goalFor(profileId, '2026-10-03');
    expect(before?.effective.energyKcal).toEqual({ value: 2040, origin: 'auto' });
    const height = await screen.findByLabelText('Körpergröße (cm)');
    await userEvent.clear(height);
    await userEvent.type(height, '190');
    // The test clock stands still; on a phone time always moves on between two saves.
    vi.setSystemTime(new Date(2026, 9, 3, 10, 5));
    await userEvent.click(screen.getByRole('button', { name: 'Persönliche Daten speichern' }));
    // RMR +62.5 kcal → ×1.4 = +87.5 → rounded to 10: 2130 kcal (via NutritionGoalSync).
    await waitFor(async () => {
      expect(
        (await services.nutrition.goals.goalFor(profileId, '2026-10-03'))?.effective.energyKcal,
      ).toEqual({ value: 2130, origin: 'auto' });
    });
  });
});

describe('Einstellungen → Ziele', () => {
  it('groups main goal, nutrition, training, activities and health', async () => {
    await renderApp('/settings/goals');
    await screen.findByRole('radio', { name: 'Abnehmen' });
    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
        .filter((text) =>
          [
            'Hauptziel',
            'Ernährung',
            'Aktivitätskalorien',
            'Training',
            'Aktivitäten',
            'Gesundheit',
          ].includes(text),
        ),
    ).toEqual([
      'Hauptziel',
      'Ernährung',
      'Aktivitätskalorien',
      'Training',
      'Aktivitäten',
      'Gesundheit',
    ]);
    expect(document.activeElement?.tagName).not.toBe('INPUT');
  });

  it('reads the personal data from the profile and links there', async () => {
    const { router } = await renderApp('/settings/goals');
    const basis = within(await screen.findByRole('list', { name: 'Grundlage der Berechnung' }));
    expect(basis.getByText('Noch unvollständig – im Profil ergänzen')).toBeInTheDocument();
    expect(screen.queryByLabelText('Geburtsdatum')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Körpergröße (cm)')).not.toBeInTheDocument();
    await userEvent.click(basis.getByRole('link', { name: /Persönliche Daten/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings/profile');
    });
  });

  it('saves main goal, activity, training, own calories, protein, carbs, fat and water', async () => {
    const { services, db } = await renderApp('/settings/goals', { prepare: person });
    await userEvent.click(await screen.findByRole('radio', { name: 'Muskelaufbau' }));
    await userEvent.click(screen.getByRole('radio', { name: /^Sehr aktiv/ }));
    await userEvent.click(screen.getByRole('switch', { name: /Training in Kalorienberechnung/ }));
    for (const [row, value] of [
      [/^Kalorienziel/, '2600'],
      [/^Protein/, '180'],
      [/^Kohlenhydrate/, '300'],
      [/^Fett/, '80'],
    ] as const) {
      await userEvent.click(await screen.findByRole('button', { name: row }));
      const field = dialog().getByLabelText(/^Eigener Wert/);
      await userEvent.clear(field);
      await userEvent.type(field, value);
      await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
      await closed();
    }
    await userEvent.type(screen.getByLabelText('Wasserziel (ml, optional)'), '2500');
    await userEvent.click(
      screen.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }),
    );
    // A different main goal asks first (existing confirmation).
    await userEvent.click(await dialog().findByRole('button', { name: /Ziel ändern/ }));
    expect(await screen.findByText(/Ernährungsprofil gespeichert/)).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const goal = (await services.nutrition.goals.goalFor(profileId, '2026-10-03'))?.goal;
    expect(goal).toMatchObject({
      goalType: 'gain',
      activityLevel: 'active',
      includeTraining: true,
    });
    expect(goal?.targets).toMatchObject({
      energyKcal: { manual: 2600 },
      proteinG: { manual: 180 },
      carbsG: { manual: 300 },
      fatG: { manual: 80 },
      waterMl: { manual: 2500 },
    });
    // Versioned like before: the earlier version keeps its values.
    expect(
      await db.query(
        'SELECT effective_from, goal_type FROM nutrition_goals ORDER BY effective_from',
      ),
    ).toEqual([{ effective_from: '2026-10-03', goal_type: 'gain' }]);
  });

  it('counts activity calories – the one place for this setting', async () => {
    const { services } = await renderApp('/settings/goals');
    const toggle = await screen.findByRole('switch', { name: 'Aktivitätskalorien anrechnen' });
    await userEvent.click(toggle);
    await waitFor(async () => {
      expect((await services.settings.load()).countActivityCalories).toBe(true);
    });
  });

  it('sets the daily step goal from a list, stored as a version', async () => {
    const { services } = await renderApp('/settings/goals');
    const health = section('Gesundheit');
    await userEvent.click(await health.findByRole('button', { name: /Schrittziel pro Tag/ }));
    expect(dialog().getByText(/nur aus Health Connect/)).toBeInTheDocument();
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    await userEvent.click(dialog().getByRole('button', { name: '8.000 Schritte' }));
    await closed();
    expect(await health.findByText('8.000 Schritte')).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    expect((await services.targets.history(profileId)).stepsPerDay).toMatchObject([
      { effectiveFrom: '2026-10-03', value: 8000 },
    ]);
  });
});

describe('one place to configure', () => {
  it('Ernährung, App, Profil and Fortschritt have no second goal setting', async () => {
    await renderApp('/nutrition');
    await screen.findByRole('region', { name: 'Tagesübersicht' });
    expect(screen.queryByRole('switch', { name: 'Aktivitätskalorien anrechnen' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Abnehmen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Kalorienziel/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ernährungsprofil' })).toBeNull();

    await userEvent.click(nav().getByRole('link', { name: 'Einstellungen' }));
    await userEvent.click(await main().findByRole('link', { name: /^App/ }));
    await screen.findByRole('heading', { level: 1, name: 'App' });
    expect(screen.queryByRole('switch', { name: 'Aktivitätskalorien anrechnen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /pro Woche/ })).toBeNull();
    expect(screen.queryByLabelText('Körpergröße (cm)')).toBeNull();

    await userEvent.click(main().getByRole('link', { name: /Einstellungen/ }));
    await userEvent.click(await main().findByRole('link', { name: /^Profil/ }));
    await screen.findByRole('heading', { level: 1, name: 'Profil' });
    expect(screen.queryByRole('radio', { name: 'Abnehmen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /pro Woche/ })).toBeNull();
  });
});

describe('Gesundheit: steps against the step goal', () => {
  function stepsPlatform(values: [day: number, steps: number][]) {
    const platform = new FakeHealthPlatform();
    platform.steps = values.map(([day, value]) => ({
      dayStart: localIso(2026, day > 3 ? 9 : 10, day, 0, 0),
      value,
    }));
    return platform;
  }

  it('shows today’s steps from Health Connect against the goal of the day', async () => {
    await renderApp('/health', {
      healthPlatform: stepsPlatform([
        [1, 9000],
        [2, 4000],
        [3, 6200],
      ]),
      prepare: async (s, profileId) => {
        vi.setSystemTime(new Date(2026, 8, 1, 9));
        await s.targets.set(profileId, 'stepsPerDay', 8000);
        vi.setSystemTime(NOW);
        await s.healthSync.connect(profileId);
      },
    });
    const row = await screen.findByText('Schrittziel heute');
    const item = within(row.closest('li') ?? document.body);
    expect(item.getByText('6.200 von 8.000')).toBeInTheDocument();
    expect(item.getByText('Ziel an 1 von 3 Tagen mit Daten erreicht (7 Tage)')).toBeInTheDocument();
  });

  it('stays neutral without step data and offers to set a goal without one', async () => {
    await renderApp('/health', {
      healthPlatform: stepsPlatform([]),
      prepare: async (s, profileId) => {
        await s.healthSync.connect(profileId);
      },
    });
    expect(await screen.findByRole('link', { name: 'Schrittziel festlegen' })).toHaveAttribute(
      'href',
      '/settings/goals',
    );
  });

  it('without steps today the goal is shown, nothing is counted as missed', async () => {
    await renderApp('/health', {
      healthPlatform: stepsPlatform([]),
      prepare: async (s, profileId) => {
        await s.targets.set(profileId, 'stepsPerDay', 8000);
        await s.healthSync.connect(profileId);
      },
    });
    const row = await screen.findByText('Schrittziel heute');
    const item = within(row.closest('li') ?? document.body);
    expect(item.getByText('Ziel 8.000 · noch keine Schritte')).toBeInTheDocument();
    expect(item.queryByText(/Ziel an/)).not.toBeInTheDocument();
  });
});
