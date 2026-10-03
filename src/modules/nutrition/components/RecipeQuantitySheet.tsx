import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  isValidAmount,
  scaleNutrients,
  useNutrition,
  useNutritionData,
  type MealSlot,
  type Recipe,
} from '@/core/nutrition';
import { Button, Sheet } from '@/ui';
import { describeAmountError, describeNutritionError } from '../domain/format';
import { formatNumberInput, parseAmountInput } from '../domain/input';
import { MealSelect } from './MealSelect';
import { NutrientPreview } from './NutrientPreview';
import styles from './Nutrition.module.css';

/**
 * Logs servings of a recipe (e.g. 0,5 or 2 of 4). The nutrients per serving come from the
 * recipe service; the diary stores them as a snapshot, so later changes of the recipe never
 * change this day.
 */
export function RecipeQuantitySheet({
  recipe,
  day,
  meals,
  mealId: initialMealId,
  onBack,
  onDone,
}: {
  recipe: Recipe;
  day: string;
  meals: readonly MealSlot[];
  mealId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const amountId = useId();
  const errorId = useId();
  const [amount, setAmount] = useState(formatNumberInput(1, locale));
  const [mealId, setMealId] = useState(initialMealId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nutrition = useNutritionData(
    (s, profileId) => s.recipes.nutrition(profileId, recipe.id),
    [recipe],
  );

  const parsed = parseAmountInput(amount, isValidAmount);
  const preview =
    parsed.ok && nutrition.status === 'ready'
      ? scaleNutrients(nutrition.data.perServing.totals, parsed.value)
      : null;

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!parsed.ok) {
      setError(describeAmountError(parsed.error, t));
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        s.diary.addRecipe(profileId, {
          recipeId: recipe.id,
          servings: parsed.value,
          localDate: day,
          mealId,
        }),
      );
      onDone();
    } catch (failure) {
      setError(describeNutritionError(failure, t));
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={t('nutrition.recipes.logTitle', { name: recipe.name })}
      onClose={onBack}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <p className={styles.hint}>
          {recipe.servings === 1
            ? t('nutrition.recipes.makesOne')
            : t('nutrition.recipes.makes', {
                servings: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                  recipe.servings,
                ),
              })}
        </p>
        {recipe.ingredients.length === 0 ? (
          <p className={styles.warning}>{t('nutrition.recipes.noIngredients')}</p>
        ) : null}
        <label htmlFor={amountId} className={styles.label}>
          {t('nutrition.recipes.servingsToLog')}
        </label>
        {/* No autofocus: choosing a recipe never opens the keyboard by itself. */}
        <input
          id={amountId}
          className={styles.field}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={amount}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
        />
        <MealSelect meals={meals} value={mealId} onChange={setMealId} />
        <p className={styles.label}>{t('nutrition.add.preview')}</p>
        <NutrientPreview nutrients={preview} />
        <p className={styles.hint}>{t('nutrition.recipes.snapshotHint')}</p>
        {nutrition.status === 'error' || error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error ?? t('nutrition.errors.loadFailed')}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onBack}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('nutrition.add.save')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
