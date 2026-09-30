import type { Clock } from '@/shared/lib/clock';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import { isWeightInRange, type WeightEntry } from './weight';
import type { WeightRepository } from './weightRepository';

export type WeightErrorCode = 'invalid-date' | 'future-date' | 'out-of-range' | 'not-found';

/** A rule violation that the UI can explain; storage failures surface as other errors. */
export class WeightError extends Error {
  constructor(readonly code: WeightErrorCode) {
    super(`Weight operation rejected: ${code}`);
    this.name = 'WeightError';
  }
}

export interface SaveWeightResult {
  entry: WeightEntry;
  /** True when an existing value for that day was replaced. */
  replaced: boolean;
}

/** Periods for the chart; `all` has no lower bound. */
export const WEIGHT_PERIODS = ['1m', '3m', '1y', 'all'] as const;
export type WeightPeriod = (typeof WEIGHT_PERIODS)[number];

const PERIOD_DAYS: Record<Exclude<WeightPeriod, 'all'>, number> = { '1m': 30, '3m': 91, '1y': 365 };

export class WeightService {
  constructor(
    private readonly repository: WeightRepository,
    private readonly clock: Clock,
  ) {}

  todayKey(): string {
    return toLocalDateKey(this.clock());
  }

  async getForDate(profileId: string, date: string): Promise<WeightEntry | null> {
    this.assertDate(date);
    return this.repository.findByDate(profileId, date);
  }

  /** Latest value on or before a local day (e.g. for nutrition calculations of that day). */
  getLatestOnOrBefore(profileId: string, date: string): Promise<WeightEntry | null> {
    this.assertDate(date);
    return this.repository.findLatest(profileId, date);
  }

  /** Latest value on or before today, for "current weight". */
  getLatest(profileId: string): Promise<WeightEntry | null> {
    return this.repository.findLatest(profileId, this.todayKey());
  }

  getHistory(profileId: string, limit: number, offset = 0): Promise<WeightEntry[]> {
    return this.repository.listRecent(profileId, limit, offset);
  }

  countEntries(profileId: string): Promise<number> {
    return this.repository.count(profileId);
  }

  getTrend(profileId: string, period: WeightPeriod): Promise<WeightEntry[]> {
    const today = this.clock();
    const from =
      period === 'all'
        ? null
        : toLocalDateKey(
            new Date(today.getFullYear(), today.getMonth(), today.getDate() - PERIOD_DAYS[period]),
          );
    return this.repository.listRange(profileId, from, this.todayKey());
  }

  /** Saves the day's weight. An existing value for that day is replaced, never duplicated. */
  async save(profileId: string, date: string, kg: number): Promise<SaveWeightResult> {
    this.assertDate(date);
    this.assertWeight(kg);
    const existing = await this.repository.findByDate(profileId, date);
    const now = this.clock().toISOString();
    const entry: WeightEntry = existing
      ? { ...existing, kg, updatedAt: now }
      : { id: createId(), profileId, date, kg, createdAt: now, updatedAt: now };
    await this.repository.upsertForDate(entry);
    return { entry, replaced: existing !== null };
  }

  async update(profileId: string, id: string, kg: number): Promise<WeightEntry> {
    this.assertWeight(kg);
    const existing = await this.repository.findById(profileId, id);
    if (!existing) throw new WeightError('not-found');
    const updatedAt = this.clock().toISOString();
    if (!(await this.repository.updateValue(profileId, id, kg, updatedAt))) {
      throw new WeightError('not-found');
    }
    return { ...existing, kg, updatedAt };
  }

  async delete(profileId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(profileId, id))) throw new WeightError('not-found');
  }

  private assertDate(date: string) {
    if (!isLocalDateKey(date)) throw new WeightError('invalid-date');
    // YYYY-MM-DD keys compare correctly as strings.
    if (date > this.todayKey()) throw new WeightError('future-date');
  }

  private assertWeight(kg: number) {
    if (!isWeightInRange(kg)) throw new WeightError('out-of-range');
  }
}
