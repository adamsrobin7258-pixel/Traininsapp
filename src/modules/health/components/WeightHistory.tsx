import { useState } from 'react';
import { formatWeight, useWeightData, type WeightEntry } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { List, ListRow, Sheet } from '@/ui';
import { mediumDate } from '../domain/dates';

const PAGE_SIZE = 30;

/**
 * All own weight entries, newest first, in a sheet ("Einträge bearbeiten", Phase 24 – before, a
 * section "Verlauf" under the chart repeated the same values). Tapping an entry opens the edit
 * sheet; loads further pages on demand instead of everything at once.
 */
export function WeightHistory({
  onEdit,
  onClose,
}: {
  onEdit: (entry: WeightEntry) => void;
  onClose: () => void;
}) {
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

  return (
    <Sheet title={t('weight.entries')} onClose={onClose} closeLabel={t('common.close')}>
      {page.status === 'error' ? (
        <List>
          <ListRow title={t('weight.errors.loadFailed')} />
        </List>
      ) : page.status === 'ready' && page.data.entries.length > 0 ? (
        <List label={t('weight.entries')}>
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
      ) : page.status === 'ready' ? (
        <p>{t('weight.empty')}</p>
      ) : null}
    </Sheet>
  );
}
