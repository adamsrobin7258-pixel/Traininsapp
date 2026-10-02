import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { Screen } from '@/ui';
import { ActivityCaloriesSection } from '../components/ActivityCaloriesSection';
import { GoalTargetsSections } from '../components/GoalTargetsSection';
import { NutritionGoalsForm } from '../components/NutritionGoalsForm';

/**
 * Einstellungen → Ziele: the only place to change goals – main goal and nutrition (one save,
 * with the existing preview and confirmation), counting activity calories, and the versioned
 * targets for training, activities and steps (each saved at once).
 */
export function GoalsScreen() {
  const { t } = useI18n();
  return (
    <Screen
      title={t('settings.goals.title')}
      back={{ to: ROUTES.settings, label: t('settings.title') }}
    >
      <NutritionGoalsForm />
      <ActivityCaloriesSection />
      <GoalTargetsSections />
    </Screen>
  );
}
