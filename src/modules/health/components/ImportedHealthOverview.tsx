import { SETTINGS_LINKS } from '@/app/routes';
import {
  dayWeight,
  formatWeight,
  summarizeStepGoal,
  useHealthSync,
  useImportedHealthData,
  useWeightService,
} from '@/core/health';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import { targetOn, useTargetData } from '@/core/targets';
import { addDays, parseLocalDateKey, toLocalDateKey } from '@/shared/lib/date';
import { formatDayMonth } from '@/shared/lib/format';
import { EmptyValue, List, ListRow, Section } from '@/ui';

/**
 * Values imported from Health Connect, shown apart from Kalethra's own weight: first steps and
 * activity (named by content, the source in the footer), then the imported weight under
 * "Health Connect". Display only: nothing here feeds the weight history, the chart or the
 * nutrition goals.
 */
export function ImportedHealthOverview({ today }: { today: Date }) {
  const { t, locale } = useI18n();
  const { weightUnit } = useSettings().settings;
  const { status } = useHealthSync();
  const weights = useWeightService();
  const todayKey = toLocalDateKey(today);
  const weekStart = toLocalDateKey(addDays(today, -6));

  const data = useImportedHealthData(
    async (service, profileId) => {
      const [activity, imported] = await Promise.all([
        service.activityBetween(profileId, weekStart, todayKey),
        service.latestWeight(profileId),
      ]);
      const own = imported ? await weights.service.getForDate(profileId, imported.date) : null;
      return { activity, weight: dayWeight(own?.kg ?? null, imported), imported };
    },
    [weekStart, todayKey, weights.service, weights.revision],
  );
  // The step goal is set in Einstellungen → Ziele; steps themselves come only from Health Connect.
  const stepGoals = useTargetData(
    async (service, profileId) => (await service.history(profileId)).stepsPerDay,
    [],
  );

  const connected = status.state === 'connected' || status.state === 'permissionRequired';
  const ready = data.status === 'ready' ? data.data : null;
  const hasData = ready !== null && (ready.activity.length > 0 || ready.imported !== null);
  if (!connected && !hasData) return null;

  const number = new Intl.NumberFormat(locale);
  const todayActivity = ready?.activity.find((day) => day.date === todayKey);
  const none = <EmptyValue label={t('common.noValue')} />;
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    toLocalDateKey(addDays(today, index - 6)),
  );
  // The one step evaluation (also used by Fortschritt and the score): days without data are
  // left out, each day with the step goal that applied then.
  const stepSummary = ready
    ? summarizeStepGoal(
        ready.activity.map((day) => ({ date: day.date, steps: day.steps })),
        weekDates,
        (date) => (stepGoals.status === 'ready' ? targetOn(stepGoals.data, date) : null),
      )
    : null;
  const stepGoal = stepGoals.status === 'ready' ? stepSummary : null;
  const average = stepSummary?.avgSteps ?? null;
  const lastSuccessAt =
    status.state === 'connected' || status.state === 'permissionRequired'
      ? status.lastSuccessAt
      : null;

  return (
    <>
      <Section title={t('healthConnect.activityTitle')} footer={t('healthConnect.activityFooter')}>
        <List label={t('healthConnect.activityTitle')}>
          <ListRow
            icon="health"
            title={t('healthConnect.stepsToday')}
            value={
              todayActivity?.steps != null
                ? t('healthConnect.steps', { count: number.format(todayActivity.steps) })
                : none
            }
          />
          {stepGoal?.today ? (
            <ListRow
              icon="target"
              title={t('healthConnect.stepGoalToday')}
              subtitle={
                stepGoal.ratedDays > 0
                  ? t('healthConnect.stepGoalWeek', {
                      reached: stepGoal.reachedDays,
                      total: stepGoal.ratedDays,
                    })
                  : undefined
              }
              value={
                stepGoal.today.steps !== null
                  ? t(
                      stepGoal.today.steps >= stepGoal.today.goal
                        ? 'healthConnect.stepGoalReached'
                        : 'healthConnect.stepGoalProgress',
                      {
                        steps: number.format(stepGoal.today.steps),
                        goal: number.format(stepGoal.today.goal),
                      },
                    )
                  : t('healthConnect.stepGoalNoData', { goal: number.format(stepGoal.today.goal) })
              }
            />
          ) : stepGoals.status === 'ready' ? (
            <ListRow
              icon="target"
              title={t('healthConnect.stepGoalSet')}
              to={SETTINGS_LINKS.goals}
            />
          ) : null}
          <ListRow
            icon="flame"
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
            icon="plan"
            title={t('healthConnect.stepsAverage')}
            value={average !== null ? number.format(average) : none}
          />
        </List>
      </Section>
      <Section
        title={t('healthConnect.name')}
        footer={
          lastSuccessAt
            ? t('healthConnect.overviewFooterSynced', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(lastSuccessAt)),
              })
            : t('healthConnect.overviewFooter')
        }
      >
        <List label={t('healthConnect.name')}>
          <ListRow
            icon="scale"
            title={t('healthConnect.importedWeight')}
            subtitle={ready?.weight.kind === 'own' ? t('healthConnect.ownWins') : undefined}
            value={
              ready?.imported
                ? t('healthConnect.importedWeightValue', {
                    weight: formatWeight(ready.imported.kg, weightUnit, locale),
                    date: formatDayMonth(parseLocalDateKey(ready.imported.date) ?? today, locale),
                  })
                : none
            }
          />
        </List>
      </Section>
    </>
  );
}
