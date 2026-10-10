import { useState } from 'react';
import { formatWeight, useWeightData, type WeightEntry } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { List, ListRow, Section } from '@/ui';
import { mediumDate } from '../domain/dates';

const PAGE_SIZE = 30;

/**
 * Entries newest first, as the section "Verlauf"; loads further pages on demand instead of
 * everything at once. Without entries the section is left out (the overview says so).
 */
export function WeightHistory({ onEdit }: { onEdit: (entry: WeightEntry) => void }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const [limit, setLimit] = useState(PAGE_SIZE);
  const page = useWeightData(
    async (service, profileId) => ({
      entries: await service.getHistory(profileId, limit),
      total: await service.countEntries(profileId),
    }),
    [limit],
  );

  if (page.status === 'error') {
    return (
      <Section title={t('weight.history')}>
        <List>
          <ListRow title={t('weight.errors.loadFailed')} />
        </List>
      </Section>
    );
  }
  if (page.status !== 'ready' || page.data.entries.length === 0) return null;

  return (
    <Section title={t('weight.history')}>
      <List label={t('weight.history')}>
        {page.data.entries.map((entry) => (
          <ListRow
            key={entry.id}
            title={mediumDate(entry.date, locale)}
            value={formatWeight(entry.kg, unit, locale)}
            onPress={() => {
              onEdit(entry);
            }}
          />
        ))}
        {page.data.total > page.data.entries.length ? (
          <ListRow
            title={t('weight.showMore')}
            action
            onPress={() => {
              setLimit((value) => value + PAGE_SIZE);
            }}
          />
        ) : null}
      </List>
    </Section>
  );
}
