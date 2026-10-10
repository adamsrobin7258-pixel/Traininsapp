import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import type { SetValues } from '@/core/training';
import { renderApp } from '@/test/renderApp';

/** The focus view of a workout in progress: one exercise, steppers, the set flow. */

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

const values = (weightKg: number, reps: number): SetValues => ({
  weightKg,
  reps,
  durationS: null,
  distanceM: null,
  rpe: null,
});

const dialog = () => within(screen.getByRole('dialog'));

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

/** Plan "Kraft", day "Push": bench press 2 × 8, then dumbbell rows 1 × 10. */
async function plan(services: AppServices, profileId: string) {
  const t = services.training;
  await t.exercises.ensureCatalog();
  const created = await t.plans.createPlan(profileId, 'Kraft');
  const push = await t.plans.addDay(profileId, created.id, 'Push');
  const bench = await t.plans.addExercise(profileId, push, 'sys.bench-press');
  await t.plans.setTargets(profileId, bench, 2, 8);
  const row = await t.plans.addExercise(profileId, push, 'sys.dumbbell-row');
  await t.plans.setTargets(profileId, row, 1, 10);
  return { planId: created.id, push };
}

/** A finished Push workout on 1 October: bench 80 kg × 8, rows 30 kg × 10. */
async function trainedBefore(services: AppServices, profileId: string, push: string) {
  const w = services.training.workouts;
  vi.setSystemTime(new Date(2026, 9, 1, 7));
  const workout = await w.startFromPlan(profileId, push);
  for (const exercise of (await w.getDetail(profileId, workout.id)).exercises) {
    const load = exercise.exerciseId === 'sys.bench-press' ? values(80, 8) : values(30, 10);
    for (const set of exercise.sets) await w.updateSet(profileId, set.id, load, true);
  }
  vi.setSystemTime(new Date(2026, 9, 1, 8));
  await w.finish(profileId, workout.id);
  vi.setSystemTime(NOW);
}

/** Starts the Push day from the training page. */
async function startPush() {
  await userEvent.click(await screen.findByRole('button', { name: 'Starten' }));
  await screen.findByLabelText('Satz 1: Gewicht');
}

/** Renders Training with the plan (and, by default, one earlier workout) and starts Push. */
async function startedPush({ history = true, rest = 60 } = {}) {
  const rendered = await renderApp('/training', {
    prepare: async (services, profileId) => {
      const { push } = await plan(services, profileId);
      if (history) await trainedBefore(services, profileId, push);
      await services.settings.update('restTimerSeconds', rest as 60);
    },
  });
  await startPush();
  const profileId = (await rendered.services.profile.ensureLocalProfile()).id;
  return { ...rendered, profileId };
}

/** Completes a set; right after a completion the button is locked briefly (double taps). */
async function complete(name: string) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => {
    expect(button).toBeEnabled();
  });
  await userEvent.click(button);
}

async function setRows(db: Awaited<ReturnType<typeof renderApp>>['db']) {
  return db.query<{
    name: string;
    weight_kg: number | null;
    reps: number | null;
    completed: number;
  }>(
    `SELECT we.name_de AS name, s.weight_kg, s.reps, s.completed FROM workout_sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE w.status = 'active' ORDER BY we.position, s.position`,
  );
}

const exercise = (name: string) => within(screen.getByRole('article', { name }));
const currentSet = () => document.querySelector('[aria-current="step"]');

describe('focus view of a workout in progress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is the default: one exercise with its position, last values and the first open set', async () => {
    await startedPush();
    expect(screen.getByRole('radio', { name: 'Fokus' })).toHaveAttribute('aria-checked', 'true');
    const bench = exercise('Langhantel-Bankdrücken');
    expect(bench.getByText('Übung 1 von 2')).toBeInTheDocument();
    expect(bench.getByRole('heading', { level: 2, name: 'Langhantel-Bankdrücken' }));
    expect(
      screen.queryByRole('article', { name: 'Einarmiges Kurzhantelrudern' }),
    ).not.toBeInTheDocument();
    expect(
      await bench.findByRole('region', { name: 'Werte vom letzten Training' }),
    ).toHaveTextContent('80 kg × 8');
    // Pre-filled from the last workout, open, and the first set is the current one.
    expect(bench.getByLabelText('Satz 1: Gewicht')).toHaveValue('80');
    expect(bench.getByLabelText('Satz 1: Wdh.')).toHaveValue('8');
    expect(currentSet()).toHaveAccessibleName('Satz 1: 80 kg × 8, offen');
    expect(bench.getByRole('button', { name: 'Satz 2: 80 kg × 8, offen' })).toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);
  });

  it('+/− and typing change the same value; completing stores the last entry', async () => {
    const { db } = await startedPush();
    const bench = exercise('Langhantel-Bankdrücken');
    const weight = bench.getByLabelText('Satz 1: Gewicht');
    await userEvent.click(bench.getByRole('button', { name: 'Gewicht um 1,25 kg erhöhen' }));
    expect(weight).toHaveValue('81,25');
    expect(textFieldFocused()).toBe(false);
    await userEvent.click(bench.getByRole('button', { name: 'Wdh. um 1 verringern' }));
    expect(bench.getByLabelText('Satz 1: Wdh.')).toHaveValue('7');
    // Typing replaces the value; +/− continues from what was typed.
    await userEvent.clear(weight);
    await userEvent.type(weight, '90');
    await userEvent.click(bench.getByRole('button', { name: 'Gewicht um 1,25 kg erhöhen' }));
    expect(weight).toHaveValue('91,25');
    // Every change is stored as an open value – nothing is completed by it.
    await waitFor(async () => {
      expect((await setRows(db))[0]).toMatchObject({ weight_kg: 91.25, reps: 7, completed: 0 });
    });
    // Typed without leaving the field, then completed: the typed value counts.
    await userEvent.clear(weight);
    await userEvent.type(weight, '92,5');
    expect(textFieldFocused()).toBe(true);
    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 abschließen' }));
    await bench.findByRole('button', { name: 'Satz 1: 92,5 kg × 7, abgeschlossen' });
    expect((await setRows(db))[0]).toMatchObject({ weight_kg: 92.5, reps: 7, completed: 1 });
    expect(textFieldFocused()).toBe(false);
  });

  it('an invalid entry keeps the set open with a message', async () => {
    const { db } = await startedPush();
    const bench = exercise('Langhantel-Bankdrücken');
    await userEvent.clear(bench.getByLabelText('Satz 1: Wdh.'));
    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 abschließen' }));
    expect(await bench.findByRole('alert')).toBeInTheDocument();
    expect(bench.getByLabelText('Satz 1: Wdh.')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect((await setRows(db))[0]?.completed).toBe(0);
    // Corrected with +, it can be completed.
    await userEvent.click(bench.getByRole('button', { name: 'Wdh. um 1 erhöhen' }));
    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 abschließen' }));
    await bench.findByRole('button', { name: 'Satz 1: 80 kg × 1, abgeschlossen' });
  });

  it('completing saves, starts the rest timer and prepares the next open set – no set is added', async () => {
    const { db } = await startedPush();
    const bench = exercise('Langhantel-Bankdrücken');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 abschließen' }));
    expect(await screen.findByRole('timer', { name: 'Pause' })).toHaveTextContent('1:00');
    await bench.findByRole('button', { name: 'Satz 1: 80 kg × 8, abgeschlossen' });
    expect(currentSet()).toHaveAccessibleName('Satz 2: 80 kg × 8, offen');
    expect(bench.getByLabelText('Satz 2: Gewicht')).toHaveValue('80');
    expect(bench.getByRole('button', { name: 'Satz 2 abschließen' })).toBeInTheDocument();
    expect(await setRows(db)).toEqual([
      { name: 'Langhantel-Bankdrücken', weight_kg: 80, reps: 8, completed: 1 },
      { name: 'Langhantel-Bankdrücken', weight_kg: 80, reps: 8, completed: 0 },
      { name: 'Einarmiges Kurzhantelrudern', weight_kg: 30, reps: 10, completed: 0 },
    ]);
  });

  it('a double tap completes exactly one set', async () => {
    const { db } = await startedPush();
    const button = exercise('Langhantel-Bankdrücken').getByRole('button', {
      name: 'Satz 1 abschließen',
    });
    await userEvent.dblClick(button);
    await screen.findByRole('button', { name: 'Satz 1: 80 kg × 8, abgeschlossen' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await setRows(db)).map((row) => row.completed)).toEqual([1, 0, 0]);
    expect(screen.getByRole('button', { name: 'Satz 2: 80 kg × 8, offen' })).toBeInTheDocument();
  });

  it('after the last set of an exercise the next exercise follows, announced', async () => {
    await startedPush();
    await complete('Satz 1 abschließen');
    await complete('Satz 2 abschließen');
    const row = exercise('Einarmiges Kurzhantelrudern');
    expect(await row.findByRole('status')).toHaveTextContent(
      'Weiter mit Einarmiges Kurzhantelrudern',
    );
    expect(row.getByText('Übung 2 von 2')).toBeInTheDocument();
    expect(row.getByLabelText('Satz 1: Gewicht')).toHaveValue('30');

    // The last set of the workout: a clear end with finishing or one more set.
    await complete('Satz 1 abschließen');
    expect(await row.findByText('Alle Sätze sind erledigt.')).toBeInTheDocument();
    await userEvent.click(row.getByRole('button', { name: 'Training jetzt beenden' }));
    expect(await screen.findByRole('dialog', { name: 'Training beenden?' })).toHaveTextContent(
      '3 Sätze abgeschlossen',
    );
    await userEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }));
    await closedDialog();
    await userEvent.click(row.getByRole('button', { name: 'Satz hinzufügen' }));
    expect(await row.findByLabelText('Satz 2: Gewicht')).toHaveValue('30');
    expect(currentSet()).toHaveAccessibleName('Satz 2: 30 kg × 10, offen');
  });

  it('free navigation between exercises and sets; entries never move between sets', async () => {
    const { db } = await startedPush();
    await userEvent.click(screen.getByRole('button', { name: 'Nächste Übung' }));
    const row = exercise('Einarmiges Kurzhantelrudern');
    expect(row.getByLabelText('Satz 1: Gewicht')).toHaveValue('30');
    // After its only set the focus moves on to the exercise that still has open sets.
    await complete('Satz 1 abschließen');
    expect(await exercise('Langhantel-Bankdrücken').findByRole('status')).toHaveTextContent(
      'Weiter mit Langhantel-Bankdrücken',
    );
    // Going back to the finished exercise shows it as done, with a way on.
    await userEvent.click(screen.getByRole('button', { name: 'Nächste Übung' }));
    const done = exercise('Einarmiges Kurzhantelrudern');
    expect(done.getByText('Alle Sätze dieser Übung sind erledigt.')).toBeInTheDocument();
    expect(done.getByRole('button', { name: 'Satz 1: 30 kg × 10, abgeschlossen' })).toBeVisible();
    await userEvent.click(done.getByRole('button', { name: 'Weiter mit Langhantel-Bankdrücken' }));
    const bench = exercise('Langhantel-Bankdrücken');
    expect(bench.getByLabelText('Satz 1: Gewicht')).toHaveValue('80');

    // Typing in set 1, then choosing set 2: set 1 keeps its entry, set 2 shows its own.
    await userEvent.clear(bench.getByLabelText('Satz 1: Gewicht'));
    await userEvent.type(bench.getByLabelText('Satz 1: Gewicht'), '99');
    await userEvent.click(bench.getByRole('button', { name: 'Satz 2: 80 kg × 8, offen' }));
    expect(bench.getByLabelText('Satz 2: Gewicht')).toHaveValue('80');
    expect(bench.queryByLabelText('Satz 1: Gewicht')).not.toBeInTheDocument();
    await waitFor(async () => {
      expect((await setRows(db)).map((r) => r.weight_kg)).toEqual([99, 80, 30]);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Vorherige Übung' }));
    expect(screen.getByRole('button', { name: 'Vorherige Übung' })).toBeDisabled();
  });

  it('a completed set can be chosen, corrected and reopened – reopening starts no timer', async () => {
    const { db } = await startedPush();
    const bench = exercise('Langhantel-Bankdrücken');
    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 abschließen' }));
    const timer = within(await screen.findByRole('timer'));
    await userEvent.click(timer.getByRole('button', { name: 'Überspringen' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    await userEvent.click(
      await bench.findByRole('button', { name: 'Satz 1: 80 kg × 8, abgeschlossen' }),
    );
    expect(bench.getByText('Abgeschlossen')).toBeInTheDocument();
    // Corrected values stay completed.
    await userEvent.click(bench.getByRole('button', { name: 'Wdh. um 1 verringern' }));
    await bench.findByRole('button', { name: 'Satz 1: 80 kg × 7, abgeschlossen' });
    expect((await setRows(db))[0]).toMatchObject({ reps: 7, completed: 1 });

    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 wieder öffnen' }));
    expect(await bench.findByRole('button', { name: 'Satz 1 abschließen' })).toBeInTheDocument();
    expect(currentSet()).toHaveAccessibleName('Satz 1: 80 kg × 7, offen');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect((await setRows(db))[0]?.completed).toBe(0);
  });

  it('the full list is one tap away, shares the same workout and keeps typed values', async () => {
    const { db } = await startedPush();
    // Typed in the focus view without leaving the field, then the view is switched.
    await userEvent.clear(screen.getByLabelText('Satz 1: Gewicht'));
    await userEvent.type(screen.getByLabelText('Satz 1: Gewicht'), '85');
    await userEvent.click(screen.getByRole('radio', { name: 'Alle Übungen' }));
    const bench = within(await screen.findByRole('article', { name: 'Langhantel-Bankdrücken' }));
    expect(
      screen.getByRole('article', { name: 'Einarmiges Kurzhantelrudern' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(bench.getByLabelText('Satz 1: Gewicht')).toHaveValue('85');
    });
    // Changed and completed in the list ...
    await userEvent.clear(bench.getByLabelText('Satz 2: Wdh.'));
    await userEvent.type(bench.getByLabelText('Satz 2: Wdh.'), '6');
    await userEvent.click(bench.getByRole('button', { name: 'Satz 1 abschließen' }));
    await bench.findByRole('button', { name: 'Satz 1 wieder öffnen' });
    // ... and back in focus: an exercise opens from its name.
    await userEvent.click(
      screen.getByRole('button', { name: 'Einarmiges Kurzhantelrudern im Fokus öffnen' }),
    );
    expect(screen.getByRole('radio', { name: 'Fokus' })).toHaveAttribute('aria-checked', 'true');
    expect(exercise('Einarmiges Kurzhantelrudern').getByText('Übung 2 von 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Vorherige Übung' }));
    const focus = exercise('Langhantel-Bankdrücken');
    expect(focus.getByRole('button', { name: 'Satz 1: 85 kg × 8, abgeschlossen' })).toBeVisible();
    expect(currentSet()).toHaveAccessibleName('Satz 2: 80 kg × 6, offen');
    expect((await setRows(db)).slice(0, 2)).toEqual([
      expect.objectContaining({ weight_kg: 85, reps: 8, completed: 1 }),
      expect.objectContaining({ weight_kg: 80, reps: 6, completed: 0 }),
    ]);
  });

  it('replacing an exercise in focus: fresh values of the new exercise, the plan stays', async () => {
    const { services, profileId } = await startedPush();
    const bench = exercise('Langhantel-Bankdrücken');
    await userEvent.clear(bench.getByLabelText('Satz 1: Gewicht'));
    await userEvent.type(bench.getByLabelText('Satz 1: Gewicht'), '95');
    await userEvent.click(bench.getByRole('button', { name: 'Übung ersetzen' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Übung ersetzen' }));
    await userEvent.type(picker.getByRole('searchbox'), 'kurzhantel bank');
    await userEvent.click(picker.getByRole('button', { name: /^Kurzhantel-Bankdrücken/ }));
    await closedDialog();
    const replaced = within(await screen.findByRole('article', { name: 'Kurzhantel-Bankdrücken' }));
    // No history of the new exercise: no load is carried over, the planned reps stay.
    await waitFor(() => {
      expect(replaced.getByLabelText('Satz 1: Gewicht')).toHaveValue('');
    });
    expect(replaced.getByLabelText('Satz 1: Wdh.')).toHaveValue('8');
    expect(replaced.queryByRole('region', { name: 'Werte vom letzten Training' })).toBeNull();
    const [stored] = await services.training.plans.listPlans(profileId);
    const planned = await services.training.plans.getPlan(profileId, stored?.id ?? '');
    expect(planned.days[0]?.exercises.map((e) => e.exerciseId)).toEqual([
      'sys.bench-press',
      'sys.dumbbell-row',
    ]);
  });

  it('back and resume keep the workout and the running rest', async () => {
    const { router } = await startedPush({ rest: 90 });
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    expect(await screen.findByRole('timer')).toHaveTextContent('1:30');
    vi.setSystemTime(new Date(NOW.getTime() + 20_000));
    await act(() => router.navigate('/training'));
    expect(await screen.findByRole('button', { name: 'Fortsetzen' })).toBeInTheDocument();
    vi.setSystemTime(new Date(NOW.getTime() + 30_000));
    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }));
    // The rest went on while the workout was closed.
    expect(await screen.findByRole('timer')).toHaveTextContent('1:00');
    expect(currentSet()).toHaveAccessibleName('Satz 2: 80 kg × 8, offen');
    // It still ends with the notice.
    vi.setSystemTime(new Date(NOW.getTime() + 95_000));
    expect(await screen.findByText('Pause vorbei')).toBeInTheDocument();
  });

  it('finishing removes the open pre-filled sets; the finished workout is edited as a list', async () => {
    const { db } = await startedPush();
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    await screen.findByRole('button', { name: 'Satz 1: 80 kg × 8, abgeschlossen' });
    await userEvent.click(screen.getByRole('button', { name: 'Training beenden' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training beenden' }));
    const summary = within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
    expect(summary.getByText('1 Satz · bester Satz 80 kg × 8')).toBeInTheDocument();
    await userEvent.click(summary.getByRole('button', { name: 'Training ansehen' }));
    await closedDialog();
    const rows = await db.query<{ completed: number }>(
      `SELECT s.completed FROM workout_sets s JOIN workout_exercises we
       ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id
       WHERE w.started_at = ?`,
      [NOW.toISOString()],
    );
    expect(rows).toEqual([{ completed: 1 }]);
    expect(screen.getAllByText('80 kg × 8')).toHaveLength(1);

    // Editing a finished workout: the full list as before, no focus view, no timer.
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    const bench = within(screen.getByRole('article', { name: 'Langhantel-Bankdrücken' }));
    expect(bench.getByRole('button', { name: 'Satz 1 wieder öffnen' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Fokus' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /im Fokus öffnen/ })).not.toBeInTheDocument();
  });
});
