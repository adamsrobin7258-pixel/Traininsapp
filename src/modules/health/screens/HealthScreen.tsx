import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ROUTE_PARAMS } from '@/app/routes';
import { useHealthAutoSync, type WeightEntry } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { isLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { Screen, Section } from '@/ui';
import { WeightChart } from '../components/WeightChart';
import { WeightEntrySheet, type WeightSheetMode } from '../components/WeightEntrySheet';
import { ImportedHealthOverview } from '../components/ImportedHealthOverview';
import { RecoveryCheckIn } from '../components/RecoveryCheckIn';
import { WeightHistory } from '../components/WeightHistory';
import { WeightOverview } from '../components/WeightOverview';

/**
 * Gesundheit: the own weight (current value, course, entries), the daily recovery check-in, then
 * steps and activity and the remaining values from Health Connect. Only what Kalethra records –
 * no empty placeholders for data it does not collect.
 */
export function HealthScreen() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<WeightEntry | null>(null);
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

  return (
    <Screen title={t('health.title')}>
      <Section title={t('weight.title')}>
        <WeightOverview
          onAdd={() => {
            openAdd(today);
          }}
        />
      </Section>

      <Section title={t('weight.trend')}>
        <WeightChart />
      </Section>

      <Section title={t('weight.history')}>
        <WeightHistory onEdit={setEditing} />
      </Section>

      <Section title={t('health.recoveryTitle')}>
        <RecoveryCheckIn />
      </Section>

      <ImportedHealthOverview today={new Date()} />

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
