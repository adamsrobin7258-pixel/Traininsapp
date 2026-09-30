import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { formatLongDate } from '@/shared/lib/format';
import { List, ListRow, Screen, Section } from '@/ui';
import { TodayPanel } from '../components/TodayPanel';
import { WeekStrip } from '../components/WeekStrip';
import { buildGreeting } from '../domain/greeting';
import { EMPTY_TODAY_SUMMARY } from '../domain/todaySummary';
import { useToday } from '../hooks/useToday';

export function DashboardScreen() {
  const { locale, t } = useI18n();
  const { profile } = useProfile();
  const now = useToday();

  return (
    <Screen
      eyebrow={formatLongDate(now, locale)}
      title={buildGreeting(t, now, profile.displayName)}
    >
      <Section title={t('dashboard.todayTitle')} footer={t('dashboard.todayEmpty')}>
        <TodayPanel summary={EMPTY_TODAY_SUMMARY} />
      </Section>

      <Section title={t('dashboard.weekTitle')}>
        <WeekStrip today={now} />
      </Section>

      <Section title={t('dashboard.areasTitle')}>
        <List>
          <ListRow
            icon="training"
            title={t('nav.training')}
            subtitle={t('dashboard.areas.training')}
            to={ROUTES.training}
          />
          <ListRow
            icon="nutrition"
            title={t('nav.nutrition')}
            subtitle={t('dashboard.areas.nutrition')}
            to={ROUTES.nutrition}
          />
          <ListRow
            icon="health"
            title={t('nav.health')}
            subtitle={t('dashboard.areas.health')}
            to={ROUTES.health}
          />
        </List>
      </Section>
    </Screen>
  );
}
