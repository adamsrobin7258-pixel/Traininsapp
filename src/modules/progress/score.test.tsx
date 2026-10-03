import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 3, 10);
const WEEK = [
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
];
const PREVIOUS_WEEK = [
  '2026-09-20',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
];

const main = () => within(screen.getByRole('main'));
const scoreButton = () => main().findByRole('button', { name: /Kalethra-Score/ });
const scoreCard = async () => within(await scoreButton());
/** The total, as the card announces it (the area values may show the same number). */
async function expectScore(value: number) {
  const button = await scoreButton();
  await waitFor(() => {
    expect(button).toHaveAccessibleName(new RegExp(`^Kalethra-Score ${value} von 100,`));
  });
}

async function goal(
  s: AppServices,
  profileId: string,
  goalType: 'lose' | 'maintain' | 'gain' | 'fitness' = 'maintain',
) {
  // A goal applies from the day it is saved: saved on 1 August.
  vi.setSystemTime(new Date(2026, 7, 1, 9));
  await s.nutrition.goals.save(profileId, {
    goalType,
    targets: {
      energyKcal: { auto: null, manual: 2300 },
      proteinG: { auto: null, manual: 160 },
    },
  });
  vi.setSystemTime(NOW);
}

async function eat(
  s: AppServices,
  profileId: string,
  localDate: string,
  kcal: number,
  protein = 160,
) {
  const n = s.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [meal] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    name: `Essen ${localDate} ${kcal}`,
    reference: { amount: 100, unit: 'g' },
    nutrients: {
      energyKcal: kcal,
      proteinG: protein,
      carbsG: 0,
      fatG: 0,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    },
  });
  await n.diary.addFood(profileId, {
    localDate,
    mealId: meal?.id ?? '',
    foodId: food.id,
    amount: 100,
    unit: 'g',
  });
}

/** Sets a weekly target as if it had been chosen on 1 September (targets apply from that day). */
async function targetSince(
  s: AppServices,
  profileId: string,
  kind: 'trainingsPerWeek' | 'activeMinutesPerWeek',
  value: number,
) {
  vi.setSystemTime(new Date(2026, 8, 1, 9));
  await s.targets.set(profileId, kind, value);
  vi.setSystemTime(NOW);
}

async function workout(s: AppServices, profileId: string, start: Date) {
  vi.setSystemTime(start);
  const own = await s.training.workouts.startFree(profileId);
  vi.setSystemTime(new Date(start.getTime() + 60 * 60_000));
  await s.training.workouts.finish(profileId, own.id);
  vi.setSystemTime(NOW);
}

function hc(id: string, type: string, day: number, hour: number, minutes: number): HealthWorkout {
  const start = localIso(2026, 10, day, hour, 0);
  return {
    id,
    type,
    start,
    end: new Date(Date.parse(start) + minutes * 60_000).toISOString(),
    activeKcal: 300,
    distanceM: null,
    source: 'Pixel Watch',
  };
}

/** A complete, well-documented week: nutrition on target, workouts and recovery as given. */
async function goodWeek(s: AppServices, profileId: string) {
  await goal(s, profileId);
  for (const date of WEEK.slice(0, 5)) await eat(s, profileId, date, 2300);
  for (const date of WEEK.slice(0, 4)) {
    await s.recovery.save(profileId, date, { state: 'good', restDay: false });
  }
}

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

describe('Kalethra-Score on Fortschritt', () => {
  it('sits at the very top, above the four progress cards', async () => {
    await renderApp('/', { prepare: goodWeek });
    const button = await scoreButton();
    const list = main().getByRole('list', { name: 'Fortschritt' });
    expect(button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Period switch first, then the score.
    const radio = main().getByRole('radio', { name: '7 Tage' });
    expect(radio.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the big number, its wording and the four areas', async () => {
    await renderApp('/', { prepare: goodWeek });
    await expectScore(100);
    const card = await scoreCard();
    // Nutrition 100, recovery 100; training and activity without target → not rated.
    expect(card.getByText('von 100')).toBeInTheDocument();
    expect(card.getByText('Sehr gut unterwegs')).toBeInTheDocument();
    expect(card.queryByText('Vorläufig')).not.toBeInTheDocument();
    for (const area of ['Ernährung', 'Training', 'Aktivitäten', 'Regeneration']) {
      expect(card.getByText(area)).toBeInTheDocument();
    }
  });

  it('is announced with its number, wording, trend and every area – not by colour', async () => {
    await renderApp('/', { prepare: goodWeek });
    const button = await scoreButton();
    await waitFor(() => {
      expect(button).toHaveAccessibleName(/^Kalethra-Score 100 von 100, Sehr gut unterwegs\./);
    });
    expect(button).toHaveAccessibleName(/Noch keine ausreichenden Vergleichsdaten\./);
    expect(button).toHaveAccessibleName(/Ernährung: 100\. Training: Ohne Bewertung\./);
    expect(button).toHaveAccessibleName(/Regeneration: 100\. Details zum Kalethra-Score$/);
  });

  it('is shown but marked "Vorläufig" when few data exist – never a 0 for missing days', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await goal(s, profileId);
        await eat(s, profileId, '2026-10-01', 2300);
      },
    });
    await expectScore(100);
    const card = await scoreCard();
    expect(card.getByText('Vorläufig')).toBeInTheDocument();
    expect(
      card.getByText('Noch nicht alle Daten für diesen Zeitraum sind vorhanden.'),
    ).toBeVisible();
    expect(await scoreButton()).toHaveAccessibleName(/Vorläufig: Noch nicht alle Daten/);
  });

  it('says so when there are no data at all', async () => {
    await renderApp('/');
    const card = await scoreCard();
    expect(await card.findByText('Noch keine Daten für diesen Zeitraum.')).toBeInTheDocument();
    expect(card.getAllByText('–')).toHaveLength(5);
    expect(await scoreButton()).toHaveAccessibleName(/^Kalethra-Score: noch keine Daten\./);
  });

  it('follows the period: Heute, 7 Tage, 30 Tage', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await goal(s, profileId);
        await eat(s, profileId, '2026-10-03', 2990); // today: +30 % → kcal 50, protein 100 → 65
        await eat(s, profileId, '2026-09-30', 2300); // 100
        await eat(s, profileId, '2026-09-10', 2300); // 100 (only in 30 days)
        await eat(s, profileId, '2026-09-11', 2300);
      },
    });
    const radio = (name: string) => main().getByRole('radio', { name });
    await expectScore(83); // (65 + 100) / 2
    await userEvent.click(radio('Heute'));
    await expectScore(65);
    expect(main().getByText('03.10.')).toBeInTheDocument();
    await userEvent.click(radio('30 Tage'));
    await expectScore(91); // (65 + 3 × 100) / 4
  });

  it('shows the trend against the period before', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await goal(s, profileId);
        for (const date of PREVIOUS_WEEK.slice(0, 4)) await eat(s, profileId, date, 2990);
        for (const date of WEEK.slice(0, 4)) await eat(s, profileId, date, 2300);
      },
    });
    const card = await scoreCard();
    expect(
      await card.findByText('Verbessert gegenüber den 7 Tagen davor · +35 Punkte'),
    ).toBeInTheDocument();
  });

  it('trend: worse and about the same', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await goal(s, profileId);
        for (const date of PREVIOUS_WEEK.slice(0, 4)) await eat(s, profileId, date, 2300);
        for (const date of WEEK.slice(0, 4)) await eat(s, profileId, date, 2760); // +20 % → 79
      },
    });
    expect(
      await (
        await scoreCard()
      ).findByText(/^Verschlechtert gegenüber den 7 Tagen davor · [-−]21 Punkte$/),
    ).toBeInTheDocument();
  });

  it('trend: about the same within 3 points', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await goal(s, profileId);
        for (const date of PREVIOUS_WEEK.slice(0, 4)) await eat(s, profileId, date, 2300);
        for (const date of WEEK.slice(0, 4)) await eat(s, profileId, date, 2445); // +6.3 % → 98
      },
    });
    expect(
      await (
        await scoreCard()
      ).findByText(/^Ungefähr gleich gegenüber den 7 Tagen davor · [-−]2 Punkte$/),
    ).toBeInTheDocument();
  });

  it('weighs by the main goal: changing it changes the score', async () => {
    const prepare = (goalType: 'lose' | 'gain') => async (s: AppServices, profileId: string) => {
      await goal(s, profileId, goalType);
      await targetSince(s, profileId, 'trainingsPerWeek', 4);
      for (const date of WEEK.slice(0, 4)) await eat(s, profileId, date, 2300); // 100
      await workout(s, profileId, new Date(2026, 8, 28, 18));
      await workout(s, profileId, new Date(2026, 8, 30, 18)); // 2 of 4 → 50
    };
    const { unmount } = await renderApp('/', { prepare: prepare('lose') });
    // (100 × 0.45 + 50 × 0.25) / 0.7 = 82
    await expectScore(82);
    unmount();
    await renderApp('/', { prepare: prepare('gain') });
    // (100 × 0.3 + 50 × 0.45) / 0.75 = 70
    await expectScore(70);
  });

  it('counts only Kalethra workouts as training – Health Connect and manual activities are activities', async () => {
    await renderApp('/', {
      healthPlatform: (() => {
        const platform = new FakeHealthPlatform();
        platform.workouts = [hc('strength', 'strengthTraining', 1, 18, 60)];
        return platform;
      })(),
      prepare: async (s, profileId) => {
        await targetSince(s, profileId, 'trainingsPerWeek', 2);
        await targetSince(s, profileId, 'activeMinutesPerWeek', 120);
        await s.healthSync.connect(profileId);
        await s.activities.create(profileId, {
          sportId: 'tennis',
          localDate: '2026-10-02',
          startTime: '17:00',
          durationMin: 60,
          distanceKm: null,
          intensity: null,
          variant: 'singles',
          kcalOverride: 500,
        });
      },
    });
    await userEvent.click(await scoreButton());
    const sheet = within(await screen.findByRole('dialog', { name: 'Kalethra-Score' }));
    expect(
      sheet.getByText('0 von 2 geplanten Einheiten absolviert (Ziel: 2 pro Woche).'),
    ).toBeInTheDocument();
    expect(
      sheet.getByText('120 von 120 aktiven Minuten (Ziel: 120 pro Woche) · aktive Tage: 2.'),
    ).toBeInTheDocument();
  });
});

describe('score details', () => {
  it('opens on tap and explains goal, weighting and every area from the real data', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await goodWeek(s, profileId);
        await s.recovery.save(profileId, '2026-10-02', { state: null, restDay: true });
        await targetSince(s, profileId, 'trainingsPerWeek', 3);
        await workout(s, profileId, new Date(2026, 8, 28, 18));
        await workout(s, profileId, new Date(2026, 8, 30, 18));
        await workout(s, profileId, new Date(2026, 9, 1, 18));
      },
    });
    await userEvent.click(await scoreButton());
    const sheet = within(await screen.findByRole('dialog', { name: 'Kalethra-Score' }));
    // No text field gets focus: the keyboard stays closed.
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    expect(sheet.getByText('Letzte 7 Tage')).toBeInTheDocument();
    expect(sheet.getByText(/keine Gesundheit und nichts Medizinisches/)).toBeInTheDocument();
    expect(sheet.getByText('Hauptziel: Gewicht halten')).toBeInTheDocument();
    for (const weight of [
      'Ernährung 40 %',
      'Training 25 %',
      'Aktivitäten 25 %',
      'Regeneration 10 %',
    ]) {
      expect(sheet.getByText(weight)).toBeInTheDocument();
    }
    expect(sheet.getByText(/keine wissenschaftlich belegte Formel/)).toBeInTheDocument();
    expect(sheet.getByText(/Bisher: 6 von 7 Tagen\./)).toBeInTheDocument();
    expect(sheet.getByText('Du liegst im Schnitt nah an deinem Kalorienziel.')).toBeInTheDocument();
    expect(sheet.getByText('An 5 von 7 Tagen erfasst.')).toBeInTheDocument();
    expect(
      sheet.getByText('3 von 3 geplanten Einheiten absolviert (Ziel: 3 pro Woche).'),
    ).toBeInTheDocument();
    expect(sheet.getByText('Ruhetage: 1 – sie zählen nie negativ.')).toBeInTheDocument();
    expect(sheet.getByText(/Kein Aktivitätsziel festgelegt/)).toBeInTheDocument();
    expect(
      sheet.getByText('Deine dokumentierte Erholung war überwiegend gut.'),
    ).toBeInTheDocument();
    expect(sheet.getByText('Zählt nicht mit.')).toBeInTheDocument();
    for (const link of ['Regeneration eintragen', 'Ziele anpassen']) {
      expect(sheet.getByRole('link', { name: link })).toBeInTheDocument();
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('links to the place where recovery is entered', async () => {
    const { router } = await renderApp('/', { prepare: goodWeek });
    await userEvent.click(await scoreButton());
    const sheet = within(await screen.findByRole('dialog', { name: 'Kalethra-Score' }));
    await userEvent.click(sheet.getByRole('link', { name: 'Regeneration eintragen' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/health');
    });
    expect(await screen.findByText('Wie erholt fühlst du dich heute?')).toBeInTheDocument();
  });

  it('works in English', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    await renderApp('/', { prepare: goodWeek });
    const button = await main().findByRole('button', { name: /Kalethra score/ });
    expect(await within(button).findByText('Doing very well')).toBeInTheDocument();
    expect(within(button).getByText('Recovery')).toBeInTheDocument();
    await userEvent.click(button);
    const sheet = within(await screen.findByRole('dialog', { name: 'Kalethra score' }));
    expect(sheet.getByText('Main goal: Maintain weight')).toBeInTheDocument();
    expect(sheet.getByText('Your logged recovery was mostly good.')).toBeInTheDocument();
  });
});

describe('Regeneration eintragen (Gesundheit)', () => {
  it('saves how recovered one feels and a rest day, without opening the keyboard', async () => {
    const { services } = await renderApp('/health');
    const group = within(
      await screen.findByRole('group', { name: 'Wie erholt fühlst du dich heute?' }),
    );
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    const good = group.getByRole('button', { name: 'Gut erholt' });
    expect(good).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(good);
    await waitFor(() => {
      expect(good).toHaveAttribute('aria-pressed', 'true');
    });
    const rest = screen.getByRole('switch', { name: 'Ruhetag' });
    await userEvent.click(rest);
    await waitFor(() => {
      expect(rest).toHaveAttribute('aria-checked', 'true');
    });
    expect(await screen.findByText('Für heute gespeichert.')).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    await waitFor(async () => {
      expect(await services.recovery.get(profileId, '2026-10-03')).toMatchObject({
        state: 'good',
        restDay: true,
      });
    });
    // Tapping the chosen state again clears it; the rest day stays.
    await userEvent.click(good);
    await waitFor(async () => {
      expect(await services.recovery.get(profileId, '2026-10-03')).toMatchObject({
        state: null,
        restDay: true,
      });
    });
    expect(good).toHaveAttribute('aria-pressed', 'false');
  });

  it('feeds the score: poor recovery lowers the recovery area', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await s.recovery.save(profileId, '2026-10-03', { state: 'poor', restDay: true });
      },
    });
    await userEvent.click(main().getByRole('radio', { name: 'Heute' }));
    await expectScore(20);
    const card = await scoreCard();
    expect(card.getByText('Vorläufig')).toBeInTheDocument();
  });
});

describe('Score-Ziele (Einstellungen → Ziele)', () => {
  it('shows the main goal and sets weekly targets from a list – no keyboard', async () => {
    const { services } = await renderApp('/settings/goals', {
      prepare: async (s, profileId) => {
        await goal(s, profileId, 'lose');
      },
    });
    expect(await screen.findByRole('radio', { name: 'Abnehmen' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const training = within(
      screen.getByRole('heading', { level: 2, name: 'Training' }).closest('section') ??
        document.body,
    );
    expect(await training.findByText('Kein Ziel')).toBeInTheDocument();

    await userEvent.click(training.getByRole('button', { name: /Trainings pro Woche/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Trainings pro Woche' }));
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    expect(sheet.getByRole('button', { name: 'Kein Ziel' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(sheet.getByText(/Vergangene Tage behalten das Ziel/)).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: '3× pro Woche' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await training.findByText('3× pro Woche')).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    expect((await services.targets.current(profileId)).trainingsPerWeek).toBe(3);

    await userEvent.click(screen.getByRole('button', { name: /Aktive Minuten pro Woche/ }));
    const minutes = within(await screen.findByRole('dialog', { name: 'Aktive Minuten pro Woche' }));
    expect(minutes.getByText(/WHO empfiehlt/)).toBeInTheDocument();
    await userEvent.click(minutes.getByRole('button', { name: '150 min' }));
    await waitFor(async () => {
      expect((await services.targets.current(profileId)).activeMinutesPerWeek).toBe(150);
    });
  });

  it('offers "Allgemeine Fitness" as main goal', async () => {
    await renderApp('/settings/goals');
    const option = await screen.findByRole('radio', { name: 'Allgemeine Fitness' });
    await userEvent.click(option);
    expect(option).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/wie bei „Gewicht halten“ berechnet/)).toBeInTheDocument();
  });
});

describe('score: dark mode and reduced motion', () => {
  it('renders the same content in dark mode', async () => {
    await renderApp('/', {
      prepare: async (s, profileId) => {
        await s.settings.update('theme', 'dark');
        await goodWeek(s, profileId);
      },
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(await (await scoreCard()).findByText('Sehr gut unterwegs')).toBeInTheDocument();
  });

  it('uses no animation that depends on motion', async () => {
    const { container } = await renderApp('/', { prepare: goodWeek });
    await scoreButton();
    expect(container.querySelectorAll('main [class*="animate"], main progress')).toHaveLength(0);
  });
});
