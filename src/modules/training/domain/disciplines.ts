import type { TranslationKey } from '@/core/i18n';

/**
 * Training disciplines the app is designed for. New disciplines are added here;
 * discipline-specific logic will live in sub-modules (see ARCHITECTURE.md).
 */
export const TRAINING_DISCIPLINES = [
  'strength',
  'endurance',
  'hyrox',
  'calisthenics',
  'mobility',
] as const;

export type TrainingDiscipline = (typeof TRAINING_DISCIPLINES)[number];

export function disciplineLabelKey(discipline: TrainingDiscipline): TranslationKey {
  return `training.disciplines.${discipline}`;
}
