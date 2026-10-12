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

  it("opens the large view: the profile's body, legend as text, closing returns", async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    await userEvent.click(await dialog().findByRole('button', { name: 'Muskelkarte vergrößern' }));

    const large = within(await screen.findByRole('dialog', { name: 'Langhantel-Bankdrücken' }));
    const image = large.getByRole('img');
    expect(image).toHaveAccessibleName(
      'Muskelkarte, Vorder- und Rückansicht. Primär: Brust. Sekundär: Schultern, Trizeps.',
    );
    expect(image).toHaveAttribute('data-variant', 'male');
    expect(large.getByText('Primär').nextElementSibling).toHaveTextContent('Brust');
    expect(large.getByText('Sekundär').nextElementSibling).toHaveTextContent('Schultern, Trizeps');
    // The body comes from the profile only: no switch, no second setting (Phase 23).
    expect(large.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(large.queryByRole('radio')).not.toBeInTheDocument();
    expect(large.queryByText(/Körperdarstellung|Weiblich|Männlich/)).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Details' })).toBeInTheDocument();
    expect(dialog().getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeInTheDocument();
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

  it.each([
    ['male', 'male'],
    ['female', 'female'],
    // "Divers / keine Angabe": the male body is the fixed fallback.
    ['unspecified', 'male'],
    // No value in the profile: the same fallback, nothing breaks.
    [null, 'male'],
  ] as const)('profile "%s" shows the %s body – small and large map', async (sex, body) => {
    await renderApp('/settings/content/exercises', {
      prepare: async (services) => {
        const profile = await services.profile.ensureLocalProfile();
        await services.profile.updateBodyData(profile, {
          sex,
          birthDate: null,
          heightCm: null,
        });
      },
    });
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    const small = map(await waitForMap());
    expect(small).toHaveAttribute('data-variant', body);
    const smallLevels = levels(small);
    await userEvent.click(dialog().getByRole('button', { name: 'Muskelkarte vergrößern' }));
    const large = within(await screen.findByRole('dialog', { name: 'Langhantel-Bankdrücken' }));
    const image = large.getByRole('img');
    expect(image).toHaveAttribute('data-variant', body);
    expect(large.queryByRole('radio')).not.toBeInTheDocument();
    // Same muscles, front and back, on every body.
    expect(levels(image)).toEqual(smallLevels);
    expect(image.querySelector('[data-view="front"] [data-level="primary"]')).not.toBeNull();
    expect(image.querySelector('[data-view="back"] [data-level]')).not.toBeNull();
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
    expect(large.queryByRole('radiogroup')).not.toBeInTheDocument();
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

  /** A finished workout of [exercise, done] entries (one set each, 60 kg × 8). */
  async function finished(
    services: AppServices,
    profileId: string,
    entries: readonly (readonly [string, boolean])[],
  ): Promise<string> {
    const workouts = services.training.workouts;
    await services.training.exercises.ensureCatalog();
    const workout = await workouts.startFree(profileId);
    for (const [exerciseId, done] of entries) {
      const entryId = await workouts.addExercise(profileId, workout.id, exerciseId);
      const detail = await workouts.getDetail(profileId, workout.id);
      const set = detail.exercises.find((e) => e.id === entryId)?.sets[0];
      if (!set) throw new Error('set expected');
      await workouts.updateSet(
        profileId,
        set.id,
        { ...EMPTY_SET_VALUES, weightKg: 60, reps: 8 },
        done,
      );
    }
    await workouts.finish(profileId, workout.id);
    return workout.id;
  }

  it('lets primary win over secondary and marks each muscle once per view', async () => {
    const summary = await openSummary((services, profileId) =>
      finished(services, profileId, [
        // Shoulders secondary here …
        ['sys.bench-press', true],
        // … primary here; the bench press a second time adds nothing twice.
        ['sys.overhead-press', true],
        ['sys.bench-press', true],
      ]),
    );
    const muscles = within(await summary.findByRole('region', { name: 'Beanspruchte Muskeln' }));
    expect(await muscles.findByText('Primär')).toBeInTheDocument();
    expect(muscles.getByText('Primär').nextElementSibling).toHaveTextContent('Brust, Schultern');
    expect(muscles.getByText('Sekundär').nextElementSibling).not.toHaveTextContent('Schultern');
    const drawing = map(muscles);
    await waitFor(() => {
      expect(levels(drawing)).toMatchObject({
        'pectoralis-major': 'primary',
        'deltoid-anterior': 'primary',
        'deltoid-lateral': 'primary',
        'deltoid-posterior': 'primary',
        'triceps-brachii': 'secondary',
      });
    });
    // Each region once per side in its view – merged, never drawn twice.
    for (const view of ['front', 'back']) {
      const marked = [
        ...drawing.querySelectorAll<SVGElement>(`[data-view="${view}"] [data-level]`),
      ].map((path) => `${path.dataset.region ?? ''}:${path.dataset.side ?? ''}`);
      expect(new Set(marked).size).toBe(marked.length);
    }
    // Front muscles in the front view, back muscles in the back view.
    expect(
      drawing.querySelector('[data-view="front"] [data-region="pectoralis-major"]'),
    ).toHaveAttribute('data-level', 'primary');
    expect(drawing.querySelector('[data-view="back"] [data-region="pectoralis-major"]')).toBeNull();
    expect(
      drawing.querySelector('[data-view="back"] [data-region="deltoid-posterior"]'),
    ).toHaveAttribute('data-level', 'primary');
  });

  it('is not blocked by an exercise without muscles – it simply adds none', async () => {
    let custom = '';
    const summary = await openSummary(async (services, profileId) => {
      const own = await services.training.exercises.create(profileId, {
        name: 'Eigene Übung',
        exerciseType: 'weighted',
        equipment: 'other',
        movementPattern: 'other',
        primaryMuscles: [],
      });
      custom = own.id;
      return finished(services, profileId, [
        [custom, true],
        ['sys.lat-pulldown', true],
      ]);
    });
    expect(custom).not.toBe('');
    expect(await summary.findByText('Eigene Übung')).toBeInTheDocument();
    const muscles = within(await summary.findByRole('region', { name: 'Beanspruchte Muskeln' }));
    await waitFor(() => {
      expect(levels(map(muscles))).toEqual({
        'latissimus-dorsi': 'primary',
        'biceps-brachii': 'secondary',
        trapezius: 'secondary',
        'erector-spinae': 'secondary',
      });
    });
  });

  it('shows the summary without a map when no done exercise has muscles', async () => {
    const summary = await openSummary(async (services, profileId) => {
      const own = await services.training.exercises.create(profileId, {
        name: 'Eigene Übung',
        exerciseType: 'weighted',
        equipment: 'other',
        movementPattern: 'other',
        primaryMuscles: [],
      });
      return finished(services, profileId, [[own.id, true]]);
    });
    expect(await summary.findByText('Eigene Übung')).toBeInTheDocument();
    expect(summary.getByRole('button', { name: 'Training ansehen' })).toBeInTheDocument();
    expect(summary.queryByRole('region', { name: 'Beanspruchte Muskeln' })).not.toBeInTheDocument();
  });

  it('stores the workout once and leaves its data untouched – the map only reads', async () => {
    let id = '';
    let profile = '';
    const { services, router } = await renderApp('/training', {
      prepare: async (s, profileId) => {
        profile = profileId;
        id = await finished(s, profileId, [
          ['sys.bench-press', true],
          ['sys.back-squat', true],
        ]);
      },
    });
    const before = await services.training.workouts.getDetail(profile, id);
    await router.navigate(TRAINING_LINKS.workout(id), { state: { summary: true } });
    const summary = within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
    await summary.findByRole('region', { name: 'Beanspruchte Muskeln' });
    await userEvent.click(summary.getByRole('button', { name: 'Muskelkarte vergrößern' }));
    await userEvent.keyboard('{Escape}');
    await screen.findByRole('dialog', { name: 'Training abgeschlossen' });

    const today = '2026-10-03';
    expect(await services.training.workouts.dailyStatsBetween(profile, today, today)).toEqual([
      { localDate: today, workouts: 1, volumeKg: 960 },
    ]);
    expect(await services.training.workouts.getDetail(profile, id)).toEqual(before);
    expect(before.status).toBe('completed');
    expect(
      before.exercises.flatMap((exercise) =>
        exercise.sets.map((set) => [set.weightKg, set.reps, set.completed]),
      ),
    ).toEqual([
      [60, 8, true],
      [60, 8, true],
    ]);
  });
});
