import { useHealthAutoSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { formatLongDate } from '@/shared/lib/format';
import { Screen } from '@/ui';
import { ActivitiesSummary } from '../components/ActivitiesSummary';
import { HealthSummary } from '../components/HealthSummary';
import { NutritionSummary } from '../components/NutritionSummary';
import { ProgressSection } from '../components/ProgressSection';
import { TrainingSummary } from '../components/TrainingSummary';
import { buildGreeting } from '../domain/greeting';
import { useToday } from '../hooks/useToday';
import styles from './DashboardScreen.module.css';

/**
 * Today: the daily overview. First what matters today – nutrition as the calm center, then
 * today's training, activities and health values (each only when there is something) – then
 * "Dein Fortschritt", a compact look at the last 7 or 30 days. Every value comes from its own
 * area; nothing is entered or stored here, and every summary opens its area.
 */
export function DashboardScreen() {
  const { locale, t } = useI18n();
  const { profile } = useProfile();
  const now = useToday();
  // Refreshes imported Health Connect data when Today opens (throttled, only when connected).
  useHealthAutoSync();

  return (
    <Screen
      eyebrow={formatLongDate(now, locale)}
      title={buildGreeting(t, now, profile.displayName)}
    >
      <NutritionSummary now={now} />
      <div className={styles.cards}>
        <TrainingSummary now={now} />
        <ActivitiesSummary now={now} />
        <HealthSummary now={now} />
      </div>
      <ProgressSection now={now} />
    </Screen>
  );
}
