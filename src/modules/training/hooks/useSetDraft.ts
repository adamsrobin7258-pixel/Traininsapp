import { useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/settings';
import {
  parseDistanceInput,
  parseDurationInput,
  parseLoadInput,
  parseRepsInput,
  setFieldsFor,
  TrainingError,
  useTraining,
  WEIGHT_INPUT_DECIMALS,
  type ExerciseType,
  type FieldInput,
  type SetValues,
  type WorkoutSet,
} from '@/core/training';
import { formatDecimalInput, fromKg, type WeightUnit } from '@/shared/lib/units';
import { describeSetError, describeTrainingError } from '../domain/errors';
import type { EntryField } from '../domain/setFields';
import { useRestTimer } from './useRestTimer';

/** The text of every entry field of one set, as typed. */
export type SetDrafts = Record<EntryField, string>;

export function toDrafts(set: SetValues, unit: WeightUnit, locale: string): SetDrafts {
  const text = (value: number | null, decimals: number) =>
    value === null ? '' : formatDecimalInput(value, decimals, locale);
  return {
    weightKg: set.weightKg === null ? '' : text(fromKg(set.weightKg, unit), WEIGHT_INPUT_DECIMALS),
    reps: text(set.reps, 0),
    durationS: text(set.durationS, 0),
    distanceM: text(set.distanceM, 1),
  };
}

function parseField(field: EntryField, input: string, unit: WeightUnit): FieldInput {
  switch (field) {
    case 'weightKg':
      return parseLoadInput(input, unit);
    case 'distanceM':
      return parseDistanceInput(input);
    case 'durationS':
      return parseDurationInput(input);
    case 'reps':
      return parseRepsInput(input);
  }
}

export interface SetDraft {
  /** Fields entered for this exercise type, in display order. */
  fields: EntryField[];
  drafts: SetDrafts;
  invalid: EntryField[];
  error: string | null;
  /** Completed – also right after completing, before the reloaded set arrives. */
  completed: boolean;
  /** Completing is running: the check is ignored until the completed set has arrived. */
  saving: boolean;
  setDraft: (field: EntryField, text: string) => void;
  /**
   * Parses the drafts (or `next`, e.g. right after a +/− step), validates them in the service
   * and stores them with `completed`. A set that becomes completed starts the rest timer – only
   * then, never when a value changes or a set is reopened. Resolves to `true` on success.
   */
  save: (completed: boolean, next?: SetDrafts) => Promise<boolean>;
}

/**
 * The entry state of one set: texts as typed, parsed and saved through the training service.
 * One instance belongs to one set – give the component `key={set.id}`, so typing in one set
 * can never end up in another.
 */
export function useSetDraft(set: WorkoutSet, exerciseType: ExerciseType): SetDraft {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const restTimer = useRestTimer();
  const fields = setFieldsFor(exerciseType).filter((field): field is EntryField => field !== 'rpe');
  const snapshot = JSON.stringify([set, unit, locale]);
  const [synced, setSynced] = useState(() => ({ snapshot, base: toDrafts(set, unit, locale) }));
  const [drafts, setDrafts] = useState(synced.base);
  const [invalid, setInvalid] = useState<EntryField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Completed in the database, but the reloaded set has not arrived yet.
  const [awaiting, setAwaiting] = useState(false);
  // Synchronous guard: a second tap arrives before React re-renders the disabled state.
  const completing = useRef(false);

  if (awaiting && set.completed) setAwaiting(false);

  // Adopt saved values (e.g. after reload or unit change). Fields the user has edited but not
  // yet saved keep their draft, so a save of one field never wipes typing in another.
  if (snapshot !== synced.snapshot) {
    const base = toDrafts(set, unit, locale);
    const next = { ...base };
    for (const field of Object.keys(base) as EntryField[]) {
      if (drafts[field] !== synced.base[field]) next[field] = drafts[field];
    }
    setSynced({ snapshot, base });
    setDrafts(next);
  }

  function collect(source: SetDrafts): SetValues | null {
    // Start from the stored set so values that are not entered here (legacy RPE) are kept.
    const values: SetValues = {
      weightKg: null,
      reps: null,
      durationS: null,
      distanceM: null,
      rpe: set.rpe,
    };
    const bad: EntryField[] = [];
    for (const field of fields) {
      const parsed = parseField(field, source[field], unit);
      if (parsed.ok) values[field] = parsed.value;
      else bad.push(field);
    }
    setInvalid(bad);
    if (bad[0]) {
      setError(describeSetError({ field: bad[0], problem: 'range' }, t, unit, locale));
      return null;
    }
    return values;
  }

  async function save(completed: boolean, next?: SetDrafts): Promise<boolean> {
    const completes = completed && !set.completed && !awaiting;
    if (completes && completing.current) return false;
    const values = collect(next ?? drafts);
    if (!values) return false;
    if (completes) {
      completing.current = true;
      setSaving(true);
    }
    try {
      await mutate((s, profileId) => s.workouts.updateSet(profileId, set.id, values, completed));
      setError(null);
      setInvalid([]);
      if (completes) {
        setAwaiting(true);
        restTimer?.start();
      }
      return true;
    } catch (failure) {
      if (failure instanceof TrainingError) {
        setInvalid(
          failure.setErrors
            .map((e) => e.field)
            .filter((field): field is EntryField => field !== 'rpe'),
        );
      }
      setError(describeTrainingError(failure, t, unit, locale));
      return false;
    } finally {
      if (completes) {
        completing.current = false;
        setSaving(false);
      }
    }
  }

  return {
    fields,
    drafts,
    invalid,
    error,
    completed: set.completed || awaiting,
    saving: saving || awaiting,
    setDraft: (field, text) => {
      setDrafts((current) => ({ ...current, [field]: text }));
    },
    save,
  };
}
