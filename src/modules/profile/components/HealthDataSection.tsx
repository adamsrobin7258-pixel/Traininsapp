import { useState } from 'react';
import { useHealthSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { List, ListRow, Section } from '@/ui';
import { healthStatusKey } from '../domain/healthStatus';
import { DisconnectHealthSheet } from './DisconnectHealthSheet';
import { HealthConnectSheet } from './HealthConnectSheet';

/** Settings entry for connected health data (Health Connect on Android). */
export function HealthDataSection() {
  const { t } = useI18n();
  const { status, syncing } = useHealthSync();
  const [open, setOpen] = useState<'connection' | 'disconnect' | null>(null);

  return (
    <Section title={t('healthConnect.sectionTitle')} footer={t('healthConnect.sectionFooter')}>
      <List>
        <ListRow
          icon="health"
          title={t('healthConnect.name')}
          value={t(healthStatusKey(status, syncing))}
          onPress={() => {
            setOpen('connection');
          }}
        />
      </List>
      {open === 'connection' ? (
        <HealthConnectSheet
          onClose={() => {
            setOpen(null);
          }}
          onDisconnect={() => {
            setOpen('disconnect');
          }}
        />
      ) : null}
      {open === 'disconnect' ? (
        <DisconnectHealthSheet
          onClose={() => {
            setOpen('connection');
          }}
          onDone={() => {
            setOpen(null);
          }}
        />
      ) : null}
    </Section>
  );
}
