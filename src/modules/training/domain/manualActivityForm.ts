import {
  defaultIntensity,
  defaultVariant,
  sportById,
  type Intensity,
  type ManualActivity,
  type ManualActivityInput,
  type SportDefinition,
  type VariantOption,
} from '@/core/activity';
import { formatDecimalInput, parseDecimalInput } from '@/shared/lib/units';

/** The form as typed – strings, so half-typed values stay as they are. */
export interface ActivityFormState {
  sportId: string;
  date: string;
  time: string;
  duration: string;
  distance: string;
  intensity: Intensity | null;
  variant: VariantOption | null;
  /** `null` = use the calculated value; a string = the user's own value (may be half-typed). */
  kcal: string | null;
}

export type ActivityFormError = 'duration' | 'distance' | 'kcal' | 'date' | 'time';

export function newForm(sport: SportDefinition, today: string): ActivityFormState {
  return {
    sportId: sport.id,
    date: today,
    time: '',
    duration: '',
    distance: '',
    intensity: defaultIntensity(sport),
    variant: defaultVariant(sport),
    kcal: null,
  };
}

function localTime(instant: string | null): string {
  if (!instant) return '';
  const date = new Date(instant);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The stored activity as form values (for editing). */
export function formFromActivity(activity: ManualActivity, locale: string): ActivityFormState {
  return {
    sportId: activity.sportId,
    date: activity.localDate,
    time: localTime(activity.startedAt),
    duration: String(Math.round(activity.durationS / 60)),
    distance:
      activity.distanceM !== null ? formatDecimalInput(activity.distanceM / 1000, 2, locale) : '',
    intensity: activity.intensity,
    variant: activity.variant,
    kcal:
      activity.kcalOverridden && activity.kcal !== null ? String(Math.round(activity.kcal)) : null,
  };
}

/** Switches the sport and keeps what still fits (date, time, duration, distance if asked). */
export function withSport(state: ActivityFormState, sport: SportDefinition): ActivityFormState {
  return {
    ...state,
    sportId: sport.id,
    distance: sport.fields.distance ? state.distance : '',
    intensity: defaultIntensity(sport),
    variant: defaultVariant(sport),
  };
}

export type ParsedForm =
  | { ok: true; input: ManualActivityInput }
  | { ok: false; errors: ActivityFormError[]; partial: ManualActivityInput | null };

/**
 * Turns the typed values into service input. Duration is required (whole minutes), distance
 * optional (≤ 2 decimals), own kcal whole numbers. `partial` is what can already be calculated
 * while other fields are still invalid (for the live estimate).
 */
export function parseForm(state: ActivityFormState, today: string): ParsedForm {
  const sport = sportById(state.sportId);
  const errors: ActivityFormError[] = [];
  const duration = parseDecimalInput(state.duration, { maxDecimals: 0 });
  const durationMin =
    duration.ok && duration.value >= 1 && duration.value <= 1440 ? duration.value : null;
  if (durationMin === null) errors.push('duration');

  let distanceKm: number | null = null;
  if (sport?.fields.distance && state.distance.trim() !== '') {
    const distance = parseDecimalInput(state.distance, { maxDecimals: 2 });
    if (distance.ok && distance.value >= 0.01 && distance.value <= 1000)
      distanceKm = distance.value;
    else errors.push('distance');
  }

  let kcalOverride: number | null = null;
  if (state.kcal !== null) {
    const kcal = parseDecimalInput(state.kcal, { maxDecimals: 0, maxIntegerDigits: 5 });
    if (kcal.ok && kcal.value <= 10000) kcalOverride = kcal.value;
    else errors.push('kcal');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date) || state.date > today) errors.push('date');
  if (state.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(state.time)) errors.push('time');

  const base = {
    sportId: state.sportId,
    localDate: state.date,
    startTime: state.time === '' ? null : state.time,
    distanceKm,
    intensity: state.intensity,
    variant: state.variant,
    kcalOverride,
  };
  if (errors.length > 0) {
    const calculable = durationMin !== null && !errors.includes('distance');
    return { ok: false, errors, partial: calculable ? { ...base, durationMin } : null };
  }
  return { ok: true, input: { ...base, durationMin: durationMin ?? 0 } };
}
