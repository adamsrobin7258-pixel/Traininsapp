import type { Clock } from '@/shared/lib/clock';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { createId } from '@/shared/lib/id';
import type { ProfileRepository } from './profileRepository';
import {
  BODY_DATA_LIMITS,
  DISPLAY_NAME_MAX_LENGTH,
  PROFILE_SEXES,
  type BodyData,
  type Profile,
} from './types';

/** Rejected body data (the UI shows the matching message). */
export class BodyDataError extends Error {
  constructor(readonly field: 'sex' | 'birthDate' | 'heightCm') {
    super(`Invalid body data: ${field}`);
    this.name = 'BodyDataError';
  }
}

/** Trims and limits a display name. Empty input clears the name. */
export function normalizeDisplayName(input: string): string | null {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return null;
  return Array.from(collapsed).slice(0, DISPLAY_NAME_MAX_LENGTH).join('').trim();
}

/** Up to two uppercase initials for avatars, e.g. "Anna Maria Schmidt" -> "AS". */
export function getInitials(displayName: string | null): string {
  if (!displayName) return '';
  const words = displayName.split(' ').filter(Boolean);
  const first = words[0];
  if (!first) return '';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letters = [first, last].map((word) => (word ? (Array.from(word)[0] ?? '') : ''));
  return letters.join('').toLocaleUpperCase();
}

export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  /** Returns the local profile, creating it on first launch. */
  async ensureLocalProfile(): Promise<Profile> {
    const existing = await this.repository.findFirstActive();
    if (existing) return existing;

    const now = this.clock().toISOString();
    const profile: Profile = {
      id: createId(),
      displayName: null,
      sex: null,
      birthDate: null,
      heightCm: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.insert(profile);
    return profile;
  }

  async rename(profile: Profile, input: string): Promise<Profile> {
    const displayName = normalizeDisplayName(input);
    if (displayName === profile.displayName) return profile;
    const updatedAt = this.clock().toISOString();
    await this.repository.updateDisplayName(profile.id, displayName, updatedAt);
    return { ...profile, displayName, updatedAt };
  }

  /** Body data of a profile (for nutrition estimates), empty when unknown. */
  async getBodyData(profileId: string): Promise<BodyData> {
    const profile = await this.repository.findById(profileId);
    return {
      sex: profile?.sex ?? null,
      birthDate: profile?.birthDate ?? null,
      heightCm: profile?.heightCm ?? null,
    };
  }

  /** Saves sex, birth date and height; each may be cleared with `null`. */
  async updateBodyData(profile: Profile, data: BodyData): Promise<Profile> {
    const today = toLocalDateKey(this.clock());
    if (data.sex !== null && !PROFILE_SEXES.includes(data.sex)) throw new BodyDataError('sex');
    if (
      data.birthDate !== null &&
      (!isLocalDateKey(data.birthDate) ||
        data.birthDate < BODY_DATA_LIMITS.earliestBirthDate ||
        data.birthDate > today)
    ) {
      throw new BodyDataError('birthDate');
    }
    const { min, max } = BODY_DATA_LIMITS.heightCm;
    if (
      data.heightCm !== null &&
      (!Number.isFinite(data.heightCm) || data.heightCm < min || data.heightCm > max)
    ) {
      throw new BodyDataError('heightCm');
    }
    const updatedAt = this.clock().toISOString();
    await this.repository.updateBodyData(profile.id, data, updatedAt);
    return { ...profile, ...data, updatedAt };
  }
}
