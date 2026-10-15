import { createServices } from '@/app/services';
import type { ManualActivityInput } from '@/core/activity';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { FakeFoodProvider } from '@/test/fakeFoodProvider';
import { FakeHealthExport } from '@/test/fakeHealthExport';
import { createTestReferenceCatalog } from '@/test/testReferenceCatalog';
import {
  activitySession,
  ACTIVITY_EXPORT_TYPES,
  clientRecordId,
  workoutSession,
  WORKOUT_EXPORT_TYPES,
} from './healthExport';
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
  const open = () =>
    createServices(
      { driver, security: ENCRYPTED_TEST_SECURITY },
      clock,
      new FakeFoodProvider(),
      createTestReferenceCatalog(),
      undefined,
      store,
    );
  const services = open();
  const profile = await services.profile.ensureLocalProfile();
  return { services, store, profileId: profile.id, driver, open };
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
    const built = workoutSession({
      id: 'w1',
      trainingType: 'strength',
      status: 'completed',
      startedAt: '2026-10-15T16:00:00.000Z',
      endedAt: '2026-10-15T16:50:00.000Z',
      updatedAt: '2026-10-15T16:50:00.000Z',
    });
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
    const base = { id: 'a', durationS: 1800, updatedAt: '2026-10-15T10:00:00.000Z' };
    expect(activitySession({ ...base, sportId: 'tennis', startedAt: null })).toEqual({
      skip: 'no-start-time',
    });
    expect(
      activitySession({ ...base, sportId: 'swim', startedAt: '2026-10-15T09:00:00Z' }),
    ).toEqual({ skip: 'unsupported-type' });
    expect(
      workoutSession({
        id: 'w',
        trainingType: 'strength',
        status: 'active',
        startedAt: '2026-10-15T09:00:00Z',
        endedAt: null,
        updatedAt: '2026-10-15T09:00:00Z',
      }),
    ).toEqual({ skip: 'invalid' });
    expect(clientRecordId('activity', 'x')).toBe('kalethra:activity:x');
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
    expect(await services.healthExport.enable(profileId)).toMatchObject({ result: 'enabled' });
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
    expect(await services.healthExport.enable(profileId)).toEqual({
      result: 'denied',
      exported: 0,
    });
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
    await services.healthExport.enable(profileId);
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
    await services.healthExport.enable(profileId);
    const id = await workout(services, profileId);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('exported');
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('unchanged');
    const restarted = open();
    expect(await restarted.healthExport.exportWorkout(profileId, id)).toBe('unchanged');
    expect(await restarted.healthExport.retryWaiting(profileId)).toBe(0);
    await restarted.healthExport.disable();
    await restarted.healthExport.enable(profileId); // catch-up of 30 days
    expect(store.writes).toHaveLength(1);
    expect(store.sessions.size).toBe(1);
    expect(store.writes[0]).toMatchObject({
      clientRecordId: `kalethra:workout:${id}`,
      exerciseType: 'strengthTraining',
    });
  });

  it('a Health Connect failure never stops finishing a workout; it is retried later', async () => {
    const { services, store, profileId } = await setup();
    await services.healthExport.enable(profileId);
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
    await services.healthExport.enable(profileId);
    store.availabilityKind = 'unsupported';
    const id = await workout(services, profileId);
    await expect(services.healthExport.exportWorkout(profileId, id)).resolves.toBe('failed');
    expect(await services.healthExport.retryWaiting(profileId)).toBe(0); // still unavailable
    store.availabilityKind = 'available';
    expect(await services.healthExport.retryWaiting(profileId)).toBe(1);
  });

  it('a corrected duration updates the same session – no second one', async () => {
    const { services, store, profileId } = await setup();
    await services.healthExport.enable(profileId);
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

  it('correcting an old workout the export never handled does not export it', async () => {
    const { services, store, profileId } = await setup();
    now = new Date(2026, 7, 1, 18, 0); // 1 August: outside the 30-day catch-up
    const old = await workout(services, profileId);
    now = new Date(2026, 9, 15, 18, 0);
    await services.healthExport.enable(profileId);
    await services.training.workouts.updateDuration(profileId, old, 70);
    expect(await services.healthExport.exportWorkout(profileId, old, { onlyKnown: true })).toBe(
      'unchanged',
    );
    expect(store.writes).toEqual([]);
  });

  it('turning on catches up the last 30 days – older workouts stay local', async () => {
    const { services, store, profileId } = await setup();
    now = new Date(2026, 8, 1, 18, 0); // 1 September: far outside the window
    const old = await workout(services, profileId);
    now = new Date(2026, 9, 10, 18, 0);
    const recent = await workout(services, profileId);
    now = new Date(2026, 9, 15, 18, 0);
    const { exported } = await services.healthExport.enable(profileId);
    expect(exported).toBe(1);
    expect(store.sessions.has(`kalethra:workout:${recent}`)).toBe(true);
    expect(store.sessions.has(`kalethra:workout:${old}`)).toBe(false);
  });

  it('a supported activity with a start time is written; unsupported or without time is not', async () => {
    const { services, store, profileId } = await setup();
    await services.healthExport.enable(profileId);
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
    await services.healthExport.enable(profileId);
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
    await services.healthExport.enable(profileId);
    const id = await workout(services, profileId);
    await services.healthExport.exportWorkout(profileId, id);
    await services.training.workouts.delete(profileId, id);
    expect(await services.healthExport.exportWorkout(profileId, id)).toBe('gone');
    expect(store.sessions.size).toBe(1);
  });
});
