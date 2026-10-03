import type { TranslateFn } from '@/core/i18n';
import type { Recipe } from '@/core/nutrition';

/** "4 Portionen · 3 Zutaten · 350 kcal pro Portion" – a recipe in a list. */
export function recipeSubtitle(
  recipe: Pick<Recipe, 'servings' | 'ingredients'>,
  kcalPerServing: number | null,
  t: TranslateFn,
  locale: string,
): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const count = recipe.ingredients.length;
  return [
    recipe.servings === 1
      ? t('nutrition.recipes.servingsOne')
      : t('nutrition.recipes.servingsCount', { count: number.format(recipe.servings) }),
    count === 0
      ? t('nutrition.recipes.noIngredientsShort')
      : count === 1
        ? t('nutrition.recipes.ingredientsOne')
        : t('nutrition.recipes.ingredientsCount', { count }),
    kcalPerServing === null
      ? null
      : t('nutrition.recipes.kcalPerServing', {
          kcal: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(kcalPerServing),
        }),
  ]
    .filter(Boolean)
    .join(' · ');
}
