import { ICON_PATHS, type IconName } from './paths';

/** All icon names, e.g. for tests and the design system documentation. */
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

/**
 * One icon per meaning across the app. Screens pick icons by role, not by shape, so the same
 * topic always shows the same symbol. Documentation: docs/DESIGN_SYSTEM.md → Icons.
 */
export const ICON_FOR = {
  training: 'training',
  nutrition: 'nutrition',
  health: 'health',
  weight: 'scale',
  water: 'drop',
  sleep: 'sleep',
  steps: 'steps',
  activity: 'activity',
  distance: 'distance',
  /** Energy in kcal – eaten (nutrition) or burned (active energy): one meaning, one symbol. */
  energy: 'flame',
  food: 'apple',
  mealsOfDay: 'nutrition',
  template: 'plate',
  recipe: 'recipe',
  exercise: 'training',
  breakfast: 'cup',
  lunch: 'plate',
  dinner: 'moon',
  snack: 'apple',
  progress: 'progress',
  goals: 'target',
  settings: 'settings',
  /** Einstellungen → Meine Inhalte: the user's own lists. */
  content: 'plan',
  profile: 'profile',
  timer: 'timer',
  plan: 'plan',
  info: 'info',
  warning: 'warning',
  navForward: 'chevronRight',
  navBack: 'chevronLeft',
  close: 'close',
  more: 'more',
  add: 'plus',
  done: 'check',
  search: 'search',
  barcode: 'barcode',
} as const satisfies Record<string, IconName>;

export type IconRole = keyof typeof ICON_FOR;

/**
 * Icons that are not self-explanatory: they never stand alone, a visible text label (or at
 * least an accessible name via `label`) is required.
 */
export const ICON_NEEDS_LABEL: readonly IconRole[] = [
  'health',
  'progress',
  'goals',
  'plan',
  'steps',
  'activity',
  'sleep',
  'barcode',
  'more',
];
