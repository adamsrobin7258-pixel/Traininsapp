import { useState, type SyntheticEvent } from 'react';
import { useI18n, type TranslationKey } from '@/core/i18n';
import {
  GOAL_LIMITS,
  GOAL_TARGETS,
  GOAL_TYPES,
  useNutrition,
  type GoalForDay,
  type GoalTarget,
  type GoalType,
  type GoalValue,
} from '@/core/nutrition';
import { Button, Sheet } from '@/ui';
import { describeNutritionError } from '../domain/format';
import { formatNumberInput, parseOptionalNumber } from '../domain/input';
import { NumberField } from './NumberField';
import styles from './Nutrition.module.css';

const LABELS: Record<GoalTarget, TranslationKey> = {
  energyKcal: 'nutrition.goals.energy',
  proteinG: 'nutrition.goals.protein',
  carbsG: 'nutrition.goals.carbs',
  fatG: 'nutrition.goals.fat',
  waterMl: 'nutrition.goals.water',
};

/**
 * The user's own daily goals (entered values are manual values; nothing is calculated here).
 * A change applies from today, so past days keep the goal that applied then.
 */
export function GoalSheet({
  current,
  onClose,
}: {
  /** The goal in force today, if any (pre-fills the form). */
  current: GoalForDay | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const [goalType, setGoalType] = useState<GoalType>(current?.goal.goalType ?? 'maintain');
  const [texts, setTexts] = useState<Record<GoalTarget, string>>(
    () =>
      Object.fromEntries(
        GOAL_TARGETS.map((target) => [
          target,
          formatNumberInput(current?.effective[target].value, locale),
        ]),
      ) as Record<GoalTarget, string>,
  );
  const [errors, setErrors] = useState<Partial<Record<GoalTarget, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<GoalTarget, string>> = {};
    const targets: Partial<Record<GoalTarget, GoalValue>> = {};
    const number = new Intl.NumberFormat(locale);
    for (const target of GOAL_TARGETS) {
      const parsed = parseOptionalNumber(texts[target]);
      const { min, max } = GOAL_LIMITS[target];
      if (!parsed.ok || (parsed.value !== null && (parsed.value < min || parsed.value > max))) {
        nextErrors[target] = t('nutrition.goals.range', {
          min: number.format(min),
          max: number.format(max),
        });
        continue;
      }
      targets[target] = { auto: current?.goal.targets[target].auto ?? null, manual: parsed.value };
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) => s.goals.save(profileId, { goalType, targets }));
      onClose();
    } catch (error) {
      setFailure(describeNutritionError(error, t));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t('nutrition.goals.title')} onClose={onClose} closeLabel={t('common.close')}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <p className={styles.label}>{t('nutrition.goals.type')}</p>
        {/* Wrapping chips instead of a segmented control: the labels are long. */}
        <div className={styles.choices} role="radiogroup" aria-label={t('nutrition.goals.type')}>
          {GOAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={goalType === type}
              className={styles.chip}
              data-selected={goalType === type}
              onClick={() => {
                setGoalType(type);
              }}
            >
              {t(`nutrition.goalTypes.${type}`)}
            </button>
          ))}
        </div>
        <div className={styles.pair}>
          {GOAL_TARGETS.map((target) => (
            <NumberField
              key={target}
              label={t(LABELS[target])}
              value={texts[target]}
              integer={target === 'energyKcal' || target === 'waterMl'}
              error={errors[target]}
              onChange={(value) => {
                setTexts((old) => ({ ...old, [target]: value }));
                setErrors((old) => ({ ...old, [target]: undefined }));
                setFailure(null);
              }}
            />
          ))}
        </div>
        <p className={styles.hint}>{t('nutrition.goals.hint')}</p>
        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
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
      </form>
    </Sheet>
  );
}
