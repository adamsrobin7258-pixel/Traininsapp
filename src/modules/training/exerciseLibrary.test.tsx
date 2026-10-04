import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { EMPTY_SET_VALUES } from '@/core/training';
import { renderApp } from '@/test/renderApp';

const NOW = new Date(2026, 9, 3, 10);

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closedDialog() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

function textFieldFocused() {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && !['button', 'checkbox', 'radio'].includes(active.type))
  );
}

function resultNames() {
  return within(dialog().getByRole('list', { name: /^(Alle Übungen|Ergebnisse)$/ }))
    .getAllByRole('button')
    .map((row) => row.textContent);
}

/** A finished workout of one exercise on a day with the given working sets [kg, reps]. */
async function workoutOn(
  services: AppServices,
  profileId: string,
  day: Date,
  exerciseId: string,
  sets: [number, number][],
) {
  const workouts = services.training.workouts;
  vi.setSystemTime(day);
  const workout = await workouts.startFree(profileId);
  const exercise = await workouts.addExercise(profileId, workout.id, exerciseId);
  for (const [index, [weightKg, reps]] of sets.entries()) {
    const setId =
      index === 0
        ? (await workouts.getDetail(profileId, workout.id)).exercises[0]?.sets[0]?.id
        : await workouts.addSet(profileId, exercise, 'working');
    if (!setId) throw new Error('set expected');
    await workouts.updateSet(profileId, setId, { ...EMPTY_SET_VALUES, weightKg, reps }, true);
  }
  vi.setSystemTime(new Date(day.getTime() + 45 * 60_000));
  await workouts.finish(profileId, workout.id);
  vi.setSystemTime(NOW);
}

describe('exercise library', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openPicker() {
    await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Freies Training/ }));
    await closedDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Übung hinzufügen' }));
  }

  it('filters by muscle group and equipment without opening the keyboard', async () => {
    await renderApp('/training');
    await openPicker();
    expect(textFieldFocused()).toBe(false);

    const muscles = within(dialog().getByRole('group', { name: 'Nach Muskelgruppe filtern' }));
    const equipment = within(dialog().getByRole('group', { name: 'Nach Ausrüstung filtern' }));
    await userEvent.click(muscles.getByRole('button', { name: 'Brust' }));
    expect(muscles.getByRole('button', { name: 'Brust' })).toHaveAttribute('aria-pressed', 'true');
    // Tapping a chip never focuses the search field.
    expect(textFieldFocused()).toBe(false);
    const chest = resultNames();
    expect(chest.length).toBeGreaterThan(15);
    expect(chest).toEqual(expect.arrayContaining([expect.stringContaining('Brustpresse')]));

    await userEvent.click(equipment.getByRole('button', { name: 'Kurzhantel' }));
    const both = resultNames();
    expect(both.length).toBeGreaterThan(3);
    expect(both.length).toBeLessThan(chest.length);
    expect(both.every((name) => name.includes('Kurzhantel'))).toBe(true);

    await userEvent.type(dialog().getByRole('searchbox'), 'schräg');
    expect(resultNames().every((name) => /Schräg/i.test(name))).toBe(true);

    // Nothing found: a single tap resets search and filters.
    await userEvent.type(dialog().getByRole('searchbox'), 'xyz');
    expect(dialog().getByText('Keine passende Übung gefunden.')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(dialog().getByRole('searchbox')).toHaveValue('');
    expect(muscles.getByRole('button', { name: 'Alle Muskeln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('finds exercises by alias and adds them to the workout', async () => {
    await renderApp('/training');
    await openPicker();
    await userEvent.type(dialog().getByRole('searchbox'), 'RDL');
    expect(resultNames()[0]).toMatch(/^Rumänisches Kreuzheben/);
    await userEvent.click(
      dialog().getByRole('button', { name: /^Rumänisches KreuzhebenLanghantel/ }),
    );
    await closedDialog();
    expect(
      await screen.findByRole('article', { name: 'Rumänisches Kreuzheben' }),
    ).toBeInTheDocument();
  });

  it('marks favourites in the library and lists them first in the picker', async () => {
    await renderApp('/settings/content/exercises');
    await userEvent.type(await screen.findByRole('searchbox'), 'face pull');
    await userEvent.click(screen.getByRole('button', { name: /^Face PullsKabelzug/ }));

    // Detail view: names, muscles, equipment, description – no images.
    expect(dialog().getByRole('heading', { name: 'Face Pulls' })).toBeInTheDocument();
    expect(dialog().getByText('Schultern')).toBeInTheDocument();
    expect(dialog().getByText('Rücken')).toBeInTheDocument();
    expect(dialog().getByText('Kabelzug')).toBeInTheDocument();
    expect(dialog().getByText(/Seil zum Gesicht/)).toBeInTheDocument();
    expect(dialog().queryByRole('img')).not.toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);

    await userEvent.click(dialog().getByRole('button', { name: 'Als Favorit markieren' }));
    expect(dialog().getByRole('button', { name: 'Favorit entfernen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.keyboard('{Escape}');
    await closedDialog();
    expect(
      await screen.findByRole('button', { name: /^Face PullsKabelzug.*Favorit$/ }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
        name: 'Training',
      }),
    );
    await openPicker();
    const favorites = within(await dialog().findByRole('list', { name: 'Favoriten' }));
    expect(favorites.getAllByRole('button').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Face Pulls/),
    ]);
  });

  it('shows library exercises as read-only and keeps own exercises editable', async () => {
    await renderApp('/settings/content/exercises');
    await userEvent.type(await screen.findByRole('searchbox'), 'latzug');
    await userEvent.click(screen.getByRole('button', { name: /^LatzugKabelzug/ }));
    expect(
      dialog().getByText(/Übung aus der Bibliothek\. Sie kann nicht bearbeitet werden/),
    ).toBeInTheDocument();
    expect(dialog().queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('shows best and latest performance of a weighted exercise in its details', async () => {
    await renderApp('/settings/content/exercises', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        await workoutOn(services, profileId, new Date(2026, 8, 20, 18), 'sys.bench-press', [
          [75, 8],
          [70, 10],
        ]);
        await workoutOn(services, profileId, new Date(2026, 9, 1, 18), 'sys.bench-press', [
          [80, 8],
        ]);
      },
    });
    await userEvent.type(await screen.findByRole('searchbox'), 'langhantel-bankdrücken');
    await userEvent.click(screen.getByRole('button', { name: /^Langhantel-Bankdrücken/ }));

    const performance = within(dialog().getByRole('region', { name: 'Deine Leistung' }));
    // Best = highest estimate of a completed working set: 80 × 8 ≈ 101,3 kg (Epley).
    expect(performance.getByText('Bestwert').nextElementSibling).toHaveTextContent(
      /^80 kg × 8≈ 101 kg geschätztes Maximum · 01\.10\.2026$/,
    );
    expect(performance.getByText('Zuletzt').nextElementSibling).toHaveTextContent(
      /80 kg × 8.*↑ Neuer Bestwert$/,
    );
    expect(performance.getByText(/Epley/)).toBeInTheDocument();
  });

  it('shows no performance for exercises without load or without history', async () => {
    await renderApp('/settings/content/exercises', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        await workoutOn(services, profileId, new Date(2026, 9, 1, 18), 'sys.push-up', [[0, 20]]);
      },
    });
    await userEvent.type(await screen.findByRole('searchbox'), 'liegestütze');
    await userEvent.click(screen.getByRole('button', { name: /^LiegestützeKörpergewicht/ }));
    expect(dialog().queryByRole('region', { name: 'Deine Leistung' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await closedDialog();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'langhantel-bankdrücken');
    await userEvent.click(screen.getByRole('button', { name: /^Langhantel-Bankdrücken/ }));
    expect(await dialog().findByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeVisible();
    expect(dialog().queryByRole('region', { name: 'Deine Leistung' })).not.toBeInTheDocument();
  });
});
