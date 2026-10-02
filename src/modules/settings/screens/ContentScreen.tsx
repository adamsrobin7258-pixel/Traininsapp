import { NUTRITION_LINKS, ROUTES, TRAINING_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { List, ListRow, Screen, Section } from '@/ui';

/**
 * Einstellungen → Meine Inhalte – prepared. The own content (foods, meals, templates, plans,
 * exercises) still lives in its area and moves here in the next phase; until then this page
 * says so and leads there.
 */
export function ContentScreen() {
  const { t } = useI18n();
  return (
    <Screen
      title={t('settings.content.title')}
      back={{ to: ROUTES.settings, label: t('settings.title') }}
    >
      <Section title={t('settings.content.nutrition')} footer={t('settings.content.moving')}>
        <List>
          <ListRow title={t('nutrition.foods.manage')} to={NUTRITION_LINKS.foods} />
          <ListRow title={t('nutrition.mealsManage.manage')} to={NUTRITION_LINKS.meals} />
          <ListRow title={t('nutrition.templates.manage')} to={NUTRITION_LINKS.templates} />
        </List>
      </Section>
      <Section title={t('settings.content.training')}>
        <List>
          <ListRow title={t('training.plansTitle')} to={TRAINING_LINKS.plans} />
          <ListRow title={t('training.manageExercises')} to={TRAINING_LINKS.exercises} />
        </List>
      </Section>
    </Screen>
  );
}
