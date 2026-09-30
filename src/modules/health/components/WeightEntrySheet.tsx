import { useId, useState, type SyntheticEvent } from 'react';
import {
  formatWeight,
  formatWeightInput,
  parseWeightInput,
  useWeightForDate,
  useWeightService,
  WeightError,
  weightLimitsIn,
  type WeightEntry,
  type WeightInputError,
} from '@/core/health';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { Button, Sheet } from '@/ui';
import { longDate } from '../domain/dates';
import styles from './WeightEntrySheet.module.css';

export type WeightSheetMode = { kind: 'add'; date: string } | { kind: 'edit'; entry: WeightEntry };

const INPUT_ERRORS: Record<Exclude<WeightInputError, 'range'>, TranslationKey> = {
  empty: 'weight.errors.empty',
  invalid: 'weight.errors.invalid',
  precision: 'weight.errors.precision',
};

const SERVICE_ERRORS: Partial<Record<WeightError['code'], TranslationKey>> = {
  'future-date': 'weight.errors.futureDate',
  'invalid-date': 'weight.errors.futureDate',
  'not-found': 'weight.errors.notFound',
};

export function WeightEntrySheet({
  mode,
  onClose,
}: {
  mode: WeightSheetMode;
  onClose: () => void;
}) {
  const date = mode.kind === 'add' ? mode.date : mode.entry.date;
  const existing = useWeightForDate(date);
  // In "add" mode an entry for the day may already exist: it is edited instead of duplicated.
  const entry =
    mode.kind === 'edit' ? mode.entry : existing.status === 'ready' ? existing.data : null;
  if (mode.kind === 'add' && existing.status === 'loading') return null;
  return <WeightForm key={entry?.id ?? 'new'} date={date} entry={entry} onClose={onClose} />;
}

function WeightForm({
  date,
  entry,
  onClose,
}: {
  date: string;
  entry: WeightEntry | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { save, update, remove } = useWeightService();
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState(entry ? formatWeightInput(entry.kg, unit, locale) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function explain(failure: unknown, fallback: TranslationKey) {
    const key = failure instanceof WeightError ? SERVICE_ERRORS[failure.code] : undefined;
    setError(t(key ?? fallback));
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const parsed = parseWeightInput(text, unit);
    if (!parsed.ok) {
      if (parsed.error === 'range') {
        const limits = weightLimitsIn(unit);
        const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
        setError(
          t('weight.errors.range', {
            min: number.format(limits.min),
            max: number.format(limits.max),
            unit,
          }),
        );
      } else {
        setError(t(INPUT_ERRORS[parsed.error]));
      }
      return;
    }
    setBusy(true);
    try {
      if (entry) await update(entry.id, parsed.kg);
      else await save(date, parsed.kg);
      onClose();
    } catch (failure) {
      explain(failure, 'weight.errors.saveFailed');
      setBusy(false);
    }
  }

  async function confirmRemoval() {
    if (!entry) return;
    setBusy(true);
    try {
      await remove(entry.id);
      onClose();
    } catch (failure) {
      explain(failure, 'weight.errors.deleteFailed');
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (confirmDelete && entry) {
    return (
      <Sheet
        title={t('weight.confirmDeleteTitle')}
        onClose={onClose}
        closeLabel={t('common.close')}
      >
        <p className={styles.body}>
          {t('weight.confirmDeleteBody', {
            value: formatWeight(entry.kg, unit, locale),
            date: longDate(entry.date, locale),
          })}
        </p>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setConfirmDelete(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirmRemoval()}>
            {t('common.delete')}
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={entry ? t('weight.edit') : t('weight.add')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <div className={styles.row}>
          <span className={styles.label}>{t('weight.dateLabel')}</span>
          <span className={styles.value}>{longDate(date, locale)}</span>
        </div>
        <label htmlFor={inputId} className={styles.label}>
          {t('weight.inputLabel', { unit })}
        </label>
        <div className={styles.inputRow} data-invalid={error !== null}>
          <input
            id={inputId}
            className={styles.input}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            value={text}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
          />
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        </div>
        {error ? (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {entry ? (
          <p className={styles.hint}>
            {t('weight.existingHint', { value: formatWeight(entry.kg, unit, locale) })}
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
        {entry ? (
          <Button
            variant="destructive"
            fullWidth
            disabled={busy}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            {t('weight.delete')}
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}
