import { useState, type CSSProperties } from 'react';
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
import { dismissKeyboard, Icon } from '@/ui';
import { formatDecimalInput, fromKg, type WeightUnit } from '@/shared/lib/units';
import { describeSetError, describeTrainingError } from '../domain/errors';
import { headerKey } from '../domain/setFields';
import { useRestTimer } from '../hooks/useRestTimer';
import styles from './SetRow.module.css';

/** Fields entered in a set row (RPE is no longer entered; stored values are kept). */
type Field = Exclude<keyof SetValues, 'rpe'>;
type Drafts = Record<Field, string>;

function toDrafts(set: SetValues, unit: WeightUnit, locale: string): Drafts {
  const text = (value: number | null, decimals: number) =>
    value === null ? '' : formatDecimalInput(value, decimals, locale);
  return {
    weightKg: set.weightKg === null ? '' : text(fromKg(set.weightKg, unit), WEIGHT_INPUT_DECIMALS),
    reps: text(set.reps, 0),
    durationS: text(set.durationS, 0),
    distanceM: text(set.distanceM, 1),
  };
}

function parseField(field: Field, input: string, unit: WeightUnit): FieldInput {
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

interface SetRowProps {
  set: WorkoutSet;
  /** Spoken name of the set, e.g. "Satz 2", "Aufwärmsatz 1", "Drop 1 zu Satz 3". */
  label: string;
  /** Short visible marker: "2", "A1", "↓". */
  badge: string;
  /** Names of the check button, e.g. "Satz 2 abschließen" / "Satz 2 wieder öffnen". */
  completeLabel: string;
  reopenLabel: string;
  exerciseType: ExerciseType;
  /** Opens type change and delete for this set ("Optionen für Satz 2"). */
  optionsLabel: string;
  onOptions: () => void;
}

/**
 * One set: large numeric inputs, saved when a field loses focus; the check button completes
 * the set (validated in the service) or reopens it.
 *
 * The check button is a plain button: it never keeps or moves focus into a text field, so it
 * cannot bring up the keyboard. If a field is still focused, it is blurred first – its own
 * save runs before the toggle because training changes are queued (see `mutate`).
 */
export function SetRow({
  set,
  label,
  badge,
  completeLabel,
  reopenLabel,
  exerciseType,
  optionsLabel,
  onOptions,
}: SetRowProps) {
  const { t, locale } = useI18n();
  const { weightUnit: unit } = useSettings().settings;
  const { mutate } = useTraining();
  const restTimer = useRestTimer();
  const fields = setFieldsFor(exerciseType).filter((field): field is Field => field !== 'rpe');
  const snapshot = JSON.stringify([set, unit, locale]);
  const [synced, setSynced] = useState(() => ({ snapshot, base: toDrafts(set, unit, locale) }));
  const [drafts, setDrafts] = useState(synced.base);
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Adopt saved values (e.g. after reload or unit change). Fields the user has edited but not
  // yet saved keep their draft, so a save of one field never wipes typing in another.
  if (snapshot !== synced.snapshot) {
    const base = toDrafts(set, unit, locale);
    const next = { ...base };
    for (const field of Object.keys(base) as Field[]) {
      if (drafts[field] !== synced.base[field]) next[field] = drafts[field];
    }
    setSynced({ snapshot, base });
    setDrafts(next);
  }

  function collect(): SetValues | null {
    // Start from the stored set so values that are not entered here (legacy RPE) are kept.
    const values: SetValues = {
      weightKg: null,
      reps: null,
      durationS: null,
      distanceM: null,
      rpe: set.rpe,
    };
    const bad: Field[] = [];
    for (const field of fields) {
      const parsed = parseField(field, drafts[field], unit);
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

  async function save(completed: boolean) {
    const values = collect();
    if (!values) return;
    try {
      await mutate((s, profileId) => s.workouts.updateSet(profileId, set.id, values, completed));
      setError(null);
      setInvalid([]);
      // A set just completed during a workout starts the rest (not when only a value changed).
      if (completed && !set.completed) restTimer?.start();
    } catch (failure) {
      if (failure instanceof TrainingError) {
        setInvalid(
          failure.setErrors.map((e) => e.field).filter((field): field is Field => field !== 'rpe'),
        );
      }
      setError(describeTrainingError(failure, t, unit, locale));
    }
  }

  return (
    <div className={styles.row} data-completed={set.completed} data-type={set.setType}>
      <div className={styles.grid} style={{ '--fields': fields.length } as CSSProperties}>
        <button
          type="button"
          className={styles.number}
          aria-label={optionsLabel}
          onClick={() => {
            dismissKeyboard();
            onOptions();
          }}
        >
          {badge}
        </button>
        {fields.map((field) => (
          <input
            key={field}
            className={styles.input}
            aria-label={`${label}: ${t(headerKey(field, exerciseType))}`}
            aria-invalid={invalid.includes(field)}
            inputMode={field === 'reps' || field === 'durationS' ? 'numeric' : 'decimal'}
            enterKeyHint="done"
            autoComplete="off"
            value={drafts[field]}
            placeholder="–"
            onChange={(event) => {
              setDrafts((current) => ({ ...current, [field]: event.target.value }));
            }}
            onBlur={() => void save(set.completed)}
          />
        ))}
        <button
          type="button"
          className={styles.check}
          aria-pressed={set.completed}
          aria-label={set.completed ? reopenLabel : completeLabel}
          onClick={() => {
            dismissKeyboard();
            void save(!set.completed);
          }}
        >
          <Icon name="check" size={22} />
        </button>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
