/**
 * Sports and movement activities the user can log by hand. Pure TypeScript.
 *
 * Every MET value comes from the Compendium of Physical Activities (Ainsworth et al. 2011;
 * Herrmann et al. 2024, pacompendium.com) and names the entry it was taken from. Where the
 * Compendium has no entry for a sport (e.g. padel, Hyrox), the closest general entry is used and
 * the value is marked `basis: 'general'` – an honest estimate instead of an invented precise
 * number. See docs/ACTIVITIES.md.
 */

export const SPORT_CATEGORIES = [
  'walking',
  'running',
  'cycling',
  'water',
  'racket',
  'team',
  'fitness',
  'combat',
  'winter',
  'flexibility',
  'other',
] as const;
export type SportCategory = (typeof SPORT_CATEGORIES)[number];

export const INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export type Intensity = (typeof INTENSITIES)[number];

/** One MET value with its source. */
export interface MetValue {
  met: number;
  /** Compendium entry (description, and code where known). */
  ref: string;
  /** `general`: no specific entry – the closest general activity stands in. */
  basis: 'specific' | 'general';
}

/** Choices a sport may offer in the form, beside intensity. */
export const VARIANT_KINDS = ['tennisFormat', 'swimStroke', 'golfMode'] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export const VARIANT_OPTIONS = {
  tennisFormat: ['singles', 'doubles'],
  swimStroke: ['general', 'freestyle', 'breaststroke', 'backstroke'],
  golfMode: ['walking', 'cart'],
} as const satisfies Record<VariantKind, readonly string[]>;
export type VariantOption = (typeof VARIANT_OPTIONS)[VariantKind][number];

/** Speed bands (km/h, lower bound inclusive) for running, walking and cycling. */
export interface SpeedBand {
  fromKmh: number;
  value: MetValue;
}

/**
 * How a sport turns the entered data into a MET value:
 * - `fixed`: one value.
 * - `intensity`: one value per offered intensity (`light`/`moderate`/`vigorous`).
 * - `variant`: one value per option (e.g. tennis singles/doubles).
 * - `speed`: with a distance, the speed band; without, the intensity or `fallback` value.
 */
export type MetModel =
  | { kind: 'fixed'; value: MetValue }
  | {
      kind: 'intensity';
      levels: Partial<Record<Intensity, MetValue>>;
      default: Intensity;
    }
  | { kind: 'variant'; variant: VariantKind; options: Partial<Record<VariantOption, MetValue>> }
  | {
      kind: 'speed';
      bands: readonly SpeedBand[];
      fallback: MetValue;
      levels?: Partial<Record<Intensity, MetValue>>;
      default?: Intensity;
    };

export interface SportDefinition {
  /** Stable ID, stored with every activity – never rename. */
  id: string;
  nameDe: string;
  nameEn: string;
  category: SportCategory;
  /** Form fields beside date, start time and duration. */
  fields: {
    distance?: 'optional';
    intensity?: boolean;
    variant?: VariantKind;
  };
  met: MetModel;
  /** Health Connect exercise types that describe the same sport (duplicate detection). */
  healthConnectTypes: readonly string[];
}

const c = (met: number, ref: string): MetValue => ({ met, ref, basis: 'specific' });
const g = (met: number, ref: string): MetValue => ({ met, ref, basis: 'general' });

/** Compendium walking entries by speed (17150–17231). */
const WALKING_BANDS: readonly SpeedBand[] = [
  { fromKmh: 0, value: c(2.8, '17170 walking, 2.0 mph (3.2 km/h), level, slow pace') },
  { fromKmh: 3.6, value: c(3.0, '17180 walking, 2.5 mph (4.0 km/h), level') },
  { fromKmh: 4.4, value: c(3.5, '17190 walking, 2.8–3.2 mph (4.5–5.1 km/h), level, moderate') },
  { fromKmh: 5.4, value: c(4.3, '17200 walking, 3.5 mph (5.6 km/h), level, brisk') },
  { fromKmh: 6.2, value: c(5.0, '17220 walking, 4.0 mph (6.4 km/h), level, very brisk') },
  { fromKmh: 7.0, value: c(7.0, '17230 walking, 4.5 mph (7.2 km/h), level, very, very brisk') },
  { fromKmh: 7.8, value: c(8.3, '17231 walking, 5.0 mph (8.0 km/h), level') },
];

/** Compendium running entries by speed (12030–12134). */
const RUNNING_BANDS: readonly SpeedBand[] = [
  { fromKmh: 0, value: c(6.0, '12030 running, 4 mph (6.4 km/h)') },
  { fromKmh: 7.2, value: c(8.3, '12050 running, 5 mph (8.0 km/h)') },
  { fromKmh: 8.9, value: c(9.8, '12070 running, 6 mph (9.7 km/h)') },
  { fromKmh: 10.5, value: c(11.0, '12090 running, 7 mph (11.3 km/h)') },
  { fromKmh: 12.1, value: c(11.8, '12100 running, 8 mph (12.9 km/h)') },
  { fromKmh: 13.7, value: c(12.8, '12120 running, 9 mph (14.5 km/h)') },
  { fromKmh: 15.3, value: c(14.5, '12130 running, 10 mph (16.1 km/h)') },
  { fromKmh: 16.9, value: c(16.0, '12132 running, 11 mph (17.7 km/h)') },
  { fromKmh: 18.5, value: c(19.0, '12134 running, 12 mph (19.3 km/h)') },
];

/** Compendium bicycling entries by speed (01010–01070). */
const CYCLING_BANDS: readonly SpeedBand[] = [
  { fromKmh: 0, value: c(4.0, '01010 bicycling, <10 mph (<16 km/h), leisure') },
  { fromKmh: 16, value: c(6.8, '01020 bicycling, 10–11.9 mph (16–19 km/h), leisure, light') },
  { fromKmh: 19.3, value: c(8.0, '01030 bicycling, 12–13.9 mph (19–22 km/h), moderate') },
  { fromKmh: 22.5, value: c(10.0, '01040 bicycling, 14–15.9 mph (22–26 km/h), vigorous') },
  { fromKmh: 25.7, value: c(12.0, '01050 bicycling, 16–19 mph (26–31 km/h), racing') },
  { fromKmh: 32.2, value: c(16.8, '01060 bicycling, >20 mph (>32 km/h), racing') },
];

const DISTANCE = { distance: 'optional' } as const;
const DISTANCE_INTENSITY = { distance: 'optional', intensity: true } as const;
const INTENSITY = { intensity: true } as const;
const NONE = {} as const;

export const SPORTS: readonly SportDefinition[] = [
  // Walking & hiking
  {
    id: 'walk',
    nameDe: 'Spazieren',
    nameEn: 'Walk',
    category: 'walking',
    fields: DISTANCE,
    met: {
      kind: 'speed',
      bands: WALKING_BANDS,
      fallback: c(3.0, '17180 walking, 2.5 mph (4.0 km/h), level'),
    },
    healthConnectTypes: ['walking'],
  },
  {
    id: 'brisk-walk',
    nameDe: 'Zügiges Gehen',
    nameEn: 'Brisk walking',
    category: 'walking',
    fields: DISTANCE,
    met: {
      kind: 'speed',
      bands: WALKING_BANDS,
      fallback: c(4.3, '17200 walking, 3.5 mph (5.6 km/h), level, brisk'),
    },
    healthConnectTypes: ['walking'],
  },
  {
    id: 'nordic-walking',
    nameDe: 'Nordic Walking',
    nameEn: 'Nordic walking',
    category: 'walking',
    fields: DISTANCE,
    met: { kind: 'fixed', value: c(4.8, '17165 walking, Nordic walking, moderate') },
    healthConnectTypes: ['walking'],
  },
  {
    id: 'hike',
    nameDe: 'Wandern',
    nameEn: 'Hiking',
    category: 'walking',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: g(4.3, '17200 walking, 3.5 mph, level, brisk (easy, mostly flat hike)'),
        moderate: c(6.0, '17080 hiking, cross country'),
        vigorous: c(7.0, '17010 backpacking, hiking or organized walking with a daypack'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['hiking', 'walking'],
  },
  {
    id: 'mountain-hike',
    nameDe: 'Bergwandern',
    nameEn: 'Mountain hiking',
    category: 'walking',
    fields: DISTANCE,
    met: {
      kind: 'fixed',
      value: c(7.3, '17035 climbing hills with 21–42 lb load (mountain hike)'),
    },
    healthConnectTypes: ['hiking'],
  },
  // Running
  {
    id: 'jog',
    nameDe: 'Joggen',
    nameEn: 'Jogging',
    category: 'running',
    fields: DISTANCE,
    met: { kind: 'speed', bands: RUNNING_BANDS, fallback: c(7.0, '12020 jogging, general') },
    healthConnectTypes: ['running', 'runningTreadmill'],
  },
  {
    id: 'run',
    nameDe: 'Laufen',
    nameEn: 'Running',
    category: 'running',
    fields: DISTANCE,
    met: { kind: 'speed', bands: RUNNING_BANDS, fallback: c(8.0, '12150 running, general') },
    healthConnectTypes: ['running', 'runningTreadmill'],
  },
  {
    id: 'fast-run',
    nameDe: 'Schneller Lauf',
    nameEn: 'Fast run',
    category: 'running',
    fields: DISTANCE,
    met: {
      kind: 'speed',
      bands: RUNNING_BANDS,
      fallback: c(11.0, '12090 running, 7 mph (11.3 km/h)'),
    },
    healthConnectTypes: ['running', 'runningTreadmill'],
  },
  {
    id: 'trail-run',
    nameDe: 'Trailrunning',
    nameEn: 'Trail running',
    category: 'running',
    fields: DISTANCE,
    met: { kind: 'fixed', value: c(9.0, '12140 running, cross country') },
    healthConnectTypes: ['running'],
  },
  // Cycling
  {
    id: 'cycle',
    nameDe: 'Radfahren',
    nameEn: 'Cycling',
    category: 'cycling',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'speed',
      bands: CYCLING_BANDS,
      fallback: c(7.5, '01015 bicycling, general'),
      levels: {
        light: c(4.0, '01010 bicycling, <10 mph, leisure'),
        moderate: c(6.8, '01020 bicycling, 10–11.9 mph, leisure, light'),
        vigorous: c(10.0, '01040 bicycling, 14–15.9 mph, vigorous'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['cycling', 'bikingStationary'],
  },
  {
    id: 'indoor-cycling',
    nameDe: 'Indoor Cycling / Spinning',
    nameEn: 'Indoor cycling / spinning',
    category: 'cycling',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(6.8, '02012 bicycling, stationary, 90–100 W, moderate to vigorous'),
        moderate: c(8.5, '02019 bicycling, stationary, RPM/spin bike class'),
        vigorous: c(11.0, '02014 bicycling, stationary, 161–200 W, vigorous'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['bikingStationary', 'cycling'],
  },
  {
    id: 'mountain-bike',
    nameDe: 'Mountainbike',
    nameEn: 'Mountain biking',
    category: 'cycling',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(8.5, '01013 bicycling, mountain, general'),
        vigorous: c(14.0, '01009 bicycling, mountain, uphill, vigorous'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['cycling'],
  },
  // Water
  {
    id: 'swim',
    nameDe: 'Schwimmen',
    nameEn: 'Swimming',
    category: 'water',
    fields: { distance: 'optional', variant: 'swimStroke' },
    met: {
      kind: 'variant',
      variant: 'swimStroke',
      options: {
        general: c(6.0, '18350 swimming, leisurely, not lap swimming, general'),
        freestyle: c(5.8, '18310 swimming laps, freestyle, slow, light or moderate effort'),
        breaststroke: c(5.3, '18250 swimming, breaststroke, recreational'),
        backstroke: c(4.8, '18230 swimming, backstroke, recreational'),
      },
    },
    healthConnectTypes: ['swimming', 'swimmingPool', 'swimmingOpenWater'],
  },
  {
    id: 'swim-breaststroke',
    nameDe: 'Brustschwimmen',
    nameEn: 'Breaststroke',
    category: 'water',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(5.3, '18250 swimming, breaststroke, recreational'),
        vigorous: c(10.3, '18240 swimming, breaststroke, training or competition'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['swimming', 'swimmingPool', 'swimmingOpenWater'],
  },
  {
    id: 'swim-freestyle',
    nameDe: 'Freistil / Kraulen',
    nameEn: 'Freestyle',
    category: 'water',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(5.8, '18310 swimming laps, freestyle, slow, light or moderate effort'),
        vigorous: c(9.8, '18300 swimming laps, freestyle, fast, vigorous effort'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['swimming', 'swimmingPool', 'swimmingOpenWater'],
  },
  {
    id: 'water-aerobics',
    nameDe: 'Wassergymnastik',
    nameEn: 'Water aerobics',
    category: 'water',
    fields: NONE,
    met: { kind: 'fixed', value: c(5.5, '18355 water aerobics, water calisthenics') },
    healthConnectTypes: [],
  },
  {
    id: 'rowing-boat',
    nameDe: 'Rudern (Boot)',
    nameEn: 'Rowing (boat)',
    category: 'water',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(3.5, '18070 canoeing, rowing, for pleasure, general'),
        moderate: c(5.8, '18060 canoeing, rowing, 4.0–5.9 mph, moderate effort'),
        vigorous: c(12.0, '18080 canoeing, rowing, crew, competition'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['rowing'],
  },
  {
    id: 'kayak',
    nameDe: 'Kajak / Kanu',
    nameEn: 'Kayaking / canoeing',
    category: 'water',
    fields: NONE,
    met: { kind: 'fixed', value: c(5.0, '18100 kayaking, moderate effort') },
    healthConnectTypes: ['paddling', 'paddleSports'],
  },
  {
    id: 'sup',
    nameDe: 'Stand-up-Paddling',
    nameEn: 'Stand-up paddling',
    category: 'water',
    fields: NONE,
    met: { kind: 'fixed', value: c(6.0, '18365 paddle boarding, standing') },
    healthConnectTypes: ['paddling', 'paddleSports'],
  },
  {
    id: 'surf',
    nameDe: 'Surfen',
    nameEn: 'Surfing',
    category: 'water',
    fields: NONE,
    met: { kind: 'fixed', value: c(3.0, '18220 surfing, body or board, general') },
    healthConnectTypes: ['surfing'],
  },
  // Racket sports
  {
    id: 'tennis',
    nameDe: 'Tennis',
    nameEn: 'Tennis',
    category: 'racket',
    fields: { variant: 'tennisFormat' },
    met: {
      kind: 'variant',
      variant: 'tennisFormat',
      options: {
        singles: c(8.0, '15690 tennis, singles'),
        doubles: c(6.0, '15680 tennis, doubles'),
      },
    },
    healthConnectTypes: ['tennis'],
  },
  {
    id: 'badminton',
    nameDe: 'Badminton',
    nameEn: 'Badminton',
    category: 'racket',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(5.5, '15030 badminton, social singles and doubles, general'),
        vigorous: c(7.0, '15020 badminton, competitive'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['badminton'],
  },
  {
    id: 'table-tennis',
    nameDe: 'Tischtennis',
    nameEn: 'Table tennis',
    category: 'racket',
    fields: NONE,
    met: { kind: 'fixed', value: c(4.0, '15660 table tennis, ping pong') },
    healthConnectTypes: ['tableTennis'],
  },
  {
    id: 'squash',
    nameDe: 'Squash',
    nameEn: 'Squash',
    category: 'racket',
    fields: NONE,
    met: { kind: 'fixed', value: c(7.3, '15652 squash, general') },
    healthConnectTypes: ['squash'],
  },
  {
    id: 'padel',
    nameDe: 'Padel',
    nameEn: 'Padel',
    category: 'racket',
    fields: NONE,
    met: { kind: 'fixed', value: g(7.0, '15530 racquetball, general (no padel entry)') },
    healthConnectTypes: ['padel'],
  },
  // Team sports
  {
    id: 'soccer',
    nameDe: 'Fußball',
    nameEn: 'Football (soccer)',
    category: 'team',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(7.0, '15610 soccer, casual, general'),
        vigorous: c(10.0, '15605 soccer, competitive'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['soccer'],
  },
  {
    id: 'basketball',
    nameDe: 'Basketball',
    nameEn: 'Basketball',
    category: 'team',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(6.5, '15055 basketball, general'),
        vigorous: c(8.0, '15040 basketball, game'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['basketball'],
  },
  {
    id: 'volleyball',
    nameDe: 'Volleyball',
    nameEn: 'Volleyball',
    category: 'team',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(3.0, '15720 volleyball, non-competitive, 6–9 member team, general'),
        moderate: c(4.0, '15710 volleyball, general'),
        vigorous: c(6.0, '15711 volleyball, competitive, in gymnasium'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['volleyball'],
  },
  {
    id: 'beach-volleyball',
    nameDe: 'Beachvolleyball',
    nameEn: 'Beach volleyball',
    category: 'team',
    fields: NONE,
    met: { kind: 'fixed', value: c(8.0, '15725 volleyball, beach, in sand') },
    healthConnectTypes: ['volleyball'],
  },
  {
    id: 'handball',
    nameDe: 'Handball',
    nameEn: 'Handball',
    category: 'team',
    fields: NONE,
    met: { kind: 'fixed', value: c(12.0, '15320 handball, general') },
    healthConnectTypes: ['handball'],
  },
  {
    id: 'field-hockey',
    nameDe: 'Hockey',
    nameEn: 'Field hockey',
    category: 'team',
    fields: NONE,
    met: { kind: 'fixed', value: c(7.8, '15350 hockey, field') },
    healthConnectTypes: ['hockey'],
  },
  {
    id: 'ice-hockey',
    nameDe: 'Eishockey',
    nameEn: 'Ice hockey',
    category: 'team',
    fields: NONE,
    met: { kind: 'fixed', value: c(8.0, '15360 hockey, ice, general') },
    healthConnectTypes: ['iceHockey', 'hockey'],
  },
  // Strength & functional fitness
  {
    id: 'hiit',
    nameDe: 'HIIT',
    nameEn: 'HIIT',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(4.3, '02030 circuit training, moderate effort'),
        vigorous: c(8.0, '02040 circuit training, minimal rest, vigorous intensity'),
      },
      default: 'vigorous',
    },
    healthConnectTypes: ['highIntensityIntervalTraining'],
  },
  {
    id: 'hyrox',
    nameDe: 'Hyrox',
    nameEn: 'Hyrox',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: g(7.0, '12020 jogging, general (no Hyrox entry; running + stations)'),
        vigorous: g(8.0, '02040 circuit training, vigorous intensity (no Hyrox entry)'),
      },
      default: 'vigorous',
    },
    healthConnectTypes: ['crossTraining', 'highIntensityIntervalTraining', 'mixedCardio'],
  },
  {
    id: 'crossfit',
    nameDe: 'CrossFit',
    nameEn: 'CrossFit',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: g(4.3, '02030 circuit training, moderate effort (no CrossFit entry)'),
        vigorous: g(8.0, '02040 circuit training, vigorous intensity (no CrossFit entry)'),
      },
      default: 'vigorous',
    },
    healthConnectTypes: ['crossTraining', 'highIntensityIntervalTraining'],
  },
  {
    id: 'circuit',
    nameDe: 'Zirkeltraining',
    nameEn: 'Circuit training',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(4.3, '02030 circuit training, moderate effort'),
        vigorous: c(8.0, '02040 circuit training, minimal rest, vigorous intensity'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['crossTraining', 'exerciseClass', 'bootCamp'],
  },
  {
    id: 'jump-rope',
    nameDe: 'Seilspringen',
    nameEn: 'Jump rope',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(8.3, '15552 rope jumping, slow pace, <100 skips/min'),
        moderate: c(11.8, '15551 rope jumping, moderate pace, 100–120 skips/min'),
        vigorous: c(12.3, '15550 rope jumping, fast pace, 120–160 skips/min'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['jumpRope'],
  },
  {
    id: 'elliptical',
    nameDe: 'Crosstrainer',
    nameEn: 'Elliptical trainer',
    category: 'fitness',
    fields: NONE,
    met: { kind: 'fixed', value: c(5.0, '02048 elliptical trainer, moderate effort') },
    healthConnectTypes: ['elliptical'],
  },
  {
    id: 'stairs',
    nameDe: 'Stairmaster / Treppensteigen',
    nameEn: 'Stair climber / stairs',
    category: 'fitness',
    fields: NONE,
    met: { kind: 'fixed', value: c(9.0, '02065 stair-treadmill ergometer, general') },
    healthConnectTypes: ['stairClimbing', 'stairClimbingMachine', 'stairs'],
  },
  {
    id: 'rowing-machine',
    nameDe: 'Rudergerät',
    nameEn: 'Rowing machine',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(4.8, '02070 rowing, stationary ergometer, general, moderate effort'),
        moderate: c(7.0, '02071 rowing, stationary, 100 W, moderate effort'),
        vigorous: c(8.5, '02072 rowing, stationary, 150 W, vigorous effort'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['rowingMachine', 'rowing'],
  },
  {
    id: 'aerobics',
    nameDe: 'Aerobic / Fitnesskurs',
    nameEn: 'Aerobics / fitness class',
    category: 'fitness',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(5.0, '03016 aerobic, low impact'),
        moderate: c(7.3, '03015 aerobic, general'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['exerciseClass', 'mixedCardio', 'stepTraining'],
  },
  // Combat sports
  {
    id: 'boxing',
    nameDe: 'Boxen',
    nameEn: 'Boxing',
    category: 'combat',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(5.5, '15110 boxing, punching bag'),
        vigorous: c(7.8, '15120 boxing, sparring'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['boxing'],
  },
  {
    id: 'kickboxing',
    nameDe: 'Kickboxen',
    nameEn: 'Kickboxing',
    category: 'combat',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(5.3, '15425 martial arts, different types, slower pace, novice'),
        moderate: c(10.3, '15430 martial arts, different types, moderate pace (incl. kickboxing)'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['kickboxing', 'martialArts'],
  },
  {
    id: 'muay-thai',
    nameDe: 'Muay Thai',
    nameEn: 'Muay Thai',
    category: 'combat',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: g(5.3, '15425 martial arts, slower pace (no Muay Thai entry)'),
        moderate: g(10.3, '15430 martial arts, moderate pace (no Muay Thai entry)'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['kickboxing', 'martialArts'],
  },
  {
    id: 'judo',
    nameDe: 'Judo / Grappling',
    nameEn: 'Judo / grappling',
    category: 'combat',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(5.3, '15425 martial arts, different types, slower pace, novice'),
        moderate: c(
          10.3,
          '15430 martial arts, different types, moderate pace (incl. judo, jujitsu)',
        ),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['martialArts'],
  },
  {
    id: 'martial-arts',
    nameDe: 'Kampfsport allgemein',
    nameEn: 'Martial arts, general',
    category: 'combat',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(5.3, '15425 martial arts, different types, slower pace, novice'),
        moderate: c(10.3, '15430 martial arts, different types, moderate pace'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['martialArts', 'boxing', 'kickboxing'],
  },
  // Winter sports
  {
    id: 'ski',
    nameDe: 'Skifahren',
    nameEn: 'Downhill skiing',
    category: 'winter',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(4.3, '19150 skiing, downhill, light effort'),
        moderate: c(5.3, '19160 skiing, downhill, moderate effort, general'),
        vigorous: c(8.0, '19170 skiing, downhill, vigorous effort, racing'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['skiing', 'downhillSkiing'],
  },
  {
    id: 'cross-country-ski',
    nameDe: 'Langlauf',
    nameEn: 'Cross-country skiing',
    category: 'winter',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(6.8, '19080 skiing, cross country, 2.5 mph, slow or light effort'),
        moderate: c(9.0, '19090 skiing, cross country, 4.0–4.9 mph, moderate effort'),
        vigorous: c(12.5, '19100 skiing, cross country, 5.0–7.9 mph, vigorous effort'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['crossCountrySkiing'],
  },
  {
    id: 'snowboard',
    nameDe: 'Snowboard',
    nameEn: 'Snowboarding',
    category: 'winter',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(4.3, '19185 snowboarding, light effort'),
        moderate: c(5.3, '19180 snowboarding, moderate effort'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['snowboarding'],
  },
  {
    id: 'ice-skate',
    nameDe: 'Eislaufen',
    nameEn: 'Ice skating',
    category: 'winter',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(5.5, '19020 ice skating, 9 mph or less'),
        moderate: c(7.0, '19030 ice skating, general'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['iceSkating', 'skating'],
  },
  {
    id: 'snowshoe',
    nameDe: 'Schneeschuhwandern',
    nameEn: 'Snowshoeing',
    category: 'winter',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(5.3, '19190 snow shoeing, moderate effort'),
        vigorous: c(10.0, '19192 snow shoeing, vigorous effort'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['snowshoeing'],
  },
  // Flexibility & recovery
  {
    id: 'yoga',
    nameDe: 'Yoga',
    nameEn: 'Yoga',
    category: 'flexibility',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(2.5, '02150 yoga, Hatha'),
        vigorous: c(4.0, '02160 yoga, Power'),
      },
      default: 'light',
    },
    healthConnectTypes: ['yoga'],
  },
  {
    id: 'pilates',
    nameDe: 'Pilates',
    nameEn: 'Pilates',
    category: 'flexibility',
    fields: NONE,
    met: { kind: 'fixed', value: c(3.0, '02105 Pilates, general') },
    healthConnectTypes: ['pilates'],
  },
  {
    id: 'stretching',
    nameDe: 'Stretching',
    nameEn: 'Stretching',
    category: 'flexibility',
    fields: NONE,
    met: { kind: 'fixed', value: c(2.3, '02101 stretching, mild') },
    healthConnectTypes: ['stretching', 'flexibility', 'cooldown'],
  },
  {
    id: 'tai-chi',
    nameDe: 'Tai Chi / Qigong',
    nameEn: 'Tai chi / qigong',
    category: 'flexibility',
    fields: NONE,
    met: { kind: 'fixed', value: c(3.0, '15670 tai chi, qigong, general') },
    healthConnectTypes: ['taiChi'],
  },
  // Other
  {
    id: 'dance',
    nameDe: 'Tanzen',
    nameEn: 'Dancing',
    category: 'other',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(3.0, '03040 ballroom, slow (waltz, foxtrot)'),
        moderate: c(5.5, '03030 ballroom, fast'),
        vigorous: c(7.8, '03025 general dancing (disco, folk, line, country)'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['dance', 'dancing'],
  },
  {
    id: 'climbing',
    nameDe: 'Klettern / Bouldern',
    nameEn: 'Climbing / bouldering',
    category: 'other',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        moderate: c(5.8, '15537 rock climbing, ascending, low to moderate difficulty'),
        vigorous: c(7.5, '15535 rock climbing, ascending, high difficulty'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['climbing', 'rockClimbing'],
  },
  {
    id: 'inline-skate',
    nameDe: 'Inline-Skating',
    nameEn: 'Inline skating',
    category: 'other',
    fields: DISTANCE_INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(7.5, '15591 rollerblading, 9.0 mph (14.4 km/h), recreational pace'),
        moderate: c(9.8, '15592 rollerblading, 11.0 mph (17.7 km/h), moderate pace'),
        vigorous: c(12.3, '15593 rollerblading, 13.0 mph (20.9 km/h), fast pace'),
      },
      default: 'moderate',
    },
    healthConnectTypes: ['skating'],
  },
  {
    id: 'golf',
    nameDe: 'Golf',
    nameEn: 'Golf',
    category: 'other',
    fields: { variant: 'golfMode' },
    met: {
      kind: 'variant',
      variant: 'golfMode',
      options: {
        walking: c(4.3, '15265 golf, walking, carrying clubs'),
        cart: c(3.5, '15290 golf, using power cart'),
      },
    },
    healthConnectTypes: ['golf'],
  },
  {
    id: 'horse-riding',
    nameDe: 'Reiten',
    nameEn: 'Horseback riding',
    category: 'other',
    fields: INTENSITY,
    met: {
      kind: 'intensity',
      levels: {
        light: c(3.8, '15400 horseback riding, walking'),
        moderate: c(5.5, '15370 horseback riding, general'),
        vigorous: c(7.3, '15390 horseback riding, galloping'),
      },
      default: 'moderate',
    },
    healthConnectTypes: [],
  },
];

const BY_ID = new Map(SPORTS.map((sport) => [sport.id, sport]));

export function sportById(id: string): SportDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** Displayed name in the user's language. */
export function sportName(sport: Pick<SportDefinition, 'nameDe' | 'nameEn'>, locale: string) {
  return locale.startsWith('de') ? sport.nameDe : sport.nameEn;
}

/** Intensities a sport offers in the form (empty when it has none). */
export function sportIntensities(sport: SportDefinition): Intensity[] {
  if (!sport.fields.intensity) return [];
  const levels =
    sport.met.kind === 'intensity'
      ? sport.met.levels
      : sport.met.kind === 'speed'
        ? sport.met.levels
        : undefined;
  return INTENSITIES.filter((level) => levels?.[level] !== undefined);
}

/** The intensity preselected in the form. */
export function defaultIntensity(sport: SportDefinition): Intensity | null {
  if (!sport.fields.intensity) return null;
  return sport.met.kind === 'intensity' || sport.met.kind === 'speed'
    ? (sport.met.default ?? null)
    : null;
}

/** Options of the sport's variant (e.g. singles/doubles) and the preselected one. */
export function sportVariants(sport: SportDefinition): VariantOption[] {
  if (sport.met.kind !== 'variant') return [];
  const options = sport.met.options;
  return (VARIANT_OPTIONS[sport.met.variant] as readonly VariantOption[]).filter(
    (option) => options[option] !== undefined,
  );
}

export function defaultVariant(sport: SportDefinition): VariantOption | null {
  return sportVariants(sport)[0] ?? null;
}
