import { CONTENT_LINKS, ROUTES } from '@/app/routes';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { useNutritionData } from '@/core/nutrition';
import { useTrainingData } from '@/core/training';
import { List, ListRow, Screen, Section } from '@/ui';

/**
 * Einstellungen → Meine Inhalte: the one place where the user's own content is managed –
 * foods, meals of the day, templates and recipes for nutrition, plans and exercises for
 * training. The pages themselves belong to their areas (mounted here via
 * `AppModule.contentRoutes`); the areas keep only tracking and quick access (a new food,
 * template or recipe while logging, a new exercise in the picker).
 */
export function ContentScreen() {
  const { t, locale } = useI18n();
  // Small counts from the existing lists; the rows are usable before they arrive.
  const nutrition = useNutritionData(async (s, profileId) => {
    const [foods, meals, templates, recipes] = await Promise.all([
      s.foods.list(profileId),
      s.meals.listActive(profileId),
      s.meals.listSavedMeals(profileId),
      s.recipes.list(profileId),
    ]);
    return {
      foods: foods.length,
      meals: meals.length,
      templates: templates.length,
      recipes: recipes.length,
    };
  }, []);
  const plans = useTrainingData(
    async (s, profileId) => (await s.plans.listPlans(profileId)).length,
    [],
  );
  const number = new Intl.NumberFormat(locale);
  // The count leads the description line instead of a value column, so titles and words keep
  // their full width on narrow screens and with large fonts.
  const hint = (key: TranslationKey, value: number | undefined) =>
    value === undefined
      ? t(key)
      : t('settings.content.withCount', { count: number.format(value), hint: t(key) });
  const counts = nutrition.status === 'ready' ? nutrition.data : null;

  return (
    <Screen
      title={t('settings.content.title')}
      back={{ to: ROUTES.settings, label: t('settings.title') }}
    >
      <Section title={t('settings.content.nutrition')} footer={t('settings.content.nutritionHint')}>
        <List label={t('settings.content.nutrition')}>
          <ListRow
            icon="apple"
            title={t('nutrition.foods.title')}
            subtitle={hint('settings.content.foodsHint', counts?.foods)}
            to={CONTENT_LINKS.foods}
          />
          <ListRow
            icon="nutrition"
            title={t('nutrition.mealsManage.title')}
            subtitle={hint('settings.content.mealsHint', counts?.meals)}
            to={CONTENT_LINKS.meals}
          />
          <ListRow
            icon="plate"
            title={t('nutrition.templates.title')}
            subtitle={hint('settings.content.templatesHint', counts?.templates)}
            to={CONTENT_LINKS.templates}
          />
          <ListRow
            icon="flame"
            title={t('nutrition.recipes.title')}
            subtitle={hint('settings.content.recipesHint', counts?.recipes)}
            to={CONTENT_LINKS.recipes}
          />
        </List>
      </Section>
      <Section title={t('settings.content.training')} footer={t('settings.content.trainingHint')}>
        <List label={t('settings.content.training')}>
          <ListRow
            icon="plan"
            title={t('training.plansTitle')}
            subtitle={hint(
              'settings.content.plansHint',
              plans.status === 'ready' ? plans.data : undefined,
            )}
            to={CONTENT_LINKS.plans}
          />
          <ListRow
            icon="training"
            title={t('training.exercises.title')}
            subtitle={t('settings.content.exercisesHint')}
            to={CONTENT_LINKS.exercises}
          />
        </List>
      </Section>
    </Screen>
  );
}
