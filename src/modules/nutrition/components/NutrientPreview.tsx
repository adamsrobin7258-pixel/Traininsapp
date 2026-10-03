import { useI18n } from '@/core/i18n';
import type { Nutrients } from '@/core/nutrition';
import { formatGrams, formatKcal } from '../domain/format';
import styles from './Nutrition.module.css';

/** Live nutrients of the amount being entered; "–" while the amount is not valid. */
export function NutrientPreview({
  nutrients,
  label,
}: {
  nutrients: Nutrients | null;
  /** Accessible name of the group; by default "Nährwerte für diese Menge". */
  label?: string;
}) {
  const { t, locale } = useI18n();
  const items = [
    {
      label: t('nutrition.nutrients.energy'),
      value: nutrients ? formatKcal(nutrients.energyKcal, locale) : '–',
    },
    {
      label: t('nutrition.nutrients.protein'),
      value: nutrients ? formatGrams(nutrients.proteinG, locale) : '–',
    },
    {
      label: t('nutrition.nutrients.carbohydrates'),
      value: nutrients ? formatGrams(nutrients.carbsG, locale) : '–',
    },
    {
      label: t('nutrition.nutrients.fat'),
      value: nutrients ? formatGrams(nutrients.fatG, locale) : '–',
    },
  ];
  return (
    <div
      className={styles.preview}
      role="group"
      aria-live="polite"
      aria-label={label ?? t('nutrition.add.preview')}
    >
      {items.map((item) => (
        <div key={item.label} className={styles.figure}>
          <span className={styles.previewValue}>{item.value}</span>
          <span className={styles.previewLabel}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
