import { useI18n } from '@/core/i18n';
import { getWeekDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth, formatLongDate, formatShortWeekday } from '@/shared/lib/format';
import { Icon } from '@/ui';
import styles from './WeekStrip.module.css';

interface WeekStripProps {
  /** Selected day, YYYY-MM-DD. */
  selected: string;
  today: string;
  onSelect: (day: string) => void;
  onShiftWeek: (weeks: number) => void;
}

/** Week of the selected day. Past days and today are selectable; future days are not. */
export function WeekStrip({ selected, today, onSelect, onShiftWeek }: WeekStripProps) {
  const { locale, t } = useI18n();
  const days = getWeekDays(parseLocalDateKey(selected) ?? new Date());
  const keys = days.map(toLocalDateKey);
  const containsToday = keys.includes(today);
  const first = days[0];
  const last = days.at(-1);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.navButton}
          aria-label={t('dashboard.weekPrevious')}
          onClick={() => {
            onShiftWeek(-1);
          }}
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <span className={styles.range}>
          {first && last
            ? `${formatDayMonth(first, locale)} – ${formatDayMonth(last, locale)}`
            : null}
        </span>
        {selected !== today ? (
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => {
              onSelect(today);
            }}
          >
            {t('dashboard.backToToday')}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.navButton}
          aria-label={t('dashboard.weekNext')}
          disabled={containsToday}
          onClick={() => {
            onShiftWeek(1);
          }}
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
      <ol className={styles.week} aria-label={t('dashboard.weekTitle')}>
        {days.map((day, index) => {
          const key = keys[index] ?? '';
          const isToday = key === today;
          const isFuture = key > today;
          const isSelected = key === selected;
          return (
            <li key={key} className={styles.day}>
              <button
                type="button"
                className={styles.dayButton}
                data-today={isToday}
                data-selected={isSelected}
                disabled={isFuture}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={
                  isToday
                    ? t('dashboard.weekTodayLabel', { date: formatLongDate(day, locale) })
                    : formatLongDate(day, locale)
                }
                onClick={() => {
                  onSelect(key);
                }}
              >
                <span className={styles.weekday} aria-hidden="true">
                  {formatShortWeekday(day, locale)}
                </span>
                <span className={styles.date} aria-hidden="true">
                  {day.getDate()}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
