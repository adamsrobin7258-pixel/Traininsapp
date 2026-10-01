import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { OVERRIDE_LIMITS, type MacroTarget } from '@/core/nutrition';
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
  details,
  savesNow = false,
  onApply,
  onClose,
}: {
  label: string;
  target: MacroTarget;
  unit: string;
  autoValue: number | null;
  manualValue: number | null;
  /** Explains how the value comes about (e.g. protein: automatic vs. custom). */
  details?: ReactNode;
  /** The value is stored right away (a saved profile exists), not with the profile form. */
  savesNow?: boolean;
  /** `null` = calculate automatically. May fail; the sheet then stays open with a message. */
  onApply: (value: number | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState(formatNumberInput(manualValue ?? autoValue, locale));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const number = new Intl.NumberFormat(locale);
  const { min, max } = OVERRIDE_LIMITS[target];

  function apply(value: number | null) {
    setBusy(true);
    setError(null);
    Promise.resolve(onApply(value)).catch(() => {
      setError(t('nutrition.profile.overrideFailed'));
      setBusy(false);
    });
  }

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
    apply(parsed.value);
  }

  return (
    <Sheet
      title={t('nutrition.profile.edit', { label })}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={submit}>
        {manualValue !== null ? (
          <p className={styles.label}>
            {t('nutrition.profile.manualCurrent', {
              value: `${number.format(manualValue)} ${unit}`,
            })}
          </p>
        ) : null}
        {details}
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
        <p className={styles.hint}>
          {t('nutrition.profile.overrideHint')}
          {savesNow ? ` ${t('nutrition.profile.overrideSavedNow')}` : ''}
        </p>
        <div className={styles.saveBar}>
          <Button type="submit" fullWidth disabled={busy}>
            {t('nutrition.profile.overrideUse')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => {
              apply(null);
            }}
          >
            {t('nutrition.profile.overrideReset')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
