import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

type Rendered = Awaited<ReturnType<typeof renderApp>>;

function tab(name: string) {
  return within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
    name,
  });
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closedDialog() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

async function setRows(db: Rendered['db']) {
  return db.query<{ weight_kg: number | null; reps: number | null; completed: number }>(
    'SELECT weight_kg, reps, completed FROM workout_sets ORDER BY position',
  );
}

async function pickExercise(search: string, name: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: 'Übung hinzufügen' }));
  await userEvent.type(dialog().getByRole('searchbox'), search);
  await userEvent.click(dialog().getByRole('button', { name }));
  await closedDialog();
}

/** Opens the start sheet and starts a free workout (the flow's first option). */
async function startFreeWorkout(labels = { start: 'Training starten', free: /^Freies Training/ }) {
  await userEvent.click(await screen.findByRole('button', { name: labels.start }));
  await userEvent.click(dialog().getByRole('button', { name: labels.free }));
  await closedDialog();
}

/** True when a field that would bring up the on-screen keyboard has focus. */
function textFieldFocused() {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && !['button', 'checkbox', 'radio'].includes(active.type))
  );
}

async function fill(label: string, value: string) {
  const input = await screen.findByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

describe('training', () => {
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

  it('starts empty and honest: no plans, no history, no next workout on the dashboard', async () => {
    await renderApp('/training');
    expect(await screen.findByRole('heading', { level: 1, name: 'Training' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Training starten' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Pläne/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Letzte Trainings' })).toBeInTheDocument();
    // Plans are created in the plan management, not on the start screen.
    expect(screen.queryByRole('button', { name: 'Neuer Plan' })).not.toBeInTheDocument();

    await userEvent.click(tab('Heute'));
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Nächstes Training')).not.toBeInTheDocument();
    expect(screen.queryByText('Laufendes Training')).not.toBeInTheDocument();
  });

  it('records a free strength workout from start to history', async () => {
    const { db, router } = await renderApp('/training');
    await startFreeWorkout();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/training/workout');
    });

    await pickExercise('bank', /^Bankdrücken/);
    await fill('Satz 1: Gewicht', '80');
    await fill('Satz 1: Wdh.', '8');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));
    expect(await screen.findByRole('button', { name: 'Satz 1 wieder öffnen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Satz hinzufügen' }));
    // The new set copies the previous load and reps.
    expect(await screen.findByLabelText('Satz 2: Gewicht')).toHaveValue('80');
    await fill('Satz 2: Wdh.', '6');
    await userEvent.click(screen.getByRole('button', { name: 'Satz 2 abschließen' }));
    await screen.findByRole('button', { name: 'Satz 2 wieder öffnen' });

    await userEvent.click(screen.getByRole('button', { name: 'Training beenden' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training beenden' }));

    // 80 × 8 + 80 × 6
    expect(await screen.findByText('1.120 kg')).toBeInTheDocument();
    expect(await setRows(db)).toEqual([
      { weight_kg: 80, reps: 8, completed: 1 },
      { weight_kg: 80, reps: 6, completed: 1 },
    ]);

    await userEvent.click(tab('Training'));
    const history = await screen.findByRole('link', { name: /Krafttraining.*Heute/ });
    await userEvent.click(history);
    expect(await screen.findByText('80 kg × 6')).toBeInTheDocument();
  });

  it('keeps a set open when required values are missing', async () => {
    const { db } = await renderApp('/training');
    await startFreeWorkout();
    await pickExercise('kreuz', /^Kreuzheben/);
    await fill('Satz 1: Gewicht', '120');
    await userEvent.clear(screen.getByLabelText('Satz 1: Wdh.'));
    await userEvent.click(screen.getByRole('button', { name: 'Satz 1 abschließen' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Satz 1: Wdh.')).toHaveAttribute('aria-invalid', 'true');
    expect((await setRows(db))[0]?.completed).toBe(0);
  });

  it('restores an active workout after a restart', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        const workout = await services.training.workouts.startFree(profileId);
        await services.training.workouts.addExercise(profileId, workout.id, 'sys.back-squat');
      },
    });
    expect(await screen.findByText('Laufendes Training')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(await screen.findByRole('heading', { name: 'Kniebeugen' })).toBeInTheDocument();
  });

  it('builds a plan and starts the next workout from it', async () => {
    const { router } = await renderApp('/training');
    await userEvent.click(await screen.findByRole('link', { name: /^Pläne/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Neuer Plan' }));
    await userEvent.type(dialog().getByLabelText('Name des Plans'), 'Push/Pull/Legs');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Push/Pull/Legs' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Trainingstag hinzufügen' }));
    await userEvent.type(dialog().getByLabelText('Name des Trainingstags'), 'Push A');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closedDialog();
    await pickExercise('bank', /^Bankdrücken/);
    await pickExercise('schulter', /^Schulterdrücken/);
    await pickExercise('trizeps', /^Trizepsdrücken am Kabel/);
    // Several exercises in a row, all kept in order.
    const day = within(screen.getByRole('region', { name: 'Push A' }));
    expect(day.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Bankdrücken'),
      expect.stringContaining('Schulterdrücken'),
      expect.stringContaining('Trizepsdrücken am Kabel'),
    ]);

    // The dashboard now suggests the plan day – and only now.
    await userEvent.click(tab('Heute'));
    expect(await screen.findByText('Nächstes Training')).toBeInTheDocument();

    await userEvent.click(tab('Training'));
    await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Aus Plan starten/ }));
    const pushA = await dialog().findByRole('button', { name: /^Push A/ });
    expect(pushA).toHaveTextContent('Als Nächstes');
    await userEvent.click(pushA);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/training/workout');
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Push A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bankdrücken' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Schulterdrücken' })).toBeInTheDocument();
  });

  it('works in English with pounds and the dark theme', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const { db } = await renderApp('/training', {
      prepare: async (services) => {
        await services.settings.update('weightUnit', 'lb');
        await services.settings.update('theme', 'dark');
      },
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    await startFreeWorkout({ start: 'Start workout', free: /^Free workout/ });
    await userEvent.click(await screen.findByRole('button', { name: 'Add exercise' }));
    await userEvent.type(dialog().getByRole('searchbox'), 'bench');
    await userEvent.click(dialog().getByRole('button', { name: /^Bench Press/ }));
    await closedDialog();

    await fill('Set 1: Weight', '225');
    await fill('Set 1: Reps', '5');
    await userEvent.click(screen.getByRole('button', { name: 'Complete set 1' }));
    await screen.findByRole('button', { name: 'Reopen set 1' });

    // Stored in kilograms, shown in pounds.
    const [set] = await setRows(db);
    expect(set?.weight_kg).toBeCloseTo(102.058, 3);
    expect(screen.getByLabelText('Set 1: Weight')).toHaveValue('225');
  });

  describe('start flow', () => {
    it('offers exactly a free workout and starting from a plan – no plan creation', async () => {
      await renderApp('/training');
      await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
      const options = dialog().getAllByRole('button');
      expect(options.map((option) => option.textContent)).toEqual([
        expect.stringMatching(/^Freies Training/),
        expect.stringMatching(/^Aus Plan starten/),
      ]);
      expect(screen.queryByText(/Neuer Plan|Plan erstellen/)).not.toBeInTheDocument();

      await userEvent.click(dialog().getByRole('button', { name: /^Aus Plan starten/ }));
      expect(screen.queryByText(/Neuer Plan|Plan erstellen/)).not.toBeInTheDocument();
    });

    it('shows an empty state without plans and leads to the plan management', async () => {
      const { router } = await renderApp('/training');
      await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
      await userEvent.click(dialog().getByRole('button', { name: /^Aus Plan starten/ }));

      expect(await dialog().findByText('Noch kein Trainingsplan vorhanden.')).toBeInTheDocument();
      expect(dialog().queryByRole('list')).not.toBeInTheDocument();
      await userEvent.click(dialog().getByRole('button', { name: 'Zu Plänen' }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/training/plans');
      });
      expect(await screen.findByRole('heading', { level: 1, name: 'Pläne' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Neuer Plan' })).toBeInTheDocument();
    });

    it('keeps existing workouts and plans when using the new flow', async () => {
      await renderApp('/training', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          const plan = await services.training.plans.createPlan(profileId, 'Ganzkörper');
          const day = await services.training.plans.addDay(profileId, plan.id, 'Tag A');
          await services.training.plans.addExercise(profileId, day, 'sys.back-squat');
          const workout = await services.training.workouts.startFromPlan(profileId, day);
          await services.training.workouts.finish(profileId, workout.id);
        },
      });
      expect(await screen.findByRole('link', { name: /Tag A.*Heute/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Pläne.*1 Plan/ })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Training starten' }));
      await userEvent.click(dialog().getByRole('button', { name: /^Aus Plan starten/ }));
      expect(await dialog().findByRole('button', { name: /^Tag A/ })).toBeEnabled();
    });
  });

  describe('keyboard and focus', () => {
    it('completes a set without focusing a text field and keeps the values', async () => {
      const { db } = await renderApp('/training');
      await startFreeWorkout();
      await pickExercise('bank', /^Bankdrücken/);
      await fill('Satz 1: Gewicht', '82,5');
      await fill('Satz 1: Wdh.', '5');
      // The reps field still has focus (keyboard open) when the check is tapped.
      expect(textFieldFocused()).toBe(true);

      const check = screen.getByRole('button', { name: 'Satz 1 abschließen' });
      await userEvent.click(check);

      await screen.findByRole('button', { name: 'Satz 1 wieder öffnen' });
      expect(textFieldFocused()).toBe(false);
      expect(screen.getByLabelText('Satz 1: Gewicht')).toHaveValue('82,5');
      expect(screen.getByLabelText('Satz 1: Wdh.')).toHaveValue('5');
      expect(await setRows(db)).toEqual([{ weight_kg: 82.5, reps: 5, completed: 1 }]);

      // Reopening does not focus a field either.
      await userEvent.click(screen.getByRole('button', { name: 'Satz 1 wieder öffnen' }));
      await screen.findByRole('button', { name: 'Satz 1 abschließen' });
      expect(textFieldFocused()).toBe(false);
      expect(screen.getByRole('heading', { level: 1, name: 'Krafttraining' })).toBeInTheDocument();
    });

    it('opens the exercise picker without the keyboard and lists every active exercise', async () => {
      const { services } = await renderApp('/training');
      await startFreeWorkout();
      await userEvent.click(await screen.findByRole('button', { name: 'Übung hinzufügen' }));

      expect(textFieldFocused()).toBe(false);
      const profileId = (await services.profile.ensureLocalProfile()).id;
      const active = await services.training.exercises.list(profileId);
      const rows = within(dialog().getByRole('list', { name: 'Übungen' })).getAllByRole('button');
      // One row per active exercise plus "create exercise".
      expect(rows).toHaveLength(active.length + 1);
      expect(active.length).toBeGreaterThan(8);
    });

    it('does not carry an open keyboard from a name prompt into the picker', async () => {
      await renderApp('/training');
      await userEvent.click(await screen.findByRole('link', { name: /^Pläne/ }));
      await userEvent.click(await screen.findByRole('button', { name: 'Neuer Plan' }));
      // Naming is real text entry: the field gets focus on its own.
      expect(dialog().getByLabelText('Name des Plans')).toHaveFocus();
      await userEvent.type(dialog().getByLabelText('Name des Plans'), 'Oberkörper');
      await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
      await screen.findByRole('heading', { level: 1, name: 'Oberkörper' });

      await userEvent.click(screen.getByRole('button', { name: 'Trainingstag hinzufügen' }));
      await userEvent.type(dialog().getByLabelText('Name des Trainingstags'), 'Tag A');
      await userEvent.keyboard('{Enter}');
      await closedDialog();
      expect(textFieldFocused()).toBe(false);

      for (const [search, name] of [
        ['bank', /^Bankdrücken/],
        ['kreuz', /^Kreuzheben/],
        ['klimm', /^Klimmzüge/],
      ] as const) {
        await userEvent.click(screen.getByRole('button', { name: 'Übung hinzufügen' }));
        expect(textFieldFocused()).toBe(false);
        await userEvent.type(dialog().getByRole('searchbox'), search);
        await userEvent.click(dialog().getByRole('button', { name }));
        await closedDialog();
        // Closing the picker never re-focuses a text field.
        expect(textFieldFocused()).toBe(false);
      }
      const day = within(screen.getByRole('region', { name: 'Tag A' }));
      expect(day.getAllByRole('listitem')).toHaveLength(3);
    });
  });
});
