import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  matchesFoodSearch,
  useNutritionData,
  type Food,
  type MealSlot,
  type SavedMeal,
} from '@/core/nutrition';
import { List, ListRow, SegmentedControl, Sheet } from '@/ui';
import { formatQuantity, mealName } from '../domain/format';
import { ApplyTemplateSheet } from './ApplyTemplateSheet';
import { FoodFormSheet } from './FoodFormSheet';
import { FoodQuantitySheet } from './FoodQuantitySheet';
import styles from './Nutrition.module.css';

type Tab = 'foods' | 'templates';

type Step =
  | { kind: 'search' }
  | { kind: 'create'; name: string }
  | { kind: 'quantity'; food: Food }
  | { kind: 'template'; template: SavedMeal };

/**
 * Adding to a meal: search the local foods (or pick a saved meal), create a food on the spot,
 * then enter the amount. Every step's back action returns to the search, so the system back
 * gesture never discards more than the current step.
 */
export function AddSheet({
  day,
  meal,
  meals,
  onClose,
}: {
  day: string;
  meal: MealSlot;
  meals: readonly MealSlot[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const data = useNutritionData(
    async (s, profileId) => ({
      foods: await s.foods.list(profileId),
      templates: await s.meals.listSavedMeals(profileId),
    }),
    [],
  );
  const back = () => {
    setStep({ kind: 'search' });
  };

  if (step.kind === 'create') {
    return (
      <FoodFormSheet
        initialName={step.name}
        onSaved={(food) => {
          setStep({ kind: 'quantity', food });
        }}
        onClose={back}
      />
    );
  }
  if (step.kind === 'quantity') {
    return (
      <FoodQuantitySheet
        food={step.food}
        day={day}
        meals={meals}
        mealId={meal.id}
        onBack={back}
        onDone={onClose}
      />
    );
  }
  if (step.kind === 'template') {
    return (
      <ApplyTemplateSheet
        template={step.template}
        day={day}
        meals={meals}
        mealId={meal.id}
        onBack={back}
        onDone={onClose}
      />
    );
  }

  const foods =
    data.status === 'ready' ? data.data.foods.filter((food) => matchesFoodSearch(food, query)) : [];
  const templates = data.status === 'ready' ? data.data.templates : [];

  return (
    <Sheet
      title={t('nutrition.add.title', { meal: mealName(meal, t) })}
      onClose={onClose}
      closeLabel={t('common.close')}
      fill
    >
      <SegmentedControl
        label={t('nutrition.add.kind')}
        options={[
          { value: 'foods', label: t('nutrition.add.foodsTab') },
          { value: 'templates', label: t('nutrition.add.templatesTab') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'foods' ? (
        <>
          <label htmlFor={searchId} className="visually-hidden">
            {t('nutrition.add.search')}
          </label>
          <input
            id={searchId}
            className={styles.search}
            type="search"
            value={query}
            placeholder={t('nutrition.add.searchPlaceholder')}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <div className={styles.scroll} data-testid="food-search-list">
            <List label={t('nutrition.add.foodsTab')}>
              <ListRow
                title={t('nutrition.add.create')}
                action
                onPress={() => {
                  setStep({ kind: 'create', name: query });
                }}
              />
              {foods.map((food) => (
                <ListRow
                  key={food.id}
                  title={food.name}
                  subtitle={[
                    food.brand,
                    food.source === 'custom' ? t('nutrition.add.own') : null,
                    t('nutrition.add.perReference', {
                      kcal: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
                        food.nutrients.energyKcal,
                      ),
                      amount: formatQuantity(food.reference.amount, food.reference.unit, t, locale),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => {
                    setStep({ kind: 'quantity', food });
                  }}
                />
              ))}
            </List>
            {data.status === 'ready' && foods.length === 0 ? (
              <p className={styles.empty}>
                {data.data.foods.length === 0
                  ? t('nutrition.add.noFoods')
                  : t('nutrition.add.noResults')}
              </p>
            ) : null}
            {data.status === 'error' ? (
              <p className={styles.error} role="alert">
                {t('nutrition.errors.loadFailed')}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className={styles.scroll}>
          {templates.length > 0 ? (
            <List label={t('nutrition.add.templatesTab')}>
              {templates.map((template) => (
                <ListRow
                  key={template.id}
                  title={template.name}
                  subtitle={t('nutrition.templates.itemCount', { count: template.items.length })}
                  onPress={() => {
                    setStep({ kind: 'template', template });
                  }}
                />
              ))}
            </List>
          ) : data.status === 'ready' ? (
            <p className={styles.empty}>{t('nutrition.add.noTemplates')}</p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
