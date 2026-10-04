import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { summarizeTraining } from './progress';
import { EMPTY_SET_VALUES } from './sets';

// Saturday, 3 October 2026, 10:00 local time.
let now = new Date(2026, 9, 3, 10);
const clock = () => now;

async function setup() {
  now = new Date(2026, 9, 3, 10);
  const platform = new FakeHealthPlatform();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
    undefined,
    undefined,
    platform,
  );
  const profileId = (await services.profile.ensureLocalProfile()).id;
  await services.training.exercises.ensureCatalog();
  return { services, platform, profileId, workouts: services.training.workouts };
}

type Context = Awaited<ReturnType<typeof setup>>;

/** A workout on a day with the given sets of bench press: [kg, reps, completed, type]. */
async function workoutOn(
  { workouts, profileId }: Context,
  day: Date,
  sets: [number | null, number, boolean, ('working' | 'warmup')?][],
) {
  now = day;
  const workout = await workouts.startFree(profileId);
  const exercise = await workouts.addExercise(profileId, workout.id, 'sys.bench-press');
  let first = true;
  for (const [kg, reps, completed, type = 'working'] of sets) {
    const setId =
      first && type === 'working'
        ? (await workouts.getDetail(profileId, workout.id)).exercises[0]?.sets[0]?.id
        : await workouts.addSet(profileId, exercise, type);
    first = false;
    if (!setId) throw new Error('set expected');
    await workouts.updateSet(
      profileId,
      setId,
      { ...EMPTY_SET_VALUES, weightKg: kg, reps },
      completed,
    );
  }
  now = new Date(day.getTime() + 45 * 60_000);
  await workouts.finish(profileId, workout.id);
  now = new Date(2026, 9, 3, 10);
}

describe('training progress', () => {
  it('counts completed workouts and their volume per day', async () => {
    const context = await setup();
    await workoutOn(context, new Date(2026, 9, 1, 18), [
      [80, 8, true],
      [80, 8, true],
      [40, 10, true, 'warmup'], // warm-ups are no volume
      [85, 6, false], // not completed
    ]);
    await workoutOn(context, new Date(2026, 9, 1, 20), [[100, 5, true]]);
    await workoutOn(context, new Date(2026, 8, 20, 18), [[60, 10, true]]);
    await workoutOn(context, new Date(2026, 9, 2, 18), [[60, 10, false]]); // nothing completed: no volume

    const days = await context.workouts.dailyStatsBetween(
      context.profileId,
      '2026-09-27',
      '2026-10-03',
    );
    expect(days).toEqual([
      { localDate: '2026-10-01', workouts: 2, volumeKg: 1780 },
      { localDate: '2026-10-02', workouts: 1, volumeKg: 0 },
    ]);
  });

  it('ignores an active workout and never counts imported activities', async () => {
    const context = await setup();
    context.platform.workouts = [
      {
        id: 'hc',
        type: 'strengthTraining',
        start: localIso(2026, 10, 2, 18),
        end: localIso(2026, 10, 2, 19),
        activeKcal: 400,
        distanceM: null,
        source: 'Watch',
      },
    ];
    await context.services.healthSync.connect(context.profileId);
    await context.workouts.startFree(context.profileId);
    expect(
      await context.workouts.dailyStatsBetween(context.profileId, '2026-09-27', '2026-10-03'),
    ).toEqual([]);
  });

  it('summarises a period: count, training days, volume and one value per day', () => {
    const dates = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
    const summary = summarizeTraining(
      [
        { localDate: '2026-09-20', workouts: 1, volumeKg: 900 }, // outside the period
        { localDate: '2026-10-01', workouts: 2, volumeKg: 1780 },
        { localDate: '2026-10-03', workouts: 1, volumeKg: 0.4 },
      ],
      dates,
    );
    expect(summary).toEqual({
      workouts: 3,
      trainingDays: 2,
      volumeKg: 1780,
      perDay: [
        { date: '2026-09-30', workouts: 0 },
        { date: '2026-10-01', workouts: 2 },
        { date: '2026-10-02', workouts: 0 },
        { date: '2026-10-03', workouts: 1 },
      ],
    });
    // Without any load there is no volume – not "0 kg".
    expect(
      summarizeTraining([{ localDate: '2026-10-01', workouts: 1, volumeKg: 0 }], dates),
    ).toMatchObject({ workouts: 1, volumeKg: null });
  });
});

describe('exercise performance from the stored history', () => {
  it('reads best, latest and trend of completed working sets only', async () => {
    const context = await setup();
    const { workouts, profileId } = context;
    await workoutOn(context, new Date(2026, 8, 20, 18), [
      [60, 10, true, 'warmup'],
      [80, 8, true],
    ]);
    await workoutOn(context, new Date(2026, 8, 27, 18), [
      [82.5, 8, true],
      [100, 8, false], // not completed: no best
    ]);
    await workoutOn(context, new Date(2026, 9, 1, 18), [[85, 8, true]]);

    // An active workout never counts.
    const active = await workouts.startFree(profileId);
    await workouts.addExercise(profileId, active.id, 'sys.bench-press');
    const [set] = (await workouts.getDetail(profileId, active.id)).exercises[0]?.sets ?? [];
    if (!set) throw new Error('set expected');
    await workouts.updateSet(
      profileId,
      set.id,
      { ...EMPTY_SET_VALUES, weightKg: 150, reps: 5 },
      true,
    );

    const progress = await workouts.exerciseProgress(profileId, 'sys.bench-press');
    expect(progress.sessions).toBe(3);
    expect(progress.best).toMatchObject({ weightKg: 85, reps: 8, localDate: '2026-10-01' });
    expect(progress.best?.estimatedOneRepMaxKg).toBeCloseTo(107.67, 2);
    expect(progress.latest).toEqual(progress.best);
    expect(progress.latestIsBest).toBe(true);
    expect(progress.trend).toBe('up');

    // Other exercises have their own history.
    expect((await workouts.exerciseProgress(profileId, 'sys.back-squat')).best).toBeNull();
  });

  it('follows edits and deletions of past workouts', async () => {
    const context = await setup();
    const { workouts, profileId } = context;
    await workoutOn(context, new Date(2026, 8, 20, 18), [[80, 8, true]]);
    await workoutOn(context, new Date(2026, 9, 1, 18), [[90, 8, true]]);
    const [newest] = await workouts.getHistory(profileId, { limit: 1 });
    if (!newest) throw new Error('workout expected');

    await workouts.delete(profileId, newest.id);
    const progress = await workouts.exerciseProgress(profileId, 'sys.bench-press');
    expect(progress.best).toMatchObject({ weightKg: 80, localDate: '2026-09-20' });
    expect(progress.sessions).toBe(1);
  });
});
