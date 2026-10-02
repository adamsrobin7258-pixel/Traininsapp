import { useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { isValidWaterQuickAmounts, useSettings, WATER_QUICK_AMOUNTS_MAX } from '@/core/settings';
import { parseNumberInput } from '@/shared/lib/numberInput';
import { Button, NumberField, Sheet } from '@/ui';
import styles from './Settings.module.css';

/** Edits the amounts of the water quick buttons (a local app setting). */
export function WaterQuickAmountsSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { settings, updateSetting } = useSettings();
  const [texts, setTexts] = useState(() =>
    Array.from({ length: WATER_QUICK_AMOUNTS_MAX }, (_, index) => {
      const amount = settings.waterQuickAmountsMl[index];
      return amount === undefined ? '' : String(amount);
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const filled = texts.filter((text) => text.trim() !== '');
    const amounts = filled.map((text) => {
      const parsed = parseNumberInput(text);
      return parsed.ok ? parsed.value : Number.NaN;
    });
    if (!isValidWaterQuickAmounts(amounts)) {
      setError(t('nutrition.errors.quickAmounts'));
      return;
    }
    setBusy(true);
    try {
      await updateSetting('waterQuickAmountsMl', amounts);
      onClose();
    } catch {
      setError(t('nutrition.errors.saveFailed'));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t('nutrition.water.quickTitle')} onClose={onClose} closeLabel={t('common.close')}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <p className={styles.hint}>{t('nutrition.water.quickHint')}</p>
        <div className={styles.pair}>
          {texts.map((text, index) => (
            <NumberField
              key={index}
              label={t('nutrition.water.quickLabel', { index: index + 1 })}
              value={text}
              integer
              onChange={(value) => {
                setTexts((current) => current.map((old, i) => (i === index ? value : old)));
                setError(null);
              }}
            />
          ))}
        </div>
        {error ? (
          <p className={styles.error} role="alert">
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
      </form>
    </Sheet>
  );
}
