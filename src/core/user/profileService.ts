import type { Clock } from '@/shared/lib/clock';
import { createId } from '@/shared/lib/id';
import type { ProfileRepository } from './profileRepository';
import { DISPLAY_NAME_MAX_LENGTH, type Profile } from './types';

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
    const profile: Profile = { id: createId(), displayName: null, createdAt: now, updatedAt: now };
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
}
