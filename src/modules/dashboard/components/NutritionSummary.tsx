import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { OverviewCard, OverviewNote, OverviewStat, OverviewStats } from './OverviewCard';

/**
 * Nutrition at a glance. The nutrition area does not record meals yet, so there is nothing to
 * show: the values stay empty ("–") instead of showing invented numbers. Once the area stores
 * meals, their daily totals appear here.
 */
export function NutritionSummary() {
  const { t } = useI18n();
  const empty = '–';
  return (
    <OverviewCard title={t('dashboard.nutrition.title')} to={ROUTES.nutrition}>
      <OverviewStats pairs>
        <OverviewStat value={empty} label={t('dashboard.nutrition.calories')} />
        <OverviewStat value={empty} label={t('dashboard.nutrition.protein')} />
        <OverviewStat value={empty} label={t('dashboard.nutrition.carbs')} />
        <OverviewStat value={empty} label={t('dashboard.nutrition.fat')} />
      </OverviewStats>
      <OverviewNote>{t('dashboard.nutrition.none')}</OverviewNote>
    </OverviewCard>
  );
}
