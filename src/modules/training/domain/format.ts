import type { TranslateFn, TranslationKey } from '@/core/i18n';
import {
  getTrainingType,
  WEIGHT_INPUT_DECIMALS,
  type ExerciseType,
  type SetValues,
} from '@/core/training';
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { fromKg, roundTo, type WeightUnit } from '@/shared/lib/units';

/** "52 min", "1 h 05 min" – compact and the same in German and English. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "Heute", "Gestern" or a short date such as "Mo., 28.09." */
export function relativeDay(localDate: string, today: string, locale: string, t: TranslateFn) {
  if (localDate === today) return t('training.today');
  const todayDate = parseLocalDateKey(today);
  if (todayDate && localDate === toLocalDateKey(addDays(todayDate, -1))) {
    return t('training.yesterday');
  }
  const date = parseLocalDateKey(localDate);
  if (!date) return localDate;
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(date)
    .replace(/\.$/, '.');
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
