import { ROUTES, TRAINING_LINKS } from '@/app/routes';
import type { ScoreArea } from '@/core/score';

/**
 * Where each score area is recorded – its existing module page (Phase 23): nutrition and training
 * their tabs, activities the activity list of the training area, recovery the health page (where
 * it is entered, as in the explanation's "Regeneration eintragen").
 */
export const AREA_LINKS: Record<ScoreArea, string> = {
  nutrition: ROUTES.nutrition,
  training: ROUTES.training,
  activity: TRAINING_LINKS.activities,
  recovery: ROUTES.health,
};
