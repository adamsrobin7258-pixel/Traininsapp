import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import type { ManualActivityInput } from '@/core/activity';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeFoodProvider } from '@/test/fakeFoodProvider';
import { FakeHealthExport } from '@/test/fakeHealthExport';
import { FakeHealthPlatform } from '@/test/fakeHealthPlatform';
import { createTestReferenceCatalog } from '@/test/testReferenceCatalog';
import {
  activityExport,
  activitySession,
  ACTIVITY_EXPORT_TYPES,
  clientRecordId,
  validAmount,
  workoutActiveKcal,
  workoutExport,
  workoutSession,
  WORKOUT_EXPORT_TYPES,
  type ExportableActivity,
  type ExportableWorkout,
} from './healthExport';
import { HealthExportRepository } from './healthExportRepository';
import { HEALTH_EXERCISE_TYPES } from '@/core/platform/health';

/** Health Connect export (Settings → App → Health Connect): Kalethra → Health Connect only. */
let now = new Date(2026, 9, 15, 18, 0);
const clock = () => now;
const advance = (minutes: number) => {
  now = new Date(now.getTime() + minutes * 60_000);
};

async function setup() {
  now = new Date(2026, 9, 15, 18, 0);
  const driver = await createTestDatabase();
  const store = new FakeHealthExport();
  const reading = new FakeHealthPlatform();
  const open = () =>
    createServices(
      { driver, security: ENCRYPTED_TEST_SECURITY },
      clock,
      new FakeFoodProvider(),
      createTestReferenceCatalog(),
      reading,
      store,
    );
  const services = open();
  const profile = await services.profile.ensureLocalProfile();
  return { services, store, reading, profileId: profile.id, driver, open };
}

/** Turns the export on and waits for the history pass. */
async function enable(services: ReturnType<typeof createServices>, profileId: string) {
  const { result, history } = await services.healthExport.enable(profileId);
  return { result, exported: await history };
}

/** Starts and finishes a free strength workout of `minutes` minutes. */
async function workout(
  services: ReturnType<typeof createServices>,
  profileId: string,
  minutes = 50,
) {
  const started = await services.training.workouts.startFree(profileId, 'strength');
  advance(minutes);
  await services.training.workouts.finish(profileId, started.id);
  return started.id;
}

const tennis: ManualActivityInput = {
  sportId: 'tennis',
  localDate: '2026-10-15',
  startTime: '17:00',
  durationMin: 60,
  distanceKm: null,
  intensity: null,
  variant: 'singles',
  kcalOverride: null,
};

/** A run with distance – kcal are calculated once a body weight is known. */
const run: ManualActivityInput = {
  sportId: 'run',
  localDate: '2026-10-15',
  startTime: '07:00',
  durationMin: 30,
  distanceKm: 5,
  intensity: null,
  variant: null,
  kcalOverride: null,
};

const exportableWorkout: ExportableWorkout = {
  id: 'w1',
  trainingType: 'strength',
  status: 'completed',
  startedAt: '2026-10-15T16:00:00.000Z',
  endedAt: '2026-10-15T16:50:00.000Z',
  durationS: 50 * 60,
  localDate: '2026-10-15',
  updatedAt: '2026-10-15T16:50:00.000Z',
};

const exportableActivity: ExportableActivity = {
  id: 'a1',
  sportId: 'run',
  startedAt: '2026-10-15T05:00:00.000Z',
  durationS: 1800,
  kcal: 420,
  distanceM: 5000,
  updatedAt: '2026-10-15T06:00:00.000Z',
};

describe('export rules', () => {
  it('maps only fitting types – every mapped type is one the native plugin knows', () => {
    const known = new Set<string>(HEALTH_EXERCISE_TYPES);
    for (const type of [
      ...Object.values(WORKOUT_EXPORT_TYPES),
      ...Object.values(ACTIVITY_EXPORT_TYPES),
    ]) {
      expect(known.has(type)).toBe(true);
    }
    expect(WORKOUT_EXPORT_TYPES.strength).toBe('strengthTraining');
    expect(WORKOUT_EXPORT_TYPES.hyrox).toBeUndefined();
    expect(ACTIVITY_EXPORT_TYPES.swim).toBeUndefined();
  });

  it('a strength workout: type and real times only, a stable client record ID', () => {
    const built = workoutSession(exportableWorkout);
    expect(built).toEqual({
      session: {
        clientRecordId: 'kalethra:workout:w1',
        clientRecordVersion: Date.parse('2026-10-15T16:50:00.000Z'),
        exerciseType: 'strengthTraining',
        start: '2026-10-15T16:00:00.000Z',
        end: '2026-10-15T16:50:00.000Z',
      },
    });
    // Nothing else leaves the device: no title, notes, calories or sets.
    expect(Object.keys('session' in built ? built.session : {}).sort()).toEqual([
      'clientRecordId',
      'clientRecordVersion',
      'end',
      'exerciseType',
      'start',
    ]);
  });

  it('never invents: no start time, unsupported type or an active workout are not written', () => {
    const base = {
      id: 'a',
      durationS: 1800,
      kcal: 300,
      distanceM: null,
      updatedAt: '2026-10-15T10:00:00.000Z',
    };
    expect(activitySession({ ...base, sportId: 'tennis', startedAt: null })).toEqual({
      skip: 'no-start-time',
    });
    expect(
      activitySession({ ...base, sportId: 'swim', startedAt: '2026-10-15T09:00:00Z' }),
    ).toEqual({ skip: 'unsupported-type' });
    expect(workoutSession({ ...exportableWorkout, status: 'active', endedAt: null })).toEqual({
      skip: 'invalid',
    });
    expect(clientRecordId('activity', 'x')).toBe('kalethra:activity:x');
  });

  it('session, calories and distance have stable, separate IDs – the session ID is unchanged', () => {
    expect(clientRecordId('workout', 'w1')).toBe('kalethra:workout:w1');
    expect(clientRecordId('workout', 'w1', 'session')).toBe('kalethra:workout:w1');
    expect(clientRecordId('workout', 'w1', 'calories')).toBe('kalethra:workout:w1:calories');
    expect(clientRecordId('activity', 'a1', 'distance')).toBe('kalethra:activity:a1:distance');
  });

  it('only positive, finite amounts within the limit – never 0, never a guess', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, null, '300', 10_001]) {
      expect(validAmount('calories', bad)).toBeNull();
    }
    expect(validAmount('calories', 386)).toBe(386);
    expect(validAmount('distance', 0)).toBeNull();
    expect(validAmount('distance', 1_000_001)).toBeNull();
    expect(validAmount('distance', 5800)).toBe(5800);
  });

  it("workout calories: Kalethra's training formula, net of rest, with the weight of the day", () => {
    // Strength: MET 3.5 → (3.5 − 1) × 80 kg × 50/60 h = 166.7 → 167 active kcal.
    expect(workoutActiveKcal(exportableWorkout, 80)).toBe(167);
    // Endurance: MET 6 → (6 − 1) × 70 kg × 1 h.
    expect(workoutActiveKcal({ trainingType: 'running', durationS: 3600 }, 70)).toBe(350);
    // Sessions longer than 3 h count as 3 h – like the calorie goal.
    expect(workoutActiveKcal({ trainingType: 'strength', durationS: 6 * 3600 }, 80)).toBe(600);
    // Without a weight or a duration there is no value – nothing is invented.
    expect(workoutActiveKcal(exportableWorkout, null)).toBeNull();
    expect(workoutActiveKcal({ ...exportableWorkout, durationS: null }, 80)).toBeNull();
    expect(workoutActiveKcal(exportableWorkout, Number.NaN)).toBeNull();
  });

  it('a workout has calories at most – no distance; an activity has what it shows', () => {
    expect(workoutExport(exportableWorkout, 80)).toMatchObject({
      amounts: { calories: 167, distance: null },
    });
    expect(workoutExport(exportableWorkout, null)).toMatchObject({
      amounts: { calories: null, distance: null },
    });
    expect(activityExport(exportableActivity)).toMatchObject({
      session: { clientRecordId: 'kalethra:activity:a1', exerciseType: 'running' },
      amounts: { calories: 420, distance: 5000 },
    });
    expect(activityExport({ ...exportableActivity, kcal: null, distanceM: null })).toMatchObject({
      amounts: { calories: null, distance: null },
    });
    expect(activityExport({ ...exportableActivity, kcal: -3, distanceM: 0 })).toMatchObject({
      amounts: { calories: null, distance: null },
    });
    // Not exportable as a session: no amounts either.
    expect(activityExport({ ...exportableActivity, startedAt: null })).toEqual({
      skip: 'no-start-time',
    });
  });
});

describe('setting and permission', () => {
  it('is off by default and writes nothing while off', async () => {
    const { services, store, profileId } = await setup();
    expect((await services.healthExport.state(profileId)).enabled).toBe(false);
    const id = await workout(services, profileId);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('off');
    expect(store.writes).toEqual([]);
    expect(store.requests).toBe(0);
  });

  it('turns on only with the permission; the state survives a restart', async () => {
    const { services, store, profileId, open } = await setup();
    expect((await enable(services, profileId)).result).toBe('enabled');
    expect(store.requests).toBe(1);
    const restarted = open();
    expect(await restarted.healthExport.state(profileId)).toMatchObject({
      enabled: true,
      access: 'granted',
    });
    await restarted.healthExport.disable();
    expect((await open().healthExport.state(profileId)).enabled).toBe(false);
  });

  it('a refused permission leaves it off – no error', async () => {
    const { services, store, profileId } = await setup();
    store.grantOnRequest = false;
    expect(await enable(services, profileId)).toEqual({ result: 'denied', exported: 0 });
    expect((await services.healthExport.state(profileId)).enabled).toBe(false);
  });

  it('without Health Connect it cannot be turned on', async () => {
    const { services, store, profileId } = await setup();
    store.availabilityKind = 'unsupported';
    expect((await services.healthExport.enable(profileId)).result).toBe('unsupported');
    store.availabilityKind = 'needsInstall';
    expect((await services.healthExport.enable(profileId)).result).toBe('needsInstall');
    expect(store.requests).toBe(0);
    expect((await services.healthExport.state(profileId)).enabled).toBe(false);
  });

  it('a permission revoked later: shown as missing, records wait, nothing is lost', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    store.granted = false;
    const id = await workout(services, profileId);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('failed');
    expect(await services.healthExport.state(profileId)).toMatchObject({
      enabled: true,
      access: 'missing',
      waiting: 1,
    });
    // The workout itself is untouched.
    expect((await services.training.workouts.getDetail(profileId, id)).status).toBe('completed');
    // Permission back: the waiting record is written on the next retry.
    store.granted = true;
    expect(await services.healthExport.retryWaiting(profileId)).toBe(1);
    expect(store.sessions.has(`kalethra:workout:${id}`)).toBe(true);
  });
});

describe('workouts and activities', () => {
  it('a finished strength workout is written once – repeats, restarts and re-enabling change nothing', async () => {
    const { services, store, profileId, open } = await setup();
    await enable(services, profileId);
    const id = await workout(services, profileId);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('exported');
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('unchanged');
    const restarted = open();
    expect(await restarted.healthExport.exportWorkout(profileId, id)).toBe('unchanged');
    expect(await restarted.healthExport.retryWaiting(profileId)).toBe(0);
    await restarted.healthExport.disable();
    await enable(restarted, profileId); // the history pass
    expect(store.writes).toHaveLength(1);
    expect(store.sessions.size).toBe(1);
    expect(store.writes[0]).toMatchObject({
      clientRecordId: `kalethra:workout:${id}`,
      exerciseType: 'strengthTraining',
    });
  });

  it('a Health Connect failure never stops finishing a workout; it is retried later', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    store.failWith = 'failed';
    const id = await workout(services, profileId);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('failed');
    expect((await services.training.workouts.getDetail(profileId, id)).status).toBe('completed');
    store.failWith = null;
    expect(await services.healthExport.retryWaiting(profileId)).toBe(1);
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0);
    expect(store.sessions.size).toBe(1);
  });

  it('Health Connect gone for a moment: nothing thrown, retried later', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    store.availabilityKind = 'unsupported';
    const id = await workout(services, profileId);
    await expect(services.healthExport.exportWorkout(profileId, id)).resolves.toBe('failed');
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0); // still unavailable
    store.availabilityKind = 'available';
    expect(await services.healthExport.retryWaiting(profileId)).toBe(1);
  });

  it('a corrected duration updates the same session – no second one', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    const id = await workout(services, profileId, 50);
    await services.healthExport.exportWorkout(profileId, id);
    advance(5);
    await services.training.workouts.updateDuration(profileId, id, 65);
    expect(await services.healthExport.exportWorkout(profileId, id, { onlyKnown: true })).toBe(
      'exported',
    );
    expect(store.sessions.size).toBe(1);
    const session = store.sessions.get(`kalethra:workout:${id}`);
    expect(Date.parse(session?.end ?? '') - Date.parse(session?.start ?? '')).toBe(65 * 60_000);
  });

  it('correcting a workout the export never handled does not export it on its own', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    // Finished, but its export never ran (e.g. the app was closed right away).
    const old = await workout(services, profileId);
    await services.training.workouts.updateDuration(profileId, old, 70);
    expect(await services.healthExport.exportWorkout(profileId, old, { onlyKnown: true })).toBe(
      'unchanged',
    );
    expect(store.writes).toEqual([]);
  });

  it('turning on exports the whole history once – workouts and activities of any age', async () => {
    const { services, store, profileId } = await setup();
    now = new Date(2024, 2, 1, 18, 0); // March 2024
    const old = await workout(services, profileId);
    now = new Date(2026, 9, 10, 18, 0);
    const recent = await workout(services, profileId);
    const played = await services.activities.create(profileId, {
      ...tennis,
      localDate: '2025-06-01',
    });
    now = new Date(2026, 9, 15, 18, 0);
    const { exported } = await enable(services, profileId);
    expect(exported).toBe(3);
    expect([...store.sessions.keys()].sort()).toEqual(
      [
        `kalethra:workout:${old}`,
        `kalethra:workout:${recent}`,
        `kalethra:activity:${played.id}`,
      ].sort(),
    );
    expect(await services.healthExport.state(profileId)).toMatchObject({
      historyPending: false,
      waiting: 0,
    });
  });

  it('a supported activity with a start time is written; unsupported or without time is not', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    const played = await services.activities.create(profileId, tennis);
    const swum = await services.activities.create(profileId, {
      ...tennis,
      sportId: 'swim',
      variant: null,
    });
    const noTime = await services.activities.create(profileId, { ...tennis, startTime: null });
    expect(await services.healthExport.exportActivity(profileId, played.id)).toBe('exported');
    expect(await services.healthExport.exportActivity(profileId, swum.id)).toBe('skipped');
    expect(await services.healthExport.exportActivity(profileId, noTime.id)).toBe('skipped');
    expect([...store.sessions.values()]).toEqual([
      expect.objectContaining({
        exerciseType: 'tennis',
        clientRecordId: `kalethra:activity:${played.id}`,
      }),
    ]);
    // Skipped records are never retried.
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0);
  });

  it('turning off deletes nothing; imported activities are never written back', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    const id = await workout(services, profileId);
    await services.healthExport.exportWorkout(profileId, id);
    await services.healthExport.disable();
    expect(store.sessions.size).toBe(1);
    expect((await services.training.workouts.getDetail(profileId, id)).status).toBe('completed');
    const another = await workout(services, profileId);
    expect(await services.healthExport.exportWorkout(profileId, another)).toBe('off');
    expect(store.sessions.size).toBe(1);
  });

  it('a deleted workout is forgotten by the export, its Health Connect copy stays', async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    const id = await workout(services, profileId);
    await services.healthExport.exportWorkout(profileId, id);
    await services.training.workouts.delete(profileId, id);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('gone');
    expect(store.sessions.size).toBe(1);
  });
});

describe('active calories and distance', () => {
  const ids = (kind: 'workout' | 'activity', id: string) => ({
    session: clientRecordId(kind, id),
    calories: clientRecordId(kind, id, 'calories'),
    distance: clientRecordId(kind, id, 'distance'),
  });

  it('an activity with kcal and distance: three records over the same span, separate IDs', async () => {
    const { services, store, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-15', 70);
    await enable(services, profileId);
    const jogged = await services.activities.create(profileId, run);
    expect(jogged.kcal).toBeGreaterThan(0);
    expect(await services.healthExport.exportActivity(profileId, jogged.id)).toBe('exported');
    const id = ids('activity', jogged.id);
    const session = store.sessions.get(id.session);
    expect(session).toMatchObject({ exerciseType: 'running' });
    // Active energy as Kalethra shows it, in kcal – no rounding, no other unit.
    expect(store.calories.get(id.calories)).toEqual({
      clientRecordId: id.calories,
      clientRecordVersion: session?.clientRecordVersion,
      start: session?.start,
      end: session?.end,
      kcal: jogged.kcal,
    });
    // Distance in metres, the real logged value.
    expect(store.distances.get(id.distance)).toMatchObject({
      start: session?.start,
      end: session?.end,
      meters: 5000,
    });
  });

  it("a workout: calories from Kalethra's formula with the weight of its day; without a weight none", async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    const without = await workout(services, profileId, 50);
    expect(await services.healthExport.exportWorkout(profileId, without)).toBe('exported');
    expect(store.calories.size).toBe(0);
    await services.weight.save(profileId, '2026-10-15', 80);
    const withWeight = await workout(services, profileId, 50);
    await services.healthExport.exportWorkout(profileId, withWeight);
    // Strength (MET 3.5): (3.5 − 1) × 80 kg × 50/60 h = 167 active kcal.
    expect(store.calories.get(ids('workout', withWeight).calories)?.kcal).toBe(167);
    // Workouts have no session distance.
    expect(store.distances.size).toBe(0);
  });

  it("the user's own kcal value is exported; no value or 0 writes no record", async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    const own = await services.activities.create(profileId, { ...tennis, kcalOverride: 450 });
    const none = await services.activities.create(profileId, tennis); // no weight → no kcal
    const zero = await services.activities.create(profileId, { ...tennis, kcalOverride: 0 });
    for (const activity of [own, none, zero]) {
      await services.healthExport.exportActivity(profileId, activity.id);
    }
    expect(store.sessions.size).toBe(3);
    expect([...store.calories.values()]).toEqual([
      expect.objectContaining({ clientRecordId: ids('activity', own.id).calories, kcal: 450 }),
    ]);
    // Tennis has no distance: no distance record, not a 0.
    expect(store.distances.size).toBe(0);
  });

  it('repeats write nothing again; a changed value updates the same records', async () => {
    const { services, store, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-15', 70);
    await enable(services, profileId);
    const jogged = await services.activities.create(profileId, run);
    await services.healthExport.exportActivity(profileId, jogged.id);
    const calls = store.calls.length;
    expect(await services.healthExport.exportActivity(profileId, jogged.id)).toBe('unchanged');
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0);
    expect(store.calls).toHaveLength(calls);

    advance(10);
    const longer = await services.activities.update(profileId, jogged.id, {
      ...run,
      distanceKm: 6,
      durationMin: 40,
    });
    expect(
      await services.healthExport.exportActivity(profileId, jogged.id, { onlyKnown: true }),
    ).toBe('exported');
    const id = ids('activity', jogged.id);
    expect(store.sessions.size).toBe(1);
    expect(store.calories.size).toBe(1);
    expect(store.distances.size).toBe(1);
    expect(store.distances.get(id.distance)?.meters).toBe(6000);
    expect(store.calories.get(id.calories)?.kcal).toBe(longer.kcal);
    expect(store.calories.get(id.calories)?.end).toBe(store.sessions.get(id.session)?.end);
  });

  it("a removed value deletes only Kalethra's own record – and comes back when the value does", async () => {
    const { services, store, profileId } = await setup();
    await enable(services, profileId);
    // A record of another app with active calories in the same store.
    store.calories.set('watch:123', {
      clientRecordId: 'watch:123',
      clientRecordVersion: 1,
      start: '2026-10-15T15:00:00.000Z',
      end: '2026-10-15T16:00:00.000Z',
      kcal: 500,
    });
    const played = await services.activities.create(profileId, { ...tennis, kcalOverride: 450 });
    await services.healthExport.exportActivity(profileId, played.id);
    const id = ids('activity', played.id);
    expect(store.calories.has(id.calories)).toBe(true);

    advance(1);
    await services.activities.update(profileId, played.id, tennis); // no weight → no kcal now
    expect(await services.healthExport.exportActivity(profileId, played.id)).toBe('exported');
    expect(store.calories.has(id.calories)).toBe(false);
    expect(store.calories.has('watch:123')).toBe(true);
    expect(store.calls.filter((call) => call.includes('#delete'))).toEqual([
      `activeCalories:${id.calories}#delete`,
    ]);
    // Nothing left to do – the removal is not repeated.
    expect(await services.healthExport.exportActivity(profileId, played.id)).toBe('unchanged');

    advance(1);
    await services.activities.update(profileId, played.id, { ...tennis, kcalOverride: 300 });
    await services.healthExport.exportActivity(profileId, played.id);
    expect(store.calories.get(id.calories)?.kcal).toBe(300);
    expect(store.sessions.size).toBe(1);
  });

  it('a failing type blocks neither the others nor later; it is retried without duplicates', async () => {
    const { services, store, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-15', 70);
    await enable(services, profileId);
    store.failType = 'activeCalories';
    const jogged = await services.activities.create(profileId, run);
    expect(await services.healthExport.exportActivity(profileId, jogged.id)).toBe('failed');
    const id = ids('activity', jogged.id);
    expect(store.sessions.has(id.session)).toBe(true);
    expect(store.distances.has(id.distance)).toBe(true);
    expect(store.calories.size).toBe(0);
    expect((await services.healthExport.state(profileId)).waiting).toBe(1);
    store.failType = null;
    expect(await services.healthExport.retryWaiting(profileId)).toBe(1);
    expect(store.calories.has(id.calories)).toBe(true);
    expect(store.writes).toHaveLength(1); // the session was not written again
    expect((await services.healthExport.state(profileId)).waiting).toBe(0);
  });

  it('without the calories and distance permission sessions still go; granted later they follow', async () => {
    const { services, store, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-15', 70);
    store.grantOnRequest = ['exercise'];
    expect((await enable(services, profileId)).result).toBe('enabled');
    expect((await services.healthExport.state(profileId)).access).toBe('partial');
    const jogged = await services.activities.create(profileId, run);
    expect(await services.healthExport.exportActivity(profileId, jogged.id)).toBe('exported');
    expect(store.sessions.size).toBe(1);
    expect(store.calories.size + store.distances.size).toBe(0);
    // Waiting for a permission the user left off is not an error and retries nothing.
    expect((await services.healthExport.state(profileId)).waiting).toBe(0);
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0);

    store.grantOnRequest = true;
    expect((await enable(services, profileId)).result).toBe('enabled');
    expect(await services.healthExport.state(profileId)).toMatchObject({
      access: 'granted',
      waiting: 0,
    });
    expect(store.calories.size).toBe(1);
    expect(store.distances.size).toBe(1);
    expect(store.writes).toHaveLength(1);
  });

  it('activities imported from Health Connect are never exported back – nor their calories or distance', async () => {
    const { services, store, reading, profileId } = await setup();
    const start = new Date(2026, 9, 14, 7, 0).toISOString();
    reading.workouts = [
      {
        id: 'watch-run',
        type: 'running',
        start,
        end: new Date(Date.parse(start) + 42 * 60_000).toISOString(),
        activeKcal: 386,
        distanceM: 5800,
        source: 'Pixel Watch',
      },
    ];
    await services.healthSync.connect(profileId);
    expect(
      await services.healthSync.workoutsBetween(profileId, '2026-10-14', '2026-10-14'),
    ).toHaveLength(1);
    await enable(services, profileId);
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0);
    expect(store.calls).toEqual([]);
  });
});

describe('history pass', () => {
  it('an interrupted pass resumes after a restart – what was written is not written again', async () => {
    const { services, store, profileId, open } = await setup();
    for (let i = 0; i < 30; i += 1) await workout(services, profileId, 30);
    // Health Connect goes away right after the first batch.
    const write = store.writeExerciseSession.bind(store);
    store.writeExerciseSession = async (session) => {
      await write(session);
      if (store.writes.length === 25) store.availabilityKind = 'unsupported';
    };
    expect((await enable(services, profileId)).exported).toBe(25);
    expect((await services.healthExport.state(profileId)).historyPending).toBe(true);

    store.availabilityKind = 'available';
    const restarted = open();
    expect(await restarted.healthExport.retryWaiting(profileId)).toBe(5);
    expect(store.sessions.size).toBe(30);
    expect(store.writes).toHaveLength(30);
    expect((await restarted.healthExport.state(profileId)).historyPending).toBe(false);
    expect(await restarted.healthExport.retryWaiting(profileId)).toBe(0);
    expect(store.writes).toHaveLength(30);
  });

  it('turning off and on again sends nothing twice', async () => {
    const { services, store, profileId } = await setup();
    await services.weight.save(profileId, '2026-10-15', 70);
    await workout(services, profileId);
    await services.activities.create(profileId, run);
    await enable(services, profileId);
    const calls = [...store.calls];
    // Workout: session + calories; activity: session + calories + distance.
    expect(calls).toHaveLength(5);
    await services.healthExport.disable();
    expect((await enable(services, profileId)).exported).toBe(0);
    expect(store.calls).toEqual(calls);
  });

  it('a workout finished while the pass runs is exported too – exactly once', async () => {
    const { services, store, profileId } = await setup();
    for (let i = 0; i < 30; i += 1) await workout(services, profileId, 20);
    const { history } = await services.healthExport.enable(profileId);
    const fresh = await workout(services, profileId, 45);
    const [outcome] = await Promise.all([
      services.healthExport.exportWorkout(profileId, fresh),
      history,
    ]);
    expect(['exported', 'unchanged']).toContain(outcome);
    expect(store.sessions.size).toBe(31);
    expect(store.writes).toHaveLength(31);
  });

  it('after the update from the first version, the pass adds calories without rewriting sessions', async () => {
    const { services, store, profileId, driver } = await setup();
    await services.weight.save(profileId, '2026-10-15', 70);
    await enable(services, profileId);
    const played = await services.activities.create(profileId, { ...tennis, kcalOverride: 450 });
    store.grantOnRequest = ['exercise'];
    store.permissions.delete('activeCalories');
    await services.healthExport.exportActivity(profileId, played.id); // session only, as in 0.43
    // The setting as the first version stored it – without the history marker.
    const repository = new HealthExportRepository(driver);
    await repository.saveSetting(
      { enabled: true, enabledAt: '2026-10-01T10:00:00.000Z', historyDoneAt: null },
      now.toISOString(),
    );
    store.permissions.add('activeCalories');
    expect(await services.healthExport.retryWaiting(profileId)).toBe(1);
    expect(store.calories.get(clientRecordId('activity', played.id, 'calories'))?.kcal).toBe(450);
    expect(store.writes).toHaveLength(1);
  });
});

describe('migration 17', () => {
  it('keeps every exported session and allows one row per record type', async () => {
    const db = await openSqlJsDriver();
    await migrate(db, migrations.slice(0, 16));
    await db.execute(`
      INSERT INTO profiles (id, created_at, updated_at) VALUES ('p', 'x', 'x');
      INSERT INTO health_connect_exports (id, profile_id, source_kind, source_id,
        client_record_id, status, exported_version, attempts, created_at, updated_at)
      VALUES ('e', 'p', 'workout', 'w1', 'kalethra:workout:w1', 'exported', 1700, 1, 'x', 'x');
    `);
    expect(await migrate(db, migrations)).toEqual([17]);
    expect(
      await db.query(
        `SELECT id, record_type, client_record_id, status, exported_version, exported_value
         FROM health_connect_exports`,
      ),
    ).toEqual([
      {
        id: 'e',
        record_type: 'session',
        client_record_id: 'kalethra:workout:w1',
        status: 'exported',
        exported_version: 1700,
        exported_value: null,
      },
    ]);
    await db.run(
      `INSERT INTO health_connect_exports (id, profile_id, source_kind, source_id, record_type,
         client_record_id, status, exported_value, created_at, updated_at)
       VALUES ('c', 'p', 'workout', 'w1', 'calories', 'kalethra:workout:w1:calories', 'removed',
         NULL, 'x', 'x')`,
    );
    await expect(
      db.run(
        `INSERT INTO health_connect_exports (id, profile_id, source_kind, source_id, record_type,
           client_record_id, status, created_at, updated_at)
         VALUES ('d', 'p', 'workout', 'w1', 'session', 'x', 'pending', 'x', 'x')`,
      ),
    ).rejects.toThrow(/UNIQUE/);
    await expect(
      db.run(
        `INSERT INTO health_connect_exports (id, profile_id, source_kind, source_id, record_type,
           client_record_id, status, exported_value, created_at, updated_at)
         VALUES ('z', 'p', 'activity', 'a', 'distance', 'x', 'exported', 0, 'x', 'x')`,
      ),
    ).rejects.toThrow(/CHECK/);
    expect(await migrate(db, migrations)).toEqual([]);
  });
});
