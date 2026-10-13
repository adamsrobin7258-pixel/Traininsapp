/**
 * The page scenes (`SceneArt`):
 * - `mountains`: forest and mountains at first light (Training) – dark sky, ivory text on top.
 * - `harvest`: a bowl of fresh greens, tomatoes and chickpeas on warm linen (Ernährung) – light.
 * - `meadow`: soft green hills under a calm sky (brand area) – dark, ivory logo on top.
 */
export type SceneName = 'mountains' | 'harvest' | 'meadow';

/** Text colour a scene needs on top of it: ivory on the dark ones, the normal text on light. */
export const SCENE_TONE: Record<SceneName, 'dark' | 'light'> = {
  mountains: 'dark',
  harvest: 'light',
  meadow: 'dark',
};
