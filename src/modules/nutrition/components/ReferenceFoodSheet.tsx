import { useState } from 'react';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { foodCategory, useNutrition, type Food, type NutrientKey } from '@/core/nutrition';
import { Button, List, ListRow, Sheet } from '@/ui';
import {
  describeNutritionError,
  foodAttribution,
  foodSourceLabel,
  formatGrams,
  formatKcal,
} from '../domain/format';
import { FoodThumb } from './FoodThumb';
import styles from './Nutrition.module.css';

const ROWS: { key: NutrientKey; label: TranslationKey }[] = [
  { key: 'energyKcal', label: 'nutrition.nutrients.energy' },
  { key: 'proteinG', label: 'nutrition.nutrients.protein' },
  { key: 'carbsG', label: 'nutrition.nutrients.carbohydrates' },
  { key: 'fatG', label: 'nutrition.nutrients.fat' },
  { key: 'fiberG', label: 'nutrition.nutrients.fiber' },
  { key: 'sugarG', label: 'nutrition.nutrients.sugar' },
  { key: 'saturatedFatG', label: 'nutrition.nutrients.saturatedFat' },
];

/**
 * A reference food (BLS) is shown, never edited: its values come from the dataset. It can be a
 * favourite, and "edit as own copy" starts an editable food of the user's own.
 */
export function ReferenceFoodSheet({
  food,
  onEditCopy,
  onClose,
}: {
  food: Food;
  onEditCopy: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const [favorite, setFavorite] = useState(food.favorite);
  const [failure, setFailure] = useState<string | null>(null);
  const category = foodCategory(food);

  return (
    <Sheet title={t('nutrition.reference.title')} onClose={onClose} closeLabel={t('common.close')}>
      <div className={styles.stack}>
        <div className={styles.titleRow}>
          <FoodThumb food={food} size={56} labelled />
          <div className={styles.titleText}>
            <p className={styles.foodName}>{food.name}</p>
            <p className={styles.hint}>
              {[category ? t(`nutrition.categories.${category}`) : null, foodSourceLabel(food, t)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <p className={styles.notice}>{t('nutrition.reference.readOnly')}</p>
        <List label={t('nutrition.reference.per100')}>
          {ROWS.map(({ key, label }) => {
            const value = food.nutrients[key];
            return (
              <ListRow
                key={key}
                title={t(label)}
                value={
                  value === null
                    ? t('nutrition.reference.notStated')
                    : key === 'energyKcal'
                      ? formatKcal(value, locale)
                      : formatGrams(value, locale)
                }
              />
            );
          })}
        </List>
        <p className={styles.hint}>
          {t('nutrition.reference.per100')} · {foodAttribution(food, t)}
        </p>
        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        ) : null}
        <Button fullWidth onClick={onEditCopy}>
          {t('nutrition.reference.editCopy')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          aria-pressed={favorite}
          onClick={() => {
            const next = !favorite;
            setFavorite(next);
            mutate((s, profileId) => s.foods.setFavorite(profileId, food.id, next)).catch(
              (error: unknown) => {
                setFavorite(!next);
                setFailure(describeNutritionError(error, t));
              },
            );
          }}
        >
          {favorite ? t('nutrition.lookup.removeFavorite') : t('nutrition.lookup.addFavorite')}
        </Button>
      </div>
    </Sheet>
  );
}
