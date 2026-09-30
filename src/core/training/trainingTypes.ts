/**
 * Training type registry – the extension point for sports.
 *
 * The database stores only the type id (free text, no CHECK list), so adding a sport means
 * adding an entry here, not a migration. Code must never assume a fixed number of types;
 * unknown ids (e.g. written by a newer app version) resolve to `other`.
 */

/** How a workout of this type is recorded. Each workflow has its own UI and metrics. */
export type TrainingWorkflow =
  /** Exercises with sets (weight, reps, RPE). Implemented. */
  | 'sets'
  /** Continuous activity with distance, duration, pace and optional GPS track. Planned. */
  | 'endurance'
  /** Stations/segments with split times (e.g. HYROX). Planned. */
  | 'segments'
  /** Timed holds and flows (mobility, stretching). Planned. */
  | 'timed';

/** Workout-level metrics a type can report. Set-level metrics live on the sets themselves. */
export type WorkoutMetric =
  | 'volume'
  | 'duration'
  | 'distance'
  | 'pace'
  | 'speed'
  | 'elevationGain'
  | 'steps'
  | 'splits'
  | 'route';

export interface TrainingTypeDefinition {
  id: string;
  /** Broad family, used for grouping and statistics across sports. */
  category: 'strength' | 'endurance' | 'hybrid' | 'flexibility' | 'other';
  workflow: TrainingWorkflow;
  metrics: readonly WorkoutMetric[];
  /** Whether a GPS track can be attached (see docs/GPS_ARCHITECTURE.md). */
  supportsRoute: boolean;
  /** Only types with an implemented workflow can be started in the UI. */
  available: boolean;
}

const STRENGTH_METRICS = ['volume', 'duration'] as const;
const ROUTE_METRICS = ['distance', 'duration', 'pace', 'speed', 'elevationGain', 'route'] as const;

export const TRAINING_TYPES: readonly TrainingTypeDefinition[] = [
  {
    id: 'strength',
    category: 'strength',
    workflow: 'sets',
    metrics: STRENGTH_METRICS,
    supportsRoute: false,
    available: true,
  },
  {
    id: 'hypertrophy',
    category: 'strength',
    workflow: 'sets',
    metrics: STRENGTH_METRICS,
    supportsRoute: false,
    available: true,
  },
  {
    id: 'powerlifting',
    category: 'strength',
    workflow: 'sets',
    metrics: STRENGTH_METRICS,
    supportsRoute: false,
    available: true,
  },
  {
    id: 'weightlifting',
    category: 'strength',
    workflow: 'sets',
    metrics: STRENGTH_METRICS,
    supportsRoute: false,
    available: true,
  },
  {
    id: 'calisthenics',
    category: 'strength',
    workflow: 'sets',
    metrics: STRENGTH_METRICS,
    supportsRoute: false,
    available: true,
  },
  {
    id: 'running',
    category: 'endurance',
    workflow: 'endurance',
    metrics: ROUTE_METRICS,
    supportsRoute: true,
    available: false,
  },
  {
    id: 'walking',
    category: 'endurance',
    workflow: 'endurance',
    metrics: [...ROUTE_METRICS, 'steps'],
    supportsRoute: true,
    available: false,
  },
  {
    id: 'cycling',
    category: 'endurance',
    workflow: 'endurance',
    metrics: ROUTE_METRICS,
    supportsRoute: true,
    available: false,
  },
  {
    id: 'hyrox',
    category: 'hybrid',
    workflow: 'segments',
    metrics: ['duration', 'distance', 'splits', 'volume'],
    supportsRoute: false,
    available: false,
  },
  {
    id: 'mobility',
    category: 'flexibility',
    workflow: 'timed',
    metrics: ['duration'],
    supportsRoute: false,
    available: false,
  },
  {
    id: 'stretching',
    category: 'flexibility',
    workflow: 'timed',
    metrics: ['duration'],
    supportsRoute: false,
    available: false,
  },
  {
    id: 'other',
    category: 'other',
    workflow: 'sets',
    metrics: ['duration'],
    supportsRoute: false,
    available: false,
  },
];

export const DEFAULT_TRAINING_TYPE = 'strength';

const FALLBACK = TRAINING_TYPES.find((type) => type.id === 'other');

/** Resolves any stored id; unknown ids fall back to `other` instead of crashing. */
export function getTrainingType(id: string): TrainingTypeDefinition {
  const found = TRAINING_TYPES.find((type) => type.id === id);
  if (found) return found;
  if (!FALLBACK) throw new Error('Training type registry needs an "other" entry');
  return FALLBACK;
}

export function isKnownTrainingType(id: string): boolean {
  return TRAINING_TYPES.some((type) => type.id === id);
}

export function availableTrainingTypes(): TrainingTypeDefinition[] {
  return TRAINING_TYPES.filter((type) => type.available);
}
