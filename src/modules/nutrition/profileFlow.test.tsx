import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

/** Man, born 1990-05-01, 180 cm, 90 kg every day of the last week. */
async function preparePerson(services: AppServices, profileId: string) {
  const profile = await services.profile.ensureLocalProfile();
  await services.profile.updateBodyData(profile, {
    sex: 'male',
    birthDate: '1990-05-01',
    heightCm: 180,
  });
  for (let day = 27; day <= 30; day++)
    await services.weight.save(profileId, `2026-09-${String(day)}`, 90);
  for (let day = 1; day <= 3; day++)
    await services.weight.save(profileId, `2026-10-0${String(day)}`, 90);
}

const loseModerate = {
  params: {
    goalType: 'lose' as const,
    goalLevel: 'moderate' as const,
    activityLevel: 'moderate' as const,
    includeTraining: false,
    targetWeightKg: 82,
  },
  overrides: {},
  waterMl: null,
};

describe('nutrition profile', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens without the keyboard and names what is missing', async () => {
    await renderApp('/nutrition/profile');
    expect(
      await screen.findByText(/Für eine automatische Berechnung fehlen noch Angaben/),
    ).toHaveTextContent(
      'Geschlecht, Geburtsdatum, Körpergröße, Gewicht (unter „Gesundheit“), Alltagsaktivität',
    );
    expect(document.activeElement?.tagName).not.toBe('INPUT');
    expect(screen.getByText('Noch kein Gewicht eingetragen')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Training in Kalorienberechnung/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText(/Die Werte sind Schätzungen/)).toBeInTheDocument();
  });

  it('calculates the goals step by step and uses them in the diary and on Today', async () => {
    const { services } = await renderApp('/nutrition/profile', {
      prepare: preparePerson,
    });
    await userEvent.click(await screen.findByRole('radio', { name: /^Moderat aktiv/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Abnehmen' }));
    expect(screen.getByRole('radio', { name: /^Moderat.*0,5 kg pro Woche/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.type(screen.getByLabelText('Wunschgewicht (kg, optional)'), '82');
    expect(screen.getByText('82,0 kg Zielgewicht · 8,0 kg verbleibend')).toBeInTheDocument();

    // RMR 10·90 + 6.25·180 − 5·36 + 5 = 1850 → × 1.4 = 2590 → − 550 = 2040
    const calc = within(await screen.findByRole('list', { name: 'Berechnung' }));
    expect(await calc.findByText('1.850 kcal')).toBeInTheDocument();
    // Everyday energy and maintenance are equal without training.
    expect(calc.getAllByText('2.590 kcal')).toHaveLength(2);
    expect(calc.getByText('−550 kcal')).toBeInTheDocument();
    const goals = within(screen.getByRole('list', { name: 'Deine Tagesziele' }));
    expect(goals.getByRole('button', { name: /^Kalorienziel.*2\.040 kcal$/ })).toBeInTheDocument();
    expect(
      goals.getByRole('button', { name: /^Protein.*1,6 g pro kg.*143 g$/ }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/Ernährungsprofil gespeichert/)).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const goal = await services.nutrition.goals.goalFor(profileId, '2026-10-03');
    expect(goal?.goal.calculation?.energy?.rmrKcal).toBe(1850);
    expect(goal?.effective.energyKcal).toEqual({ value: 2040, origin: 'auto' });

    await userEvent.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'Ernährung' }),
    );
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    // Goal and remaining (nothing eaten yet).
    expect(await overview.findAllByText('2.040 kcal')).toHaveLength(2);
  });

  it('keeps a manual value and returns to the automatic one on request', async () => {
    const { services } = await renderApp('/nutrition/profile', {
      prepare: async (s, profileId) => {
        await preparePerson(s, profileId);
        await s.nutrition.goals.saveProfile(profileId, loseModerate);
      },
    });
    // 1.6 g/kg on the reference weight: 90 kg is capped at BMI 27.5 (89.1 kg at 180 cm).
    await userEvent.click(await screen.findByRole('button', { name: /^Protein/ }));
    expect(dialog().getByText('Automatisch: 143 g')).toBeInTheDocument();
    const field = dialog().getByLabelText('Eigener Wert (g)');
    await userEvent.clear(field);
    await userEvent.type(field, '170');
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
    await closed();
    expect(
      screen.getByRole('button', { name: /^Protein\s*Individuell.*170 g$/ }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByText(/Ernährungsprofil gespeichert/);
    const profileId = (await services.profile.ensureLocalProfile()).id;
    expect(
      (await services.nutrition.goals.goalFor(profileId, '2026-10-03'))?.goal.targets.proteinG,
    ).toEqual({
      auto: 143,
      manual: 170,
    });

    await userEvent.click(screen.getByRole('button', { name: /^Protein/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Automatisch berechnen' }));
    await closed();
    expect(
      screen.getByRole('button', { name: /^Protein\s*Automatisch.*143 g$/ }),
    ).toBeInTheDocument();
  });

  it('asks before changing the goal and keeps earlier days', async () => {
    const { services } = await renderApp('/nutrition/profile', {
      prepare: async (s, profileId) => {
        await preparePerson(s, profileId);
        vi.setSystemTime(new Date(2026, 9, 1, 10));
        await s.nutrition.goals.saveProfile(profileId, loseModerate);
        vi.setSystemTime(NOW);
      },
    });
    await userEvent.click(await screen.findByRole('radio', { name: 'Muskelaufbau' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const sheet = dialog();
    expect(sheet.getByText('Abnehmen – Moderat · 2.040 kcal')).toBeInTheDocument();
    // 2590 + 5 % = 2719.5 → 2.720 kcal
    expect(sheet.getByText('Muskelaufbau – Moderat · 2.720 kcal')).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Ziel ändern' }));
    await closed();
    await screen.findByText(/Ernährungsprofil gespeichert/);

    const profileId = (await services.profile.ensureLocalProfile()).id;
    const versions = await services.nutrition.goals.list(profileId);
    expect(versions.map((v) => [v.effectiveFrom, v.goalType])).toEqual([
      ['2026-10-01', 'lose'],
      ['2026-10-03', 'gain'],
    ]);
    expect(
      (await services.nutrition.goals.goalFor(profileId, '2026-10-02'))?.effective.energyKcal.value,
    ).toBe(2040);
  });

  it('includes training only when switched on', async () => {
    await renderApp('/nutrition/profile', {
      prepare: async (s, profileId) => {
        await preparePerson(s, profileId);
        for (const day of [10, 17, 24]) {
          vi.setSystemTime(new Date(2026, 8, day, 9));
          const workout = await s.training.workouts.startFree(profileId);
          vi.setSystemTime(new Date(2026, 8, day, 10));
          await s.training.workouts.finish(profileId, workout.id);
        }
        vi.setSystemTime(NOW);
        await s.nutrition.goals.saveProfile(profileId, loseModerate);
      },
    });
    const calc = within(await screen.findByRole('list', { name: 'Berechnung' }));
    expect(calc.queryByText('Training (Ø pro Tag)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: /Training in Kalorienberechnung/ }));
    // 3 × 1 h strength: 2.5 MET × 90 kg × 3 h ÷ 28 days ≈ 24 kcal per day
    expect(
      await screen.findByText('3 Trainings in 4 Wochen · Ø 24 kcal pro Tag'),
    ).toBeInTheDocument();
    expect(await calc.findByText('Training (Ø pro Tag)')).toBeInTheDocument();
  });

  it('follows a new weight from the health area without a manual step', async () => {
    const { services } = await renderApp('/health', {
      prepare: async (s, profileId) => {
        const profile = await s.profile.ensureLocalProfile();
        await s.profile.updateBodyData(profile, {
          sex: 'male',
          birthDate: '1990-05-01',
          heightCm: 180,
        });
        await s.weight.save(profileId, '2026-09-20', 90);
        vi.setSystemTime(new Date(2026, 8, 20, 10));
        await s.nutrition.goals.saveProfile(profileId, loseModerate);
        vi.setSystemTime(NOW);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Gewicht eintragen' }));
    await userEvent.type(dialog().getByLabelText('Gewicht in kg'), '86');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    const profileId = (await services.profile.ensureLocalProfile()).id;
    await waitFor(async () => {
      expect((await services.nutrition.goals.list(profileId)).map((g) => g.effectiveFrom)).toEqual([
        '2026-09-20',
        '2026-10-03',
      ]);
    });
    const today = await services.nutrition.goals.goalFor(profileId, '2026-10-03');
    expect(today?.goal.calculation?.inputs.weight?.kg).toBe(86);
  });

  // Formerly on the Today card; since Phase 7.1 the hint lives in the diary.
  it('shows the setup hint in the diary without a profile', async () => {
    await renderApp('/nutrition');
    expect(await screen.findByText('Noch keine Ziele festgelegt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ernährungsprofil einrichten' })).toBeInTheDocument();
  });
});
