import { useId } from 'react';
import { useI18n } from '@/core/i18n';
import type { MealSlot } from '@/core/nutrition';
import { mealName } from '../domain/format';
import styles from './Nutrition.module.css';

/** Chooses the meal an entry belongs to; a hidden current meal stays selectable as is. */
export function MealSelect({
  meals,
  value,
  onChange,
  current,
}: {
  meals: readonly MealSlot[];
  value: string;
  onChange: (mealId: string) => void;
  /** The entry's meal when it is hidden by now (keeps the select's value valid). */
  current?: { id: string; label: string } | null;
}) {
  const { t } = useI18n();
  const id = useId();
  const options = meals.map((meal) => ({ id: meal.id, label: mealName(meal, t) }));
  if (current && !options.some((option) => option.id === current.id)) options.push(current);
  return (
    <div className={styles.pairItem}>
      <label htmlFor={id} className={styles.label}>
        {t('nutrition.entry.meal')}
      </label>
      <select
        id={id}
        className={styles.field}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
