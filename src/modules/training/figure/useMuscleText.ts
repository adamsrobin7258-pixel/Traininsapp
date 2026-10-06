import { useI18n } from '@/core/i18n';
import { highlightGroups, type MuscleHighlight } from '@/core/training';

/** The highlighted groups as words – the figure never carries information on its own. */
export function useMuscleText(highlight: MuscleHighlight) {
  const { t } = useI18n();
  const groups = highlightGroups(highlight);
  const names = (list: readonly string[]) =>
    list.map((group) => t(`training.muscles.${group}` as 'training.muscles.chest')).join(', ');
  const primary = names(groups.primary);
  const secondary = names(groups.secondary);
  return {
    primary,
    secondary,
    description:
      secondary !== ''
        ? t('training.figure.descriptionSecondary', { primary: primary || '–', secondary })
        : t('training.figure.description', { primary: primary || '–' }),
  };
}
