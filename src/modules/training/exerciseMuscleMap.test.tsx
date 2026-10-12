import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { TRAINING_LINKS } from '@/app/routes';
import { EMPTY_SET_VALUES } from '@/core/training';
import { closeTopOverlay } from '@/ui';
import { renderApp } from '@/test/renderApp';

/**
 * 2D muscle maps in the training views (replace the 3D figure there). The maps are plain inline
 * SVG, so the tests read the marked regions straight from the DOM.
 */
const NOW = new Date(2026, 9, 3, 10);
const dialog = () => within(screen.getByRole('dialog'));

async function openDetails(search: string, row: RegExp) {
  await userEvent.type(await screen.findByRole('searchbox'), search);
  await userEvent.click(screen.getByRole('button', { name: row }));
}

/** Region ids with a level in one map (both views), e.g. { "pectoralis-major": "primary" }. */
function levels(map: HTMLElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of map.querySelectorAll<SVGElement>('[data-region][data-level]')) {
    const region = path.dataset.region ?? '';
    const level = path.dataset.level ?? '';
    // Both sides of a region always carry the same level.
    if (region in result) expect(result[region]).toBe(level);
    result[region] = level;
  }
  return result;
}

const map = (container: { getByTestId: (id: string) => HTMLElement } = dialog()) =>
  container.getByTestId('muscle-map');

describe('muscle map in the exercise details', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows front and back with the muscles of the exercise data', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    const section = within(await dialog().findByRole('region', { name: 'Beanspruchte Muskeln' }));
    expect(section.getByRole('button', { name: 'Muskelkarte vergrößern' })).toBeVisible();
    const preview = map(section);
    // Default body without a stated sex; one drawing per side.
    expect(preview).toHaveAttribute('data-variant', 'male');
    expect(preview.querySelectorAll('svg')).toHaveLength(2);
    expect(preview.querySelector('[data-view="front"] svg')).toHaveAttribute('data-view', 'front');
    expect(preview.querySelector('[data-view="back"] svg')).toHaveAttribute('data-view', 'back');
    // Catalog: chest primary; triceps and shoulders secondary – nothing else lights up.
    expect(levels(preview)).toEqual({
      'pectoralis-major': 'primary',
      'triceps-brachii': 'secondary',
      'deltoid-anterior': 'secondary',
      'deltoid-lateral': 'secondary',
      'deltoid-posterior': 'secondary',
    });
    // The facts stay complete as text.
    expect(dialog().getByText('Brust')).toBeInTheDocument();
    expect(dialog().getByText('Trizeps, Schultern')).toBeInTheDocument();
  });

  it('shows a map for every exercise, not only the former 3D ones', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('liegestütze', /^LiegestützeKörpergewicht/);
    expect(levels(map(await waitForMap()))).toEqual({
      'pectoralis-major': 'primary',
      'triceps-brachii': 'secondary',
      'deltoid-anterior': 'secondary',
      'deltoid-lateral': 'secondary',
      'deltoid-posterior': 'secondary',
      'rectus-abdominis': 'secondary',
      'external-oblique': 'secondary',
    });
    // No WebGL canvas anywhere.
    expect(screen.queryByTestId('figure-canvas')).not.toBeInTheDocument();
  });

  it('marks the back group as a whole for the lat pulldown', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('latzug', /^LatzugKabelzug/);
    expect(levels(map(await waitForMap()))).toEqual({
      'latissimus-dorsi': 'primary',
      'biceps-brachii': 'secondary',
      trapezius: 'secondary',
      'erector-spinae': 'secondary',
    });
  });

  it('opens the large view: switch the body, legend as text, closing returns', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    await userEvent.click(await dialog().findByRole('button', { name: 'Muskelkarte vergrößern' }));

    const large = within(await screen.findByRole('dialog', { name: 'Langhantel-Bankdrücken' }));
    const image = large.getByRole('img');
    expect(image).toHaveAccessibleName(
      'Muskelkarte, Vorder- und Rückansicht. Primär: Brust. Sekundär: Schultern, Trizeps.',
    );
    expect(large.getByText('Primär').nextElementSibling).toHaveTextContent('Brust');
    expect(large.getByText('Sekundär').nextElementSibling).toHaveTextContent('Schultern, Trizeps');

    const body = large.getByRole('radiogroup', { name: 'Körperdarstellung' });
    expect(within(body).getByRole('radio', { name: 'Männlich' })).toBeChecked();
    const male = levels(image);
    await userEvent.click(within(body).getByRole('radio', { name: 'Weiblich' }));
    expect(within(body).getByRole('radio', { name: 'Weiblich' })).toBeChecked();
    const female = large.getByRole('img');
    expect(female).toHaveAttribute('data-variant', 'female');
    // Same muscle ids, same levels on both bodies.
    expect(levels(female)).toEqual(male);

    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Details' })).toBeInTheDocument();
    expect(dialog().getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeInTheDocument();
    // The switch is a view setting only: the small map shows the profile's body again.
    expect(map()).toHaveAttribute('data-variant', 'male');
  });

  it('closes the large view with the system back action', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('latzug', /^LatzugKabelzug/);
    await userEvent.click(await dialog().findByRole('button', { name: 'Muskelkarte vergrößern' }));
    await screen.findByRole('dialog', { name: 'Latzug' });
    expect(closeTopOverlay()).toBe(true);
    expect(await screen.findByRole('dialog', { name: 'Details' })).toBeInTheDocument();
  });

  it('starts with the body of the profile', async () => {
    await renderApp('/settings/content/exercises', {
      prepare: async (services) => {
        const profile = await services.profile.ensureLocalProfile();
        await services.profile.updateBodyData(profile, {
          sex: 'female',
          birthDate: null,
          heightCm: null,
        });
      },
    });
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    expect(map(await waitForMap())).toHaveAttribute('data-variant', 'female');
    await userEvent.click(dialog().getByRole('button', { name: 'Muskelkarte vergrößern' }));
    const large = within(await screen.findByRole('dialog', { name: 'Langhantel-Bankdrücken' }));
    expect(large.getByRole('radio', { name: 'Weiblich' })).toBeChecked();
  });
});

async function waitForMap() {
  return within(await dialog().findByRole('region', { name: 'Beanspruchte Muskeln' }));
}

/** A finished workout: bench press and squat done, lat pulldown added but never done. */
async function workoutWithExercises(services: AppServices, profileId: string): Promise<string> {
  const workouts = services.training.workouts;
  await services.training.exercises.ensureCatalog();
  const workout = await workouts.startFree(profileId);
  for (const [exerciseId, done] of [
    ['sys.bench-press', true],
    ['sys.lat-pulldown', false],
    ['sys.back-squat', true],
  ] as const) {
    await workouts.addExercise(profileId, workout.id, exerciseId);
    const detail = await workouts.getDetail(profileId, workout.id);
    const set = detail.exercises.find((e) => e.exerciseId === exerciseId)?.sets[0];
    if (!set) throw new Error('set expected');
    await workouts.updateSet(
      profileId,
      set.id,
      { ...EMPTY_SET_VALUES, weightKg: 60, reps: 8 },
      done,
    );
  }
  vi.setSystemTime(new Date(NOW.getTime() + 45 * 60_000));
  await workouts.finish(profileId, workout.id);
  vi.setSystemTime(NOW);
  return workout.id;
}

describe('workout summary: muscles worked', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openSummary(
    build: (services: AppServices, profileId: string) => Promise<string> = workoutWithExercises,
  ) {
    let id = '';
    const { router } = await renderApp('/training', {
      prepare: async (services, profileId) => {
        id = await build(services, profileId);
      },
    });
    await router.navigate(TRAINING_LINKS.workout(id), { state: { summary: true } });
    return within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
  }

  it('maps the muscles of the exercises actually done – a union, no score', async () => {
    const summary = await openSummary();
    const muscles = within(await summary.findByRole('region', { name: 'Beanspruchte Muskeln' }));
    // Bench press (chest | triceps, shoulders) + squat (quads, glutes | hamstrings, core);
    // the lat pulldown was not done.
    expect(await muscles.findByText('Primär')).toBeInTheDocument();
    const primary = muscles.getByText('Primär').nextElementSibling;
    expect(primary).toHaveTextContent(/^Brust, .*Quadrizeps/);
    expect(primary).not.toHaveTextContent('Latissimus');
    expect(muscles.getByText('Sekundär').nextElementSibling).toHaveTextContent(/Trizeps/);
    await waitFor(() => {
      expect(levels(map(muscles))).toMatchObject({
        'pectoralis-major': 'primary',
        'rectus-femoris': 'primary',
        'gluteus-maximus': 'primary',
        'biceps-femoris': 'secondary',
        'triceps-brachii': 'secondary',
      });
    });
    expect(levels(map(muscles))).not.toHaveProperty('latissimus-dorsi');
  });

  it('opens the map large and returns to the summary – by close and by system back', async () => {
    const summary = await openSummary();
    await userEvent.click(await summary.findByRole('button', { name: 'Muskelkarte vergrößern' }));
    const large = within(await screen.findByRole('dialog', { name: 'Beanspruchte Muskeln' }));
    expect(large.getByRole('radiogroup', { name: 'Körperdarstellung' })).toBeInTheDocument();
    expect(levels(large.getByRole('img'))).toMatchObject({ 'pectoralis-major': 'primary' });
    await userEvent.keyboard('{Escape}');
    const again = within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
    await userEvent.click(await again.findByRole('button', { name: 'Muskelkarte vergrößern' }));
    await screen.findByRole('dialog', { name: 'Beanspruchte Muskeln' });
    expect(closeTopOverlay()).toBe(true);
    expect(
      await screen.findByRole('dialog', { name: 'Training abgeschlossen' }),
    ).toBeInTheDocument();
  });

  it('shows no muscles when no set was completed', async () => {
    const summary = await openSummary(async (services, profileId) => {
      const workouts = services.training.workouts;
      await services.training.exercises.ensureCatalog();
      const workout = await workouts.startFree(profileId);
      await workouts.addExercise(profileId, workout.id, 'sys.bench-press');
      await workouts.finish(profileId, workout.id);
      return workout.id;
    });
    await summary.findByText('Langhantel-Bankdrücken');
    expect(summary.queryByRole('region', { name: 'Beanspruchte Muskeln' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('muscle-map')).not.toBeInTheDocument();
  });

  it('shows the muscles of a single done exercise', async () => {
    const summary = await openSummary(async (services, profileId) => {
      const workouts = services.training.workouts;
      await services.training.exercises.ensureCatalog();
      const workout = await workouts.startFree(profileId);
      await workouts.addExercise(profileId, workout.id, 'sys.lat-pulldown');
      const set = (await workouts.getDetail(profileId, workout.id)).exercises[0]?.sets[0];
      if (!set) throw new Error('set expected');
      await workouts.updateSet(
        profileId,
        set.id,
        { ...EMPTY_SET_VALUES, weightKg: 50, reps: 10 },
        true,
      );
      await workouts.finish(profileId, workout.id);
      return workout.id;
    });
    const muscles = within(await summary.findByRole('region', { name: 'Beanspruchte Muskeln' }));
    expect(await muscles.findByText('Latissimus')).toBeInTheDocument();
    expect(muscles.getByText('Sekundär').nextElementSibling).toHaveTextContent('Rücken, Bizeps');
    expect(levels(map(muscles))).toEqual({
      'latissimus-dorsi': 'primary',
      'biceps-brachii': 'secondary',
      trapezius: 'secondary',
      'erector-spinae': 'secondary',
    });
  });
});
