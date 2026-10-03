import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import {
  formatWeight,
  formatWeightChange,
  fromKg,
  mergeWeightDays,
  summarizeWeightPeriod,
  useHealthSync,
  useImportedHealthData,
  useWeightData,
} from '@/core/health';
import {
  combineActivities,
  summarizeAllActivities,
  useActivities,
  useActivityData,
} from '@/core/activity';
import { useI18n } from '@/core/i18n';
import { summarizeNutrition, useNutritionData } from '@/core/nutrition';
import { useSettings } from '@/core/settings';
import { useTargets } from '@/core/targets';
import { summarizeTraining, useTrainingData } from '@/core/training';
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth, formatDuration } from '@/shared/lib/format';
import { Icon, SegmentedControl, type IconName } from '@/ui';
import {
  periodRange,
  perWeek,
  previousPeriodRange,
  PROGRESS_PERIODS,
  type ProgressPeriod,
} from '../domain/period';
import { ScoreCard } from './ScoreCard';
import { DayBars, WeightLine } from './ProgressCharts';
import styles from './Progress.module.css';

/** Fewer days with a value than this: the numbers say enough, a chart would be noise. */
const MIN_CHART_DAYS = 2;

/**
 * The Kalethra score first, then the progress figures of today or the last 7 or 30 days –
 * Kalethra training, nutrition, weight and activities, in this order. Each area is one card that opens its detail screen.
 * Values are only described, never judged; missing data stays missing (no invented zeros).
 */
export function ProgressSection({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<ProgressPeriod>('week');
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per day, not per minute
  const range = useMemo(() => periodRange(now, period), [todayKey, period]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per day, not per minute
  const previous = useMemo(() => previousPeriodRange(now, period), [todayKey, period]);
  const day = (date: string) => formatDayMonth(parseLocalDateKey(date) ?? now, locale);

  return (
    <div className={styles.progress}>
      <SegmentedControl
        label={t('progress.periodLabel')}
        options={PROGRESS_PERIODS.map((value) => ({
          value,
          label: t(`progress.periods.${value}`),
        }))}
        value={period}
        onChange={setPeriod}
      />
      <p className={styles.range}>
        <span className="visually-hidden">{t(`progress.rangeHint.${period}`)} </span>
        {range.from === range.to
          ? t('progress.rangeDay', { day: day(range.to) })
          : t('progress.range', { from: day(range.from), to: day(range.to) })}
      </p>
      <ScoreCard period={period} range={range} previous={previous} />
      <ul className={styles.list} aria-label={t('progress.title')}>
        <TrainingProgress range={range} period={period} day={day} />
        <NutritionProgress range={range} day={day} />
        <WeightProgress range={range} period={period} day={day} />
        <ActivityProgress range={range} day={day} />
      </ul>
    </div>
  );
}

type Range = ReturnType<typeof periodRange>;

function ProgressRow({
  to,
  icon,
  title,
  children,
}: {
  to: string;
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link to={to} className={styles.row}>
        <span className={styles.rowHeader}>
          <span className={styles.rowTitle}>
            <Icon name={icon} size={18} className={styles.rowIcon} />
            {title}
          </span>
          <Icon name="chevronRight" size={18} className={styles.chevron} />
        </span>
        {children}
      </Link>
    </li>
  );
}

function TrainingProgress({
  range,
  period,
  day,
}: {
  range: Range;
  period: ProgressPeriod;
  day: (date: string) => string;
}) {
  const { t, locale } = useI18n();
  const data = useTrainingData(
    (s, profileId) => s.workouts.dailyStatsBetween(profileId, range.from, range.to),
    [range.from, range.to],
  );
  const summary = data.status === 'ready' ? summarizeTraining(data.data, range.dates) : null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (
    <ProgressRow to={ROUTES.training} icon="training" title={t('progress.training.title')}>
      {summary && summary.workouts > 0 ? (
        <>
          <span className={styles.figures}>
            <span className={styles.main}>
              {summary.workouts === 1
                ? t('progress.training.workoutsOne')
                : t('progress.training.workouts', { count: summary.workouts })}
            </span>
            {period !== 'today' ? (
              <span className={styles.secondary}>
                {t('progress.training.perWeek', {
                  value: number.format(perWeek(summary.workouts, period)),
                })}
              </span>
            ) : null}
          </span>
          {summary.volumeKg !== null ? (
            <span className={styles.secondary}>
              {t('progress.training.volume', {
                value: new Intl.NumberFormat(locale).format(summary.volumeKg),
              })}
            </span>
          ) : null}
          {range.dates.length >= MIN_CHART_DAYS ? (
            <DayBars
              values={summary.perDay.map((entry) => entry.workouts)}
              label={t('progress.training.chart', {
                days: summary.trainingDays,
                total: range.dates.length,
              })}
              from={day(range.from)}
              to={day(range.to)}
            />
          ) : null}
        </>
      ) : summary ? (
        <span className={styles.note}>{t('progress.training.empty')}</span>
      ) : null}
    </ProgressRow>
  );
}

function NutritionProgress({ range, day }: { range: Range; day: (date: string) => string }) {
  const { t, locale } = useI18n();
  const { revision: targetRevision } = useTargets();
  const { revision: healthRevision } = useHealthSync();
  const { revision: activityRevision } = useActivities();
  const data = useNutritionData(
    async (s, profileId) => ({
      totals: await s.diary.dailyTotalsBetween(profileId, range.from, range.to),
      goals: await s.goals.dayGoalsBetween(profileId, range.dates),
    }),
    [range, targetRevision, healthRevision, activityRevision],
  );
  const summary =
    data.status === 'ready'
      ? summarizeNutrition(data.data.totals, data.data.goals, range.dates)
      : null;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return (
    <ProgressRow to={ROUTES.nutrition} icon="nutrition" title={t('progress.nutrition.title')}>
      {summary && summary.avgKcal !== null ? (
        <>
          <span className={styles.figures}>
            <span className={styles.main}>
              {t('progress.nutrition.avgKcal', { value: number.format(summary.avgKcal) })}
            </span>
            {summary.avgProteinG !== null ? (
              <span className={styles.secondary}>
                {t('progress.nutrition.avgProtein', {
                  value: number.format(summary.avgProteinG),
                })}
              </span>
            ) : null}
          </span>
          {summary.avgGoalKcal !== null ? (
            <span className={styles.note}>
              {summary.avgGoalProteinG !== null
                ? t('progress.nutrition.goal', {
                    kcal: number.format(summary.avgGoalKcal),
                    protein: number.format(summary.avgGoalProteinG),
                  })
                : t('progress.nutrition.goalKcal', {
                    kcal: number.format(summary.avgGoalKcal),
                  })}
            </span>
          ) : null}
          <span className={styles.note}>
            {t('progress.nutrition.logged', {
              count: summary.loggedDays,
              total: range.dates.length,
            })}
          </span>
          {summary.loggedDays >= MIN_CHART_DAYS ? (
            <DayBars
              values={summary.perDay.map((entry) => entry.kcal)}
              reference={summary.avgGoalKcal}
              label={t('progress.nutrition.chart', {
                count: summary.loggedDays,
                avg: number.format(summary.avgKcal),
              })}
              from={day(range.from)}
              to={day(range.to)}
            />
          ) : null}
        </>
      ) : summary ? (
        <span className={styles.note}>{t('progress.nutrition.empty')}</span>
      ) : null}
    </ProgressRow>
  );
}

function WeightProgress({
  range,
  period,
  day,
}: {
  range: Range;
  period: ProgressPeriod;
  day: (date: string) => string;
}) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const own = useWeightData(
    async (service, profileId) => {
      const [inPeriod, latest] = await Promise.all([
        service.listBetween(profileId, range.from, range.to),
        service.getLatestOnOrBefore(profileId, range.to),
      ]);
      return latest && !inPeriod.some((entry) => entry.date === latest.date)
        ? [latest, ...inPeriod]
        : inPeriod;
    },
    [range.from, range.to],
  );
  const imported = useImportedHealthData(
    async (service, profileId) => {
      const [inPeriod, latest] = await Promise.all([
        service.weightsBetween(profileId, range.from, range.to),
        service.latestWeight(profileId),
      ]);
      return latest && !inPeriod.some((entry) => entry.date === latest.date)
        ? [latest, ...inPeriod]
        : inPeriod;
    },
    [range.from, range.to],
  );
  const ready = own.status === 'ready' && imported.status === 'ready';
  const summary = ready
    ? summarizeWeightPeriod(mergeWeightDays(own.data, imported.data), range.from, range.to)
    : null;
  const first = summary?.points[0];
  const last = summary?.points.at(-1);
  const weight = (kg: number) => formatWeight(kg, unit, locale);
  return (
    <ProgressRow to={ROUTES.health} icon="scale" title={t('progress.weight.title')}>
      {summary?.latest ? (
        <>
          <span className={styles.figures}>
            <span className={styles.main}>{weight(summary.latest.kg)}</span>
            <span className={styles.secondary}>
              {summary.changeKg !== null
                ? t(`progress.weight.change.${period}`, {
                    value: formatWeightChange(summary.changeKg, unit, locale),
                  })
                : t('progress.weight.noChange')}
            </span>
          </span>
          {summary.latest.source === 'imported' ? (
            <span className={styles.note}>{t('progress.weight.imported')}</span>
          ) : null}
          {first && last && summary.points.length >= MIN_CHART_DAYS ? (
            <WeightLine
              points={summary.points.map((point) => ({
                date: point.date,
                value: fromKg(point.kg, unit),
              }))}
              label={t('progress.weight.chart', {
                first: weight(first.kg),
                from: day(first.date),
                last: weight(last.kg),
                to: day(last.date),
              })}
              start={`${weight(first.kg)} · ${day(first.date)}`}
              end={`${weight(last.kg)} · ${day(last.date)}`}
            />
          ) : null}
        </>
      ) : summary ? (
        <span className={styles.note}>{t('progress.weight.empty')}</span>
      ) : null}
    </ProgressRow>
  );
}

function ActivityProgress({ range, day }: { range: Range; day: (date: string) => string }) {
  const { t, locale } = useI18n();
  const { status } = useHealthSync();
  const imported = useImportedHealthData(
    (service, profileId) => service.workoutsBetween(profileId, range.from, range.to),
    [range.from, range.to],
  );
  const manual = useActivityData(
    (service, profileId) => service.listBetween(profileId, range.from, range.to),
    [range.from, range.to],
  );
  // Completed Kalethra workouts (neighbouring days too: one may start before midnight) – a
  // session that is one of them belongs to training, not to the activities.
  const own = useTrainingData(
    (s, profileId) =>
      s.workouts.completedSpansBetween(profileId, shiftDay(range.from, -1), shiftDay(range.to, 1)),
    [range.from, range.to],
  );
  // Both sources, each session once – same rule as the calorie budget and the score.
  const summary =
    imported.status === 'ready' && manual.status === 'ready' && own.status === 'ready'
      ? summarizeAllActivities(combineActivities(imported.data, manual.data), range.dates, own.data)
      : null;
  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  // Without Health Connect (iOS, browser, never connected) and without any activity this row
  // would only say "nothing" – it is left out.
  if (!summary || (!connected && summary.count === 0)) return null;
  const number = new Intl.NumberFormat(locale);
  return (
    <ProgressRow to={TRAINING_LINKS.activities} icon="flame" title={t('progress.activities.title')}>
      {summary.count > 0 ? (
        <>
          <span className={styles.figures}>
            <span className={styles.main}>
              {summary.count === 1
                ? t('progress.activities.countOne')
                : t('progress.activities.count', { count: summary.count })}
            </span>
            <span className={styles.secondary}>{formatDuration(summary.durationS)}</span>
          </span>
          {summary.activeKcal !== null ? (
            <span className={styles.secondary}>
              {t('progress.activities.kcal', {
                value: number.format(summary.activeKcal),
              })}
            </span>
          ) : null}
          {summary.activeDays >= 3 ? (
            <DayBars
              values={summary.perDay.map((entry) => entry.minutes)}
              label={t('progress.activities.chart', {
                days: summary.activeDays,
                total: range.dates.length,
              })}
              from={day(range.from)}
              to={day(range.to)}
            />
          ) : null}
        </>
      ) : (
        <span className={styles.note}>{t('progress.activities.empty')}</span>
      )}
    </ProgressRow>
  );
}

/** The local day `days` before or after `localDate` (YYYY-MM-DD). */
function shiftDay(localDate: string, days: number): string {
  const day = parseLocalDateKey(localDate);
  return day ? toLocalDateKey(addDays(day, days)) : localDate;
}
