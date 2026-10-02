import { useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { isValidWaterAmount, useNutrition, type WaterEntry } from '@/core/nutrition';
import { Button, ConfirmSheet, NumberField, Sheet } from '@/ui';
import { describeNutritionError, formatWater } from '../domain/format';
import { parseNumberInput } from '../domain/input';
import styles from './Nutrition.module.css';

/** Log a custom amount of water, or correct / delete an existing water entry. */
export function WaterSheet({
  day,
  entry,
  onClose,
}: {
  day: string;
  entry?: WaterEntry;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const initialMl = entry ? (entry.unit === 'l' ? entry.amount * 1000 : entry.amount) : null;
  const [text, setText] = useState(initialMl !== null ? String(Math.round(initialMl)) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const parsed = parseNumberInput(text);
    if (!parsed.ok || !isValidWaterAmount(parsed.value, 'ml')) {
      setError(t('nutrition.errors.water'));
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        entry
          ? s.diary.updateWater(profileId, entry.id, parsed.value, 'ml')
          : s.diary.addWater(profileId, { localDate: day, amount: parsed.value, unit: 'ml' }),
      );
      onClose();
    } catch (failure) {
      setError(describeNutritionError(failure, t));
      setBusy(false);
    }
  }

  if (confirmDelete && entry && initialMl !== null) {
    return (
      <ConfirmSheet
        title={t('nutrition.water.deleteTitle')}
        body={t('nutrition.water.deleteBody', { amount: formatWater(initialMl, locale) })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        destructive
        errorText={t('nutrition.errors.saveFailed')}
        onConfirm={async () => {
          await mutate((s, profileId) => s.diary.deleteWater(profileId, entry.id));
          onClose();
        }}
        onClose={() => {
          setConfirmDelete(false);
        }}
      />
    );
  }

  return (
    <Sheet
      title={entry ? t('nutrition.water.editTitle') : t('nutrition.water.addTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <NumberField
          label={t('nutrition.water.amountLabel')}
          value={text}
          integer
          autoFocus
          error={error}
          onChange={(value) => {
            setText(value);
            setError(null);
          }}
        />
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
        {entry ? (
          <Button
            variant="destructive"
            fullWidth
            disabled={busy}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            {t('nutrition.water.delete')}
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}
