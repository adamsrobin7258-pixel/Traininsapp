import { CONTENT_LINKS, SETTINGS_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { useNutritionData } from '@/core/nutrition';
import { EmptyState, List, ListRow, Screen, Section } from '@/ui';
import { formatQuantity } from '../domain/format';
import styles from '../components/Nutrition.module.css';

/**
 * Saved meals (templates): each opens its editor (name, meal, foods and amounts, delete).
 * Templates are created in the diary ("Als Vorlage speichern") and logged from a meal's add
 * sheet; changing or deleting one never touches logged days.
 */
export function TemplatesScreen() {
  const { t, locale } = useI18n();
  const data = useNutritionData(async (s, profileId) => {
    const templates = await s.meals.listSavedMeals(profileId);
    const foods = await s.foods.findMany(
      profileId,
      templates.flatMap((template) => template.items.map((item) => item.foodId)),
    );
    return { templates, foods: new Map(foods.map((food) => [food.id, food])) };
  }, []);
  const templates = data.status === 'ready' ? data.data.templates : [];

  return (
    <Screen
      title={t('nutrition.templates.title')}
      back={{ to: SETTINGS_LINKS.content, label: t('settings.content.title') }}
    >
      {data.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {data.status === 'ready' && templates.length === 0 ? (
        <EmptyState
          icon="plate"
          title={t('nutrition.templates.empty')}
          body={t('nutrition.templates.emptyBody')}
        />
      ) : null}
      {templates.length > 0 ? (
        <Section footer={t('nutrition.templates.listHint')}>
          <List label={t('nutrition.templates.title')}>
            {templates.map((template) => (
              <ListRow
                key={template.id}
                title={template.name}
                subtitle={template.items
                  .map((item) => {
                    const food = data.status === 'ready' ? data.data.foods.get(item.foodId) : null;
                    return `${food?.name ?? '–'} (${formatQuantity(item.amount, item.unit, t, locale)})`;
                  })
                  .join(', ')}
                to={CONTENT_LINKS.template(template.id)}
              />
            ))}
          </List>
        </Section>
      ) : null}
    </Screen>
  );
}
