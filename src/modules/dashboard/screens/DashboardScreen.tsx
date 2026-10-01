import { useHealthAutoSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { formatLongDate } from '@/shared/lib/format';
import { Screen } from '@/ui';
import { HealthSummary } from '../components/HealthSummary';
import { NutritionSummary } from '../components/NutritionSummary';
import { TrainingSummary } from '../components/TrainingSummary';
import { buildGreeting } from '../domain/greeting';
import { useToday } from '../hooks/useToday';
import styles from './DashboardScreen.module.css';

/**
 * Today: a read-only overview. Nutrition comes first as the calm center of the day (calories,
 * macros, water, meals); training and weight follow. Every value comes from its own area (training, health,
 * nutrition); nothing is entered or stored here. Each summary opens its area.
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
        <HealthSummary now={now} />
      </div>
    </Screen>
  );
}
