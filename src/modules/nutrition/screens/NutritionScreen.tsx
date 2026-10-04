import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useActivities } from '@/core/activity';
import { useHealthSync } from '@/core/health';
import { useI18n } from '@/core/i18n';
import {
  SAVED_MEAL_NAME_MAX_LENGTH,
  useNutrition,
  useNutritionData,
  type FoodEntry,
  type MealSlot,
} from '@/core/nutrition';
import { useTargets } from '@/core/targets';
import { toLocalDateKey } from '@/shared/lib/date';
import { PromptSheet, Screen } from '@/ui';
import { AddSheet } from '../components/AddSheet';
import { DayNavigator } from '../components/DayNavigator';
import { DayOverview } from '../components/DayOverview';
import { EntrySheet } from '../components/EntrySheet';
import { MealDetailsSheet, MealList } from '../components/MealSection';
import { WaterSection } from '../components/WaterSection';
import { groupDay, resolveDay, type MealGroup } from '../domain/day';
import { describeNutritionError, mealName } from '../domain/format';
import styles from '../components/Nutrition.module.css';

const DAY_PARAM = 'day';

/** `from`: the meal whose details were open – closing returns there instead of to the day. */
type Open =
  | { kind: 'meal'; key: string }
  | { kind: 'add'; meal: MealSlot; from?: string }
  | { kind: 'entry'; entry: FoodEntry; from?: string }
  | { kind: 'template'; group: MealGroup }
  | null;

/**
 * The food diary of one day (today by default): energy and macros against the day's goal,
 * the configured meals as an overview (their foods one tap away), and water. Past days can be viewed and corrected;
 * future days cannot be opened.
 */
export function NutritionScreen() {
  const { t } = useI18n();
  const { mutate } = useNutrition();
  const [params, setParams] = useSearchParams();
  const today = toLocalDateKey(new Date());
  const day = resolveDay(params.get(DAY_PARAM), today);
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // … and after a target changed: "Aktivitätskalorien anrechnen" is a versioned target.
  const { revision: targetRevision } = useTargets();
  // Reloads after a Health Connect sync: imported activities can change the day's budget.
  const { revision: healthRevision } = useHealthSync();
  // … and after a manual activity changed.
  const { revision: activityRevision } = useActivities();

  const data = useNutritionData(
    async (s, profileId) => ({
      day: await s.diary.getDay(profileId, day),
      goal: await s.goals.dayGoal(profileId, day),
      meals: await s.meals.listAll(profileId),
    }),
    [day, today, targetRevision, healthRevision, activityRevision],
  );

  function changeDay(next: string) {
    setNotice(null);
    // Replacing keeps the history short: system back leaves the diary instead of
    // stepping through every day that was looked at.
    setParams(next === today ? {} : { [DAY_PARAM]: next }, { replace: true });
  }

  const close = () => {
    setOpen(open && 'from' in open && open.from ? { kind: 'meal', key: open.from } : null);
  };
  const ready = data.status === 'ready' ? data.data : null;
  const activeMeals = ready ? ready.meals.filter((meal) => meal.active) : [];
  const groups = ready ? groupDay(ready.meals, ready.day.entries) : [];
  // Resolved from the current data, so the details follow every edit; once the last food of
  // the meal was moved or deleted there is nothing left to show and the day is visible again.
  const openGroup =
    open?.kind === 'meal'
      ? (groups.find((group) => group.key === open.key && group.entries.length > 0) ?? null)
      : null;

  return (
    <Screen title={t('nutrition.title')}>
      <DayNavigator day={day} today={today} onChange={changeDay} />
      {data.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {ready ? (
        <>
          <DayOverview totals={ready.day.summary.totals.totals} goal={ready.goal} />
          <MealList
            groups={groups}
            onOpen={(group) => {
              setOpen({ kind: 'meal', key: group.key });
            }}
            onAdd={(group) => {
              if (group.meal) setOpen({ kind: 'add', meal: group.meal });
            }}
          />
          <WaterSection
            day={day}
            entries={ready.day.water}
            totalMl={ready.day.waterMl}
            goalMl={ready.goal?.effective.waterMl.value ?? null}
          />
        </>
      ) : null}

      {openGroup ? (
        <MealDetailsSheet
          group={openGroup}
          onAdd={() => {
            if (openGroup.meal) {
              setOpen({ kind: 'add', meal: openGroup.meal, from: openGroup.key });
            }
          }}
          onEdit={(entry) => {
            setOpen({ kind: 'entry', entry, from: openGroup.key });
          }}
          onSaveTemplate={() => {
            setOpen({ kind: 'template', group: openGroup });
          }}
          onClose={close}
        />
      ) : null}
      {open?.kind === 'add' ? (
        <AddSheet day={day} meal={open.meal} meals={activeMeals} onClose={close} />
      ) : null}
      {open?.kind === 'entry' ? (
        <EntrySheet entry={open.entry} meals={activeMeals} onClose={close} />
      ) : null}
      {open?.kind === 'template' ? (
        <PromptSheet
          title={t('nutrition.mealSection.templateTitle')}
          label={t('nutrition.mealSection.templateName')}
          initialValue={mealName(open.group, t)}
          maxLength={SAVED_MEAL_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={(error) => describeNutritionError(error, t)}
          onSubmit={async (name) => {
            const { group } = open;
            const items = group.entries.flatMap((entry) =>
              entry.foodId
                ? [{ foodId: entry.foodId, amount: entry.amount, unit: entry.unit }]
                : [],
            );
            const saved = await mutate((s, profileId) =>
              s.meals.saveMeal(profileId, { name, mealId: group.meal?.id ?? null, items }),
            );
            const skipped = group.entries.some((entry) => entry.foodId === null);
            setNotice(
              [
                t('nutrition.templates.saved', { name: saved.name }),
                skipped ? t('nutrition.mealSection.templateSkipped') : null,
              ]
                .filter(Boolean)
                .join(' '),
            );
            close();
          }}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}
