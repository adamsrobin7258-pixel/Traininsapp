import { useHealthAutoSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { Screen } from '@/ui';
import { ProgressSection } from '../components/ProgressSection';
import { buildGreeting } from '../domain/greeting';
import { useToday } from '../hooks/useToday';

/**
 * Fortschritt – the main page. Only progress over the last 7 or 30 days: Kalethra training,
 * nutrition, weight and imported activities. No daily overview; every area opens its detail
 * screen. Nothing is entered or stored here.
 */
export function ProgressScreen() {
  const { t } = useI18n();
  const { profile } = useProfile();
  const now = useToday();
  // Refreshes imported Health Connect data when the main page opens (throttled, only when
  // connected) – the activity and weight figures read it.
  useHealthAutoSync();

  return (
    <Screen eyebrow={buildGreeting(t, now, profile.displayName)} title={t('progress.title')}>
      <ProgressSection now={now} />
    </Screen>
  );
}
