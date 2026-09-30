import type { ComponentType } from 'react';
import type { TranslationKey } from '@/core/i18n';
import type { IconName } from '@/ui';
import type { ModuleId } from './routes';

/**
 * Contract every feature module exposes to the app shell. The shell builds the
 * router and the tab bar from these definitions; it knows nothing else about a module.
 */
export interface AppModule {
  id: ModuleId;
  path: string;
  /** Label in the tab bar. */
  navLabelKey: TranslationKey;
  icon: IconName;
  Screen: ComponentType;
}
