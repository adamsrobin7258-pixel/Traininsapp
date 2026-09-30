import type { ComponentType } from 'react';
import type { TranslationKey } from '@/core/i18n';
import type { IconName } from '@/ui';
import type { ModuleId } from './routes';

/** Maximum number of tabs that fit the bottom navigation on small phones. */
export const MAX_TABS = 5;

/**
 * Contract every feature module exposes to the app shell. The shell builds the
 * router and the tab bar from these definitions; it knows nothing else about a module.
 */
export interface AppModule {
  id: ModuleId;
  path: string;
  Screen: ComponentType;
  /** Nested screens below `path`, e.g. `{ path: 'plans/:planId', Screen }`. */
  subRoutes?: readonly { path: string; Screen: ComponentType }[];
  /**
   * Bottom-navigation entry. Omit it for modules that are reached from another screen
   * (e.g. running or cycling inside training) – they still get their route.
   */
  tab?: {
    labelKey: TranslationKey;
    icon: IconName;
  };
}
