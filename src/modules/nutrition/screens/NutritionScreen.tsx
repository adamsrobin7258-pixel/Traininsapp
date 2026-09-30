import { useI18n } from '@/core/i18n';
import { EmptyState, EmptyValue, List, ListRow, Screen, Section } from '@/ui';

const NUTRIENTS = ['energy', 'protein', 'carbohydrates', 'fat'] as const;

export function NutritionScreen() {
  const { t } = useI18n();
  return (
    <Screen title={t('nutrition.title')}>
      <EmptyState
        icon="nutrition"
        title={t('nutrition.emptyTitle')}
        body={t('nutrition.emptyBody')}
      />
      <Section title={t('nutrition.nutrientsTitle')}>
        <List>
          {NUTRIENTS.map((nutrient) => (
            <ListRow
              key={nutrient}
              title={t(`nutrition.nutrients.${nutrient}`)}
              value={<EmptyValue label={t('common.noValue')} />}
            />
          ))}
        </List>
      </Section>
    </Screen>
  );
}
