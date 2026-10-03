import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import { formatWeight, formatWeightChange, fromKg, useHealthSync } from '@/core/health';
import { useI18n, type TranslationKey } from '@/core/i18n';
import type { CalorieGoalKind, CalorieGoalStatus } from '@/core/nutrition';
import { useProgressGoals, type Attainment, type ProgressGoals } from '@/core/progress';
import { useSettings } from '@/core/settings';
import { parseLocalDateKey } from '@/shared/lib/date';
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
 * Kalethra training, nutrition, weight, activities and steps, in this order. Each area is one
 * card that opens its detail screen. Since Phase 14 each card shows the goal from Einstellungen
 * next to the tracked value; all figures come ready-made from `ProgressGoalService` – the cards
 * calculate nothing. Values are only described, never judged; missing data stays missing.
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
  // The rolling period always ends today (`periodRange`), so its last day is today.
  const goals = useProgressGoals(range.dates, range.to);
  const data = goals.status === 'ready' ? goals.data : null;

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
        <TrainingProgress data={data} range={range} period={period} day={day} />
        <NutritionProgress data={data} range={range} period={period} day={day} />
        <WeightProgress data={data} period={period} day={day} />
        <ActivityProgress data={data} range={range} period={period} day={day} />
        <StepsProgress data={data} range={range} period={period} />
      </ul>
    </div>
  );
}

type Range = ReturnType<typeof periodRange>;

interface CardProps {
  /** `null` while loading – the card shows its title only. */
  data: ProgressGoals | null;
  range: Range;
  period: ProgressPeriod;
  day: (date: string) => string;
}

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

/**
 * Actual against goal: the figures as text, a quiet bar (never beyond 100 %, so "5 of 4" keeps
 * the layout) and the percent. The bar is decorative – everything it shows is in the text.
 */
function GoalMeter({ value, attainment }: { value: string; attainment: Attainment | null }) {
  const { t, locale } = useI18n();
  return (
    <span className={styles.goal}>
      <span className={styles.figures}>
        <span className={styles.main}>{value}</span>
        {attainment ? (
          <span className={styles.secondary}>
            {t('progress.goal.percent', {
              value: new Intl.NumberFormat(locale).format(attainment.percent),
            })}
          </span>
        ) : null}
      </span>
      {attainment ? (
        <span className={styles.meter} aria-hidden="true">
          <span
            className={styles.meterFill}
            style={{ '--meter-ratio': attainment.shownRatio } as CSSProperties}
          />
        </span>
      ) : null}
    </span>
  );
}

function TrainingProgress({ data, range, period, day }: CardProps) {
  const { t, locale } = useI18n();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const summary = data?.training.summary ?? null;
  const goal = data?.training.goal ?? null;
  const count = (value: number) =>
    value === 1
      ? t('progress.training.workoutsOne')
      : t('progress.training.workouts', { count: number.format(value) });
  return (
    <ProgressRow to={ROUTES.training} icon="training" title={t('progress.training.title')}>
      {goal?.mode === 'full' ? (
        <GoalMeter
          value={t('progress.training.goalProgress', {
            done: number.format(goal.done),
            expected: number.format(goal.expected),
          })}
          attainment={goal.attainment}
        />
      ) : summary && summary.workouts > 0 ? (
        <span className={styles.figures}>
          <span className={styles.main}>{count(summary.workouts)}</span>
        </span>
      ) : summary ? (
        <span className={styles.note}>{t('progress.training.empty')}</span>
      ) : null}
      {goal && goal.mode !== 'none' ? (
        <span className={styles.note}>
          {goal.mode === 'full' && goal.targetSince
            ? t('progress.training.goalSince', {
                target: goal.weeklyTarget,
                date: day(goal.targetSince),
              })
            : t('progress.training.goalTarget', { target: goal.weeklyTarget })}
        </span>
      ) : goal ? (
        <span className={styles.note}>{t('progress.training.noTarget')}</span>
      ) : null}
      {summary && summary.workouts > 0 ? (
        <>
          {period !== 'today' || summary.volumeKg !== null ? (
            <span className={styles.figures}>
              {period !== 'today' ? (
                <span className={styles.secondary}>
                  {goal?.mode === 'full'
                    ? `${count(summary.workouts)} · ${t('progress.training.perWeek', {
                        value: number.format(perWeek(summary.workouts, period)),
                      })}`
                    : t('progress.training.perWeek', {
                        value: number.format(perWeek(summary.workouts, period)),
                      })}
                </span>
              ) : null}
              {summary.volumeKg !== null ? (
                <span className={styles.secondary}>
                  {t('progress.training.volume', {
                    value: new Intl.NumberFormat(locale).format(summary.volumeKg),
                  })}
                </span>
              ) : null}
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
      ) : null}
    </ProgressRow>
  );
}

function calorieTodayKey(kind: CalorieGoalKind, status: CalorieGoalStatus): TranslationKey | null {
  if (kind === 'limit') {
    if (status === 'within') return 'progress.nutrition.kcalToday.limitWithin';
    if (status === 'above') return 'progress.nutrition.kcalToday.limitAbove';
    return null;
  }
  if (kind === 'minimum') {
    if (status === 'within') return 'progress.nutrition.kcalToday.minimumWithin';
    if (status === 'open') return 'progress.nutrition.kcalToday.minimumOpen';
    return null;
  }
  if (status === 'within') return 'progress.nutrition.kcalToday.rangeWithin';
  if (status === 'above') return 'progress.nutrition.kcalToday.rangeAbove';
  if (status === 'open') return 'progress.nutrition.kcalToday.rangeOpen';
  return null;
}

function NutritionProgress({ data, range, period, day }: CardProps) {
  const { t, locale } = useI18n();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nutrition = data?.nutrition ?? null;
  const summary = nutrition?.summary ?? null;
  const calories = nutrition?.calories ?? null;
  const protein = nutrition?.protein ?? null;
  const today = period === 'today';
  const calorieTodayText = calories?.today ? calorieTodayKey(calories.kind, calories.today) : null;
  const calorieText = !calories
    ? null
    : calories.ratedDays > 0 && !today
      ? t(`progress.nutrition.kcalDays.${calories.kind}`, {
          count: calories.withinDays,
          total: calories.ratedDays,
        })
      : calorieTodayText
        ? t(calorieTodayText)
        : null;
  const proteinNote = protein
    ? protein.ratedDays > 0 && !today
      ? t('progress.nutrition.proteinDays', {
          count: protein.reachedDays,
          total: protein.ratedDays,
        })
      : protein.today === 'reached'
        ? t('progress.nutrition.proteinToday')
        : null
    : null;
  return (
    <ProgressRow to={ROUTES.nutrition} icon="nutrition" title={t('progress.nutrition.title')}>
      {summary && summary.avgKcal !== null ? (
        <>
          {calories ? (
            <GoalMeter
              value={t(
                today ? 'progress.nutrition.kcalProgress' : 'progress.nutrition.avgKcalProgress',
                {
                  value: number.format(calories.avgKcal),
                  goal: number.format(calories.avgGoalKcal),
                },
              )}
              attainment={null}
            />
          ) : (
            <span className={styles.figures}>
              <span className={styles.main}>
                {t('progress.nutrition.avgKcal', { value: number.format(summary.avgKcal) })}
              </span>
            </span>
          )}
          {calorieText ? <span className={styles.note}>{calorieText}</span> : null}
          {protein ? (
            <GoalMeter
              value={t(
                today
                  ? 'progress.nutrition.proteinProgress'
                  : 'progress.nutrition.avgProteinProgress',
                { value: number.format(protein.avgG), goal: number.format(protein.avgGoalG) },
              )}
              attainment={protein.attainment}
            />
          ) : summary.avgProteinG !== null ? (
            <span className={styles.secondary}>
              {t('progress.nutrition.avgProtein', { value: number.format(summary.avgProteinG) })}
            </span>
          ) : null}
          {proteinNote ? <span className={styles.note}>{proteinNote}</span> : null}
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

function WeightProgress({ data, period, day }: Omit<CardProps, 'range'>) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const summary = data?.weight ?? null;
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
          {summary.start && summary.end ? (
            <span className={styles.secondary}>
              {t('progress.weight.course', {
                from: weight(summary.start.kg),
                to: weight(summary.end.kg),
              })}
            </span>
          ) : null}
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

function ActivityProgress({ data, range, day }: CardProps) {
  const { t, locale } = useI18n();
  const { status } = useHealthSync();
  const summary = data?.activity.summary ?? null;
  const goal = data?.activity.goal ?? null;
  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  // Without Health Connect (iOS, browser, never connected), without any activity and without an
  // activity goal this row would only say "nothing" – it is left out.
  if (!summary || !goal || (!connected && summary.count === 0 && goal.mode === 'none')) return null;
  const number = new Intl.NumberFormat(locale);
  return (
    <ProgressRow to={TRAINING_LINKS.activities} icon="flame" title={t('progress.activities.title')}>
      {goal.mode === 'full' ? (
        <GoalMeter
          value={t('progress.activities.goalProgress', {
            minutes: number.format(goal.minutes),
            expected: number.format(goal.expectedMinutes),
          })}
          attainment={goal.attainment}
        />
      ) : null}
      {summary.count > 0 ? (
        <>
          <span className={styles.figures}>
            <span className={goal.mode === 'full' ? styles.secondary : styles.main}>
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
        </>
      ) : (
        <span className={styles.note}>{t('progress.activities.empty')}</span>
      )}
      <span className={styles.note}>
        {goal.mode === 'none'
          ? t('progress.activities.noTarget')
          : goal.targetSince
            ? t('progress.activities.goalSince', {
                target: number.format(goal.weeklyTarget),
                date: day(goal.targetSince),
              })
            : t('progress.activities.goalTarget', { target: number.format(goal.weeklyTarget) })}
      </span>
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
    </ProgressRow>
  );
}

/**
 * Steps from Health Connect against the daily step goal – the real steps (the score uses them
 * inside "Aktivitäten", outside tracked activities). A day without
 * step data is neither 0 steps nor a missed goal – averages cover the days with data only.
 */
function StepsProgress({ data, range, period }: Omit<CardProps, 'day'>) {
  const { t, locale } = useI18n();
  const { status } = useHealthSync();
  const steps = data?.steps ?? null;
  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  // Steps exist only through Health Connect: without a connection and without imported steps
  // the row is left out (also on iOS and in the browser).
  if (!steps || (!connected && steps.summary.daysWithData === 0)) return null;
  const { summary, attainment } = steps;
  const number = new Intl.NumberFormat(locale);
  const today = period === 'today';
  return (
    <ProgressRow to={ROUTES.health} icon="health" title={t('progress.steps.title')}>
      {summary.avgSteps === null ? (
        <span className={styles.note}>
          {today ? t('progress.steps.emptyToday') : t('progress.steps.empty')}
        </span>
      ) : attainment ? (
        <GoalMeter
          value={t(today ? 'progress.steps.progress' : 'progress.steps.avgProgress', {
            steps: number.format(attainment.actual),
            goal: number.format(attainment.target),
          })}
          attainment={attainment}
        />
      ) : (
        <span className={styles.figures}>
          <span className={styles.main}>
            {t(today ? 'progress.steps.value' : 'progress.steps.avgValue', {
              steps: number.format(summary.avgSteps),
            })}
          </span>
        </span>
      )}
      {summary.latestGoal !== null ? (
        <span className={styles.note}>
          {t('progress.steps.goalTarget', { goal: number.format(summary.latestGoal) })}
        </span>
      ) : (
        <span className={styles.note}>{t('progress.steps.noTarget')}</span>
      )}
      {!today && summary.daysWithData > 0 ? (
        <span className={styles.note}>
          {t('progress.steps.days', { count: summary.daysWithData, total: range.dates.length })}
          {summary.ratedDays > 0
            ? ` · ${t('progress.steps.reached', {
                count: summary.reachedDays,
                total: summary.ratedDays,
              })}`
            : null}
        </span>
      ) : null}
    </ProgressRow>
  );
}
