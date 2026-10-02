/**
 * Self-reported recovery of a day: how recovered the user felt and whether it was a rest day.
 * A subjective note by the user – Kalethra never interprets it medically. Pure.
 */
export const RECOVERY_STATES = ['poor', 'moderate', 'good'] as const;
export type RecoveryState = (typeof RECOVERY_STATES)[number];

export interface RecoveryEntry {
  id: string;
  profileId: string;
  /** Local day (YYYY-MM-DD); one entry per day. */
  localDate: string;
  /** `null` when only a rest day was marked. */
  state: RecoveryState | null;
  restDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryInput {
  state: RecoveryState | null;
  restDay: boolean;
}

export type RecoveryErrorCode = 'invalid-date' | 'future-date' | 'invalid-state';

export class RecoveryError extends Error {
  constructor(readonly code: RecoveryErrorCode) {
    super(`Recovery: ${code}`);
    this.name = 'RecoveryError';
  }
}

export const isRecoveryState = (value: unknown): value is RecoveryState =>
  (RECOVERY_STATES as readonly unknown[]).includes(value);
