import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { HealthWorkout } from '@/core/platform/health';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 3, 10, 0);

function session(
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

const connect = async (services: AppServices, profileId: string) => {
  await services.healthSync.connect(profileId);
};

async function withGoal(services: AppServices, profileId: string) {
  await services.nutrition.goals.save(profileId, {
    effectiveFrom: '2026-09-01',
    goalType: 'maintain',
    targets: {
      energyKcal: { auto: null, manual: 2300 },
      proteinG: { auto: null, manual: 160 },
    },
  });
}

describe('Aktivitäten', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens from the training screen, separate from the workout history', async () => {
    await renderApp('/training', {
      healthPlatform: platformWith([session('a', [2, 18, 20], 42)]),
      prepare: connect,
    });
    const link = await screen.findByRole('link', { name: /Aktivitäten/ });
    expect(link).toHaveTextContent('Aus Health Connect · getrennt von deinen Trainings');
    // Imported activities are no Kalethra workouts: the history stays empty.
    expect(await screen.findByText('Noch keine abgeschlossenen Trainings.')).toBeInTheDocument();
    expect(screen.queryByText('Laufen')).not.toBeInTheDocument();
    await userEvent.click(link);
    expect(await screen.findByRole('heading', { name: 'Aktivitäten' })).toBeInTheDocument();
  });

  it('lists activities newest first with day, time and only the delivered values', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([
        session('a', [2, 18, 20], 42),
        session('b', [3, 7, 5], 30, { type: 'yoga', activeKcal: null, distanceM: null }),
        {
          ...session('c', [1, 9, 0], 65, { type: 'frisbeeDisc', distanceM: 0, activeKcal: 210 }),
          start: localIso(2026, 9, 28, 9, 0),
          end: localIso(2026, 9, 28, 10, 5),
        },
      ]),
      prepare: connect,
    });
    const list = await screen.findByRole('list', { name: 'Aktivitäten' });
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Yoga');
    expect(rows[0]).toHaveTextContent('Heute · 07:05');
    expect(rows[0]).toHaveTextContent('30 min');
    // Nothing invented for missing values.
    expect(rows[0]).not.toHaveTextContent('kcal');
    expect(rows[0]).not.toHaveTextContent('km');
    expect(rows[1]).toHaveTextContent('Laufen');
    expect(rows[1]).toHaveTextContent('Gestern · 18:20');
    expect(rows[1]).toHaveTextContent('42 min · 5,8 km · 386 kcal');
    // Unknown provider type: its own name, not another sport.
    expect(rows[2]).toHaveTextContent('Frisbee disc');
    expect(rows[2]).toHaveTextContent('1 h 05 min · 210 kcal');
  });

  it('shows the details of one activity with its source', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([
        session('a', [2, 18, 20], 42),
        session('b', [3, 7, 5], 30, {
          type: 'yoga',
          activeKcal: null,
          distanceM: null,
          source: null,
        }),
      ]),
      prepare: connect,
    });
    await userEvent.click(await screen.findByRole('button', { name: /Laufen/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität' }));
    const facts = within(sheet.getByRole('list', { name: 'Aktivität' }));
    expect(facts.getByText('Laufen')).toBeInTheDocument();
    expect(facts.getByText('02.10.2026')).toBeInTheDocument();
    expect(facts.getByText('18:20')).toBeInTheDocument();
    expect(facts.getByText('42 min')).toBeInTheDocument();
    expect(facts.getByText('386 kcal')).toBeInTheDocument();
    expect(facts.getByText('5,8 km')).toBeInTheDocument();
    expect(facts.getByText('Health Connect · Pixel Watch')).toBeInTheDocument();
    expect(facts.queryByText('Schritte')).not.toBeInTheDocument();
    expect(sheet.getByText(/Zählt nicht als Kalethra-Training/)).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await userEvent.click(await screen.findByRole('button', { name: /Yoga/ }));
    const yoga = within(await screen.findByRole('dialog', { name: 'Aktivität' }));
    expect(yoga.queryByText('Aktive Kalorien')).not.toBeInTheDocument();
    expect(yoga.queryByText('Distanz')).not.toBeInTheDocument();
    expect(yoga.getByText('Health Connect')).toBeInTheDocument();
  });

  it('explains how to get activities when Health Connect is not connected', async () => {
    await renderApp('/training/activities', { healthPlatform: platformWith([]) });
    expect(await screen.findByText('Noch keine Aktivitäten')).toBeInTheDocument();
    expect(screen.getByText(/Profil → Gesundheitsdaten/)).toBeInTheDocument();
  });

  it('says so when connected without activities', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([]),
      prepare: connect,
    });
    expect(
      await screen.findByText('Keine Aktivitäten in den letzten 30 Tagen'),
    ).toBeInTheDocument();
  });

  it('notes an activity that is the same session as a Kalethra workout', async () => {
    await renderApp('/training/activities', {
      healthPlatform: platformWith([
        session('watch', [3, 7, 2], 56, { type: 'strengthTraining', distanceM: null }),
      ]),
      prepare: async (services, profileId) => {
        vi.setSystemTime(new Date(2026, 9, 3, 7, 0));
        const own = await services.training.workouts.startFree(profileId);
        vi.setSystemTime(new Date(2026, 9, 3, 8, 0));
        await services.training.workouts.finish(profileId, own.id);
        vi.setSystemTime(NOW);
        await connect(services, profileId);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Krafttraining/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Aktivität' }));
    expect(await sheet.findByText(/Überschneidet sich mit deinem Kalethra-Training/)).toBeVisible();
  });
});

describe('Aktivitätskalorien anrechnen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is off by default, explains both states and saves the choice', async () => {
    const { services } = await renderApp('/profile', { healthPlatform: platformWith([]) });
    const toggle = await screen.findByRole('switch', { name: 'Aktivitätskalorien anrechnen' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    const row = within(toggle.closest('li') ?? document.body);
    expect(row.getByText('Aus')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Aktive Kalorien aus Health Connect werden zum verfügbaren Tagesziel hinzugezählt.',
      ),
    ).toBeInTheDocument();
    expect(toggle).toHaveAccessibleDescription(
      'Das tägliche Ernährungsziel bleibt unverändert. Importierte Aktivitätskalorien werden nur als Information angezeigt.',
    );

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(row.getByText('An')).toBeInTheDocument();
    expect(toggle).toHaveAccessibleDescription(
      '100 % der von Health Connect gelieferten aktiven Kalorien werden zum verfügbaren Tagesbudget hinzugezählt.',
    );
    await waitFor(async () => {
      expect((await services.settings.load()).countActivityCalories).toBe(true);
    });
  });

  it('nutrition: off shows the activity calories as information only', async () => {
    await renderApp('/nutrition', {
      healthPlatform: platformWith([session('a', [3, 7, 0], 45, { activeKcal: 500 })]),
      prepare: async (services, profileId) => {
        await withGoal(services, profileId);
        await connect(services, profileId);
      },
    });
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    expect(await overview.findByText('Aktivitätskalorien')).toBeInTheDocument();
    expect(overview.getByText('500 kcal')).toBeInTheDocument();
    expect(overview.getByText('Nicht auf das Tagesziel angerechnet')).toBeInTheDocument();
    // Goal and remaining stay at 2.300 kcal.
    expect(overview.getAllByText('2.300 kcal')).toHaveLength(2);
    expect(overview.queryByText('Basisziel')).not.toBeInTheDocument();
  });

  it('nutrition: on adds them to the day: Basisziel 2.300 kcal + 500 kcal = 2.800 kcal', async () => {
    await renderApp('/nutrition', {
      healthPlatform: platformWith([session('a', [3, 7, 0], 45, { activeKcal: 500 })]),
      prepare: async (services, profileId) => {
        await withGoal(services, profileId);
        await services.settings.update('countActivityCalories', true);
        await connect(services, profileId);
      },
    });
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    expect(await overview.findByText('Basisziel')).toBeInTheDocument();
    expect(overview.getByText('2.300 kcal')).toBeInTheDocument();
    expect(overview.getByText('+500 kcal')).toBeInTheDocument();
    // Goal and remaining (nothing eaten yet) follow the day's budget.
    expect(overview.getAllByText('2.800 kcal')).toHaveLength(2);
  });

  it('nutrition: nothing extra on a day without activities', async () => {
    await renderApp('/nutrition', {
      healthPlatform: platformWith([]),
      prepare: async (services, profileId) => {
        await withGoal(services, profileId);
        await services.settings.update('countActivityCalories', true);
        await connect(services, profileId);
      },
    });
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    expect((await overview.findAllByText('2.300 kcal')).length).toBeGreaterThan(0);
    expect(overview.queryByText('Aktivitätskalorien')).not.toBeInTheDocument();
    expect(overview.queryByText('Basisziel')).not.toBeInTheDocument();
  });

  it('today: shows the breakdown under the calorie goal', async () => {
    await renderApp('/', {
      healthPlatform: platformWith([session('a', [3, 7, 0], 45, { activeKcal: 500 })]),
      prepare: async (services, profileId) => {
        await withGoal(services, profileId);
        await services.settings.update('countActivityCalories', true);
        await connect(services, profileId);
      },
    });
    expect(
      await screen.findByText('Basisziel 2.300 kcal · Aktivitätskalorien +500 kcal'),
    ).toBeInTheDocument();
    expect(screen.getByText(/von 2\.800 kcal/)).toBeInTheDocument();
  });

  it('today: off keeps the goal and labels the calories as not counted', async () => {
    await renderApp('/', {
      healthPlatform: platformWith([session('a', [3, 7, 0], 45, { activeKcal: 500 })]),
      prepare: async (services, profileId) => {
        await withGoal(services, profileId);
        await connect(services, profileId);
      },
    });
    expect(
      await screen.findByText('Aktivitätskalorien 500 kcal · Nicht auf das Tagesziel angerechnet'),
    ).toBeInTheDocument();
    expect(screen.getByText(/von 2\.300 kcal/)).toBeInTheDocument();
  });
});
