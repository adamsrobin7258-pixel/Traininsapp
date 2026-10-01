import { useI18n } from '@/core/i18n';
import { EQUIPMENT, MUSCLE_FILTERS, type Equipment, type MuscleFilter } from '@/core/training';
import styles from './ExercisePicker.module.css';

interface ExerciseFiltersProps {
  muscle: MuscleFilter | null;
  equipment: Equipment | null;
  onMuscleChange: (muscle: MuscleFilter | null) => void;
  onEquipmentChange: (equipment: Equipment | null) => void;
}

/**
 * Two horizontally scrolling chip rows: muscle group and equipment. Tapping the selected chip
 * (or "All") clears that filter; both filters combine with the search text.
 */
export function ExerciseFilters({
  muscle,
  equipment,
  onMuscleChange,
  onEquipmentChange,
}: ExerciseFiltersProps) {
  const { t } = useI18n();
  return (
    <div className={styles.filters}>
      <ChipRow
        label={t('training.exercises.muscleFilter')}
        allLabel={t('training.exercises.allMuscles')}
        options={MUSCLE_FILTERS.map((value) => ({
          value,
          label: t(`training.muscleFilters.${value}`),
        }))}
        selected={muscle}
        onChange={onMuscleChange}
      />
      <ChipRow
        label={t('training.exercises.equipmentFilter')}
        allLabel={t('training.exercises.allEquipment')}
        options={EQUIPMENT.map((value) => ({ value, label: t(`training.equipment.${value}`) }))}
        selected={equipment}
        onChange={onEquipmentChange}
      />
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.chip}
        aria-pressed={selected === null}
        onClick={() => {
          onChange(null);
        }}
      >
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.chip}
          aria-pressed={selected === option.value}
          onClick={() => {
            onChange(selected === option.value ? null : option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
