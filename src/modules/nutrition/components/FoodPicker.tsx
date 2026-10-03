import { useI18n } from '@/core/i18n';
import type { Food } from '@/core/nutrition';
import { Sheet } from '@/ui';
import { useFoodPicker } from './useFoodPicker';

/**
 * The food selection on its own, e.g. to add an ingredient to a recipe or a food to a template.
 * Same search, barcode and "new food" as when logging.
 */
export function FoodPickerSheet({
  title,
  onPicked,
  onClose,
}: {
  title: string;
  onPicked: (food: Food) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const picker = useFoodPicker({ onPicked });
  if (picker.overlay) return picker.overlay;
  return (
    <Sheet title={title} onClose={onClose} closeLabel={t('common.close')} fill>
      {picker.panel}
    </Sheet>
  );
}
