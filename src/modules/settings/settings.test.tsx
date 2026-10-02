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

  it('Meine Inhalte is prepared and still leads to the content in its area', async () => {
    await renderApp('/settings/content');
    expect(await screen.findByText(/ziehen bald hierher/)).toBeInTheDocument();
    expect(main().getByRole('link', { name: /Lebensmittel/ })).toHaveAttribute(
      'href',
      '/nutrition/foods',
    );
    expect(main().getByRole('link', { name: /Pläne/ })).toHaveAttribute('href', '/training/plans');
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
