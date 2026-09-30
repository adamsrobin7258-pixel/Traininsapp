import { useI18n } from '@/core/i18n';
import { EmptyState, List, ListRow, Screen, Section } from '@/ui';
import { disciplineLabelKey, TRAINING_DISCIPLINES } from '../domain/disciplines';

export function TrainingScreen() {
  const { t } = useI18n();
  return (
    <Screen title={t('training.title')}>
      <EmptyState icon="training" title={t('training.emptyTitle')} body={t('training.emptyBody')} />
      <Section title={t('training.disciplinesTitle')} footer={t('training.disciplinesFooter')}>
        <List>
          {TRAINING_DISCIPLINES.map((discipline) => (
            <ListRow key={discipline} title={t(disciplineLabelKey(discipline))} />
          ))}
        </List>
      </Section>
    </Screen>
  );
}
