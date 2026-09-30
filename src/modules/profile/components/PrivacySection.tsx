import { useState } from 'react';
import type { SelfTestResult } from '@/core/database';
import { useI18n } from '@/core/i18n';
import { useStorage } from '@/core/storage';
import { useSyncService } from '@/core/sync';
import { List, ListRow, Section } from '@/ui';

type CheckState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; results: SelfTestResult[] }
  | { phase: 'error' };

/** Where and how data is stored, with an on-device storage check. */
export function PrivacySection() {
  const { t, locale } = useI18n();
  const storage = useStorage();
  const syncStatus = useSyncService().getStatus();
  const [check, setCheck] = useState<CheckState>({ phase: 'idle' });
  const { encrypted } = storage.security;

  function runCheck() {
    setCheck({ phase: 'running' });
    storage.runSelfTest().then(
      (results) => {
        setCheck({ phase: 'done', results });
      },
      () => {
        setCheck({ phase: 'error' });
      },
    );
  }

  function describe(result: SelfTestResult): string | undefined {
    if (result.check === 'encryption' && result.detail === 'development-unencrypted') {
      return t('profile.privacy.developmentMode');
    }
    // Other failure details are technical messages, kept verbatim for bug reports.
    if (!result.detail || result.status === 'fail') return result.detail;
    if (result.check === 'restart') {
      const date = new Date(result.detail);
      return t('profile.privacy.lastRun', {
        date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          date,
        ),
      });
    }
    if (result.check === 'encryption') return `SQLCipher ${result.detail}`;
    return undefined;
  }

  return (
    <Section
      title={t('profile.privacy.title')}
      footer={
        encrypted ? t('profile.privacy.footerEncrypted') : t('profile.privacy.footerDevelopment')
      }
    >
      <List>
        <ListRow title={t('profile.privacy.location')} value={t('profile.privacy.locationValue')} />
        <ListRow
          title={t('profile.privacy.encryption')}
          value={encrypted ? t('profile.privacy.encryptionOn') : t('profile.privacy.encryptionOff')}
        />
        <ListRow
          title={t('profile.cloudSync')}
          value={syncStatus.state === 'disabled' ? t('profile.cloudSyncOff') : undefined}
        />
        <ListRow
          title={
            check.phase === 'running' ? t('profile.privacy.running') : t('profile.privacy.runCheck')
          }
          onPress={runCheck}
          action
          disabled={check.phase === 'running'}
        />
        {check.phase === 'error' ? <ListRow title={t('profile.privacy.checkFailed')} /> : null}
        {check.phase === 'done'
          ? check.results.map((result) => (
              <ListRow
                key={result.check}
                title={t(`profile.privacy.checks.${result.check}`)}
                subtitle={describe(result)}
                value={t(`profile.privacy.status.${result.status}`)}
              />
            ))
          : null}
      </List>
    </Section>
  );
}
