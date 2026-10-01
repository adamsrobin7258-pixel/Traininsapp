import { useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { GOAL_LIMITS, type MacroTarget } from '@/core/nutrition';
import { Button, Sheet } from '@/ui';
import { formatNumberInput, parseNumberInput } from '../domain/input';
import { NumberField } from './NumberField';
import styles from './Nutrition.module.css';

/**
 * Sets an own value for one goal or returns it to the automatic calculation. Opens without the
 * keyboard; the field is focused only when tapped.
 */
export function OverrideSheet({
  label,
  target,
  unit,
  autoValue,
  manualValue,
  onApply,
  onClose,
}: {
  label: string;
  target: MacroTarget;
  unit: string;
  autoValue: number | null;
  manualValue: number | null;
  /** `null` = calculate automatically. */
  onApply: (value: number | null) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState(formatNumberInput(manualValue ?? autoValue, locale));
  const [error, setError] = useState<string | null>(null);
  const number = new Intl.NumberFormat(locale);
  const { min, max } = GOAL_LIMITS[target];

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const parsed = parseNumberInput(text);
    if (!parsed.ok || parsed.value < min || parsed.value > max) {
      setError(
        t('nutrition.profile.errors.override', {
          min: number.format(min),
          max: number.format(max),
        }),
      );
      return;
    }
    onApply(parsed.value);
  }

  return (
    <Sheet
      title={t('nutrition.profile.edit', { label })}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={submit}>
        <p className={styles.hint}>
          {t('nutrition.profile.overrideAuto', {
            value:
              autoValue === null
                ? t('nutrition.profile.noValue')
                : `${number.format(autoValue)} ${unit}`,
          })}
        </p>
        <NumberField
          label={`${t('nutrition.profile.overrideLabel')} (${unit})`}
          value={text}
          integer={target === 'energyKcal'}
          error={error}
          onChange={(value) => {
            setText(value);
            setError(null);
          }}
        />
        <p className={styles.hint}>{t('nutrition.profile.overrideHint')}</p>
        <div className={styles.saveBar}>
          <Button type="submit" fullWidth>
            {t('nutrition.profile.overrideUse')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              onApply(null);
            }}
          >
            {t('nutrition.profile.overrideReset')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
