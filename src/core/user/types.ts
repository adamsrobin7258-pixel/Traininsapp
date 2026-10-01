/**
 * The person using the app. Every installation starts with a local profile, so the
 * app works without an account. A cloud account can be linked to it later.
 */
export const PROFILE_SEXES = ['male', 'female', 'unspecified'] as const;
export type ProfileSex = (typeof PROFILE_SEXES)[number];

/**
 * Body data used for nutrition estimates. The age is derived from the birth date when needed
 * (never stored); the weight lives in the health module's weight entries.
 */
export interface BodyData {
  sex: ProfileSex | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  heightCm: number | null;
}

/** Accepted when saving; the nutrition calculation applies its own, narrower limits. */
export const BODY_DATA_LIMITS = {
  heightCm: { min: 100, max: 250 },
  earliestBirthDate: '1900-01-01',
} as const;

export interface Profile extends BodyData {
  id: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DISPLAY_NAME_MAX_LENGTH = 40;
