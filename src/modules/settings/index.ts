import type { AppModule } from '@/app/moduleTypes';
import { ROUTES } from '@/app/routes';
import { AppSettingsScreen } from './screens/AppSettingsScreen';
import { ContentScreen } from './screens/ContentScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { ProfileSettingsScreen } from './screens/ProfileSettingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export const settingsModule: AppModule = {
  id: 'settings',
  path: ROUTES.settings,
  Screen: SettingsScreen,
  // Paths must match SETTINGS_LINKS in app/routes.ts.
  subRoutes: [
    { path: 'profile', Screen: ProfileSettingsScreen },
    { path: 'goals', Screen: GoalsScreen },
    { path: 'content', Screen: ContentScreen },
    { path: 'app', Screen: AppSettingsScreen },
  ],
  tab: { labelKey: 'nav.settings', icon: 'settings' },
};
