import { useI18n } from '@/core/i18n';
import { foodCategory, type Food, type FoodCategory, type ReferenceFood } from '@/core/nutrition';
import { FoodArt, Icon, type FoodArtName } from '@/ui';
import styles from './Nutrition.module.css';

const ART: Record<FoodCategory, FoodArtName> = {
  bread: 'bread',
  grain: 'grain',
  bakery: 'bakery',
  egg: 'egg',
  fruit: 'fruit',
  vegetable: 'vegetable',
  legumes: 'legumes',
  potato: 'potato',
  dairy: 'dairy',
  drinks: 'drinks',
  fats: 'fats',
  sweets: 'sweets',
  fish: 'fish',
  meat: 'meat',
  poultry: 'meat',
  sausage: 'sausage',
  dishes: 'dishes',
};

/**
 * The illustration of a food's family. Without a known family (own foods, Open Food Facts
 * products) it shows the neutral food symbol – never a guessed category. In lists it is
 * decorative; `labelled` makes it speak the family (detail views).
 */
export function FoodThumb({
  food,
  size = 40,
  labelled = false,
}: {
  food: Pick<Food, 'origin'> | Pick<ReferenceFood, 'dataset' | 'code'>;
  size?: number;
  labelled?: boolean;
}) {
  const { t } = useI18n();
  const category = foodCategory(food);
  return (
    <FoodArt
      name={category ? ART[category] : 'food'}
      size={size}
      label={labelled && category ? t(`nutrition.categories.${category}`) : undefined}
    />
  );
}

/** Small star after a favourite food in mixed lists (the favourites list needs none). */
export function FavoriteMark() {
  const { t } = useI18n();
  return (
    <span className={styles.favoriteMark}>
      <Icon name="star" size={16} />
      <span className="visually-hidden">{t('nutrition.lookup.favorite')}</span>
    </span>
  );
}
