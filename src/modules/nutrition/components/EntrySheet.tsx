import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  convertQuantity,
  isValidAmount,
  QUANTITY_UNITS,
  scaleNutrients,
  useNutrition,
  type FoodEntry,
  type MealSlot,
  type QuantityUnit,
} from '@/core/nutrition';
import { Button, ConfirmSheet, Sheet } from '@/ui';
import { describeAmountError, describeNutritionError, mealName } from '../domain/format';
import { formatNumberInput, parseAmountInput } from '../domain/input';
import { MealSelect } from './MealSelect';
import { NutrientPreview } from './NutrientPreview';
import styles from './Nutrition.module.css';

/**
 * Edit a logged entry: amount, unit (only g ↔ kg or ml ↔ l – the entry stores no piece or
 * serving size) and meal. The stored nutrients are rescaled, never re-read from the food.
 */
export function EntrySheet({
  entry,
  meals,
  onClose,
}: {
  entry: FoodEntry;
  meals: readonly MealSlot[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const amountId = useId();
  const unitId = useId();
  const errorId = useId();
  const units = QUANTITY_UNITS.filter((unit) => convertQuantity(1, unit, entry.unit) !== null);
  const [amount, setAmount] = useState(formatNumberInput(entry.amount, locale));
  const [unit, setUnit] = useState<QuantityUnit>(entry.unit);
  const [mealId, setMealId] = useState(entry.mealId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parsed = parseAmountInput(amount, isValidAmount);
  const inOldUnit = parsed.ok ? convertQuantity(parsed.value, unit, entry.unit) : null;
  const preview =
    inOldUnit !== null ? scaleNutrients(entry.nutrients, inOldUnit / entry.amount) : null;
  const currentMeal = entry.mealId
    ? {
        id: entry.mealId,
        label: mealName({ defaultKey: entry.mealDefaultKey, name: entry.mealName }, t),
      }
    : null;

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!parsed.ok) {
      setError(describeAmountError(parsed.error, t));
      return;
    }
    setBusy(true);
    try {
      await mutate(async (s, profileId) => {
        if (parsed.value !== entry.amount || unit !== entry.unit) {
          await s.diary.updateQuantity(profileId, entry.id, parsed.value, unit);
        }
        if (mealId && mealId !== entry.mealId) {
          await s.diary.moveEntry(profileId, entry.id, { localDate: entry.localDate, mealId });
        }
      });
      onClose();
    } catch (failure) {
      setError(describeNutritionError(failure, t));
      setBusy(false);
    }
  }

  if (confirmDelete) {
    return (
      <ConfirmSheet
        title={t('nutrition.entry.deleteTitle')}
        body={t('nutrition.entry.deleteBody', { name: entry.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        destructive
        errorText={t('nutrition.errors.saveFailed')}
        onConfirm={async () => {
          await mutate((s, profileId) => s.diary.deleteEntry(profileId, entry.id));
          onClose();
        }}
        onClose={() => {
          setConfirmDelete(false);
        }}
      />
    );
  }

  return (
    <Sheet title={t('nutrition.entry.title')} onClose={onClose} closeLabel={t('common.close')}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <p className={styles.foodName}>{entry.name}</p>
        {entry.brand ? <p className={styles.hint}>{entry.brand}</p> : null}
        <div className={styles.pair}>
          <div className={styles.pairItem}>
            <label htmlFor={amountId} className={styles.label}>
              {t('nutrition.entry.amount')}
            </label>
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
              disabled={units.length < 2}
              onChange={(event) => {
                setUnit(event.target.value as QuantityUnit);
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
        <p className={styles.hint}>{t('nutrition.entry.unitFixed')}</p>
        <MealSelect meals={meals} value={mealId} onChange={setMealId} current={currentMeal} />
        <p className={styles.label}>{t('nutrition.add.preview')}</p>
        <NutrientPreview nutrients={preview} />
        <p className={styles.hint}>{t('nutrition.entry.snapshotHint')}</p>
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
        <Button
          variant="destructive"
          fullWidth
          disabled={busy}
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          {t('nutrition.entry.delete')}
        </Button>
      </form>
    </Sheet>
  );
}
