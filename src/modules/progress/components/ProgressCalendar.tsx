import { useId, useMemo, useState } from 'react';
import { useI18n, type TranslationKey } from '@/core/i18n';
import {
  useProgressCalendar,
  type CalendarCalorieState,
  type ProgressCalendarDay,
} from '@/core/progress';
import { parseLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth, formatLongDate, formatShortWeekday } from '@/shared/lib/format';
import { Icon, ICON_FOR, Sheet } from '@/ui';
import { calendarRange } from '../domain/period';
import styles from './Calendar.module.css';

const CALORIE_DETAIL: Record<CalendarCalorieState, TranslationKey> = {
  reached: 'progress.calendar.calories.reached',
  notReached: 'progress.calendar.calories.notReached',
  open: 'progress.calendar.calories.open',
  noGoal: 'progress.calendar.calories.noGoal',
  noData: 'progress.calendar.calories.noData',
};

/**
 * "Die letzten Tage": the current calendar week and the two before, Monday first (Phase 24; until
 * then the last 20 days). A day gets the training symbol when a Kalethra workout was completed
 * and the nutrition symbol when the calorie goal was met – both in forest green, independent of
 * each other. Every other day stays plain: no data or a goal not met is never shown as a failure.
 * Tapping a day shows what is known about it. Days after today are only drawn (quiet, no mark,
 * not tappable) – there is nothing to know about them yet.
 */
export function ProgressCalendar({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const todayKey = now.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per day, not per minute
  const range = useMemo(() => calendarRange(now), [todayKey]);
  // Data only up to today – the rest of this week is still to come.
  const calendar = useProgressCalendar(range.untilToday, range.today);
  const [selected, setSelected] = useState<string | null>(null);
  const titleId = useId();
  const dateOf = (key: string) => parseLocalDateKey(key) ?? now;
  // Weekday names from the first week's days (Monday … Sunday).
  const weekdays = range.dates.slice(0, 7).map((key) => formatShortWeekday(dateOf(key), locale));
  const days: ProgressCalendarDay[] =
    calendar.status === 'ready'
      ? calendar.data
      : range.untilToday.map((date) => ({ date, workouts: 0, calories: 'noData' }));
  const loading = calendar.status === 'loading';
  const day = days.find((entry) => entry.date === selected) ?? null;
  const future = range.dates.filter((date) => date > range.today);

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
        {days.map((entry) => {
          const date = dateOf(entry.date);
          const isToday = entry.date === range.today;
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
        {future.map((key) => (
          <span key={key} className={styles.day} data-date={key} data-future="true">
            <span className={styles.number} aria-hidden="true">
              {dateOf(key).getDate()}
            </span>
            <span className={styles.marks} aria-hidden="true" />
            <span className="visually-hidden">
              {`${formatLongDate(dateOf(key), locale)}, ${t('progress.calendar.future')}`}
            </span>
          </span>
        ))}
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
