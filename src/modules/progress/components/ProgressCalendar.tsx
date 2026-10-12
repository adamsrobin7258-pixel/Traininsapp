import { useId, useMemo, useState } from 'react';
import { useI18n, type TranslationKey } from '@/core/i18n';
import {
  useProgressCalendar,
  type CalendarCalorieState,
  type ProgressCalendarDay,
} from '@/core/progress';
import { addDays, parseLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth, formatLongDate, formatShortWeekday } from '@/shared/lib/format';
import { Icon, ICON_FOR, Sheet } from '@/ui';
import { calendarRange, leadingBlanks } from '../domain/period';
import styles from './Calendar.module.css';

const CALORIE_DETAIL: Record<CalendarCalorieState, TranslationKey> = {
  reached: 'progress.calendar.calories.reached',
  notReached: 'progress.calendar.calories.notReached',
  open: 'progress.calendar.calories.open',
  noGoal: 'progress.calendar.calories.noGoal',
  noData: 'progress.calendar.calories.noData',
};

/**
 * The last 20 local days under the weekdays (Phase 23). A day gets the training symbol when a
 * Kalethra workout was completed and the nutrition symbol when the calorie goal was met – both in
 * forest green, independent of each other. Every other day stays plain: no data or a goal not met
 * is never shown as a failure. Tapping a day shows what is known about it.
 */
export function ProgressCalendar({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per day, not per minute
  const range = useMemo(() => calendarRange(now), [todayKey]);
  const calendar = useProgressCalendar(range.dates, range.to);
  const [selected, setSelected] = useState<string | null>(null);
  const titleId = useId();
  const first = parseLocalDateKey(range.from) ?? now;
  const blanks = leadingBlanks(first);
  // Weekday names from the days themselves, starting with the first column (Monday).
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    formatShortWeekday(addDays(first, index - blanks), locale),
  );
  const days: ProgressCalendarDay[] =
    calendar.status === 'ready'
      ? calendar.data
      : range.dates.map((date) => ({ date, workouts: 0, calories: 'noData' }));
  const loading = calendar.status === 'loading';
  const day = days.find((entry) => entry.date === selected) ?? null;
  const dateOf = (key: string) => parseLocalDateKey(key) ?? now;

  return (
    <section className={styles.calendar} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {t('progress.calendar.title')}
        </h2>
        <span className={styles.range}>
          {t('progress.range', {
            from: formatDayMonth(dateOf(range.from), locale),
            to: formatDayMonth(dateOf(range.to), locale),
          })}
        </span>
      </div>
      {calendar.status === 'error' ? (
        <p className={styles.note} role="alert">
          {t('progress.calendar.loadFailed')}
        </p>
      ) : null}
      <div className={styles.grid} aria-busy={loading || undefined}>
        {weekdays.map((name, index) => (
          <span key={`weekday-${String(index)}`} className={styles.weekday} aria-hidden="true">
            {name}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, index) => (
          <span key={`blank-${String(index)}`} aria-hidden="true" />
        ))}
        {days.map((entry) => {
          const date = dateOf(entry.date);
          const isToday = entry.date === range.to;
          const trained = entry.workouts > 0;
          const reached = entry.calories === 'reached';
          const marks = [
            trained ? t('progress.calendar.legendTraining') : null,
            reached ? t('progress.calendar.legendCalories') : null,
          ].filter(Boolean);
          return (
            <button
              key={entry.date}
              type="button"
              className={styles.day}
              data-date={entry.date}
              data-today={isToday || undefined}
              aria-current={isToday ? 'date' : undefined}
              aria-label={[
                formatLongDate(date, locale),
                isToday ? t('progress.calendar.today') : null,
                ...marks,
              ]
                .filter(Boolean)
                .join(', ')}
              onClick={() => {
                setSelected(entry.date);
              }}
            >
              <span className={styles.number}>{date.getDate()}</span>
              <span className={styles.marks} aria-hidden="true">
                {trained ? (
                  <span className={styles.mark} data-mark="training">
                    <Icon name={ICON_FOR.training} size={14} />
                  </span>
                ) : null}
                {reached ? (
                  <span className={styles.mark} data-mark="calories">
                    <Icon name={ICON_FOR.nutrition} size={14} />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <ul className={styles.legend} aria-label={t('progress.calendar.legendLabel')}>
        <li>
          <span className={styles.mark} data-mark="training" aria-hidden="true">
            <Icon name={ICON_FOR.training} size={14} />
          </span>
          {t('progress.calendar.legendTraining')}
        </li>
        <li>
          <span className={styles.mark} data-mark="calories" aria-hidden="true">
            <Icon name={ICON_FOR.nutrition} size={14} />
          </span>
          {t('progress.calendar.legendCalories')}
        </li>
      </ul>
      {day ? (
        <Sheet
          title={formatLongDate(dateOf(day.date), locale)}
          onClose={() => {
            setSelected(null);
          }}
          closeLabel={t('common.close')}
        >
          <dl className={styles.details}>
            <div className={styles.detail}>
              <dt>
                <span
                  className={styles.mark}
                  data-mark="training"
                  data-off={day.workouts === 0 || undefined}
                  aria-hidden="true"
                >
                  <Icon name={ICON_FOR.training} size={18} />
                </span>
                {t('progress.calendar.trainingTitle')}
              </dt>
              <dd>
                {day.workouts === 0
                  ? t('progress.calendar.training.none')
                  : day.workouts === 1
                    ? t('progress.calendar.training.one')
                    : t('progress.calendar.training.many', { count: day.workouts })}
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>
                <span
                  className={styles.mark}
                  data-mark="calories"
                  data-off={day.calories !== 'reached' || undefined}
                  aria-hidden="true"
                >
                  <Icon name={ICON_FOR.nutrition} size={18} />
                </span>
                {t('progress.calendar.caloriesTitle')}
              </dt>
              <dd>{t(CALORIE_DETAIL[day.calories])}</dd>
            </div>
          </dl>
        </Sheet>
      ) : null}
    </section>
  );
}
