/**
 * The Kalethra figure's skeleton and its exercise motions – plain numbers, no 3D library, so the
 * same data can drive the procedural prototype figure now and a modelled figure later.
 *
 * Body coordinates (metres): origin in the middle of the pelvis, +Y up to the head, +X to the
 * figure's left, +Z out of its front. A motion moves the hands and feet; elbows and knees follow
 * by two-bone IK with a hint where they should point.
 */

export type Vec3 = readonly [number, number, number];

/** Neutral-athletic proportions, about 1.75 m tall; one set for every exercise. */
export const BODY = {
  shoulderX: 0.19,
  shoulderY: 0.47,
  hipX: 0.095,
  hipY: -0.03,
  neckY: 0.53,
  headY: 0.68,
  headRadius: 0.105,
  upperArm: 0.29,
  forearm: 0.26,
  thigh: 0.44,
  shin: 0.43,
} as const;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3) => Math.sqrt(dot(a, a));
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, -1, 0];
};
/** Mirrors a left-side point or direction to the right side. */
export const mirror = (a: Vec3): Vec3 => [-a[0], a[1], a[2]];

/**
 * Two-bone IK: from `root` towards `target` with bone lengths `a` and `b`, the middle joint bent
 * towards `pole`. A target out of reach is clamped (never stretched), so bone lengths are kept.
 */
export function solveTwoBone(
  root: Vec3,
  target: Vec3,
  a: number,
  b: number,
  pole: Vec3,
): { joint: Vec3; end: Vec3; bend: Vec3 } {
  const toTarget = sub(target, root);
  const direction = normalize(toTarget);
  const distance = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, length(toTarget)));
  const cos = (a * a + distance * distance - b * b) / (2 * a * distance);
  const along = a * cos;
  const height = a * Math.sqrt(Math.max(0, 1 - cos * cos));
  let bend = sub(pole, scale(direction, dot(pole, direction)));
  if (length(bend) < 1e-6) bend = [0, 0, 1];
  bend = normalize(bend);
  const joint = add(add(root, scale(direction, along)), scale(bend, height));
  // `bend`: unit direction the joint points to, at right angles to root → end. Both bones lie
  // in the plane of root → end and `bend`, so it also fixes how the limbs are twisted.
  return { joint, end: add(root, scale(direction, distance)), bend };
}

export type Posture = 'standing' | 'supine' | 'seated';
export type Equipment = 'none' | 'bench' | 'pulldown';

/** Targets of one frame (left side; the right side is mirrored). */
export interface Frame {
  hand: Vec3;
  elbowPole: Vec3;
  foot: Vec3;
  kneePole: Vec3;
}

/** Where the camera looks from for a clip (degrees), its height and the radius to keep in view. */
export interface ClipView {
  azimuth: number;
  elevation: number;
  radius: number;
  y: number;
}

export interface MotionDefinition {
  posture: Posture;
  view: ClipView;
  equipment: Equipment;
  /** Whether a bar is held between the hands. */
  bar: boolean;
  /** One full repetition in seconds – slow and controlled. */
  durationS: number;
  /** Phase 0…1 of the loop → targets; frame(0) equals frame(1). */
  frame(phase: number): Frame;
  /** Phase shown when the figure stands still (small view, reduced motion). */
  stillPhase: number;
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));

/**
 * 0 → 1 → 0 over one loop, with soft turns at the top and the bottom (a short hold), so the
 * repetition reads as controlled and the loop has no seam.
 */
export function repetition(phase: number): number {
  const p = phase - Math.floor(phase);
  const wave = (1 - Math.cos(2 * Math.PI * p)) / 2;
  // Smoothstep stretches the turns into a short, calm hold.
  return wave * wave * (3 - 2 * wave);
}

const SHOULDER: Vec3 = [BODY.shoulderX, BODY.shoulderY, 0];

/**
 * Bench press, lying on a flat bench: from straight arms above the chest down to the lower chest
 * with the elbows out to the side, and back up. Feet on the floor beside the bench.
 */
const benchPress: MotionDefinition = {
  posture: 'supine',
  view: { azimuth: 74, elevation: 30, radius: 0.98, y: 0.55 },
  equipment: 'bench',
  bar: true,
  durationS: 4.4,
  stillPhase: 0.3,
  frame(phase) {
    const depth = repetition(phase);
    return {
      hand: lerp([0.33, SHOULDER[1] - 0.04, 0.55], [0.33, SHOULDER[1] - 0.15, 0.13], depth),
      elbowPole: lerp([1, -0.2, -0.3], [1, -0.35, -0.8], depth),
      foot: [0.22, -0.47, -0.46],
      kneePole: [0.3, 0, 1],
    };
  },
};

/**
 * Lat pulldown, seated with thighs under the pad: from the arms reaching up to the bar pulled to
 * the upper chest with the elbows down and back, and back up.
 */
const latPulldown: MotionDefinition = {
  posture: 'seated',
  view: { azimuth: 0, elevation: 10, radius: 1.02, y: 1.1 },
  equipment: 'pulldown',
  bar: true,
  durationS: 4.4,
  stillPhase: 0.3,
  frame(phase) {
    const depth = repetition(phase);
    return {
      hand: lerp([0.4, SHOULDER[1] + 0.52, 0.06], [0.36, SHOULDER[1] + 0.04, 0.14], depth),
      elbowPole: lerp([1, 0.1, -0.3], [0.6, -1, -0.45], depth),
      foot: [0.17, -0.53, 0.44],
      kneePole: [0.2, 0.4, 1],
    };
  },
};

/** Standing, arms relaxed – for a picture of several exercises (workout summary). */
const stand: MotionDefinition = {
  posture: 'standing',
  view: { azimuth: 0, elevation: 6, radius: 0.98, y: 0.92 },
  equipment: 'none',
  bar: false,
  durationS: 0,
  stillPhase: 0,
  frame: () => ({
    hand: [0.27, SHOULDER[1] - 0.53, 0.03],
    elbowPole: [0.2, 0, -1],
    foot: [0.12, -0.9, 0.02],
    kneePole: [0, 0, 1],
  }),
};

/**
 * The fallback body's clips, named by the asset contract (movement type + equipment variant).
 * A modelled body brings its own clips under the same names.
 */
export const FALLBACK_CLIPS: Readonly<Record<string, MotionDefinition>> = {
  rest: stand,
  horizontalPush_bench: benchPress,
  verticalPull_cable: latPulldown,
};

/** Joint positions of one frame, both sides (body coordinates). */
export interface Skeleton {
  shoulder: [Vec3, Vec3];
  elbow: [Vec3, Vec3];
  hand: [Vec3, Vec3];
  hip: [Vec3, Vec3];
  knee: [Vec3, Vec3];
  foot: [Vec3, Vec3];
  /** Direction each elbow / knee points to (from the IK) – also fixes the limb twist. */
  elbowBend: [Vec3, Vec3];
  kneeBend: [Vec3, Vec3];
}

export function skeleton(motion: MotionDefinition, phase: number): Skeleton {
  const frame = motion.frame(phase);
  const sides = [(v: Vec3) => v, mirror] as const;
  const result = sides.map((side) => {
    const shoulder = side(SHOULDER);
    const hip = side([BODY.hipX, BODY.hipY, 0]);
    const arm = solveTwoBone(
      shoulder,
      side(frame.hand),
      BODY.upperArm,
      BODY.forearm,
      side(frame.elbowPole),
    );
    const leg = solveTwoBone(hip, side(frame.foot), BODY.thigh, BODY.shin, side(frame.kneePole));
    return {
      shoulder,
      elbow: arm.joint,
      hand: arm.end,
      hip,
      knee: leg.joint,
      foot: leg.end,
      elbowBend: arm.bend,
      kneeBend: leg.bend,
    };
  });
  const [left, right] = result as [(typeof result)[number], (typeof result)[number]];
  const pair = <K extends keyof typeof left>(key: K): [(typeof left)[K], (typeof left)[K]] => [
    left[key],
    right[key],
  ];
  return {
    shoulder: pair('shoulder'),
    elbow: pair('elbow'),
    hand: pair('hand'),
    hip: pair('hip'),
    knee: pair('knee'),
    foot: pair('foot'),
    elbowBend: pair('elbowBend'),
    kneeBend: pair('kneeBend'),
  };
}
