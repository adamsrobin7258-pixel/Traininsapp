/**
 * Health Connect activities and manual activities side by side. Pure.
 *
 * The two sources stay separate records; this only decides how they are shown and counted:
 * - Health Connect has priority. A manual activity that is most likely the same session as an
 *   imported one (see `isLikelySameActivity`) is shown, but not counted a second time.
 * - Neither source is ever counted as a Kalethra workout; activities that are the same session
 *   as a completed Kalethra workout are that workout and do not count again – not on the calorie
 *   budget, not in the score's active minutes, not in the progress totals (Phase 6.3 rule).
 *
 * Whether an activity counts is decided in one place (`importedExclusion`, `manualExclusion`);
 * calorie budget, score minutes and progress totals all use it.
 */

import {
  countableActivityCalories,
  isKalethraWorkout,
  isSameSession,
  summarizeActivities,
  type ActivityPeriodSummary,
  type ExternalWorkout,
  type OwnWorkoutSpan,
} from '@/core/health';
import { sportById } from './catalog';
import type { ManualActivity } from './manualActivity';

/** Shorter session ÷ longer one; below this two sessions are not "the same". */
export const SIMILAR_DURATION = 0.5;

export type ActivityEntry =
  | { source: 'healthConnect'; key: string; activity: ExternalWorkout }
  | {
      source: 'manual';
      key: string;
      activity: ManualActivity;
      /** Key of the Health Connect activity this one most likely duplicates. */
      duplicateOf: string | null;
    };

/** Start and end of a manual activity – only when a start time was entered. */
export function manualSpan(activity: ManualActivity): OwnWorkoutSpan | null {
  if (!activity.startedAt) return null;
  const start = Date.parse(activity.startedAt);
  if (Number.isNaN(start)) return null;
  return {
    startedAt: activity.startedAt,
    endedAt: new Date(start + activity.durationS * 1000).toISOString(),
  };
}

/**
 * Conservative: a manual activity duplicates an imported one only when all three hold –
 * compatible sport (the imported type is one of the sport's Health Connect types), the times
 * overlap for at least half of the shorter session, and the durations are similar (shorter ≥
 * half of the longer). Without a start time there is no reliable match: it stays on its own.
 */
export function isLikelySameActivity(manual: ManualActivity, imported: ExternalWorkout): boolean {
  const sport = sportById(manual.sportId);
  const span = manualSpan(manual);
  if (!sport || !span) return false;
  if (!sport.healthConnectTypes.includes(imported.activityType)) return false;
  const shorter = Math.min(manual.durationS, imported.durationS);
  const longer = Math.max(manual.durationS, imported.durationS);
  if (longer <= 0 || shorter / longer < SIMILAR_DURATION) return false;
  return isSameSession(span, imported);
}

/** Why an activity does not count – `null` when it counts. */
export type ActivityExclusion = 'duplicate' | 'kalethraWorkout' | null;

/** An imported activity counts unless it is the same session as a Kalethra workout. */
export function importedExclusion(
  activity: ExternalWorkout,
  own: readonly OwnWorkoutSpan[],
): ActivityExclusion {
  return isKalethraWorkout(activity, own) ? 'kalethraWorkout' : null;
}

/**
 * A manual activity counts unless it duplicates an imported one (Health Connect has priority)
 * or – with a start time – is the same session as a Kalethra workout.
 */
export function manualExclusion(
  activity: ManualActivity,
  imported: readonly ExternalWorkout[],
  own: readonly OwnWorkoutSpan[],
): ActivityExclusion {
  if (imported.some((candidate) => isLikelySameActivity(activity, candidate))) return 'duplicate';
  const span = manualSpan(activity);
  return span !== null && isKalethraWorkout(span, own) ? 'kalethraWorkout' : null;
}

/** Both sources, newest first; manual activities know the import they duplicate. */
export function combineActivities(
  imported: readonly ExternalWorkout[],
  manual: readonly ManualActivity[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...imported.map((activity) => ({
      source: 'healthConnect' as const,
      key: `hc:${activity.id}`,
      activity,
    })),
    ...manual.map((activity) => {
      const twin = imported.find((candidate) => isLikelySameActivity(activity, candidate));
      return {
        source: 'manual' as const,
        key: `manual:${activity.id}`,
        activity,
        duplicateOf: twin ? `hc:${twin.id}` : null,
      };
    }),
  ];
  return entries.sort(compareNewestFirst);
}

function sortKey(entry: ActivityEntry): [string, string] {
  return [entry.activity.localDate, entry.activity.startedAt ?? ''];
}

function compareNewestFirst(a: ActivityEntry, b: ActivityEntry): number {
  const [dayA, startA] = sortKey(a);
  const [dayB, startB] = sortKey(b);
  if (dayA !== dayB) return dayB.localeCompare(dayA);
  return startB.localeCompare(startA);
}

/** Duration and active kcal of an entry, whatever its source. */
export function entryFigures(entry: ActivityEntry): { durationS: number; kcal: number | null } {
  return entry.source === 'healthConnect'
    ? { durationS: entry.activity.durationS, kcal: entry.activity.activeKcal }
    : { durationS: entry.activity.durationS, kcal: entry.activity.kcal };
}

export interface DayActivityCalories {
  kcal: number;
  counted: number;
  excluded: number;
}

/**
 * The active kcal of one day that may go onto the calorie budget: imported activities (without
 * those that are a Kalethra workout) plus manual ones (without duplicates of an import and
 * without those that are a Kalethra workout). 100 %, no adjustment; rounded to whole kcal.
 */
export function dayActivityCalories(
  imported: readonly ExternalWorkout[],
  manual: readonly ManualActivity[],
  own: readonly OwnWorkoutSpan[],
): DayActivityCalories {
  const fromImport = countableActivityCalories(imported, own);
  let kcal = fromImport.kcal;
  let counted = fromImport.counted;
  let excluded = fromImport.excluded;
  for (const activity of manual) {
    if (manualExclusion(activity, imported, own) !== null) {
      excluded++;
      continue;
    }
    if (activity.kcal === null) continue;
    kcal += activity.kcal;
    counted++;
  }
  return { kcal: Math.round(kcal), counted, excluded };
}

/**
 * Totals for the progress page: every activity of both sources once – a manual duplicate of an
 * import is left out, and so is a session that is a Kalethra workout (it shows under training).
 * Same rule as the calorie budget and the score's active minutes.
 */
export function summarizeAllActivities(
  entries: readonly ActivityEntry[],
  dates: readonly string[],
  own: readonly OwnWorkoutSpan[],
): ActivityPeriodSummary {
  const imported = entries.flatMap((entry) =>
    entry.source === 'healthConnect' ? [entry.activity] : [],
  );
  return summarizeActivities(
    entries
      .filter((entry) =>
        entry.source === 'healthConnect'
          ? importedExclusion(entry.activity, own) === null
          : manualExclusion(entry.activity, imported, own) === null,
      )
      .map((entry) => {
        const figures = entryFigures(entry);
        return {
          externalId: entry.key,
          localDate: entry.activity.localDate,
          durationS: figures.durationS,
          activeKcal: figures.kcal,
        };
      }),
    dates,
  );
}

/**
 * Active minutes per local day that count for the Kalethra score: both sources, a manual
 * duplicate of an import once, and no session that is the same as a completed Kalethra workout
 * (that one already counts as training). Same rules as `dayActivityCalories`.
 */
export function countableActivityMinutes(
  imported: readonly ExternalWorkout[],
  manual: readonly ManualActivity[],
  own: readonly OwnWorkoutSpan[],
): { localDate: string; minutes: number }[] {
  const minutes = new Map<string, number>();
  const add = (localDate: string, durationS: number) => {
    minutes.set(localDate, (minutes.get(localDate) ?? 0) + durationS / 60);
  };
  for (const activity of imported) {
    if (importedExclusion(activity, own) === null) add(activity.localDate, activity.durationS);
  }
  for (const activity of manual) {
    if (manualExclusion(activity, imported, own) === null) {
      add(activity.localDate, activity.durationS);
    }
  }
  return [...minutes]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([localDate, value]) => ({ localDate, minutes: Math.round(value) }));
}
