/**
 * A modelled Kalethra body from a bundled GLB (male / female variant). Loaded as its own chunk,
 * from the app's own files (offline, never a remote URL).
 *
 * Highlight keeps the model's look: each muscle node gets its own copy of its material, only the
 * base colour is tinted towards the Kalethra accent – normal map, roughness and the modelled
 * fibre structure stay visible underneath (anatomy → structure → highlight). A muscle under the
 * clothing lights up on the clothing.
 *
 * One file serves every body shown at once (the summary shows front and back): it is loaded
 * once, each body is a clone with its own skeleton, and the shared geometry and textures are
 * freed when the last body using them is disposed.
 */
import {
  AnimationMixer,
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3,
  type AnimationClip,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneWithSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FigureMuscle } from '@/core/training';
import { SECONDARY_MIX, type BodyOptions, type FigureBody, type FigurePalette } from './body';
import {
  REQUIRED_BONES,
  clipVariant,
  muscleGroupOfNode,
  propVariantOfNode,
  resolveClip,
  validateFigureAsset,
} from './contract';
import type { ClipView } from './rig';

/** Camera angle per movement type for a modelled body (its size comes from its bounds). */
const VIEW_ANGLES: Record<string, { azimuth: number; elevation: number }> = {
  horizontalPush: { azimuth: 74, elevation: 30 },
  horizontalPull: { azimuth: 60, elevation: 16 },
  verticalPull: { azimuth: 0, elevation: 10 },
  rest: { azimuth: 0, elevation: 6 },
};

/**
 * Where in its loop a clip stands when the figure is still (small view, reduced motion): a
 * moment that explains the exercise – as the code-built figure does.
 */
export const STILL_PHASE = 0.3;

/** Room around the skeleton for the body's volume (metres). */
const VOLUME_MARGIN = 0.16;

export class FigureAssetError extends Error {}

/** The muscle group of a mesh: its own name or the name of a node above it. */
function groupOf(object: Object3D): FigureMuscle | null {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const group = muscleGroupOfNode(node.name);
    if (group) return group;
  }
  return null;
}

/** The equipment variant of a prop: its own name or a node above it. */
function propOf(object: Object3D): string | null {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const variant = propVariantOfNode(node.name);
    if (variant) return variant;
  }
  return null;
}

function texturesOf(material: Material): Texture[] {
  return Object.values(material).filter(
    (value): value is Texture => (value as { isTexture?: boolean } | null)?.isTexture === true,
  );
}

/** Frees geometry, materials and textures of a scene. */
function disposeScene(scene: Object3D) {
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    (node.geometry as BufferGeometry).dispose();
    const materials = (
      Array.isArray(node.material) ? node.material : [node.material]
    ) as Material[];
    for (const material of materials) {
      for (const texture of texturesOf(material)) texture.dispose();
      material.dispose();
    }
  });
}

/**
 * Builds a body from a loaded scene and its clips; throws if the asset breaks the contract.
 * `release` frees shared resources instead of the scene's own (see `loadGltfBody`).
 */
export function gltfBodyFrom(
  scene: Object3D,
  animations: readonly AnimationClip[],
  { clip: requested, highlight, palette }: BodyOptions,
  release?: () => void,
): FigureBody {
  const nodeNames: string[] = [];
  const boneNames: string[] = [];
  scene.traverse((node) => {
    nodeNames.push(node.name);
    if ((node as { isBone?: boolean }).isBone) boneNames.push(node.name);
  });
  const report = validateFigureAsset({
    nodeNames,
    boneNames,
    clipNames: animations.map((animation) => animation.name),
  });
  if (!report.ok)
    throw new FigureAssetError(`Body asset breaks the contract: ${JSON.stringify(report)}`);

  const clipName = resolveClip(
    requested,
    animations.map((animation) => animation.name),
  );
  const clip = animations.find((animation) => animation.name === clipName);
  const equipment = clipName ? clipVariant(clipName) : null;

  // Own material per muscle mesh (its modelled colour is the neutral state); props are shown
  // only with their clip and take the theme's equipment colours.
  const muscles: { group: FigureMuscle; material: MeshStandardMaterial; base: Color }[] = [];
  const props: { material: MeshStandardMaterial; metal: boolean }[] = [];
  const owned: Material[] = [];
  scene.traverse((node) => {
    const prop = propOf(node);
    if (prop && propVariantOfNode(node.name)) node.visible = prop === equipment;
    if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)) return;
    if (prop) {
      const material = node.material.clone();
      node.material = material;
      owned.push(material);
      props.push({ material, metal: material.metalness > 0.3 });
      return;
    }
    const group = groupOf(node);
    if (!group) return;
    const material = node.material.clone();
    node.material = material;
    owned.push(material);
    muscles.push({ group, material, base: material.color.clone() });
  });

  let accent = new Color(palette.accent);
  let current = highlight;
  const applyHighlight = () => {
    for (const { group, material, base } of muscles) {
      const level = current[group];
      material.color.copy(
        level === 'primary'
          ? accent
          : level === 'secondary'
            ? base.clone().lerp(accent, SECONDARY_MIX)
            : base,
      );
      material.userData.level = level ?? 'neutral';
    }
  };
  const applyProps = (next: FigurePalette) => {
    for (const { material, metal } of props)
      material.color.set(metal ? next.metal : next.equipment);
  };
  applyHighlight();
  applyProps(palette);

  const mixer = new AnimationMixer(scene);
  if (clip) mixer.clipAction(clip).play();
  const animated = Boolean(clip && clip.duration > 0 && clipName !== 'rest');
  mixer.update(animated && clip ? clip.duration * STILL_PHASE : 0);

  // Frame the body by its skeleton in the clip's pose (props are not part of the frame).
  scene.updateMatrixWorld(true);
  const box = new Box3();
  const point = new Vector3();
  for (const name of REQUIRED_BONES) {
    const bone = scene.getObjectByName(name);
    if (bone) box.expandByPoint(bone.getWorldPosition(point));
  }
  box.expandByScalar(VOLUME_MARGIN);
  const sphere = box.getBoundingSphere(new Sphere());
  const angles = VIEW_ANGLES[(clipName ?? 'rest').split('_')[0] ?? 'rest'] ?? {
    azimuth: 0,
    elevation: 10,
  };
  const view: ClipView = { ...angles, radius: sphere.radius, y: sphere.center.y };

  return {
    root: scene,
    source: 'asset',
    clip: clipName ?? 'rest',
    animated,
    view,
    advance(seconds) {
      mixer.update(seconds);
    },
    setHighlight(next) {
      current = next;
      applyHighlight();
    },
    setPalette(next) {
      accent = new Color(next.accent);
      applyHighlight();
      applyProps(next);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      for (const material of owned) material.dispose();
      if (release) release();
      else disposeScene(scene);
    },
  };
}

// ── Loading ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  gltf: Promise<GLTF>;
  users: number;
}
const cache = new Map<string, CacheEntry>();

function acquire(url: string): Promise<GLTF> {
  let entry = cache.get(url);
  if (!entry) {
    const gltf = new GLTFLoader().loadAsync(url);
    entry = { gltf, users: 0 };
    cache.set(url, entry);
    // A failed load is not kept: the next attempt tries again.
    gltf.catch(() => {
      if (cache.get(url)?.gltf === gltf) cache.delete(url);
    });
  }
  entry.users += 1;
  return entry.gltf;
}

function release(url: string) {
  const entry = cache.get(url);
  if (!entry) return;
  entry.users -= 1;
  if (entry.users > 0) return;
  cache.delete(url);
  void entry.gltf
    .then((gltf) => {
      disposeScene(gltf.scene);
    })
    .catch(() => undefined);
}

/** How many bodies currently use a loaded file (for tests). */
export function loadedUsers(url: string): number {
  return cache.get(url)?.users ?? 0;
}

/** Loads a bundled GLB body (local file, never a remote URL). */
export async function loadGltfBody(url: string, options: BodyOptions): Promise<FigureBody> {
  let gltf: GLTF;
  try {
    gltf = await acquire(url);
  } catch (error) {
    release(url);
    throw error;
  }
  try {
    return gltfBodyFrom(cloneWithSkeleton(gltf.scene), gltf.animations, options, () => {
      release(url);
    });
  } catch (error) {
    release(url);
    throw error;
  }
}
