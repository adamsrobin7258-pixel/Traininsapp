import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n, type TranslateFn, type TranslationKey } from '@/core/i18n';
import {
  FOOD_NAME_MAX_LENGTH,
  isValidAmount,
  useNutrition,
  type CountUnit,
  type Food,
  type FoodInput,
  type FoodServing,
  type MeasureUnit,
  type QuantityUnit,
} from '@/core/nutrition';
import { AUTOFOCUS, Button, ConfirmSheet, Sheet } from '@/ui';
import { describeNutritionError } from '../domain/format';
import { formatNumberInput, parseNumberInput, parseOptionalNumber } from '../domain/input';
import { NumberField } from './NumberField';
import styles from './Nutrition.module.css';

const REFERENCE_UNITS: QuantityUnit[] = ['g', 'ml', 'piece', 'serving'];
const SIZE_UNITS: MeasureUnit[] = ['g', 'ml'];

type NumberKey =
  | 'referenceAmount'
  | 'energyKcal'
  | 'proteinG'
  | 'carbsG'
  | 'fatG'
  | 'fiberG'
  | 'sugarG'
  | 'saturatedFatG'
  | 'pieceAmount'
  | 'servingAmount';

const REQUIRED: NumberKey[] = ['referenceAmount', 'energyKcal', 'proteinG', 'carbsG', 'fatG'];

const LABELS: Record<NumberKey, TranslationKey> = {
  referenceAmount: 'nutrition.foods.referenceAmount',
  energyKcal: 'nutrition.goals.energy',
  proteinG: 'nutrition.goals.protein',
  carbsG: 'nutrition.goals.carbs',
  fatG: 'nutrition.goals.fat',
  fiberG: 'nutrition.nutrients.fiber',
  sugarG: 'nutrition.nutrients.sugar',
  saturatedFatG: 'nutrition.nutrients.saturatedFat',
  pieceAmount: 'nutrition.foods.pieceSize',
  servingAmount: 'nutrition.foods.servingSize',
};

/** Amounts (reference, piece, serving) must be > 0; nutrient values may be 0. */
const AMOUNTS = new Set<NumberKey>(['referenceAmount', 'pieceAmount', 'servingAmount']);

interface Draft {
  name: string;
  brand: string;
  referenceUnit: QuantityUnit;
  pieceUnit: MeasureUnit;
  servingUnit: MeasureUnit;
  numbers: Record<NumberKey, string>;
}

function initialDraft(food: Food | undefined, initialName: string, locale: string): Draft {
  const piece = food?.servings.find((s) => s.unit === 'piece');
  const serving = food?.servings.find((s) => s.unit === 'serving');
  const n = (value: number | null | undefined) => formatNumberInput(value, locale);
  return {
    name: food?.name ?? initialName,
    brand: food?.brand ?? '',
    referenceUnit: food?.reference.unit ?? 'g',
    pieceUnit: piece?.amountUnit ?? 'g',
    servingUnit: serving?.amountUnit ?? 'g',
    numbers: {
      referenceAmount: food ? n(food.reference.amount) : '100',
      energyKcal: n(food?.nutrients.energyKcal),
      proteinG: n(food?.nutrients.proteinG),
      carbsG: n(food?.nutrients.carbsG),
      fatG: n(food?.nutrients.fatG),
      fiberG: n(food?.nutrients.fiberG),
      sugarG: n(food?.nutrients.sugarG),
      saturatedFatG: n(food?.nutrients.saturatedFatG),
      pieceAmount: n(piece?.amount),
      servingAmount: n(serving?.amount),
    },
  };
}

type Checked =
  | { ok: true; input: FoodInput }
  | { ok: false; errors: Partial<Record<NumberKey | 'name', string>> };

/** Validates the whole form at once so every problem is shown next to its field. */
function checkFoodDraft(draft: Draft, t: TranslateFn): Checked {
  const errors: Partial<Record<NumberKey | 'name', string>> = {};
  const values: Partial<Record<NumberKey, number | null>> = {};
  if (draft.name.trim() === '') errors.name = t('nutrition.errors.required');
  for (const key of Object.keys(draft.numbers) as NumberKey[]) {
    const required = REQUIRED.includes(key);
    const parsed = required
      ? parseNumberInput(draft.numbers[key])
      : parseOptionalNumber(draft.numbers[key]);
    if (!parsed.ok) {
      errors[key] = t(
        parsed.error === 'empty'
          ? 'nutrition.errors.required'
          : parsed.error === 'negative'
            ? 'nutrition.errors.negative'
            : 'nutrition.errors.invalidNumber',
      );
      continue;
    }
    if (AMOUNTS.has(key) && parsed.value !== null && !isValidAmount(parsed.value)) {
      errors[key] = t('nutrition.errors.amount');
      continue;
    }
    values[key] = parsed.value;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const num = (key: NumberKey) => values[key] ?? 0;
  const opt = (key: NumberKey) => values[key] ?? null;
  const servings: FoodServing[] = [];
  const size = (unit: CountUnit, key: NumberKey, amountUnit: MeasureUnit) => {
    const amount = opt(key);
    if (amount !== null) servings.push({ unit, amount, amountUnit, label: null });
  };
  size('piece', 'pieceAmount', draft.pieceUnit);
  size('serving', 'servingAmount', draft.servingUnit);
  return {
    ok: true,
    input: {
      name: draft.name,
      brand: draft.brand,
      reference: { amount: num('referenceAmount'), unit: draft.referenceUnit },
      nutrients: {
        energyKcal: num('energyKcal'),
        proteinG: num('proteinG'),
        carbsG: num('carbsG'),
        fatG: num('fatG'),
        fiberG: opt('fiberG'),
        sugarG: opt('sugarG'),
        saturatedFatG: opt('saturatedFatG'),
      },
      servings,
    },
  };
}

interface FoodFormSheetProps {
  /** Edit this food; omit to create one. */
  food?: Food;
  initialName?: string;
  onSaved: (food: Food) => void;
  /** Called after "delete": removed for good, or only hidden because it is in use. */
  onRemoved?: (result: 'deleted' | 'deactivated', food: Food) => void;
  onClose: () => void;
}

/**
 * Create or correct a custom food. Required: name, reference amount and unit, kcal and the
 * three macros. Corrections never change logged days (entries keep their snapshot).
 */
export function FoodFormSheet({
  food,
  initialName = '',
  onSaved,
  onRemoved,
  onClose,
}: FoodFormSheetProps) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const ids = { name: useId(), brand: useId(), unit: useId(), piece: useId(), serving: useId() };
  const [draft, setDraft] = useState(() => initialDraft(food, initialName, locale));
  const [errors, setErrors] = useState<Partial<Record<NumberKey | 'name', string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setNumber = (key: NumberKey) => (value: string) => {
    setDraft((current) => ({ ...current, numbers: { ...current.numbers, [key]: value } }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFailure(null);
  };

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const checked = checkFoodDraft(draft, t);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setBusy(true);
    try {
      const saved = await mutate((s, profileId) =>
        food
          ? s.foods.update(profileId, food.id, checked.input)
          : s.foods.create(profileId, checked.input),
      );
      onSaved(saved);
    } catch (error) {
      setFailure(describeNutritionError(error, t));
      setBusy(false);
    }
  }

  if (confirmDelete && food) {
    return (
      <ConfirmSheet
        title={t('nutrition.foods.deleteTitle')}
        body={t('nutrition.foods.deleteBody', { name: food.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        destructive
        errorText={t('nutrition.errors.saveFailed')}
        onConfirm={async () => {
          const result = await mutate((s, profileId) => s.foods.remove(profileId, food.id));
          onRemoved?.(result, food);
        }}
        onClose={() => {
          setConfirmDelete(false);
        }}
      />
    );
  }

  const field = (key: NumberKey) => (
    <NumberField
      label={t(LABELS[key])}
      value={draft.numbers[key]}
      onChange={setNumber(key)}
      error={errors[key]}
    />
  );

  const unitSelect = (id: string, value: MeasureUnit, onChange: (unit: MeasureUnit) => void) => (
    <div className={styles.pairItem}>
      <label htmlFor={id} className={styles.label}>
        {t('nutrition.foods.sizeUnit')}
      </label>
      <select
        id={id}
        className={styles.field}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as MeasureUnit);
        }}
      >
        {SIZE_UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {t(`nutrition.unitsLong.${unit}`)}
          </option>
        ))}
      </select>
    </div>
  );

  const referenceUnits = REFERENCE_UNITS.includes(draft.referenceUnit)
    ? REFERENCE_UNITS
    : [...REFERENCE_UNITS, draft.referenceUnit];

  return (
    <Sheet
      title={food ? t('nutrition.foods.edit') : t('nutrition.foods.create')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        {food ? <p className={styles.hint}>{t('nutrition.foods.editHint')}</p> : null}
        <label htmlFor={ids.name} className={styles.label}>
          {t('nutrition.foods.name')}
        </label>
        <input
          {...(food ? {} : AUTOFOCUS)}
          id={ids.name}
          className={styles.field}
          value={draft.name}
          maxLength={FOOD_NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => {
            setDraft((current) => ({ ...current, name: event.target.value }));
            setErrors((current) => ({ ...current, name: undefined }));
          }}
        />
        {errors.name ? <p className={styles.fieldError}>{errors.name}</p> : null}
        <label htmlFor={ids.brand} className={styles.label}>
          {t('nutrition.foods.brand')}
        </label>
        <input
          id={ids.brand}
          className={styles.field}
          value={draft.brand}
          maxLength={FOOD_NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="next"
          onChange={(event) => {
            setDraft((current) => ({ ...current, brand: event.target.value }));
          }}
        />

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('nutrition.foods.basics')}</legend>
          <div className={styles.pair}>
            {field('referenceAmount')}
            <div className={styles.pairItem}>
              <label htmlFor={ids.unit} className={styles.label}>
                {t('nutrition.foods.referenceUnit')}
              </label>
              <select
                id={ids.unit}
                className={styles.field}
                value={draft.referenceUnit}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    referenceUnit: event.target.value as QuantityUnit,
                  }));
                }}
              >
                {referenceUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`nutrition.unitsLong.${unit}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.pair}>
            {field('energyKcal')}
            {field('proteinG')}
          </div>
          <div className={styles.pair}>
            {field('carbsG')}
            {field('fatG')}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('nutrition.foods.details')}</legend>
          <div className={styles.pair}>
            {field('fiberG')}
            {field('sugarG')}
          </div>
          {field('saturatedFatG')}
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('nutrition.foods.sizes')}</legend>
          <p className={styles.hint}>{t('nutrition.foods.sizesHint')}</p>
          <div className={styles.pair}>
            {field('pieceAmount')}
            {unitSelect(ids.piece, draft.pieceUnit, (unit) => {
              setDraft((current) => ({ ...current, pieceUnit: unit }));
            })}
          </div>
          <div className={styles.pair}>
            {field('servingAmount')}
            {unitSelect(ids.serving, draft.servingUnit, (unit) => {
              setDraft((current) => ({ ...current, servingUnit: unit }));
            })}
          </div>
        </fieldset>

        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        ) : Object.values(errors).some(Boolean) ? (
          <p className={styles.error} role="alert">
            {t('nutrition.errors.checkFields')}
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
        {food && !food.active ? (
          <Button
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => {
              mutate((s, profileId) => s.foods.setActive(profileId, food.id, true)).then(
                onClose,
                (error: unknown) => {
                  setFailure(describeNutritionError(error, t));
                },
              );
            }}
          >
            {t('nutrition.foods.show')}
          </Button>
        ) : null}
        {food ? (
          <Button
            variant="destructive"
            fullWidth
            disabled={busy}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            {t('nutrition.foods.delete')}
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}
