import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { sumNutrients, type DefaultMealKey, type FoodEntry } from '@/core/nutrition';
import { Button, Icon, Sheet, type IconName } from '@/ui';
import type { MealGroup } from '../domain/day';
import { formatGrams, formatKcal, formatQuantity, mealName } from '../domain/format';
import styles from './Nutrition.module.css';

const MEAL_ICONS: Record<DefaultMealKey, IconName> = {
  breakfast: 'cup',
  lunch: 'plate',
  dinner: 'moon',
  snacks: 'apple',
};

/**
 * One meal of the day as a group: its name and kcal, the logged foods as its content and one
 * quiet "+ Hinzufügen". Saving the foods as a template is a rarer action behind the meal's
 * "more" button. A hidden meal only shows what was logged in it.
 */
export function MealSection({
  group,
  onAdd,
  onEdit,
  onSaveTemplate,
}: {
  group: MealGroup;
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onSaveTemplate: () => void;
}) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const [menu, setMenu] = useState(false);
  const name = mealName(group, t);
  const totals = sumNutrients(group.entries.map((entry) => entry.nutrients)).totals;
  const macros = (entry: FoodEntry) =>
    [
      `${t('nutrition.short.protein')} ${formatGrams(entry.nutrients.proteinG, locale)}`,
      `${t('nutrition.short.carbohydrates')} ${formatGrams(entry.nutrients.carbsG, locale)}`,
      `${t('nutrition.short.fat')} ${formatGrams(entry.nutrients.fatG, locale)}`,
    ].join(' · ');
  const canSaveTemplate = group.active && group.entries.some((entry) => entry.foodId !== null);

  return (
    <section className={styles.meal} aria-labelledby={titleId}>
      <div className={styles.mealHead}>
        <Icon
          name={group.defaultKey ? MEAL_ICONS[group.defaultKey] : 'nutrition'}
          size={20}
          className={styles.mealIcon}
        />
        {/* Read as one heading ("Frühstück · 454 kcal"); shown as name and quieter kcal. */}
        <h2
          id={titleId}
          className={styles.mealTitle}
          aria-label={`${name} · ${formatKcal(totals.energyKcal, locale)}`}
        >
          <span>{name}</span>
          <span className={styles.mealKcal}>{formatKcal(totals.energyKcal, locale)}</span>
        </h2>
        {canSaveTemplate ? (
          <button
            type="button"
            className={styles.mealMore}
            aria-label={t('nutrition.mealSection.more', { meal: name })}
            onClick={() => {
              setMenu(true);
            }}
          >
            <Icon name="more" size={20} />
          </button>
        ) : null}
      </div>
      <div className={styles.mealBody}>
        {group.entries.length > 0 ? (
          <ul className={styles.mealEntries} aria-label={name}>
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={styles.mealEntry}
                  onClick={() => {
                    onEdit(entry);
                  }}
                >
                  <span className={styles.mealEntryText}>
                    <span className={styles.mealEntryName}>{entry.name}</span>
                    <span className={styles.mealEntryDetail}>
                      {`${formatQuantity(entry.amount, entry.unit, t, locale)} · ${macros(entry)}`}
                    </span>
                  </span>
                  <span className={styles.mealEntryKcal}>
                    {formatKcal(entry.nutrients.energyKcal, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {group.active ? (
          <button
            type="button"
            className={styles.mealAdd}
            aria-label={t('nutrition.mealSection.addTo', { meal: name })}
            onClick={onAdd}
          >
            <Icon name="plus" size={18} />
            {t('nutrition.mealSection.add')}
          </button>
        ) : (
          <p className={styles.empty}>{t('nutrition.mealSection.hiddenMeal')}</p>
        )}
      </div>
      {menu ? (
        <Sheet
          title={name}
          onClose={() => {
            setMenu(false);
          }}
          closeLabel={t('common.close')}
        >
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setMenu(false);
              onSaveTemplate();
            }}
          >
            {t('nutrition.mealSection.saveAsTemplate')}
          </Button>
        </Sheet>
      ) : null}
    </section>
  );
}
