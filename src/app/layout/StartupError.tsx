import { createTranslator, detectLocale } from '@/core/i18n';
import { getDeviceLanguages } from '@/core/platform';
import type { StartupProblem } from '../startupProblem';
import styles from './StartupError.module.css';

/** Shown when the local database cannot be opened. Settings are unavailable here. */
const BODY = {
  key: 'app.startupErrorKey',
  migration: 'app.startupErrorMigration',
  generic: 'app.startupErrorBody',
} as const;

export function StartupError({
  problem,
  onRetry,
}: {
  problem: StartupProblem;
  onRetry: () => void;
}) {
  const t = createTranslator(detectLocale(getDeviceLanguages()));
  return (
    <main className={styles.container} role="alert">
      <h1 className={styles.title}>{t('app.startupErrorTitle')}</h1>
      <p className={styles.body}>{t(BODY[problem])}</p>
      <button type="button" className={styles.button} onClick={onRetry}>
        {t('app.retry')}
      </button>
    </main>
  );
}
