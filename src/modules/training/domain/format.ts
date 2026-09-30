import type { TranslateFn, TranslationKey } from '@/core/i18n';
import {
  getTrainingType,
  groupSets,
  WEIGHT_INPUT_DECIMALS,
  type ExerciseType,
  type SetValues,
  type WorkoutSet,
} from '@/core/training';
import { formatRelativeDay } from '@/shared/lib/format';
import { fromKg, roundTo, type WeightUnit } from '@/shared/lib/units';

export { formatDuration } from '@/shared/lib/format';

/** "Heute", "Gestern" or a short date such as "Mo., 28.09." */
export function relativeDay(localDate: string, today: string, locale: string, t: TranslateFn) {
  return formatRelativeDay(localDate, today, locale, {
    today: t('training.today'),
    yesterday: t('training.yesterday'),
  });
}

export function trainingTypeLabel(id: string, t: TranslateFn): string {
  return t(`training.types.${getTrainingType(id).id}` as TranslationKey);
}

/** Load in the user's unit with up to two decimals: "80 kg", "82,5 kg", "181.25 lb". */
export function formatLoad(kg: number, unit: WeightUnit, locale: string): string {
  const value = roundTo(fromKg(kg, unit), WEIGHT_INPUT_DECIMALS);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: WEIGHT_INPUT_DECIMALS }).format(value)} ${unit}`;
}

/** One set in short form: "80 kg × 8", "+10 kg × 8", "12", "60 s", "40 m". */
export function formatSetShort(
  set: SetValues,
  type: ExerciseType,
  unit: WeightUnit,
  locale: string,
): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  switch (type) {
    case 'weighted':
      return `${set.weightKg !== null ? formatLoad(set.weightKg, unit, locale) : '–'} × ${set.reps ?? '–'}`;
    case 'bodyweight':
      return set.weightKg
        ? `+${formatLoad(set.weightKg, unit, locale)} × ${set.reps ?? '–'}`
        : `${set.reps ?? '–'}`;
    case 'timed':
      return `${set.durationS ?? '–'} s`;
    case 'distance':
      return `${set.distanceM !== null ? number.format(set.distanceM) : '–'} m${set.durationS ? ` · ${set.durationS} s` : ''}`;
  }
}

/**
 * Working sets with their drops, e.g. "100 kg × 8 · 100 kg × 7 ↓ 70 kg × 6". Warm-ups are left
 * out: "last time" is about the working performance.
 */
export function formatWorkingSets(
  sets: readonly WorkoutSet[],
  type: ExerciseType,
  unit: WeightUnit,
  locale: string,
): string {
  return groupSets(sets)
    .working.map((group) =>
      [group.set, ...group.drops].map((set) => formatSetShort(set, type, unit, locale)).join(' ↓ '),
    )
    .join(' · ');
}
