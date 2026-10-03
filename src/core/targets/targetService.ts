import type { DatabaseDriver } from '@/core/database';
import type { Clock } from '@/shared/lib/clock';
import { toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { TargetRepository } from './targetRepository';
import {
  isTargetKind,
  isValidTargetValue,
  TargetError,
  targetOn,
  type TargetHistory,
  type TargetKind,
  type TargetVersion,
} from './targets';

/**
 * Versioned personal targets. A change applies from today on; earlier versions are never
 * changed, so past periods keep the target that applied then. A second change on the same day
 * replaces that day's version (like the nutrition goals).
 */
export class TargetService {
  private readonly repository: TargetRepository;

  constructor(
    db: DatabaseDriver,
    private readonly clock: Clock,
  ) {
    this.repository = new TargetRepository(db);
  }

  async history(profileId: string): Promise<TargetHistory> {
    const history: Record<TargetKind, TargetVersion[]> = {
      trainingsPerWeek: [],
      activeMinutesPerWeek: [],
      stepsPerDay: [],
      activityCalories: [],
    };
    for (const version of await this.repository.list(profileId)) {
      history[version.kind].push(version);
    }
    return history;
  }

  /** The value in force on a day (`null` = no target). */
  async valueOn(profileId: string, kind: TargetKind, localDate: string): Promise<number | null> {
    return targetOn((await this.history(profileId))[kind], localDate);
  }

  /** Today's values of every kind. */
  async current(profileId: string): Promise<Record<TargetKind, number | null>> {
    const history = await this.history(profileId);
    const today = toLocalDateKey(this.clock());
    return {
      trainingsPerWeek: targetOn(history.trainingsPerWeek, today),
      activeMinutesPerWeek: targetOn(history.activeMinutesPerWeek, today),
      stepsPerDay: targetOn(history.stepsPerDay, today),
      activityCalories: targetOn(history.activityCalories, today),
    };
  }

  /** Sets the value from today on. Nothing is stored when it does not change. */
  async set(profileId: string, kind: TargetKind, value: number | null): Promise<void> {
    if (!isTargetKind(kind)) throw new TargetError('invalid-kind');
    if (!isValidTargetValue(kind, value)) throw new TargetError('invalid-value');
    const today = toLocalDateKey(this.clock());
    const versions = (await this.history(profileId))[kind];
    const todays = versions.find((version) => version.effectiveFrom === today) ?? null;
    const before = targetOn(
      versions.filter((version) => version.effectiveFrom < today),
      today,
    );
    if (!todays && before === value) return;
    const now = this.clock().toISOString();
    await this.repository.upsert({
      id: todays?.id ?? createId(),
      profileId,
      kind,
      effectiveFrom: today,
      value,
      createdAt: todays?.createdAt ?? now,
      updatedAt: now,
    });
  }
}
