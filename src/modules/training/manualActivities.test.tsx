import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { ManualActivityInput } from '@/core/activity';
import type { HealthWorkout } from '@/core/platform/health';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 3, 10, 0);

function hcSession(
  id: string,
  [day, hour, minute]: [number, number, number],
  minutes: number,
  extra: Partial<HealthWorkout> = {},
): HealthWorkout {
  const start = localIso(2026, 10, day, hour, minute);
  return {
    id,
    type: 'running',
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: 386,
    distanceM: 5800,
    source: 'Pixel Watch',
    ...extra,
  };
}

function platformWith(workouts: HealthWorkout[]) {
  const platform = new FakeHealthPlatform();
  platform.workouts = workouts;
  return platform;
}

function input(patch: Partial<ManualActivityInput> = {}): ManualActivityInput {
  return {
    sportId: 'jog',
    localDate: '2026-10-03',
    startTime: null,
    durationMin: 72,
    distanceKm: null,
    intensity: null,
    variant: null,
    kcalOverride: null,
    ...patch,
  };
}

async function withGoal(services: AppServices, profileId: string, proteinG = 160) {
  await services.nutrition.goals.save(profileId, {
    effectiveFrom: '2026-09-01',
    goalType: 'maintain',
    targets: {
      energyKcal: { auto: null, manual: 2300 },
      proteinG: { auto: null, manual: proteinG },
    },
  });
}

/** One logged meal today, so the progress page has a day to compare with its goal. */
async function logToday(services: AppServices, profileId: string) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [meal] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    name: 'Porridge',
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
    mealId: meal?.id ?? '',
    foodId: food.id,
    amount: 100,
    unit: 'g',
  });
}

/** No text field may have focus when a sheet opens – the keyboard stays closed. */
function expectNoFocusedField() {
  const active = document.activeElement;
  expect(active?.tagName).not.toBe('INPUT');
  expect(active?.tagName).not.toBe('TEXTAREA');
}

let currentProfile = '';
const profileId = () => currentProfile;

const activityList = () => screen.findByRole('list', { name: 'Aktivitäten' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Aktivität erfassen', () => {
  it('logs a run: sport, duration and distance, calculated calories, own value, saved', async () => {
    const { services } = await renderApp('/training/activities', {
      healthPlatform: platformWith([]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.weight.save(id, '2026-10-01', 84.6);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Aktivität erfassen' }));

    // Step 1: the sport – grouped, searchable, no keyboard on open.
    const picker = within(await screen.findByRole('dialog', { name: 'Sportart wählen' }));
    expectNoFocusedField();
    expect(picker.getByRole('list', { name: 'Rückschlagspiele' })).toBeInTheDocument();
    await userEvent.type(picker.getByLabelText('Sportart suchen'), 'jogg');
    await userEvent.click(picker.getByRole('button', { name: 'Joggen' }));

    // Step 2: only the fields jogging needs.
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität erfassen' }));
    expectNoFocusedField();
    expect(sheet.getByText('Joggen')).toBeInTheDocument();
    expect(sheet.getByLabelText('Datum')).toHaveValue('2026-10-03');
    expect(sheet.getByLabelText('Startzeit (optional)')).toHaveValue('');
    expect(sheet.queryByText('Spielform')).not.toBeInTheDocument();
    await userEvent.type(sheet.getByLabelText('Dauer (Minuten)'), '48');
    await userEvent.type(sheet.getByLabelText('Distanz in km (optional)'), '7,2');

    // 9,0 km/h → 9.8 MET: (9.8 − 1) × 3.5 × 84.6 ÷ 200 × 48 = 625 kcal.
    const estimate = within(sheet.getByRole('region', { name: 'Geschätzter Energieverbrauch' }));
    expect(await estimate.findByText('625 kcal')).toBeInTheDocument();
    expect(estimate.getByText(/Körpergewicht \(84,6 kg\)/)).toBeInTheDocument();
    expect(estimate.getByText(/9 km\/h/)).toBeInTheDocument();

    await userEvent.click(estimate.getByRole('button', { name: 'Kalorien anpassen' }));
    const own = estimate.getByLabelText('Eigener Wert in kcal');
    expect(own).toHaveValue('625');
    await userEvent.clear(own);
    await userEvent.type(own, '650');
    expect(estimate.getByText('Manuell angepasst · automatisch 625 kcal')).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const rows = within(await activityList()).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Joggen');
    expect(rows[0]).toHaveTextContent('Heute');
    expect(rows[0]).toHaveTextContent('48 min · 7,2 km · 650 kcal');
    expect(rows[0]).toHaveTextContent('Manuell erfasst');

    const [stored] = await services.activities.recent(profileId());
    expect(stored).toMatchObject({
      sportId: 'jog',
      localDate: '2026-10-03',
      startedAt: null,
      durationS: 2880,
      distanceM: 7200,
      weightKg: 84.6,
      met: 9.8,
      calculatedKcal: 625,
      kcal: 650,
      kcalOverridden: true,
    });
  });

  it('shows the fields of the chosen sport: tennis asks for singles or doubles, no distance', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.weight.save(id, '2026-10-01', 80);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Aktivität erfassen' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Sportart wählen' }));
    await userEvent.click(picker.getByRole('button', { name: /^Tennis$/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität erfassen' }));
    expect(sheet.queryByLabelText('Distanz in km (optional)')).not.toBeInTheDocument();
    expect(sheet.getByRole('radio', { name: 'Einzel' })).toBeChecked();
    await userEvent.type(sheet.getByLabelText('Dauer (Minuten)'), '60');
    const estimate = within(sheet.getByRole('region', { name: 'Geschätzter Energieverbrauch' }));
    // (8 − 1) × 3.5 × 80 ÷ 200 × 60 = 588; doubles (6 − 1) … = 420.
    expect(await estimate.findByText('588 kcal')).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('radio', { name: 'Doppel' }));
    expect(estimate.getByText('420 kcal')).toBeInTheDocument();
  });

  it('marks a general estimate and asks for the weight when none is known', async () => {
    await renderApp('/training/activities', { healthPlatform: platformWith([]) });
    await userEvent.click(await screen.findByRole('button', { name: 'Aktivität erfassen' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Sportart wählen' }));
    await userEvent.type(picker.getByLabelText('Sportart suchen'), 'padel');
    await userEvent.click(picker.getByRole('button', { name: 'Padel' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität erfassen' }));
    await userEvent.type(sheet.getByLabelText('Dauer (Minuten)'), '60');
    expect(await sheet.findByText(/fehlt dein Körpergewicht/)).toBeInTheDocument();
    expect(sheet.getByText(/Allgemeiner Schätzwert/)).toBeInTheDocument();
  });

  it('does not save invalid values and says why', async () => {
    const { services } = await renderApp('/training/activities', {
      healthPlatform: platformWith([]),
      prepare: (_s, id) => {
        currentProfile = id;
        return Promise.resolve();
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Aktivität erfassen' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Sportart wählen' }));
    await userEvent.click(picker.getByRole('button', { name: 'Yoga' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität erfassen' }));
    await userEvent.type(sheet.getByLabelText('Dauer (Minuten)'), '0');
    await userEvent.click(sheet.getByRole('button', { name: 'Speichern' }));
    expect(
      await sheet.findByText('Bitte eine Dauer zwischen 1 und 1440 Minuten angeben.'),
    ).toBeInTheDocument();
    expect(sheet.getByLabelText('Dauer (Minuten)')).toHaveAttribute('aria-invalid', 'true');
    expect(await services.activities.recent(profileId())).toEqual([]);
  });

  it('edits an activity: the calories follow the new duration, an own value replaces them', async () => {
    const { services } = await renderApp('/training/activities', {
      healthPlatform: platformWith([]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.weight.save(id, '2026-10-01', 80);
        await s.activities.create(
          id,
          input({ sportId: 'tennis', durationMin: 90, variant: 'singles', startTime: '08:00' }),
        );
      },
    });
    const list = await activityList();
    expect(within(list).getByRole('listitem')).toHaveTextContent('Heute · 08:00');
    expect(within(list).getByRole('listitem')).toHaveTextContent('1 h 30 min · 882 kcal');
    await userEvent.click(within(list).getByRole('button', { name: /Tennis/ }));

    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität bearbeiten' }));
    expectNoFocusedField();
    expect(sheet.getByLabelText('Startzeit (optional)')).toHaveValue('08:00');
    const duration = sheet.getByLabelText('Dauer (Minuten)');
    expect(duration).toHaveValue('90');
    await userEvent.clear(duration);
    await userEvent.type(duration, '60');
    const estimate = within(sheet.getByRole('region', { name: 'Geschätzter Energieverbrauch' }));
    expect(await estimate.findByText('588 kcal')).toBeInTheDocument();
    await userEvent.click(estimate.getByRole('button', { name: 'Kalorien anpassen' }));
    const own = estimate.getByLabelText('Eigener Wert in kcal');
    await userEvent.clear(own);
    await userEvent.type(own, '600');
    await userEvent.click(sheet.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(within(await activityList()).getByRole('listitem')).toHaveTextContent(
      '1 h 00 min · 600 kcal',
    );
    const [stored] = await services.activities.recent(profileId());
    expect(stored).toMatchObject({ calculatedKcal: 588, kcal: 600, kcalOverridden: true });

    // Back to the calculated value.
    await userEvent.click(within(await activityList()).getByRole('button', { name: /Tennis/ }));
    const again = within(await screen.findByRole('dialog', { name: 'Aktivität bearbeiten' }));
    expect(again.getByText('Manuell angepasst · automatisch 588 kcal')).toBeInTheDocument();
    await userEvent.click(again.getByRole('button', { name: 'Automatischen Wert verwenden' }));
    await userEvent.click(again.getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      expect((await services.activities.recent(profileId()))[0]).toMatchObject({
        kcal: 588,
        kcalOverridden: false,
      });
    });
  });

  it('deletes an activity only after confirmation', async () => {
    const { services } = await renderApp('/training/activities', {
      healthPlatform: platformWith([]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.activities.create(id, input({ sportId: 'yoga', durationMin: 45 }));
      },
    });
    await userEvent.click(within(await activityList()).getByRole('button', { name: /Yoga/ }));
    let sheet = within(await screen.findByRole('dialog', { name: 'Aktivität bearbeiten' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Aktivität löschen' }));
    let confirm = within(await screen.findByRole('dialog', { name: 'Aktivität löschen?' }));
    expect(confirm.getByText(/„Yoga“ vom/)).toBeInTheDocument();
    await userEvent.click(confirm.getByRole('button', { name: 'Abbrechen' }));
    sheet = within(await screen.findByRole('dialog', { name: 'Aktivität bearbeiten' }));
    expect(await services.activities.recent(profileId())).toHaveLength(1);

    await userEvent.click(sheet.getByRole('button', { name: 'Aktivität löschen' }));
    confirm = within(await screen.findByRole('dialog', { name: 'Aktivität löschen?' }));
    await userEvent.click(confirm.getByRole('button', { name: 'Löschen' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Noch keine Aktivitäten')).toBeInTheDocument();
    expect(await services.activities.recent(profileId())).toEqual([]);
  });
});

describe('Aktivitäten: beide Quellen', () => {
  it('lists Health Connect and manual activities together, newest first, with their source', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([hcSession('a', [2, 18, 20], 42)]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.healthSync.connect(id);
        await s.activities.create(
          id,
          input({ sportId: 'yoga', durationMin: 30, startTime: '07:00', kcalOverride: 90 }),
        );
      },
    });
    const list = await activityList();
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Yoga');
    expect(rows[0]).toHaveTextContent('Heute · 07:00');
    expect(rows[0]).toHaveTextContent('Manuell erfasst');
    expect(rows[1]).toHaveTextContent('Laufen');
    expect(rows[1]).toHaveTextContent('Health Connect · Pixel Watch');
  });

  it('keeps Health Connect activities read-only', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([hcSession('a', [2, 18, 20], 42)]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.healthSync.connect(id);
      },
    });
    await userEvent.click(within(await activityList()).getByRole('button', { name: /Laufen/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität' }));
    expect(sheet.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Aktivität löschen' })).not.toBeInTheDocument();
    expect(sheet.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('notes a manual activity that is most likely the same session as an import', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([hcSession('a', [3, 7, 0], 45, { activeKcal: 500 })]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.healthSync.connect(id);
        await s.activities.create(
          id,
          input({ durationMin: 45, startTime: '07:05', kcalOverride: 480 }),
        );
      },
    });
    await userEvent.click(within(await activityList()).getByRole('button', { name: /Joggen/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität bearbeiten' }));
    expect(sheet.getByText(/nicht doppelt gezählt/)).toBeInTheDocument();
  });
});

describe('Aktivitätskalorien mit manuellen Aktivitäten', () => {
  const overview = async () =>
    within(await screen.findByRole('region', { name: 'Tagesübersicht' }));

  it('off: 2.300 kcal stay 2.300 kcal, the manual 500 kcal are information only', async () => {
    await renderApp('/nutrition', {
      prepare: async (s, id) => {
        currentProfile = id;
        await withGoal(s, id);
        await s.activities.create(id, input({ kcalOverride: 500 }));
      },
    });
    const day = await overview();
    expect(await day.findByText('500 kcal')).toBeInTheDocument();
    expect(day.getByText('Nicht auf das Tagesziel angerechnet')).toBeInTheDocument();
    expect(day.getAllByText('2.300 kcal')).toHaveLength(2);
    expect(day.queryByText('Basisziel')).not.toBeInTheDocument();
  });

  it('on: 2.300 kcal + 500 kcal = 2.800 kcal', async () => {
    await renderApp('/nutrition', {
      prepare: async (s, id) => {
        currentProfile = id;
        await withGoal(s, id);
        await s.targets.set(id, 'activityCalories', 1);
        await s.activities.create(id, input({ kcalOverride: 500 }));
      },
    });
    const day = await overview();
    expect(await day.findByText('Basisziel')).toBeInTheDocument();
    expect(day.getByText('2.300 kcal')).toBeInTheDocument();
    expect(day.getByText('+500 kcal')).toBeInTheDocument();
    expect(day.getAllByText('2.800 kcal')).toHaveLength(2);
  });

  it('on: an own value of 700 kcal counts +700 kcal, not the calculated 650 kcal', async () => {
    let calculated: number | null = null;
    await renderApp('/nutrition', {
      prepare: async (s, id) => {
        currentProfile = id;
        await withGoal(s, id);
        await s.targets.set(id, 'activityCalories', 1);
        await s.weight.save(id, '2026-10-01', 86);
        // Jogging 72 min at 86 kg → (7 − 1) × 3.5 × 86 ÷ 200 × 72 = 650 kcal.
        const created = await s.activities.create(id, input({ kcalOverride: 700 }));
        calculated = created.calculatedKcal;
      },
    });
    expect(calculated).toBe(650);
    const day = await overview();
    expect(await day.findByText('+700 kcal')).toBeInTheDocument();
    expect(day.queryByText('+650 kcal')).not.toBeInTheDocument();
    expect(day.getAllByText('3.000 kcal')).toHaveLength(2);
  });

  it('on: Health Connect and manual activities add up, a duplicate counts once', async () => {
    await renderApp('/nutrition', {
      healthPlatform: platformWith([hcSession('a', [3, 7, 0], 45, { activeKcal: 500 })]),
      prepare: async (s, id) => {
        currentProfile = id;
        await withGoal(s, id);
        await s.targets.set(id, 'activityCalories', 1);
        await s.healthSync.connect(id);
        // Same run logged by hand → Health Connect wins.
        await s.activities.create(
          id,
          input({ durationMin: 45, startTime: '07:00', kcalOverride: 480 }),
        );
        // A separate yoga session without a time → counts.
        await s.activities.create(
          id,
          input({ sportId: 'yoga', durationMin: 30, kcalOverride: 100 }),
        );
      },
    });
    const day = await overview();
    expect(await day.findByText('+600 kcal')).toBeInTheDocument();
    expect(day.getAllByText('2.900 kcal')).toHaveLength(2);
  });

  it('never changes the protein target (custom 220 g stays 220 g)', async () => {
    await renderApp('/', {
      prepare: async (s, id) => {
        currentProfile = id;
        await withGoal(s, id, 220);
        await logToday(s, id);
        await s.targets.set(id, 'activityCalories', 1);
        await s.activities.create(id, input({ kcalOverride: 500 }));
      },
    });
    expect(await screen.findByText('Tagesziel Ø 2.800 kcal · 220 g Protein')).toBeInTheDocument();
  });

  it('progress: off, the daily goal stays the base goal', async () => {
    await renderApp('/', {
      prepare: async (s, id) => {
        currentProfile = id;
        await withGoal(s, id);
        await logToday(s, id);
        await s.activities.create(id, input({ kcalOverride: 500 }));
      },
    });
    expect(await screen.findByText('Tagesziel Ø 2.300 kcal · 160 g Protein')).toBeInTheDocument();
  });
});

describe('Fortschritt: Aktivitäten', () => {
  const main = () => within(screen.getByRole('main'));
  const findCard = async () => within(await main().findByRole('link', { name: /^Aktivitäten/ }));

  it('shows manual activities without Health Connect', async () => {
    await renderApp('/', {
      prepare: async (s, id) => {
        currentProfile = id;
        await s.activities.create(
          id,
          input({ sportId: 'yoga', durationMin: 45, kcalOverride: 120 }),
        );
      },
    });
    const card = await findCard();
    expect(await card.findByText('1 Aktivität')).toBeInTheDocument();
    expect(card.getByText('45 min')).toBeInTheDocument();
    expect(card.getByText('120 aktive kcal')).toBeInTheDocument();
  });

  it('shows Health Connect activities alone', async () => {
    await renderApp('/', {
      healthPlatform: platformWith([hcSession('a', [3, 7, 0], 42)]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.healthSync.connect(id);
      },
    });
    const card = await findCard();
    expect(await card.findByText('1 Aktivität')).toBeInTheDocument();
    expect(card.getByText('386 aktive kcal')).toBeInTheDocument();
  });

  it('adds both sources and counts a duplicate once', async () => {
    await renderApp('/', {
      healthPlatform: platformWith([hcSession('a', [3, 7, 0], 42)]),
      prepare: async (s, id) => {
        currentProfile = id;
        await s.healthSync.connect(id);
        await s.activities.create(
          id,
          input({ durationMin: 42, startTime: '07:00', kcalOverride: 400 }),
        );
        await s.activities.create(
          id,
          input({ sportId: 'yoga', localDate: '2026-10-02', durationMin: 30, kcalOverride: 100 }),
        );
      },
    });
    const card = await findCard();
    expect(await card.findByText('2 Aktivitäten')).toBeInTheDocument();
    expect(card.getByText('1 h 12 min')).toBeInTheDocument();
    expect(card.getByText('486 aktive kcal')).toBeInTheDocument();
  });

  it('switches between week and month', async () => {
    await renderApp('/', {
      prepare: async (s, id) => {
        currentProfile = id;
        await s.activities.create(
          id,
          input({ sportId: 'yoga', durationMin: 30, kcalOverride: 100 }),
        );
        await s.activities.create(
          id,
          input({ sportId: 'yoga', localDate: '2026-09-15', durationMin: 60, kcalOverride: 200 }),
        );
      },
    });
    const card = await findCard();
    expect(await card.findByText('1 Aktivität')).toBeInTheDocument();
    await userEvent.click(main().getByRole('radio', { name: '30 Tage' }));
    expect(await (await findCard()).findByText('2 Aktivitäten')).toBeInTheDocument();
    expect((await findCard()).getByText('300 aktive kcal')).toBeInTheDocument();
  });

  it('stays hidden without Health Connect and without any activity', async () => {
    await renderApp('/');
    await within(await main().findByRole('link', { name: /^Gewicht/ })).findByText(
      'Noch keine Gewichtsdaten.',
    );
    expect(main().queryByRole('link', { name: /^Aktivitäten/ })).not.toBeInTheDocument();
  });
});
