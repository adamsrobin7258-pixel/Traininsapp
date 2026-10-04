import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { SetValues } from '@/core/training';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

const values = (weightKg: number, reps: number): SetValues => ({
  weightKg,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closedDialog() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

/** True when a field that would bring up the on-screen keyboard has focus. */
function textFieldFocused() {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && !['button', 'checkbox', 'radio'].includes(active.type))
  );
}

/** Plan "Push Pull" with Push (bench press 3 × 8) and Pull (dumbbell row). */
async function plan(services: AppServices, profileId: string, name = 'Push Pull') {
  const t = services.training;
  await t.exercises.ensureCatalog();
  const created = await t.plans.createPlan(profileId, name);
  const push = await t.plans.addDay(profileId, created.id, 'Push');
  const pull = await t.plans.addDay(profileId, created.id, 'Pull');
  const bench = await t.plans.addExercise(profileId, push, 'sys.bench-press');
  await t.plans.setTargets(profileId, bench, 3, 8);
  await t.plans.addExercise(profileId, pull, 'sys.dumbbell-row');
  return { planId: created.id, push, pull };
}

/** A finished workout of `dayId` on 2026-10-`day`: all working sets at kg × reps. */
async function trained(
  services: AppServices,
  profileId: string,
  dayId: string,
  day: number,
  kg = 80,
  reps = 8,
) {
  const w = services.training.workouts;
  vi.setSystemTime(new Date(2026, 9, day, 7));
  const workout = await w.startFromPlan(profileId, dayId);
  for (const exercise of (await w.getDetail(profileId, workout.id)).exercises) {
    for (const set of exercise.sets) await w.updateSet(profileId, set.id, values(kg, reps), true);
  }
  vi.setSystemTime(new Date(2026, 9, day, 8));
  await w.finish(profileId, workout.id);
  vi.setSystemTime(NOW);
  return workout.id;
}

async function startDay(day: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: 'Anderes Training' }));
  await userEvent.click(dialog().getByRole('button', { name: /^Aus Plan starten/ }));
  await userEvent.click(await screen.findByRole('button', { name: day }));
  await screen.findByLabelText('Satz 1: Gewicht');
}

describe('training experience', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marks the next day of every plan and lets any day be started', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        const first = await plan(services, profileId, 'Plan Eins');
        await plan(services, profileId, 'Plan Zwei');
        await trained(services, profileId, first.push, 1);
      },
    });
    // The training page suggests the plan trained last.
    expect(await screen.findByText('Pull · Plan Eins')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anderes Training' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Aus Plan starten/ }));
    const one = within(await screen.findByRole('list', { name: 'Plan Eins' }));
    const two = within(screen.getByRole('list', { name: 'Plan Zwei' }));
    expect(one.getByRole('button', { name: /^Pull.*Als Nächstes/ })).toBeInTheDocument();
    expect(one.getByRole('button', { name: /^Push/ })).not.toHaveTextContent('Als Nächstes');
    expect(two.getByRole('button', { name: /^Push.*Als Nächstes/ })).toBeInTheDocument();
    // Free choice: Push of plan one although Pull is suggested.
    await userEvent.click(one.getByRole('button', { name: /^Push/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);
  });

  it('shows last values per set and a suggestion that can be taken over and changed', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        const p = await plan(services, profileId);
        for (const day of [1, 2]) await trained(services, profileId, p.push, day);
        // The newest workout: 80 × 8, 80 × 8, 80 × 9 (more reps still reach the target).
        const id = await trained(services, profileId, p.push, 3);
        const sets = (await services.training.workouts.getDetail(profileId, id)).exercises[0]?.sets;
        await services.training.workouts.updateSet(
          profileId,
          sets?.[2]?.id ?? '',
          values(80, 9),
          true,
        );
      },
    });
    await startDay(/^Push/);
    const card = within(screen.getByRole('article', { name: 'Langhantel-Bankdrücken' }));
    const last = within(await card.findByRole('region', { name: 'Werte vom letzten Training' }));
    expect(last.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '80 kg × 8',
      '80 kg × 8',
      '80 kg × 9',
    ]);
    const suggestion = within(await card.findByRole('region', { name: 'Vorschlag' }));
    expect(suggestion.getByText('83,75 kg × 6')).toBeInTheDocument();
    expect(suggestion.getByText(/3-mal in Folge 80 kg × 8 geschafft/)).toBeInTheDocument();
    // Nothing is taken over automatically: the sets still hold the last values.
    expect(card.getByLabelText('Satz 1: Gewicht')).toHaveValue('80');

    await userEvent.click(
      suggestion.getByRole('button', { name: /Vorschlag 83,75 kg × 6 für Langhantel/ }),
    );
    await waitFor(() => {
      expect(card.getByLabelText('Satz 1: Gewicht')).toHaveValue('83,75');
    });
    expect(card.getByLabelText('Satz 3: Wdh.')).toHaveValue('6');
    expect(textFieldFocused()).toBe(false);
    // The user can still enter something else.
    await userEvent.clear(card.getByLabelText('Satz 1: Gewicht'));
    await userEvent.type(card.getByLabelText('Satz 1: Gewicht'), '82,5');
    await userEvent.click(card.getByRole('button', { name: 'Satz 1 abschließen' }));
    await card.findByRole('button', { name: 'Satz 1 wieder öffnen' });
    expect(card.getByLabelText('Satz 1: Gewicht')).toHaveValue('82,5');
  });

  it('no suggestion without enough history or with the setting off', async () => {
    const { services } = await renderApp('/training', {
      prepare: async (s, id) => {
        const p = await plan(s, id);
        for (const day of [1, 2]) await trained(s, id, p.push, day);
        await s.settings.update('progressionMode', 'off');
      },
    });
    await startDay(/^Push/);
    const card = within(screen.getByRole('article', { name: 'Langhantel-Bankdrücken' }));
    expect(
      await card.findByRole('region', { name: 'Werte vom letzten Training' }),
    ).toBeInTheDocument();
    expect(card.queryByRole('region', { name: 'Vorschlag' })).not.toBeInTheDocument();
    expect((await services.settings.load()).progressionMode).toBe('off');
  });

  it('rest timer: starts after a completed set, can be paused and skipped, ends quietly', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        await plan(services, profileId);
        await services.settings.update('restTimerSeconds', 30);
      },
    });
    await startDay(/^Push/);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Satz 1: Gewicht'), '60');
    await userEvent.type(screen.getByLabelText('Satz 1: Wdh.'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    const bar = await screen.findByRole('timer', { name: 'Pause' });
    const timer = within(bar);
    // One compact line (Phase 17.4): label, the remaining time, two icon buttons.
    expect(timer.getByText('Pause')).toBeInTheDocument();
    expect(timer.getByText('0:30')).toBeInTheDocument();
    expect(bar).toHaveTextContent(/^Pause0:30$/);
    expect(timer.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(
      ['Anhalten', 'Überspringen'],
    );
    // The next set stays usable while the timer runs.
    expect(screen.getByLabelText('Satz 2: Gewicht')).toBeEnabled();
    vi.setSystemTime(new Date(NOW.getTime() + 10_000));
    await timer.findByText('0:20');
    await userEvent.click(timer.getByRole('button', { name: 'Anhalten' }));
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    expect(await timer.findByText('Angehalten')).toBeInTheDocument();
    expect(timer.getByText('0:20')).toBeInTheDocument();
    await userEvent.click(timer.getByRole('button', { name: 'Weiter' }));
    vi.setSystemTime(new Date(NOW.getTime() + 90_000));
    expect(await screen.findByText('Pause vorbei')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Pause vorbei');
    await userEvent.click(screen.getByRole('button', { name: 'Hinweis schließen' }));
    expect(screen.queryByText('Pause vorbei')).not.toBeInTheDocument();

    // A new set restarts it; skip removes it at once.
    vi.setSystemTime(NOW);
    await userEvent.type(screen.getByLabelText('Satz 2: Gewicht'), '60');
    await userEvent.type(screen.getByLabelText('Satz 2: Wdh.'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 2 abschließen' }));
    await userEvent.click(
      within(await screen.findByRole('timer')).getByRole('button', { name: 'Überspringen' }),
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('rest timer 0: no timer at all', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        await plan(services, profileId);
        await services.settings.update('restTimerSeconds', 0);
      },
    });
    await startDay(/^Push/);
    await userEvent.type(screen.getByLabelText('Satz 1: Gewicht'), '60');
    await userEvent.type(screen.getByLabelText('Satz 1: Wdh.'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    await screen.findByRole('button', { name: 'Satz 1 wieder öffnen' });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pause/)).not.toBeInTheDocument();
  });

  it('replaces an exercise in this workout only; set options change the type or delete', async () => {
    const { services } = await renderApp('/training', {
      prepare: async (s, id) => {
        await plan(s, id);
      },
    });
    const profileId = (await services.profile.ensureLocalProfile()).id;
    await startDay(/^Push/);
    await userEvent.click(screen.getByRole('button', { name: 'Übung ersetzen' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Übung ersetzen' }));
    expect(
      picker.getByText('Nur in diesem Training – dein Plan bleibt unverändert.'),
    ).toBeVisible();
    expect(textFieldFocused()).toBe(false);
    await userEvent.type(picker.getByRole('searchbox'), 'kurzhantel bank');
    await userEvent.click(picker.getByRole('button', { name: /^Kurzhantel-Bankdrücken/ }));
    await closedDialog();
    expect(
      await screen.findByRole('article', { name: 'Kurzhantel-Bankdrücken' }),
    ).toBeInTheDocument();
    const plans = await services.training.plans.listPlans(profileId);
    const stored = await services.training.plans.getPlan(profileId, plans[0]?.id ?? '');
    expect(stored.days[0]?.exercises.map((e) => e.exerciseId)).toEqual(['sys.bench-press']);

    // Set 3 becomes a drop of set 2, then set 1 is deleted.
    await userEvent.click(screen.getByRole('button', { name: 'Optionen für Satz 3' }));
    const options = within(await screen.findByRole('dialog', { name: 'Optionen für Satz 3' }));
    expect(options.getByRole('button', { name: 'Arbeitssatz' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(textFieldFocused()).toBe(false);
    await userEvent.click(options.getByRole('button', { name: 'Drop-Satz' }));
    await closedDialog();
    expect(await screen.findByLabelText('Drop 1 zu Satz 2: Gewicht')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Optionen für Satz 1' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Satz löschen' }),
    );
    await closedDialog();
    await waitFor(() => {
      expect(screen.queryByLabelText('Satz 2: Gewicht')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText('Drop 1 zu Satz 1: Gewicht')).toBeInTheDocument();
  });

  it('after finishing: summary with a new heaviest weight, then the editable workout', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        const p = await plan(services, profileId);
        await trained(services, profileId, p.push, 1, 80, 8);
      },
    });
    await startDay(/^Push/);
    for (const number of [1, 2, 3]) {
      const weight = screen.getByLabelText(`Satz ${number}: Gewicht`);
      await userEvent.clear(weight);
      await userEvent.type(weight, number === 1 ? '82,5' : '80');
      await userEvent.click(screen.getByRole('button', { name: `Satz ${number} abschließen` }));
      await screen.findByRole('button', { name: `Satz ${number} wieder öffnen` });
    }
    vi.setSystemTime(new Date(NOW.getTime() + 45 * 60_000));
    await userEvent.click(screen.getByRole('button', { name: 'Training beenden' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training beenden' }));
    const summary = within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
    expect(summary.getByRole('heading', { name: 'Push' })).toBeInTheDocument();
    expect(summary.getByText('45 min')).toBeInTheDocument();
    const records = within(await summary.findByRole('region', { name: 'Neues Höchstgewicht' }));
    expect(records.getByText('82,5 kg (bisher 80 kg)')).toBeInTheDocument();
    expect(summary.getByText('3 Sätze · bester Satz 82,5 kg × 8')).toBeInTheDocument();
    await userEvent.click(summary.getByRole('button', { name: 'Training ansehen' }));
    await closedDialog();

    // Edit: duration and notes.
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    await userEvent.click(screen.getByRole('button', { name: /^Titel, Notizen und Dauer/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Titel, Notizen und Dauer' }));
    expect(textFieldFocused()).toBe(false);
    const duration = sheet.getByLabelText('Dauer (Minuten)');
    expect(duration).toHaveValue('45');
    await userEvent.clear(duration);
    await userEvent.type(duration, '0');
    await userEvent.click(sheet.getByRole('button', { name: 'Speichern' }));
    expect(
      sheet.getByText('Bitte eine Dauer von 1 bis 1440 Minuten eingeben.'),
    ).toBeInTheDocument();
    await userEvent.clear(duration);
    await userEvent.type(duration, '60');
    await userEvent.type(sheet.getByLabelText('Notizen'), 'Gute Einheit');
    await userEvent.click(sheet.getByRole('button', { name: 'Speichern' }));
    await closedDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(await screen.findByText('1 h 00 min')).toBeInTheDocument();
    expect(screen.getByText('Gute Einheit')).toBeInTheDocument();
  });

  it('the summary closes to Training; system back on the finished workout leads there too', async () => {
    const { router } = await renderApp('/training', {
      prepare: async (services, profileId) => {
        await plan(services, profileId);
      },
    });
    await startDay(/^Push/);
    await userEvent.type(screen.getByLabelText('Satz 1: Gewicht'), '60');
    await userEvent.type(screen.getByLabelText('Satz 1: Wdh.'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    await screen.findByRole('button', { name: 'Satz 1 wieder öffnen' });
    await userEvent.click(screen.getByRole('button', { name: 'Training beenden' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training beenden' }));
    const summary = within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
    await userEvent.click(summary.getByRole('button', { name: 'Schließen' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/training');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Training' })).toBeInTheDocument();
  });
});

describe('training settings', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Ziele → Training: weight increase suggestions from a list, with the central thresholds', async () => {
    const { services } = await renderApp('/settings/goals');
    const row = await screen.findByRole('button', { name: /^Gewichtssteigerung vorschlagen/ });
    expect(row).toHaveTextContent('Normal');
    await userEvent.click(row);
    const sheet = within(await screen.findByRole('dialog'));
    expect(textFieldFocused()).toBe(false);
    expect(
      sheet.getByRole('button', { name: /^Vorsichtig.*4 Trainings in Folge, etwa \+2,5 %/ }),
    ).toBeInTheDocument();
    expect(
      sheet.getByRole('button', { name: /^Normal.*3 Trainings in Folge, etwa \+5 %/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      sheet.getByRole('button', { name: /^Progressiv.*2 Trainings.*\+7,5 %/ }),
    ).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: /^Vorsichtig/ }));
    await closedDialog();
    expect(
      screen.getByRole('button', { name: /^Gewichtssteigerung vorschlagen/ }),
    ).toHaveTextContent('Vorsichtig');
    expect((await services.settings.load()).progressionMode).toBe('cautious');
  });

  it('App → Training: rest time from a list, 0 = off, stored', async () => {
    const { services } = await renderApp('/settings/app');
    const row = await screen.findByRole('button', { name: /^Pausenzeit/ });
    expect(row).toHaveTextContent('90 s');
    await userEvent.click(row);
    const sheet = within(await screen.findByRole('dialog'));
    expect(textFieldFocused()).toBe(false);
    expect(sheet.getAllByRole('button', { pressed: false }).length).toBeGreaterThan(0);
    for (const label of ['Aus', '30 s', '60 s', '90 s', '120 s', '180 s', '240 s', '300 s']) {
      expect(sheet.getByRole('button', { name: label })).toBeInTheDocument();
    }
    await userEvent.click(sheet.getByRole('button', { name: 'Aus' }));
    await closedDialog();
    expect(screen.getByRole('button', { name: /^Pausenzeit/ })).toHaveTextContent('Aus');
    expect((await services.settings.load()).restTimerSeconds).toBe(0);
  });
});
