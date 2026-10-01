import { ROUTES } from '@/app/routes';
import { useI18n, type TranslationKey } from '@/core/i18n';
import {
  goalProgress,
  useNutritionData,
  type GoalTarget,
  type MainNutrient,
} from '@/core/nutrition';
import { toLocalDateKey } from '@/shared/lib/date';
import {
  OverviewCard,
  OverviewNote,
  OverviewProgress,
  OverviewStat,
  OverviewStats,
} from './OverviewCard';

/** Values that get a progress bar when a goal is set (calories and protein matter most). */
const WITH_PROGRESS: readonly MainNutrient[] = ['energyKcal', 'proteinG'];

const VALUES: { key: MainNutrient; goal: GoalTarget; label: TranslationKey; unit: string }[] = [
  { key: 'energyKcal', goal: 'energyKcal', label: 'dashboard.nutrition.calories', unit: 'kcal' },
  { key: 'proteinG', goal: 'proteinG', label: 'dashboard.nutrition.protein', unit: 'g' },
  { key: 'carbsG', goal: 'carbsG', label: 'dashboard.nutrition.carbs', unit: 'g' },
  { key: 'fatG', goal: 'fatG', label: 'dashboard.nutrition.fat', unit: 'g' },
];

/**
 * Nutrition at a glance: today's totals from the food diary (read only). Without entries the
 * values stay empty ("–") – nothing is invented. A goal in force is shown next to the value,
 * and calories and protein get a progress bar (full, never red, when the goal is passed).
 */
export function NutritionSummary({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const today = toLocalDateKey(now);
  const data = useNutritionData(
    async (s, profileId) => ({
      day: await s.diary.getDay(profileId, today),
      goal: await s.goals.goalFor(profileId, today),
    }),
    [today],
  );
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const day = data.status === 'ready' ? data.data.day : null;
  const goal = data.status === 'ready' ? data.data.goal : null;
  const hasEntries = (day?.summary.entryCount ?? 0) > 0;

  return (
    <OverviewCard title={t('dashboard.nutrition.title')} to={ROUTES.nutrition}>
      <OverviewStats pairs>
        {VALUES.map(({ key, goal: target, label, unit }) => {
          const value =
            hasEntries && day ? `${number.format(day.summary.totals.totals[key])} ${unit}` : '–';
          const aim = goal?.effective[target].value;
          const eaten = day?.summary.totals.totals[key] ?? 0;
          return (
            <OverviewStat
              key={key}
              value={value}
              progress={
                aim != null && WITH_PROGRESS.includes(key) ? (
                  <OverviewProgress
                    label={t(label)}
                    ratio={goalProgress(eaten, aim).ratio}
                    valueText={t('dashboard.nutrition.progress', {
                      value: `${number.format(eaten)} ${unit}`,
                      goal: `${number.format(aim)} ${unit}`,
                    })}
                  />
                ) : undefined
              }
              label={
                aim != null
                  ? t('dashboard.nutrition.ofGoal', {
                      label: t(label),
                      goal: `${number.format(aim)} ${unit}`,
                    })
                  : t(label)
              }
            />
          );
        })}
      </OverviewStats>
      {data.status === 'ready' && !hasEntries ? (
        <OverviewNote>{t('dashboard.nutrition.none')}</OverviewNote>
      ) : null}
      {data.status === 'ready' && !goal ? (
        <OverviewNote>{t('dashboard.nutrition.setup')}</OverviewNote>
      ) : null}
    </OverviewCard>
  );
}
