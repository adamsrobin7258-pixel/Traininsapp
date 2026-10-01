import { useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  isValidAmount,
  useNutrition,
  useNutritionData,
  type FoodQuantity,
  type MealSlot,
  type SavedMeal,
} from '@/core/nutrition';
import { Button, Sheet } from '@/ui';
import { describeAmountError, describeNutritionError } from '../domain/format';
import { formatNumberInput, parseAmountInput } from '../domain/input';
import { MealSelect } from './MealSelect';
import styles from './Nutrition.module.css';

interface ItemDraft {
  id: string;
  foodId: string;
  amount: string;
  unit: FoodQuantity['unit'];
  include: boolean;
}

/**
 * Logs a saved meal on a day. Amounts can be changed and foods left out first; only the new
 * diary entries get these values – the template itself stays as it is.
 */
export function ApplyTemplateSheet({
  template,
  day,
  meals,
  mealId: initialMealId,
  onBack,
  onDone,
}: {
  template: SavedMeal;
  day: string;
  meals: readonly MealSlot[];
  mealId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const foods = useNutritionData(
    (s, profileId) =>
      s.foods.findMany(
        profileId,
        template.items.map((item) => item.foodId),
      ),
    [template],
  );
  const [items, setItems] = useState<ItemDraft[]>(() =>
    template.items.map((item) => ({
      id: item.id,
      foodId: item.foodId,
      amount: formatNumberInput(item.amount, locale),
      unit: item.unit,
      include: true,
    })),
  );
  const [mealId, setMealId] = useState(initialMealId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = new Map(foods.status === 'ready' ? foods.data.map((f) => [f.id, f]) : []);
  const usable = (item: ItemDraft) => byId.get(item.foodId)?.active === true;

  function update(id: string, change: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
    setErrors((current) => ({ ...current, [id]: '' }));
    setFailure(null);
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const chosen = items.filter((item) => item.include && usable(item));
    if (chosen.length === 0) {
      setFailure(t('nutrition.templates.nothingSelected'));
      return;
    }
    const nextErrors: Record<string, string> = {};
    const quantities: FoodQuantity[] = [];
    for (const item of chosen) {
      const parsed = parseAmountInput(item.amount, isValidAmount);
      if (parsed.ok)
        quantities.push({ foodId: item.foodId, amount: parsed.value, unit: item.unit });
      else nextErrors[item.id] = describeAmountError(parsed.error, t);
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        s.diary.addSavedMeal(profileId, {
          savedMealId: template.id,
          localDate: day,
          mealId,
          items: quantities,
        }),
      );
      onDone();
    } catch (error) {
      setFailure(describeNutritionError(error, t));
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={t('nutrition.templates.applyTitle', { name: template.name })}
      onClose={onBack}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <p className={styles.hint}>{t('nutrition.templates.applyHint')}</p>
        {foods.status === 'ready'
          ? items.map((item) => {
              const food = byId.get(item.foodId);
              const name = food?.name ?? '–';
              const active = usable(item);
              return (
                <div key={item.id}>
                  <div className={styles.itemRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      aria-label={t('nutrition.templates.include', { name })}
                      checked={item.include && active}
                      disabled={!active}
                      onChange={(event) => {
                        update(item.id, { include: event.target.checked });
                      }}
                    />
                    <span className={styles.itemName}>
                      {name}
                      {!active ? (
                        <span className={styles.hint}>
                          {' · '}
                          {t('nutrition.templates.hiddenFood')}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.amountCell}>
                      <input
                        className={styles.field}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        enterKeyHint="done"
                        aria-label={`${name}: ${t('nutrition.entry.amount')} (${t(`nutrition.units.${item.unit}`)})`}
                        value={item.amount}
                        disabled={!active || !item.include}
                        aria-invalid={Boolean(errors[item.id])}
                        onChange={(event) => {
                          update(item.id, { amount: event.target.value });
                        }}
                      />
                      <span className={styles.hint}>{t(`nutrition.units.${item.unit}`)}</span>
                    </span>
                  </div>
                  {errors[item.id] ? <p className={styles.fieldError}>{errors[item.id]}</p> : null}
                </div>
              );
            })
          : null}
        <MealSelect meals={meals} value={mealId} onChange={setMealId} />
        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onBack}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy || foods.status !== 'ready'}>
            {t('nutrition.templates.apply')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
