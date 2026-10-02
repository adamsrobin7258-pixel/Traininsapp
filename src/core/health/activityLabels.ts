import type { TranslateFn, TranslationKey } from '@/core/i18n';
import { NAMED_ACTIVITY_TYPES, readableActivityType } from './externalWorkouts';

/**
 * Name of an imported activity: Kalethra's translation for known types, otherwise the
 * provider's own name made readable – an unknown type is never mapped to another sport.
 */
export function activityTypeLabel(type: string, t: TranslateFn): string {
  if (type === 'other' || NAMED_ACTIVITY_TYPES.includes(type)) {
    return t(`activities.types.${type}` as TranslationKey);
  }
  return readableActivityType(type);
}
