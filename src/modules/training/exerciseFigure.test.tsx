import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { TRAINING_LINKS } from '@/app/routes';
import { EMPTY_SET_VALUES, type MuscleHighlight } from '@/core/training';
import { renderApp } from '@/test/renderApp';

/**
 * 3D exercise visuals (prototype). jsdom has no WebGL, so the environment and the three.js
 * renderer are replaced by fakes that record what the UI asks of them.
 */
const fake = vi.hoisted(() => {
  interface FakeRenderer {
    options: { pose: string; highlight: MuscleHighlight; pair: boolean; quality: string };
    playing: boolean[];
    yaws: { yaw: number; smooth: boolean }[];
    rotations: number[];
    disposed: boolean;
  }
  return {
    webgl: true,
    reducedMotion: false,
    renderers: [] as FakeRenderer[],
  };
});

vi.mock('./figure/environment', () => ({
  supportsWebGL: () => fake.webgl,
  prefersReducedMotion: () => fake.reducedMotion,
  readFigurePalette: () => ({
    body: '#d9d3c9',
    shirt: '#4b544e',
    shorts: '#353c38',
    shoe: '#2c312e',
    equipment: '#bdbab1',
    metal: '#8f8d87',
    accent: '#557a5b',
    shadow: '#1b1f1c',
  }),
}));

vi.mock('./figure/figureRenderer', () => {
  return {
    createFigureRenderer: (
      _canvas: HTMLCanvasElement,
      options: (typeof fake.renderers)[0]['options'],
    ) => {
      let yaw = 0;
      const record = {
        options,
        playing: [] as boolean[],
        yaws: [] as { yaw: number; smooth: boolean }[],
        rotations: [] as number[],
        disposed: false,
      };
      fake.renderers.push(record);
      return {
        setPlaying: (playing: boolean) => record.playing.push(playing),
        setYaw: (next: number, smooth: boolean) => {
          yaw = next;
          record.yaws.push({ yaw: next, smooth });
        },
        rotateBy: (delta: number) => {
          yaw += delta;
          record.rotations.push(delta);
        },
        yaw: () => yaw,
        setPalette: () => undefined,
        resize: () => undefined,
        dispose: () => {
          record.disposed = true;
        },
      };
    },
  };
});

const NOW = new Date(2026, 9, 3, 10);
const dialog = () => within(screen.getByRole('dialog'));
const latest = () => {
  const renderer = fake.renderers.at(-1);
  if (!renderer) throw new Error('no renderer');
  return renderer;
};

async function openDetails(search: string, row: RegExp) {
  await userEvent.type(await screen.findByRole('searchbox'), search);
  await userEvent.click(screen.getByRole('button', { name: row }));
}

describe('3D exercise visuals', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
    fake.webgl = true;
    fake.reducedMotion = false;
    fake.renderers.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a small, still figure beside the facts – muscles from the exercise data', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    const open = await dialog().findByRole('button', { name: '3D-Ansicht öffnen' });
    expect(open).toBeVisible();
    await waitFor(() => {
      expect(fake.renderers).toHaveLength(1);
    });
    expect(latest().options).toMatchObject({
      pose: 'benchPress',
      quality: 'small',
      pair: false,
      // From the catalog: chest primary; triceps and shoulders secondary.
      highlight: { chest: 'primary', triceps: 'secondary', shoulders: 'secondary' },
    });
    // Still in the small view: the motion never starts there.
    expect(latest().playing).not.toContain(true);
    // The facts stay complete next to the figure.
    expect(dialog().getByText('Brust')).toBeInTheDocument();
    expect(dialog().getByText('Trizeps, Schultern')).toBeInTheDocument();
  });

  it('shows the back first for the lat pulldown', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('latzug', /^LatzugKabelzug/);
    await dialog().findByRole('button', { name: '3D-Ansicht öffnen' });
    await waitFor(() => {
      expect(latest().yaws[0]).toEqual({ yaw: Math.PI, smooth: false });
    });
    expect(latest().options.highlight).toEqual({
      lats: 'primary',
      biceps: 'secondary',
      back: 'secondary',
    });
  });

  it('keeps exercises without a 3D visual exactly as before', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('liegestütze', /^LiegestützeKörpergewicht/);
    expect(await dialog().findByText('Brust')).toBeInTheDocument();
    expect(dialog().queryByRole('button', { name: '3D-Ansicht öffnen' })).not.toBeInTheDocument();
    expect(fake.renderers).toHaveLength(0);
  });

  it('shows no figure without WebGL – and nothing breaks', async () => {
    fake.webgl = false;
    await renderApp('/settings/content/exercises');
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    expect(await dialog().findByText('Trizeps, Schultern')).toBeInTheDocument();
    expect(dialog().queryByRole('button', { name: '3D-Ansicht öffnen' })).not.toBeInTheDocument();
    expect(fake.renderers).toHaveLength(0);
  });

  it('opens the large view: motion plays and pauses, the figure turns, closing returns', async () => {
    await renderApp('/settings/content/exercises');
    await openDetails('langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
    await userEvent.click(await dialog().findByRole('button', { name: '3D-Ansicht öffnen' }));

    const large = within(await screen.findByRole('dialog', { name: 'Langhantel-Bankdrücken' }));
    expect(large.getByRole('img')).toHaveAccessibleName(
      // Groups in the fixed order of the figure (top to bottom), as in the workout summary.
      'Figur mit hervorgehobenen Muskelgruppen. Primär: Brust. Sekundär: Schultern, Trizeps.',
    );
    expect(large.getByText('Primär').nextElementSibling).toHaveTextContent('Brust');
    await waitFor(() => {
      expect(latest().options.quality).toBe('large');
    });
    // The small figure was replaced, not kept running underneath.
    expect(fake.renderers[0]?.disposed).toBe(true);
    // The loop starts on its own …
    await waitFor(() => {
      expect(latest().playing.at(-1)).toBe(true);
    });
    // … and can be paused and started again.
    await userEvent.click(large.getByRole('button', { name: 'Animation anhalten' }));
    expect(latest().playing.at(-1)).toBe(false);
    await userEvent.click(large.getByRole('button', { name: 'Animation abspielen' }));
    expect(latest().playing.at(-1)).toBe(true);

    // Turning: to the back and front again, smoothly; and by dragging.
    await userEvent.click(large.getByRole('button', { name: 'Rückseite zeigen' }));
    expect(latest().yaws.at(-1)).toEqual({ yaw: Math.PI, smooth: true });
    await userEvent.click(large.getByRole('button', { name: 'Vorderseite zeigen' }));
    // Front again – turning on in the same direction (0 or 2π are the same view).
    expect(latest().yaws.at(-1)?.smooth).toBe(true);
    expect(Math.cos(latest().yaws.at(-1)?.yaw ?? Math.PI)).toBeCloseTo(1, 10);
    const canvas = screen.getByTestId('figure-canvas');
    fireEvent.pointerDown(canvas, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 190, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(latest().rotations).toEqual([1]);

    // Closing returns to the details, with the performance still there.
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Details' })).toBeInTheDocument();
    expect(dialog().getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeInTheDocument();
    expect(fake.renderers.find((r) => r.options.quality === 'large')?.disposed).toBe(true);
  });

  it('with reduced motion nothing plays on its own, the figure turns without animation', async () => {
    fake.reducedMotion = true;
    await renderApp('/settings/content/exercises');
    await openDetails('latzug', /^LatzugKabelzug/);
    await userEvent.click(await dialog().findByRole('button', { name: '3D-Ansicht öffnen' }));
    const large = within(await screen.findByRole('dialog', { name: 'Latzug' }));
    await waitFor(() => {
      expect(latest().options.quality).toBe('large');
    });
    expect(latest().playing).not.toContain(true);
    expect(large.getByRole('button', { name: 'Animation abspielen' })).toBeInTheDocument();
    await userEvent.click(large.getByRole('button', { name: 'Vorderseite zeigen' }));
    // Half a turn either way round is the front again; without animation.
    const turn = latest().yaws.at(-1);
    expect(turn?.smooth).toBe(false);
    expect(Math.cos(turn?.yaw ?? Math.PI)).toBeCloseTo(1, 10);
    // Still possible on request.
    await userEvent.click(large.getByRole('button', { name: 'Animation abspielen' }));
    expect(latest().playing.at(-1)).toBe(true);
  });
});

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
    fake.webgl = true;
    fake.reducedMotion = false;
    fake.renderers.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openSummary() {
    let id = '';
    const { router } = await renderApp('/training', {
      prepare: async (services, profileId) => {
        id = await workoutWithExercises(services, profileId);
      },
    });
    await router.navigate(TRAINING_LINKS.workout(id), { state: { summary: true } });
    return within(await screen.findByRole('dialog', { name: 'Training abgeschlossen' }));
  }

  it('derives the muscles from the exercises actually done – a union, no score', async () => {
    const summary = await openSummary();
    const muscles = within(await summary.findByRole('region', { name: 'Beanspruchte Muskeln' }));
    // Bench press (chest | triceps, shoulders) + squat; the lat pulldown was not done.
    expect(await muscles.findByText('Primär')).toBeInTheDocument();
    const primary = muscles.getByText('Primär').nextElementSibling;
    expect(primary).toHaveTextContent(/^Brust, .*Quadrizeps/);
    expect(primary).not.toHaveTextContent('Latissimus');
    expect(muscles.getByText('Sekundär').nextElementSibling).toHaveTextContent(/Trizeps/);
    await waitFor(() => {
      expect(latest().options).toMatchObject({ pose: 'stand', pair: true, quality: 'small' });
    });
    expect(latest().options.highlight).toMatchObject({ chest: 'primary', quadriceps: 'primary' });
    expect(latest().options.highlight.lats).toBeUndefined();
  });

  it('opens the figure large and returns to the summary', async () => {
    const summary = await openSummary();
    await userEvent.click(await summary.findByRole('button', { name: '3D-Ansicht öffnen' }));
    const large = within(await screen.findByRole('dialog', { name: 'Beanspruchte Muskeln' }));
    // A picture of several exercises: no motion to play, but it turns.
    expect(large.queryByRole('button', { name: /Animation/ })).not.toBeInTheDocument();
    expect(large.getByRole('button', { name: 'Rückseite zeigen' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(
      await screen.findByRole('dialog', { name: 'Training abgeschlossen' }),
    ).toBeInTheDocument();
  });

  it('lists the muscles as text even without WebGL', async () => {
    fake.webgl = false;
    const summary = await openSummary();
    const muscles = within(await summary.findByRole('region', { name: 'Beanspruchte Muskeln' }));
    expect(await muscles.findByText('Primär')).toBeInTheDocument();
    expect(muscles.queryByRole('button', { name: '3D-Ansicht öffnen' })).not.toBeInTheDocument();
  });
});
