import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ROUTE_PARAMS } from '@/app/routes';
import { useHealthAutoSync, type WeightEntry } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useStorage } from '@/core/storage';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { EmptyValue, List, ListRow, Screen, Section } from '@/ui';
import { WeightChart } from '../components/WeightChart';
import { WeightEntrySheet, type WeightSheetMode } from '../components/WeightEntrySheet';
import { ImportedHealthOverview } from '../components/ImportedHealthOverview';
import { RecoveryCheckIn } from '../components/RecoveryCheckIn';
import { WeightHistory } from '../components/WeightHistory';
import { WeightOverview } from '../components/WeightOverview';

const BODY_MEASUREMENTS = ['bodyFat', 'muscleMass'] as const;
const RECOVERY_MEASUREMENTS = ['restingHeartRate', 'sleep'] as const;

type Measurement = (typeof BODY_MEASUREMENTS)[number] | (typeof RECOVERY_MEASUREMENTS)[number];

export function HealthScreen() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const { encrypted } = useStorage().security;
  // Opening Health refreshes imported Health Connect data (throttled, only when connected).
  useHealthAutoSync();

  const today = toLocalDateKey(new Date());
  const requested = params.get(ROUTE_PARAMS.addWeight);
  const addDate = requested && isLocalDateKey(requested) && requested <= today ? requested : null;

  const sheet: WeightSheetMode | null = editing
    ? { kind: 'edit', entry: editing }
    : addDate
      ? { kind: 'add', date: addDate }
      : null;

  function openAdd(date: string) {
    setParams({ [ROUTE_PARAMS.addWeight]: date });
  }

  function closeSheet() {
    setEditing(null);
    if (params.has(ROUTE_PARAMS.addWeight)) setParams({}, { replace: true });
  }

  const renderPlaceholders = (measurements: readonly Measurement[]) =>
    measurements.map((measurement) => (
      <ListRow
        key={measurement}
        title={t(`health.measurements.${measurement}`)}
        value={<EmptyValue label={t('common.noValue')} />}
      />
    ));

  return (
    <Screen title={t('health.title')}>
      <Section
        title={t('weight.title')}
        footer={encrypted ? t('weight.privacyNote') : t('weight.privacyNoteDevelopment')}
      >
        <WeightOverview
          onAdd={() => {
            openAdd(today);
          }}
        />
      </Section>

      <Section title={t('health.recoveryTitle')}>
        <RecoveryCheckIn />
        <List>{renderPlaceholders(RECOVERY_MEASUREMENTS)}</List>
      </Section>

      <Section title={t('weight.trend')}>
        <WeightChart />
      </Section>

      <Section title={t('weight.history')}>
        <WeightHistory onEdit={setEditing} />
      </Section>

      <ImportedHealthOverview today={new Date()} />

      <Section title={t('health.bodyTitle')}>
        <List>{renderPlaceholders(BODY_MEASUREMENTS)}</List>
      </Section>

      {sheet ? (
        <WeightEntrySheet
          key={sheet.kind === 'edit' ? sheet.entry.id : sheet.date}
          mode={sheet}
          onClose={closeSheet}
        />
      ) : null}
    </Screen>
  );
}
