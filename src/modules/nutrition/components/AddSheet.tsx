import { useId, useState } from 'react';
import { useI18n } from '@/core/i18n';
import {
  useNutritionData,
  type Food,
  type MealSlot,
  type Recipe,
  type SavedMeal,
} from '@/core/nutrition';
import { EmptyState, ICON_FOR, List, ListRow, SegmentedControl, Sheet } from '@/ui';
import { mealName } from '../domain/format';
import { recipeSubtitle } from '../domain/recipes';
import { ApplyTemplateSheet } from './ApplyTemplateSheet';
import { useFoodPicker } from './useFoodPicker';
import { FoodQuantitySheet } from './FoodQuantitySheet';
import { RecipeFormSheet } from './RecipeFormSheet';
import { RecipeQuantitySheet } from './RecipeQuantitySheet';
import { matchesRecipe, useRecipes } from './useRecipes';
import styles from './Nutrition.module.css';

type Tab = 'foods' | 'templates' | 'recipes';

type Step =
  | { kind: 'choose' }
  | { kind: 'quantity'; food: Food }
  | { kind: 'template'; template: SavedMeal }
  | { kind: 'recipe'; recipe: Recipe }
  | { kind: 'create-recipe' };

/**
 * Adding to a meal: foods (shared food selection with search, barcode and "new food"),
 * templates and recipes. Every step's back action returns to the choice, so the system back
 * gesture never discards more than the current step. A new recipe is created with the same
 * form as in Meine Inhalte and can be logged right away.
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
  const recipeSearchId = useId();
  const [tab, setTab] = useState<Tab>('foods');
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [recipeQuery, setRecipeQuery] = useState('');
  const picker = useFoodPicker({
    onPicked: (food) => {
      setStep({ kind: 'quantity', food });
    },
  });
  const templates = useNutritionData((s, id) => s.meals.listSavedMeals(id), []);
  const recipes = useRecipes();
  const back = () => {
    setStep({ kind: 'choose' });
  };

  switch (step.kind) {
    case 'quantity':
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
    case 'template':
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
    case 'recipe':
      return (
        <RecipeQuantitySheet
          recipe={step.recipe}
          day={day}
          meals={meals}
          mealId={meal.id}
          onBack={back}
          onDone={onClose}
        />
      );
    case 'create-recipe':
      return (
        <RecipeFormSheet
          onSaved={(recipe) => {
            setStep({ kind: 'recipe', recipe });
          }}
          onClose={back}
        />
      );
    case 'choose':
      break;
  }
  if (tab === 'foods' && picker.overlay) return picker.overlay;

  const recipeList = recipes.status === 'ready' ? recipes.data : [];
  const recipeMatches = recipeList.filter(({ recipe }) => matchesRecipe(recipe, recipeQuery));

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
          { value: 'recipes', label: t('nutrition.add.recipesTab') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'foods' ? picker.panel : null}
      {tab === 'templates' ? (
        <div className={styles.scroll}>
          {templates.status === 'ready' && templates.data.length > 0 ? (
            <List label={t('nutrition.add.templatesTab')}>
              {templates.data.map((template) => (
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
          ) : templates.status === 'ready' ? (
            <EmptyState
              icon="plate"
              title={t('nutrition.add.noTemplates')}
              body={t('nutrition.add.noTemplatesBody')}
            />
          ) : null}
          {templates.status === 'error' ? (
            <p className={styles.error} role="alert">
              {t('nutrition.errors.loadFailed')}
            </p>
          ) : null}
        </div>
      ) : null}
      {tab === 'recipes' ? (
        <>
          {recipeList.length > 0 ? (
            <>
              <label htmlFor={recipeSearchId} className="visually-hidden">
                {t('nutrition.recipes.search')}
              </label>
              <input
                id={recipeSearchId}
                className={styles.search}
                type="search"
                value={recipeQuery}
                placeholder={t('nutrition.recipes.searchPlaceholder')}
                autoComplete="off"
                enterKeyHint="search"
                onChange={(event) => {
                  setRecipeQuery(event.target.value);
                }}
              />
            </>
          ) : null}
          <div className={styles.scroll}>
            <List label={t('nutrition.add.recipesTab')}>
              <ListRow
                title={t('nutrition.recipes.createQuick')}
                icon="plus"
                action
                onPress={() => {
                  setStep({ kind: 'create-recipe' });
                }}
              />
              {recipeMatches.map(({ recipe, kcalPerServing }) => (
                <ListRow
                  key={recipe.id}
                  title={recipe.name}
                  subtitle={recipeSubtitle(recipe, kcalPerServing, t, locale)}
                  onPress={() => {
                    setStep({ kind: 'recipe', recipe });
                  }}
                />
              ))}
            </List>
            {recipes.status === 'ready' && recipeList.length === 0 ? (
              <EmptyState
                icon={ICON_FOR.recipe}
                title={t('nutrition.recipes.empty')}
                body={t('nutrition.recipes.emptyBodyAdd')}
              />
            ) : recipes.status === 'ready' && recipeMatches.length === 0 ? (
              <EmptyState
                icon="search"
                title={t('nutrition.add.noResults')}
                body={t('nutrition.recipes.noResultsBody')}
              />
            ) : null}
            {recipes.status === 'error' ? (
              <p className={styles.error} role="alert">
                {t('nutrition.errors.loadFailed')}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
