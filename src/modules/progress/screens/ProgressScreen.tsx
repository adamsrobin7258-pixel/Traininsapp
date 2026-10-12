import { useHealthAutoSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { Screen } from '@/ui';
import { ProgressSection } from '../components/ProgressSection';
import { buildGreeting } from '../domain/greeting';
import { useToday } from '../hooks/useToday';

/**
 * Fortschritt – the main page, compact (Phase 23): the Kalethra score with its four areas (each
 * opens its area), then the calendar of the last 20 days. Nothing is entered or stored here. The
 * Kalethra symbol sits at the end of the title row, as on every page (`Screen`).
 */
export function ProgressScreen() {
  const { t } = useI18n();
  const { profile } = useProfile();
  const now = useToday();
  // Refreshes imported Health Connect data when the main page opens (throttled, only when
  // connected) – the score's activity area reads it.
  useHealthAutoSync();

  return (
    <Screen eyebrow={buildGreeting(t, now, profile.displayName)} title={t('progress.title')}>
      <ProgressSection now={now} />
    </Screen>
  );
}
