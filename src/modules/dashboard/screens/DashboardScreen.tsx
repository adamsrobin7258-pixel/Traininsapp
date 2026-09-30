import { useSearchParams } from 'react-router';
import { ROUTE_PARAMS, ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useProfile } from '@/core/user';
import { parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatLongDate } from '@/shared/lib/format';
import { List, ListRow, Screen, Section } from '@/ui';
import { DayWeightRow } from '../components/DayWeightRow';
import { TrainingOverview } from '../components/TrainingOverview';
import { TodayPanel } from '../components/TodayPanel';
import { WeekStrip } from '../components/WeekStrip';
import { buildGreeting } from '../domain/greeting';
import { resolveSelectedDay, shiftByWeeks } from '../domain/selectedDay';
import { EMPTY_TODAY_SUMMARY } from '../domain/todaySummary';
import { useTrainingData } from '@/core/training';
import { useToday } from '../hooks/useToday';
import styles from './DashboardScreen.module.css';

export function DashboardScreen() {
  const { locale, t } = useI18n();
  const { profile } = useProfile();
  const now = useToday();
  const [params, setParams] = useSearchParams();

  const today = toLocalDateKey(now);
  const selected = resolveSelectedDay(params.get(ROUTE_PARAMS.day), today);
  const isToday = selected === today;
  const trained = useTrainingData(
    (s, profileId) => s.workouts.trainedMinutesOn(profileId, selected),
    [selected],
  );
  const summary = {
    ...EMPTY_TODAY_SUMMARY,
    trainingMinutes: trained.status === 'ready' ? trained.data : null,
  };

  function select(day: string) {
    // Replace, so browsing days does not fill the back stack.
    setParams(day === today ? {} : { [ROUTE_PARAMS.day]: day }, { replace: true });
  }

  return (
    <Screen
      eyebrow={formatLongDate(now, locale)}
      title={buildGreeting(t, now, profile.displayName)}
    >
      <Section title={t('dashboard.weekTitle')}>
        <WeekStrip
          selected={selected}
          today={today}
          onSelect={select}
          onShiftWeek={(weeks) => {
            select(shiftByWeeks(selected, weeks, today));
          }}
        />
      </Section>

      <Section
        title={
          isToday
            ? t('dashboard.todayTitle')
            : formatLongDate(parseLocalDateKey(selected) ?? now, locale)
        }
      >
        <div className={styles.dayContent}>
          <TodayPanel summary={summary} />
          <DayWeightRow day={selected} />
        </div>
      </Section>

      <TrainingOverview />

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
