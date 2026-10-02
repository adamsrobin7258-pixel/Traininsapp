import { ROUTES } from '@/app/routes';
import {
  dayWeight,
  formatWeight,
  useHealthSync,
  useImportedHealthData,
  useWeightService,
} from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { toLocalDateKey } from '@/shared/lib/date';
import { OverviewCard, OverviewStat, OverviewStats } from './OverviewCard';

/**
 * Today's health values in one line: steps and active calories from Health Connect and the
 * weight of today (an own entry wins over an imported one). Shown only when there is something
 * for today; the full picture stays in the health area.
 */
export function HealthSummary({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const weights = useWeightService();
  const { status } = useHealthSync();
  const today = toLocalDateKey(now);
  const data = useImportedHealthData(
    async (service, profileId) => {
      const [activity, imported, own] = await Promise.all([
        service.activityBetween(profileId, today, today),
        service.weightsBetween(profileId, today, today),
        weights.service.getForDate(profileId, today),
      ]);
      return {
        activity: activity[0] ?? null,
        weight: dayWeight(own?.kg ?? null, imported[0] ?? null),
      };
    },
    [today, weights.service, weights.revision],
  );
  if (data.status !== 'ready') return null;
  const { activity, weight } = data.data;
  const steps = activity?.steps ?? null;
  const kcal = activity?.activeKcal ?? null;
  if (steps === null && kcal === null && weight.kind === 'none') return null;
  // Without a connection only an own weight of today can appear – then the card is redundant
  // with "Dein Fortschritt"; show it only with Health Connect data or a connection.
  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  if (!connected && steps === null && kcal === null) return null;

  const number = new Intl.NumberFormat(locale);
  return (
    <OverviewCard icon="health" title={t('dashboard.health.title')} to={ROUTES.health}>
      <OverviewStats>
        {steps !== null ? (
          <OverviewStat value={number.format(steps)} label={t('dashboard.health.steps')} />
        ) : null}
        {kcal !== null ? (
          <OverviewStat
            value={number.format(Math.round(kcal))}
            label={t('dashboard.health.activeKcal')}
          />
        ) : null}
        {weight.kind !== 'none' ? (
          <OverviewStat
            value={formatWeight(weight.kg, unit, locale)}
            label={
              weight.kind === 'imported'
                ? `${t('dashboard.health.weight')} · ${t('dashboard.health.imported')}`
                : t('dashboard.health.weight')
            }
          />
        ) : null}
      </OverviewStats>
    </OverviewCard>
  );
}
