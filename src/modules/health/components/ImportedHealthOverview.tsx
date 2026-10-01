import {
  dayWeight,
  formatWeight,
  useHealthSync,
  useImportedHealthData,
  useWeightService,
} from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth } from '@/shared/lib/format';
import { EmptyValue, List, ListRow, Section } from '@/ui';

/**
 * Values imported from Health Connect, shown apart from Kalethra's own weight. Display only:
 * nothing here feeds the weight history, the chart or the nutrition goals.
 */
export function ImportedHealthOverview({ today }: { today: Date }) {
  const { t, locale } = useI18n();
  const { weightUnit } = useSettings().settings;
  const { status } = useHealthSync();
  const weights = useWeightService();
  const todayKey = toLocalDateKey(today);
  const weekStart = toLocalDateKey(addDays(today, -6));

  const data = useImportedHealthData(
    async (service, profileId) => {
      const [activity, imported] = await Promise.all([
        service.activityBetween(profileId, weekStart, todayKey),
        service.latestWeight(profileId),
      ]);
      const own = imported ? await weights.service.getForDate(profileId, imported.date) : null;
      return { activity, weight: dayWeight(own?.kg ?? null, imported), imported };
    },
    [weekStart, todayKey, weights.service, weights.revision],
  );

  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  const ready = data.status === 'ready' ? data.data : null;
  const hasData = ready !== null && (ready.activity.length > 0 || ready.imported !== null);
  if (!connected && !hasData) return null;

  const number = new Intl.NumberFormat(locale);
  const todayActivity = ready?.activity.find((day) => day.date === todayKey);
  const stepDays = (ready?.activity ?? []).filter((day) => day.steps !== null);
  const average =
    stepDays.length > 0
      ? Math.round(stepDays.reduce((sum, day) => sum + (day.steps ?? 0), 0) / stepDays.length)
      : null;
  const none = <EmptyValue label={t('common.noValue')} />;
  const lastSuccessAt =
    status.state === 'connected' || status.state === 'permissionRequired'
      ? status.lastSuccessAt
      : null;

  return (
    <Section
      title={t('healthConnect.overviewTitle')}
      footer={
        lastSuccessAt
          ? t('healthConnect.overviewFooterSynced', {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(lastSuccessAt)),
            })
          : t('healthConnect.overviewFooter')
      }
    >
      <List label={t('healthConnect.overviewTitle')}>
        <ListRow
          icon="health"
          title={t('healthConnect.stepsToday')}
          value={
            todayActivity?.steps != null
              ? t('healthConnect.steps', { count: number.format(todayActivity.steps) })
              : none
          }
        />
        <ListRow
          icon="flame"
          title={t('healthConnect.activeEnergyToday')}
          value={
            todayActivity?.activeKcal != null
              ? t('healthConnect.kcal', {
                  count: number.format(Math.round(todayActivity.activeKcal)),
                })
              : none
          }
        />
        <ListRow
          icon="plan"
          title={t('healthConnect.stepsAverage')}
          value={average !== null ? number.format(average) : none}
        />
        <ListRow
          icon="scale"
          title={t('healthConnect.importedWeight')}
          subtitle={ready?.weight.kind === 'own' ? t('healthConnect.ownWins') : undefined}
          value={
            ready?.imported
              ? t('healthConnect.importedWeightValue', {
                  weight: formatWeight(ready.imported.kg, weightUnit, locale),
                  date: formatDayMonth(parseLocalDateKey(ready.imported.date) ?? today, locale),
                })
              : none
          }
        />
      </List>
    </Section>
  );
}
