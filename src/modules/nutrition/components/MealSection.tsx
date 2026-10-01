import { useI18n } from '@/core/i18n';
import { sumNutrients, type DefaultMealKey, type FoodEntry } from '@/core/nutrition';
import { List, ListRow, Section, type IconName } from '@/ui';
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
 * One meal of the day with its entries and kcal. Active meals offer "Add" (and saving the
 * logged foods as a template); a hidden meal only shows what was logged in it.
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
  const name = mealName(group, t);
  const totals = sumNutrients(group.entries.map((entry) => entry.nutrients)).totals;
  const macros = (entry: FoodEntry) =>
    [
      `${t('nutrition.short.protein')} ${formatGrams(entry.nutrients.proteinG, locale)}`,
      `${t('nutrition.short.carbohydrates')} ${formatGrams(entry.nutrients.carbsG, locale)}`,
      `${t('nutrition.short.fat')} ${formatGrams(entry.nutrients.fatG, locale)}`,
    ].join(' · ');

  return (
    <Section
      title={`${name} · ${formatKcal(totals.energyKcal, locale)}`}
      icon={group.defaultKey ? MEAL_ICONS[group.defaultKey] : 'nutrition'}
    >
      <List label={name}>
        {group.entries.map((entry) => (
          <ListRow
            key={entry.id}
            title={entry.name}
            subtitle={`${formatQuantity(entry.amount, entry.unit, t, locale)} · ${macros(entry)}`}
            value={formatKcal(entry.nutrients.energyKcal, locale)}
            onPress={() => {
              onEdit(entry);
            }}
          />
        ))}
        {group.active ? (
          <ListRow
            title={t('nutrition.mealSection.addTo', { meal: name })}
            icon="plus"
            action
            onPress={onAdd}
          />
        ) : null}
        {group.active && group.entries.some((entry) => entry.foodId !== null) ? (
          <ListRow
            title={t('nutrition.mealSection.saveAsTemplate')}
            action
            onPress={onSaveTemplate}
          />
        ) : null}
      </List>
      {group.entries.length === 0 ? (
        <p className={styles.empty}>{t('nutrition.mealSection.empty')}</p>
      ) : null}
      {!group.active ? (
        <p className={styles.empty}>{t('nutrition.mealSection.hiddenMeal')}</p>
      ) : null}
    </Section>
  );
}
