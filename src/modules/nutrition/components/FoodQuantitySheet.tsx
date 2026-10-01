import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  isValidAmount,
  nutrientsForQuantity,
  unitsFor,
  useNutrition,
  type Food,
  type MealSlot,
  type QuantityUnit,
} from '@/core/nutrition';
import { Button, Icon, Sheet } from '@/ui';
import { describeAmountError, describeNutritionError } from '../domain/format';
import { formatNumberInput, parseAmountInput } from '../domain/input';
import { MealSelect } from './MealSelect';
import { NutrientPreview } from './NutrientPreview';
import styles from './Nutrition.module.css';

/**
 * Step two of adding a food: amount, unit and meal, with the nutrients calculated live by the
 * core (`nutrientsForQuantity`). Only units the food can be converted to are offered.
 */
export function FoodQuantitySheet({
  food,
  day,
  meals,
  mealId: initialMealId,
  onBack,
  onDone,
}: {
  food: Food;
  day: string;
  meals: readonly MealSlot[];
  mealId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const amountId = useId();
  const unitId = useId();
  const errorId = useId();
  const units = unitsFor(food);
  const [amount, setAmount] = useState(formatNumberInput(food.reference.amount, locale));
  const [unit, setUnit] = useState<QuantityUnit>(food.reference.unit);
  const [mealId, setMealId] = useState(initialMealId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [favorite, setFavorite] = useState(food.favorite);

  const parsed = parseAmountInput(amount, isValidAmount);
  let preview = null;
  if (parsed.ok) {
    try {
      preview = nutrientsForQuantity(food, parsed.value, unit);
    } catch {
      preview = null;
    }
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!parsed.ok) {
      setError(describeAmountError(parsed.error, t));
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        s.diary.addFood(profileId, {
          localDate: day,
          mealId,
          foodId: food.id,
          amount: parsed.value,
          unit,
        }),
      );
      onDone();
    } catch (failure) {
      setError(describeNutritionError(failure, t));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t('nutrition.add.quantityTitle')} onClose={onBack} closeLabel={t('common.close')}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.foodName}>{food.name}</p>
            {food.brand ? <p className={styles.hint}>{food.brand}</p> : null}
          </div>
          <button
            type="button"
            className={styles.favorite}
            aria-pressed={favorite}
            aria-label={
              favorite ? t('nutrition.lookup.removeFavorite') : t('nutrition.lookup.addFavorite')
            }
            onClick={() => {
              const next = !favorite;
              setFavorite(next);
              mutate((s, profileId) => s.foods.setFavorite(profileId, food.id, next)).catch(
                (failure: unknown) => {
                  setFavorite(!next);
                  setError(describeNutritionError(failure, t));
                },
              );
            }}
          >
            <Icon name="star" size={22} />
          </button>
        </div>
        <div className={styles.pair}>
          <div className={styles.pairItem}>
            <label htmlFor={amountId} className={styles.label}>
              {t('nutrition.entry.amount')}
            </label>
            {/* No autofocus: choosing a food never opens the keyboard by itself. */}
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
          </div>
          <div className={styles.pairItem}>
            <label htmlFor={unitId} className={styles.label}>
              {t('nutrition.entry.unit')}
            </label>
            <select
              id={unitId}
              className={styles.field}
              value={unit}
              onChange={(event) => {
                setUnit(event.target.value as QuantityUnit);
                setError(null);
              }}
            >
              {units.map((option) => (
                <option key={option} value={option}>
                  {t(`nutrition.unitsLong.${option}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <MealSelect meals={meals} value={mealId} onChange={setMealId} />
        <p className={styles.label}>{t('nutrition.add.preview')}</p>
        <NutrientPreview nutrients={preview} />
        {food.source === 'external' ? (
          <p className={styles.hint}>{t('nutrition.lookup.attribution')}</p>
        ) : null}
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
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
