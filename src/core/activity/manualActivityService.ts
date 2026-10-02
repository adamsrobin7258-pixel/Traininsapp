import type { DatabaseDriver } from '@/core/database';
import type { Clock } from '@/shared/lib/clock';
import { isLocalDateKey, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { CALORIE_METHOD, estimateCalories, type CalorieEstimate } from './calories';
import { sportById, sportIntensities, sportVariants, type SportDefinition } from './catalog';
import {
  ACTIVITY_LIMITS,
  ActivityError,
  type ManualActivity,
  type ManualActivityInput,
} from './manualActivity';
import { ManualActivityRepository } from './manualActivityRepository';

/** The body weight for a day: the value used for the calculation and where it came from. */
export interface ActivityWeight {
  kg: number;
  date: string;
  source: 'own' | 'imported';
}

/**
 * Where the body weight comes from – wired in the app shell from the weight entries and the
 * values imported from Health Connect (own entry first). Only read here; nothing is stored back.
 */
export interface ActivityWeightSource {
  weightOn(profileId: string, localDate: string): Promise<ActivityWeight | null>;
}

export interface ActivityPreview extends CalorieEstimate {
  weight: ActivityWeight | null;
}

/** Validated, normalised form data: everything needed to store and calculate. */
interface Checked {
  sport: SportDefinition;
  localDate: string;
  startedAt: string | null;
  durationS: number;
  distanceM: number | null;
  intensity: ManualActivityInput['intensity'];
  variant: ManualActivityInput['variant'];
  kcalOverride: number | null;
}

/**
 * Manually logged sport activities: create, read, change, delete. Calories are calculated from
 * the sport's MET value, the duration and the body weight of that day (see calories.ts); the
 * user may replace the value – both the calculated and the used value are stored.
 */
export class ManualActivityService {
  constructor(
    private readonly db: DatabaseDriver,
    private readonly clock: Clock,
    private readonly weights: ActivityWeightSource,
  ) {}

  private get repository() {
    return new ManualActivityRepository(this.db);
  }

  listBetween(profileId: string, from: string, to: string): Promise<ManualActivity[]> {
    return this.repository.listBetween(profileId, from, to);
  }

  recent(profileId: string, limit = 100): Promise<ManualActivity[]> {
    return this.repository.recent(profileId, limit);
  }

  async get(profileId: string, id: string): Promise<ManualActivity> {
    const activity = await this.repository.find(profileId, id);
    if (!activity) throw new ActivityError('not-found');
    return activity;
  }

  /** The body weight used for an activity on that day (shown in the form). */
  weightOn(profileId: string, localDate: string): Promise<ActivityWeight | null> {
    return this.weights.weightOn(profileId, localDate);
  }

  /** The calculation the form shows before saving (nothing is stored). */
  async preview(profileId: string, input: ManualActivityInput): Promise<ActivityPreview> {
    const checked = this.check(input);
    const weight = await this.weights.weightOn(profileId, checked.localDate);
    return { ...estimateCalories(checked.sport, checked, weight?.kg ?? null), weight };
  }

  async create(profileId: string, input: ManualActivityInput): Promise<ManualActivity> {
    const now = this.clock().toISOString();
    const activity = await this.build(profileId, input, createId(), now, now);
    await this.repository.insert(activity);
    return activity;
  }

  /** Changes an activity; the calories are calculated again from the new data. */
  async update(profileId: string, id: string, input: ManualActivityInput): Promise<ManualActivity> {
    const existing = await this.get(profileId, id);
    const activity = await this.build(
      profileId,
      input,
      existing.id,
      existing.createdAt,
      this.clock().toISOString(),
    );
    await this.repository.update(activity);
    return activity;
  }

  async delete(profileId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(profileId, id))) throw new ActivityError('not-found');
  }

  private async build(
    profileId: string,
    input: ManualActivityInput,
    id: string,
    createdAt: string,
    updatedAt: string,
  ): Promise<ManualActivity> {
    const checked = this.check(input);
    const weight = await this.weights.weightOn(profileId, checked.localDate);
    const estimate = estimateCalories(checked.sport, checked, weight?.kg ?? null);
    // An "own" value equal to the calculated one is no change: it stays automatic.
    const overridden = checked.kcalOverride !== null && checked.kcalOverride !== estimate.kcal;
    return {
      id,
      profileId,
      sportId: checked.sport.id,
      localDate: checked.localDate,
      startedAt: checked.startedAt,
      durationS: checked.durationS,
      distanceM: checked.distanceM,
      intensity: checked.intensity,
      variant: checked.variant,
      weightKg: estimate.weightKg,
      met: estimate.met.met,
      metRef: estimate.met.ref,
      metBasis: estimate.met.basis,
      calcMethod: CALORIE_METHOD,
      calculatedKcal: estimate.kcal,
      kcal: overridden ? checked.kcalOverride : estimate.kcal,
      kcalOverridden: overridden,
      createdAt,
      updatedAt,
    };
  }

  private check(input: ManualActivityInput): Checked {
    const sport = sportById(input.sportId);
    if (!sport) throw new ActivityError('invalid-sport');
    if (!isLocalDateKey(input.localDate)) throw new ActivityError('invalid-date');
    if (input.localDate > toLocalDateKey(this.clock())) throw new ActivityError('future-date');

    const { durationMin, distanceKm, kcal } = ACTIVITY_LIMITS;
    if (
      !Number.isFinite(input.durationMin) ||
      input.durationMin < durationMin.min ||
      input.durationMin > durationMin.max
    ) {
      throw new ActivityError('invalid-duration');
    }
    let distanceM: number | null = null;
    if (input.distanceKm !== null && sport.fields.distance) {
      if (
        !Number.isFinite(input.distanceKm) ||
        input.distanceKm < distanceKm.min ||
        input.distanceKm > distanceKm.max
      ) {
        throw new ActivityError('invalid-distance');
      }
      distanceM = Math.round(input.distanceKm * 1000);
    }
    if (
      input.kcalOverride !== null &&
      (!Number.isInteger(input.kcalOverride) ||
        input.kcalOverride < kcal.min ||
        input.kcalOverride > kcal.max)
    ) {
      throw new ActivityError('invalid-kcal');
    }
    // Fields the sport does not ask for are dropped, never stored as guesses.
    const intensity =
      input.intensity && sportIntensities(sport).includes(input.intensity) ? input.intensity : null;
    const variant =
      input.variant && sportVariants(sport).includes(input.variant) ? input.variant : null;

    return {
      sport,
      localDate: input.localDate,
      startedAt: startInstant(input.localDate, input.startTime),
      durationS: Math.round(input.durationMin * 60),
      distanceM,
      intensity,
      variant,
      kcalOverride: input.kcalOverride,
    };
  }
}

/** "HH:MM" on a local day → ISO instant; `null` without a time. */
function startInstant(localDate: string, time: string | null): string | null {
  if (time === null || time === '') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  const day = parseLocalDateKey(localDate);
  if (!match || !day) throw new ActivityError('invalid-time');
  day.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return day.toISOString();
}
