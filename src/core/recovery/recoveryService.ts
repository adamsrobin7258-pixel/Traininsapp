import type { DatabaseDriver } from '@/core/database';
import type { Clock } from '@/shared/lib/clock';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { isRecoveryState, RecoveryError, type RecoveryEntry, type RecoveryInput } from './recovery';
import { RecoveryRepository } from './recoveryRepository';

/**
 * The daily recovery note. One entry per day; saving replaces it, and an entry with neither a
 * state nor a rest day is removed – "not entered" stays distinguishable from "poorly recovered".
 */
export class RecoveryService {
  private readonly repository: RecoveryRepository;

  constructor(
    db: DatabaseDriver,
    private readonly clock: Clock,
  ) {
    this.repository = new RecoveryRepository(db);
  }

  listBetween(profileId: string, from: string, to: string): Promise<RecoveryEntry[]> {
    return this.repository.listBetween(profileId, from, to);
  }

  get(profileId: string, localDate: string): Promise<RecoveryEntry | null> {
    return this.repository.find(profileId, localDate);
  }

  async save(
    profileId: string,
    localDate: string,
    input: RecoveryInput,
  ): Promise<RecoveryEntry | null> {
    if (!isLocalDateKey(localDate)) throw new RecoveryError('invalid-date');
    if (localDate > toLocalDateKey(this.clock())) throw new RecoveryError('future-date');
    if (input.state !== null && !isRecoveryState(input.state)) {
      throw new RecoveryError('invalid-state');
    }
    if (input.state === null && !input.restDay) {
      await this.repository.delete(profileId, localDate);
      return null;
    }
    const now = this.clock().toISOString();
    const existing = await this.repository.find(profileId, localDate);
    const entry: RecoveryEntry = {
      id: existing?.id ?? createId(),
      profileId,
      localDate,
      state: input.state,
      restDay: input.restDay,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.repository.upsert(entry);
    return entry;
  }
}
