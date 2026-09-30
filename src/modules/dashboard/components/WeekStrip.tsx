import { useI18n } from '@/core/i18n';
import { getWeekDays, isSameDay, toLocalDateKey } from '@/shared/lib/date';
import { formatLongDate, formatShortWeekday } from '@/shared/lib/format';
import styles from './WeekStrip.module.css';

export function WeekStrip({ today }: { today: Date }) {
  const { locale, t } = useI18n();
  return (
    <ol className={styles.week} aria-label={t('dashboard.weekTitle')}>
      {getWeekDays(today).map((day) => {
        const isToday = isSameDay(day, today);
        const isFuture = day > today && !isToday;
        return (
          <li
            key={toLocalDateKey(day)}
            className={styles.day}
            data-today={isToday}
            data-future={isFuture}
            aria-current={isToday ? 'date' : undefined}
            aria-label={
              isToday
                ? t('dashboard.weekTodayLabel', { date: formatLongDate(day, locale) })
                : formatLongDate(day, locale)
            }
          >
            <span className={styles.weekday} aria-hidden="true">
              {formatShortWeekday(day, locale)}
            </span>
            <span className={styles.date} aria-hidden="true">
              {day.getDate()}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
