import type { DatabaseDriver } from '@/core/database';
import { SettingsRepository, SettingsService, type AppSettings } from '@/core/settings';
import { LocalOnlySyncService, type SyncService } from '@/core/sync';
import { ProfileRepository, ProfileService, type Profile } from '@/core/user';
import { systemClock, type Clock } from '@/shared/lib/clock';

/** Composition root: wires repositories and services to one database connection. */
export interface AppServices {
  settings: SettingsService;
  profile: ProfileService;
  sync: SyncService;
}

export function createServices(db: DatabaseDriver, clock: Clock = systemClock): AppServices {
  return {
    settings: new SettingsService(new SettingsRepository(db, clock)),
    profile: new ProfileService(new ProfileRepository(db), clock),
    sync: new LocalOnlySyncService(),
  };
}

export interface InitialState {
  settings: AppSettings;
  profile: Profile;
}

export async function loadInitialState(services: AppServices): Promise<InitialState> {
  const [settings, profile] = await Promise.all([
    services.settings.load(),
    services.profile.ensureLocalProfile(),
  ]);
  return { settings, profile };
}
