import { useI18n } from '@/core/i18n';
import { sumNutrients, type DefaultMealKey, type FoodEntry } from '@/core/nutrition';
import { Button, Icon, ICON_FOR, Sheet, type IconName } from '@/ui';
import type { MealGroup } from '../domain/day';
import { formatGrams, formatKcal, formatQuantity, mealName } from '../domain/format';
import styles from './Nutrition.module.css';

const MEAL_ICONS: Record<DefaultMealKey, IconName> = {
  breakfast: ICON_FOR.breakfast,
  lunch: ICON_FOR.lunch,
  dinner: ICON_FOR.dinner,
  snacks: ICON_FOR.snack,
};

const mealIcon = (group: MealGroup): IconName =>
  group.defaultKey ? MEAL_ICONS[group.defaultKey] : ICON_FOR.mealsOfDay;

/**
 * The meals of the day as one calm overview: name and kcal per meal, one quick "+" each. The
 * foods of a meal are a detail – tapping the meal opens them (`MealDetailsSheet`); an empty meal
 * has nothing to show, so tapping it adds a food right away.
 */
export function MealList({
  groups,
  onOpen,
  onAdd,
}: {
  groups: readonly MealGroup[];
  onOpen: (group: MealGroup) => void;
  onAdd: (group: MealGroup) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <section className={styles.meals} aria-label={t('nutrition.mealSection.listLabel')}>
      <ul className={styles.mealRows}>
        {groups.map((group) => {
          const name = mealName(group, t);
          const kcal = formatKcal(
            sumNutrients(group.entries.map((entry) => entry.nutrients)).totals.energyKcal,
            locale,
          );
          const empty = group.entries.length === 0;
          return (
            <li key={group.key} className={styles.mealRow}>
              <button
                type="button"
                className={styles.mealOpen}
                aria-label={`${name} · ${kcal}`}
                onClick={() => {
                  if (empty) onAdd(group);
                  else onOpen(group);
                }}
              >
                {/* A soft tile per meal time (natural tints), the same symbol as everywhere. */}
                <span className={styles.mealIcon} data-meal={group.defaultKey ?? 'custom'}>
                  <Icon name={mealIcon(group)} size={20} />
                </span>
                <span className={styles.mealName}>{name}</span>
                <span className={styles.mealKcal}>{kcal}</span>
              </button>
              {group.active ? (
                <button
                  type="button"
                  className={styles.mealQuickAdd}
                  aria-label={t('nutrition.mealSection.addTo', { meal: name })}
                  onClick={() => {
                    onAdd(group);
                  }}
                >
                  <Icon name="plus" size={20} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One meal in detail: its foods with amount, macros and kcal (tap to edit or delete), adding
 * more, and saving the meal as a template. A hidden meal only shows what was logged in it.
 */
export function MealDetailsSheet({
  group,
  onAdd,
  onEdit,
  onSaveTemplate,
  onClose,
}: {
  group: MealGroup;
  onAdd: () => void;
  onEdit: (entry: FoodEntry) => void;
  onSaveTemplate: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const name = mealName(group, t);
  const totals = sumNutrients(group.entries.map((entry) => entry.nutrients)).totals;
  const macros = (nutrients: { proteinG: number; carbsG: number; fatG: number }) =>
    [
      `${t('nutrition.short.protein')} ${formatGrams(nutrients.proteinG, locale)}`,
      `${t('nutrition.short.carbohydrates')} ${formatGrams(nutrients.carbsG, locale)}`,
      `${t('nutrition.short.fat')} ${formatGrams(nutrients.fatG, locale)}`,
    ].join(' · ');
  const canSaveTemplate = group.active && group.entries.some((entry) => entry.foodId !== null);

  return (
    <Sheet title={name} onClose={onClose} closeLabel={t('common.close')}>
      <p className={styles.mealSummary}>
        <span className={styles.mealSummaryKcal}>{formatKcal(totals.energyKcal, locale)}</span>
        {group.entries.length > 0 ? <span>{macros(totals)}</span> : null}
      </p>
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
                    {`${formatQuantity(entry.amount, entry.unit, t, locale)} · ${macros(entry.nutrients)}`}
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
      {canSaveTemplate ? (
        <Button variant="secondary" fullWidth onClick={onSaveTemplate}>
          {t('nutrition.mealSection.saveAsTemplate')}
        </Button>
      ) : null}
    </Sheet>
  );
}
