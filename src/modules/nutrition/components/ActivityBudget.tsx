import { useI18n } from '@/core/i18n';
import type { GoalForDay } from '@/core/nutrition';
import { formatKcal } from '../domain/format';
import styles from './Nutrition.module.css';

/**
 * How imported activity calories relate to the day's calorie goal: added to the base goal
 * ("Basisziel 2.300 kcal / Aktivitätskalorien +500 kcal") or shown for information only.
 * Nothing is shown on days without imported activity calories.
 */
export function ActivityBudget({ goal }: { goal: GoalForDay | null }) {
  const { t, locale } = useI18n();
  const activity = goal?.activity;
  if (!activity) return null;
  return (
    <div className={styles.activityBudget}>
      {activity.kcal > 0 && activity.counted && activity.baseKcal !== null ? (
        <>
          <BudgetLine
            label={t('nutrition.activityBudget.base')}
            value={formatKcal(activity.baseKcal, locale)}
          />
          <BudgetLine
            label={t('nutrition.activityBudget.added')}
            value={`+${formatKcal(activity.kcal, locale)}`}
          />
        </>
      ) : activity.kcal > 0 ? (
        <>
          <BudgetLine
            label={t('nutrition.activityBudget.info')}
            value={formatKcal(activity.kcal, locale)}
          />
          <p className={styles.activityBudgetNote}>{t('nutrition.activityBudget.notCounted')}</p>
        </>
      ) : null}
      {activity.excluded > 0 ? (
        <p className={styles.activityBudgetNote}>{t('nutrition.activityBudget.excluded')}</p>
      ) : null}
    </div>
  );
}

function BudgetLine({ label, value }: { label: string; value: string }) {
  return (
    <p className={styles.activityBudgetLine}>
      <span>{label}</span>
      <span className={styles.activityBudgetValue}>{value}</span>
    </p>
  );
}
