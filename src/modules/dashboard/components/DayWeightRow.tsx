import { addWeightLink } from '@/app/routes';
import { formatWeight, useWeightForDate } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { List, ListRow } from '@/ui';

/** Weight of the selected day; tapping opens the entry for exactly that day. */
export function DayWeightRow({ day }: { day: string }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const weight = useWeightForDate(day);

  const value =
    weight.status === 'ready'
      ? weight.data
        ? formatWeight(weight.data.kg, unit, locale)
        : t('weight.notEntered')
      : weight.status === 'error'
        ? t('weight.errors.loadFailed')
        : undefined;

  return (
    <List>
      <ListRow icon="health" title={t('weight.title')} value={value} to={addWeightLink(day)} />
    </List>
  );
}
