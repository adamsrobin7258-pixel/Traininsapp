/**
 * One body in the scene – the interface every body implements, the code-built fallback as well
 * as a modelled GLB body. The renderer and the screens only talk to this, so a new model never
 * touches the exercise details or the workout summary.
 *
 * Transform rule: a body only writes transforms *below* its `root` (posture, skeleton,
 * animation, props) and never reads world matrices. The view (turning, front/back) only turns
 * the stage the root hangs in. So turning can never move a single part on its own.
 */
import type { Object3D } from 'three';
import type { MuscleHighlight } from '@/core/training';
import type { ClipView } from './rig';

export interface FigurePalette {
  body: string;
  shirt: string;
  shorts: string;
  shoe: string;
  equipment: string;
  metal: string;
  /** Primary muscles: the Kalethra accent. */
  accent: string;
  /** Contact shadow under the figure. */
  shadow: string;
}

export interface BodyOptions {
  /** Requested clip ("horizontalPush_bench", "rest" …); the body resolves what it has. */
  clip: string;
  highlight: MuscleHighlight;
  palette: FigurePalette;
}

export interface FigureBody {
  /**
   * The body in its own coordinate system – metres, +Y up, +Z = the body's front (glTF
   * convention), floor at y = 0, origin on the floor below the body's centre.
   */
  root: Object3D;
  /** "asset": a modelled body; "fallback": the code-built placeholder. */
  source: 'asset' | 'fallback';
  /** The clip actually played (after falling back to the movement type or the rest pose). */
  clip: string;
  /** Whether the clip moves (the rest pose does not). */
  animated: boolean;
  /** How the camera frames this clip. */
  view: ClipView;
  /** Advances the clip by seconds (loops). */
  advance(seconds: number): void;
  setHighlight(highlight: MuscleHighlight): void;
  setPalette(palette: FigurePalette): void;
  dispose(): void;
}

/** Secondary muscles: halfway between the neutral surface and the accent – calm, not neon. */
export const SECONDARY_MIX = 0.5;
