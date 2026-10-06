/**
 * The contract every Kalethra body asset fulfils – the code-built fallback today, modelled GLB
 * bodies (male, female) later. Pure: names, variants and a validator, no three.js. The exercise
 * data never depends on it: Exercise → primary/secondary muscles → muscleMap → highlight; the
 * body only shows that. Full description: docs/EXERCISE_VISUALS.md.
 */
import { FIGURE_MOVEMENTS, FIGURE_MUSCLES, isOneOf, type FigureMuscle } from '@/core/training';
import type { ProfileSex } from '@/core/user';

// ── Variants ─────────────────────────────────────────────────────────────────

export const FIGURE_VARIANTS = ['male', 'female'] as const;
export type FigureVariant = (typeof FIGURE_VARIANTS)[number];

/**
 * Without a stated sex (none, or "unspecified") one fixed variant is used. A product decision,
 * kept in this one place.
 */
export const DEFAULT_FIGURE_VARIANT: FigureVariant = 'male';

/** The body variant for the profile's sex – the profile field already exists, nothing new. */
export function figureVariantFor(sex: ProfileSex | null): FigureVariant {
  return sex === 'male' || sex === 'female' ? sex : DEFAULT_FIGURE_VARIANT;
}

/**
 * Bundled body assets (relative to the app's base, never a remote URL – the app works offline).
 * Built by `tools/figures/build.mjs`; `null` would mean "not delivered", and only then – or if an
 * asset cannot be loaded – the code-built fallback body is shown.
 */
export const FIGURE_ASSETS: Readonly<Record<FigureVariant, string | null>> = {
  male: 'figure/male/kalethra-male.glb',
  female: 'figure/female/kalethra-female.glb',
};

export function figureAssetFor(variant: FigureVariant): string | null {
  return FIGURE_ASSETS[variant];
}

// ── Node names ───────────────────────────────────────────────────────────────

/**
 * Muscle nodes: `muscle_<group>` or `muscle_<group>_<part>` – the group is one of the muscle
 * groups of the exercise library (`FIGURE_MUSCLES`); the part is the finer anatomy a model may
 * split a group into. Highlighting always works per group, so every part of a group lights up
 * together. Never rely on mesh indices.
 *
 * Only letters, digits and `_` in node, bone and clip names: the glTF loader removes
 * `[ ] . : /` from node names (three.js `PropertyBinding.sanitizeNodeName`), and animation tracks
 * address nodes as `<node>.<property>`. A name like `muscle:chest` would arrive as `musclechest`.
 */
export const MUSCLE_NODE_PREFIX = 'muscle_';
/** Allowed in every name of the contract. */
export const SAFE_NAME = /^[A-Za-z0-9_]+$/;

/**
 * Neutral surface without a muscle group (head, hands, feet, knees …): `body_<part>`. Never
 * highlighted.
 */
export const BODY_NODE_PREFIX = 'body_';

/**
 * Equipment of a clip: `prop_<variant>_<part>` ("prop_bench_bar"). Shown only while a clip of
 * that equipment variant plays ("horizontalPush_bench" → `prop_bench_*`), hidden otherwise.
 */
export const PROP_NODE_PREFIX = 'prop_';

/** The equipment variant a prop node belongs to, or `null` for any other node. */
export function propVariantOfNode(name: string): string | null {
  return /^prop_([a-z][a-zA-Z]*)_[a-zA-Z0-9]+$/.exec(name)?.[1] ?? null;
}

/** The equipment variant of a clip name ("horizontalPush_bench" → "bench"), or `null`. */
export function clipVariant(clip: string): string | null {
  return clip.split('_')[1] ?? null;
}

/** Recommended finer parts per group (names `muscle_<group>_<part>`); all optional. */
export const MUSCLE_PARTS: Readonly<Record<FigureMuscle, readonly string[]>> = {
  chest: ['upper', 'lower'],
  back: ['trapezius', 'rhomboids', 'erectors'],
  lats: [],
  shoulders: ['front', 'middle', 'rear'],
  biceps: [],
  triceps: [],
  forearms: ['flexors', 'extensors'],
  core: ['rectus', 'obliques'],
  glutes: ['maximus', 'medius'],
  quadriceps: [],
  hamstrings: [],
  adductors: [],
  calves: ['gastrocnemius', 'soleus'],
};

export function muscleNodeName(group: FigureMuscle, part?: string): string {
  return `${MUSCLE_NODE_PREFIX}${group}${part ? `_${part}` : ''}`;
}

/** The muscle group a node belongs to, or `null` for any other node. */
export function muscleGroupOfNode(name: string): FigureMuscle | null {
  if (!name.startsWith(MUSCLE_NODE_PREFIX)) return null;
  // A trailing number is the glTF loader's: a mesh with several primitives (skin and clothing)
  // becomes a group with children "<name>_1", "<name>_2".
  const match = /^([a-z]+)(?:_([a-z]+))?(?:_\d+)?$/i.exec(name.slice(MUSCLE_NODE_PREFIX.length));
  const group = match?.[1];
  return group && isOneOf(FIGURE_MUSCLES, group) ? group : null;
}

/**
 * Skeleton: these joints must exist (`_L` / `_R` for the sides), so every movement clip can
 * drive every body variant. Bone rest pose: standing, arms slightly away from the body.
 * `shoulder_*` is the clavicle, `forearm_*` the lower arm, `thigh_*` / `shin_*` the upper and
 * lower leg. More bones are allowed (e.g. a forearm twist bone).
 */
export const REQUIRED_BONES = [
  'root',
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  ...(['L', 'R'] as const).flatMap((side) => [
    `shoulder_${side}`,
    `upperArm_${side}`,
    `forearm_${side}`,
    `hand_${side}`,
    `thigh_${side}`,
    `shin_${side}`,
    `foot_${side}`,
  ]),
] as const;

/** Clip names: a movement type, optionally with an equipment variant ("horizontalPush_bench"). */
export function isClipName(name: string): boolean {
  const [movement, variant, extra] = name.split('_');
  return (
    extra === undefined &&
    movement !== undefined &&
    isOneOf(FIGURE_MOVEMENTS, movement) &&
    (variant === undefined || /^[a-z][a-zA-Z]*$/.test(variant))
  );
}

/**
 * The clip a body plays for a requested clip: the exact clip, else its movement type, else the
 * rest pose – so a body without a special clip still shows something sensible.
 */
export function resolveClip(requested: string, available: readonly string[]): string | null {
  const movement = requested.split('_')[0] ?? requested;
  for (const name of [requested, movement, 'rest']) {
    if (available.includes(name)) return name;
  }
  return null;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface AssetDescription {
  nodeNames: readonly string[];
  boneNames: readonly string[];
  clipNames: readonly string[];
}

export interface AssetReport {
  /** Usable: every muscle group, every required bone and the rest clip are there. */
  ok: boolean;
  missingMuscles: FigureMuscle[];
  missingBones: string[];
  /** `muscle_` nodes that name no known group – a typo in the model. */
  unknownMuscleNodes: string[];
  /** Clips whose name does not follow the contract. */
  invalidClips: string[];
  hasRestClip: boolean;
}

/** Checks a body asset against the contract (used by the loader and by tests). */
export function validateFigureAsset(asset: AssetDescription): AssetReport {
  const groups = new Set(asset.nodeNames.map(muscleGroupOfNode));
  const missingMuscles = FIGURE_MUSCLES.filter((group) => !groups.has(group));
  const missingBones = REQUIRED_BONES.filter((bone) => !asset.boneNames.includes(bone));
  const unknownMuscleNodes = asset.nodeNames.filter(
    (name) => name.startsWith(MUSCLE_NODE_PREFIX) && muscleGroupOfNode(name) === null,
  );
  const invalidClips = asset.clipNames.filter((name) => !isClipName(name));
  const hasRestClip = asset.clipNames.includes('rest');
  return {
    ok:
      missingMuscles.length === 0 &&
      missingBones.length === 0 &&
      unknownMuscleNodes.length === 0 &&
      invalidClips.length === 0 &&
      hasRestClip,
    missingMuscles,
    missingBones,
    unknownMuscleNodes,
    invalidClips,
    hasRestClip,
  };
}

/** Budgets a body asset must keep (Android and iOS mid-range devices). */
export const ASSET_BUDGET = {
  /** Compressed GLB per variant (geometry, textures, clips). */
  maxBytes: 4 * 1024 * 1024,
  maxTriangles: 60_000,
  maxTextureSize: 2048,
  maxMaterials: 8,
} as const;
