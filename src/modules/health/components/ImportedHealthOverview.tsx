import { Link } from 'react-router';
import { SETTINGS_LINKS } from '@/app/routes';
import { summarizeStepGoal, useHealthSync, useImportedHealthData } from '@/core/health';
import { useI18n } from '@/core/i18n';
import { targetOn, useTargetData } from '@/core/targets';
import { addDays, toLocalDateKey } from '@/shared/lib/date';
import { EmptyValue, Icon, ICON_FOR, List, ListRow, Meter, Section } from '@/ui';
import styles from './ImportedHealthOverview.module.css';

/**
 * Steps and activity from Health Connect (named by content, the source and last update in the
 * footer). Today's steps and the step goal are one statement with one bar. Display only: the
 * own weight lives in the weight section above; an imported weight is not repeated here.
 */
export function ImportedHealthOverview({ today }: { today: Date }) {
  const { t, locale } = useI18n();
  const { status } = useHealthSync();
  const todayKey = toLocalDateKey(today);
  const weekStart = toLocalDateKey(addDays(today, -6));

  const data = useImportedHealthData(
    (service, profileId) => service.activityBetween(profileId, weekStart, todayKey),
    [weekStart, todayKey],
  );
  // The step goal is set in Einstellungen → Ziele; steps themselves come only from Health Connect.
  const stepGoals = useTargetData(
    async (service, profileId) => (await service.history(profileId)).stepsPerDay,
    [],
  );

  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  const ready = data.status === 'ready' ? data.data : null;
  const hasData = ready !== null && ready.length > 0;
  if (!connected && !hasData) return null;

  const number = new Intl.NumberFormat(locale);
  const todayActivity = ready?.find((day) => day.date === todayKey);
  const none = <EmptyValue label={t('common.noValue')} />;
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    toLocalDateKey(addDays(today, index - 6)),
  );
  // The one step evaluation (also used by Fortschritt and the score): days without data are
  // left out, each day with the step goal that applied then.
  const stepSummary = ready
    ? summarizeStepGoal(
        ready.map((day) => ({ date: day.date, steps: day.steps })),
        weekDates,
        (date) => (stepGoals.status === 'ready' ? targetOn(stepGoals.data, date) : null),
      )
    : null;
  const stepGoal = stepGoals.status === 'ready' ? stepSummary?.today : null;
  const average = stepSummary?.avgSteps ?? null;
  const todaySteps = todayActivity?.steps ?? null;
  const todayGoal = stepGoal?.goal ?? null;
  const stepsLabel =
    todayGoal !== null
      ? t('healthConnect.stepsTodayOfGoal', {
          steps: todaySteps !== null ? number.format(todaySteps) : '–',
          goal: number.format(todayGoal),
        })
      : todaySteps !== null
        ? t('healthConnect.steps', { count: number.format(todaySteps) })
        : t('common.noValue');
  const lastSuccessAt =
    status.state === 'connected' || status.state === 'permissionRequired'
      ? status.lastSuccessAt
      : null;

  return (
    <Section
      title={t('healthConnect.activityTitle')}
      footer={
        lastSuccessAt
          ? t('healthConnect.activityFooterSynced', {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(lastSuccessAt)),
            })
          : t('healthConnect.activityFooter')
      }
    >
      {/* Steps and step goal as one statement: "7.842 / 10.000 Schritte". */}
      <div className={styles.steps} role="group" aria-label={stepsLabel}>
        <span className={styles.stepsTitle}>
          <Icon name={ICON_FOR.steps} size={18} className={styles.stepsIcon} />
          {t('healthConnect.stepsToday')}
        </span>
        <span className={styles.stepsFigure} aria-hidden="true">
          <span className={styles.stepsValue}>
            {todaySteps !== null ? number.format(todaySteps) : '–'}
          </span>
          {todayGoal !== null ? (
            <span className={styles.stepsGoal}>
              {t('healthConnect.stepsOfGoal', { goal: number.format(todayGoal) })}
            </span>
          ) : (
            <span className={styles.stepsGoal}>{t('healthConnect.stepsUnit')}</span>
          )}
        </span>
        {todayGoal !== null && todaySteps !== null ? (
          <Meter
            ratio={todaySteps / todayGoal}
            label={t('healthConnect.stepsToday')}
            valueText={stepsLabel}
          />
        ) : null}
        {todayGoal === null && stepGoals.status === 'ready' ? (
          <Link to={SETTINGS_LINKS.goals} className={styles.quietLink}>
            {t('healthConnect.stepGoalSet')}
          </Link>
        ) : null}
      </div>
      <List label={t('healthConnect.activityTitle')}>
        <ListRow
          icon={ICON_FOR.energy}
          title={t('healthConnect.activeEnergyToday')}
          value={
            todayActivity?.activeKcal != null
              ? t('healthConnect.kcal', {
                  count: number.format(Math.round(todayActivity.activeKcal)),
                })
              : none
          }
        />
        <ListRow
          icon={ICON_FOR.steps}
          title={t('healthConnect.stepsAverage')}
          value={average !== null ? number.format(average) : none}
        />
      </List>
    </Section>
  );
}
