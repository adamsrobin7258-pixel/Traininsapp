import { useEffect, useEffectEvent, useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { normalizeBarcode, useNutrition, type BarcodeLookup } from '@/core/nutrition';
import { AUTOFOCUS, Button, Sheet } from '@/ui';
import { describeNutritionError } from '../domain/format';
import styles from './Nutrition.module.css';

/** Typing a barcode – for when the camera is unavailable, refused or the code is damaged. */
export function BarcodeEntrySheet({
  initial = '',
  notice,
  onSubmit,
  onClose,
}: {
  initial?: string;
  /** Why the field is shown instead of the scanner, if relevant. */
  notice?: string;
  onSubmit: (barcode: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const errorId = useId();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const code = normalizeBarcode(text);
    if (!code) {
      setError(t('nutrition.errors.barcode'));
      return;
    }
    onSubmit(code);
  }

  return (
    <Sheet
      title={t('nutrition.lookup.barcodeTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={submit}>
        {notice ? <p className={styles.warning}>{notice}</p> : null}
        <label htmlFor={id} className={styles.label}>
          {t('nutrition.lookup.barcodeLabel')}
        </label>
        <input
          {...AUTOFOCUS}
          id={id}
          className={styles.field}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p id={errorId} className={styles.fieldError} role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.hint}>{t('nutrition.lookup.barcodeHint')}</p>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">{t('nutrition.lookup.barcodeSearch')}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Looks a barcode up (local first, then the provider) while showing progress. Cancelling or
 * system back stops waiting for the answer; errors are shown here with the way out.
 */
export function BarcodeLookupSheet({
  barcode,
  onResult,
  onEnterManually,
  onClose,
}: {
  barcode: string;
  onResult: (result: BarcodeLookup) => void;
  onEnterManually: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { services, profileId } = useNutrition();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const deliver = useEffectEvent((result: BarcodeLookup) => {
    onResult(result);
  });
  const fail = useEffectEvent((failure: unknown) => {
    setError(describeNutritionError(failure, t));
  });

  useEffect(() => {
    const controller = new AbortController();
    services.lookup.lookupBarcode(profileId, barcode, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) deliver(result);
      },
      (failure: unknown) => {
        if (!controller.signal.aborted) fail(failure);
      },
    );
    return () => {
      controller.abort();
    };
  }, [services, profileId, barcode, attempt]);

  return (
    <Sheet
      title={t('nutrition.lookup.barcodeTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <div className={styles.stack}>
        <p className={styles.hint}>{t('nutrition.lookup.notFoundBarcode', { barcode })}</p>
        {error ? (
          <>
            <p className={styles.warning} role="alert">
              {error}
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onEnterManually}>
                {t('nutrition.lookup.enterBarcode')}
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setAttempt((value) => value + 1);
                }}
              >
                {t('nutrition.lookup.retry')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.notice} role="status">
              {t('nutrition.lookup.searchingBarcode')}
            </p>
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Unknown barcode: create the food (barcode pre-filled) or search by name. */
export function BarcodeNotFoundSheet({
  barcode,
  onCreate,
  onSearchByName,
  onClose,
}: {
  barcode: string;
  onCreate: () => void;
  onSearchByName: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet
      title={t('nutrition.lookup.notFoundTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <div className={styles.stack}>
        <p className={styles.hint}>{t('nutrition.lookup.notFoundBarcode', { barcode })}</p>
        <p>{t('nutrition.lookup.notFoundBody')}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onSearchByName}>
            {t('nutrition.lookup.searchByName')}
          </Button>
          <Button onClick={onCreate}>{t('nutrition.lookup.createOwn')}</Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Camera access refused: explain, retry or type the code – the rest stays usable. */
export function CameraDeniedSheet({
  onRetry,
  onEnterManually,
  onClose,
}: {
  onRetry: () => void;
  onEnterManually: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet
      title={t('nutrition.lookup.cameraDeniedTitle')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <div className={styles.stack}>
        <p>{t('nutrition.lookup.cameraDeniedBody')}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onEnterManually}>
            {t('nutrition.lookup.enterBarcode')}
          </Button>
          <Button onClick={onRetry}>{t('nutrition.lookup.retry')}</Button>
        </div>
      </div>
    </Sheet>
  );
}
