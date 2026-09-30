import { useI18n } from '@/core/i18n';
import { EmptyState, EmptyValue, List, ListRow, Screen, Section } from '@/ui';

const BODY_MEASUREMENTS = ['weight', 'bodyFat', 'muscleMass'] as const;
const RECOVERY_MEASUREMENTS = ['restingHeartRate', 'sleep'] as const;

type Measurement = (typeof BODY_MEASUREMENTS)[number] | (typeof RECOVERY_MEASUREMENTS)[number];

export function HealthScreen() {
  const { t } = useI18n();

  const renderRows = (measurements: readonly Measurement[]) =>
    measurements.map((measurement) => (
      <ListRow
        key={measurement}
        title={t(`health.measurements.${measurement}`)}
        value={<EmptyValue label={t('common.noValue')} />}
      />
    ));

  return (
    <Screen title={t('health.title')}>
      <EmptyState icon="health" title={t('health.emptyTitle')} body={t('health.emptyBody')} />
      <Section title={t('health.bodyTitle')}>
        <List>{renderRows(BODY_MEASUREMENTS)}</List>
      </Section>
      <Section title={t('health.recoveryTitle')}>
        <List>{renderRows(RECOVERY_MEASUREMENTS)}</List>
      </Section>
    </Screen>
  );
}
