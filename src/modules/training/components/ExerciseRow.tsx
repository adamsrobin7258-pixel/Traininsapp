import { useI18n } from '@/core/i18n';
import { exerciseDisplayName, type Exercise } from '@/core/training';
import { Icon, ListRow } from '@/ui';
import styles from './ExercisePicker.module.css';

export function FavoriteMark() {
  const { t } = useI18n();
  return (
    <span className={styles.favoriteMark}>
      <Icon name="star" size={16} />
      <span className="visually-hidden">{t('training.exercises.favorite')}</span>
    </span>
  );
}

export function ExerciseRow({
  exercise,
  favorite,
  subtitle,
  disabled,
  onPress,
}: {
  exercise: Exercise;
  favorite: boolean;
  subtitle?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { t, locale } = useI18n();
  // Equipment and main muscles, e.g. "Kurzhantel · Brust".
  const summary = [
    t(`training.equipment.${exercise.equipment}`),
    ...exercise.primaryMuscles.map((muscle) => t(`training.muscles.${muscle}`)),
  ].join(' · ');
  return (
    <ListRow
      title={exerciseDisplayName(exercise, locale)}
      subtitle={subtitle ?? summary}
      trailing={favorite ? <FavoriteMark /> : undefined}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
