import { useI18n } from '@/core/i18n';
import { parseLocalDateKey } from '@/shared/lib/date';
import { formatLongDate, formatRelativeDay } from '@/shared/lib/format';
import { Icon } from '@/ui';
import { shiftDay } from '../domain/day';
import styles from './Nutrition.module.css';

/**
 * Previous / next day, a date picker and a way back to today. Days after today cannot be
 * reached: the next button stops at today and the picker has today as its maximum.
 */
export function DayNavigator({
  day,
  today,
  onChange,
}: {
  day: string;
  today: string;
  onChange: (day: string) => void;
}) {
  const { t, locale } = useI18n();
  const date = parseLocalDateKey(day);
  const relative = formatRelativeDay(day, today, locale, {
    today: t('nutrition.day.today'),
    yesterday: t('nutrition.day.yesterday'),
  });
  const label =
    day === today || relative === t('nutrition.day.yesterday') || !date
      ? relative
      : formatLongDate(date, locale);

  return (
    <div className={styles.dayNav}>
      <button
        type="button"
        className={styles.dayButton}
        aria-label={t('nutrition.day.previous')}
        onClick={() => {
          onChange(shiftDay(day, -1));
        }}
      >
        <Icon name="chevronLeft" size={20} />
      </button>
      <div className={styles.dayCenter}>
        <label className={styles.dayLabel}>
          <span aria-hidden="true">{label}</span>
          <input
            className={styles.dateInput}
            type="date"
            aria-label={`${t('nutrition.day.pick')}: ${label}`}
            value={day}
            max={today}
            onChange={(event) => {
              // Clearing the picker or choosing a future day keeps the current day.
              const value = event.target.value;
              if (value && value <= today) onChange(value);
            }}
          />
        </label>
        {day !== today ? (
          <button
            type="button"
            className={styles.todayLink}
            onClick={() => {
              onChange(today);
            }}
          >
            {t('nutrition.day.backToToday')}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.dayButton}
        aria-label={t('nutrition.day.next')}
        disabled={day >= today}
        onClick={() => {
          onChange(shiftDay(day, 1));
        }}
      >
        <Icon name="chevronRight" size={20} />
      </button>
    </div>
  );
}
