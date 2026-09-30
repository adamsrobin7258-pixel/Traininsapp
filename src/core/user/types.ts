/**
 * The person using the app. Every installation starts with a local profile, so the
 * app works without an account. A cloud account can be linked to it later.
 */
export interface Profile {
  id: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DISPLAY_NAME_MAX_LENGTH = 40;
