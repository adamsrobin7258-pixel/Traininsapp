/**
 * A modelled Kalethra body from a bundled GLB (male / female variant). Loaded as its own chunk
 * and only when an asset is registered in `FIGURE_ASSETS`; until then the fallback body is used.
 *
 * Highlight keeps the model's look: each muscle node gets its own copy of its material, only the
 * base colour is tinted towards the Kalethra accent – normal map, roughness and the modelled
 * fibre structure stay visible underneath (anatomy → structure → highlight).
 */
import {
  AnimationMixer,
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  type AnimationClip,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { FigureMuscle } from '@/core/training';
import { SECONDARY_MIX, type BodyOptions, type FigureBody } from './body';
import { muscleGroupOfNode, resolveClip, validateFigureAsset } from './contract';
import type { ClipView } from './rig';

/** Camera angle per movement type for a modelled body (its size comes from its bounds). */
const VIEW_ANGLES: Record<string, { azimuth: number; elevation: number }> = {
  horizontalPush: { azimuth: 74, elevation: 30 },
  horizontalPull: { azimuth: 60, elevation: 16 },
  rest: { azimuth: 0, elevation: 6 },
};

export class FigureAssetError extends Error {}

/** The muscle group of a mesh: its own name or the name of a node above it. */
function groupOf(object: Object3D): FigureMuscle | null {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const group = muscleGroupOfNode(node.name);
    if (group) return group;
  }
  return null;
}

/** Builds a body from a loaded scene and its clips; throws if the asset breaks the contract. */
export function gltfBodyFrom(
  scene: Object3D,
  animations: readonly AnimationClip[],
  { clip: requested, highlight, palette }: BodyOptions,
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

  // Own material per muscle mesh; remember its modelled colour as the neutral state.
  const muscles: { group: FigureMuscle; material: MeshStandardMaterial; base: Color }[] = [];
  const owned: Material[] = [];
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const group = groupOf(node);
    if (!group || !(node.material instanceof MeshStandardMaterial)) return;
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
  applyHighlight();

  const clipName = resolveClip(
    requested,
    animations.map((animation) => animation.name),
  );
  const clip = animations.find((animation) => animation.name === clipName);
  const mixer = new AnimationMixer(scene);
  if (clip) mixer.clipAction(clip).play();
  mixer.update(0);

  // Frame the body by its bounds.
  const sphere = new Box3().setFromObject(scene).getBoundingSphere(new Sphere());
  const angles = VIEW_ANGLES[(clipName ?? 'rest').split('_')[0] ?? 'rest'] ?? {
    azimuth: 0,
    elevation: 10,
  };
  const view: ClipView = { ...angles, radius: sphere.radius, y: sphere.center.y };

  return {
    root: scene,
    source: 'asset',
    clip: clipName ?? 'rest',
    animated: Boolean(clip && clip.duration > 0 && clipName !== 'rest'),
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
    },
    dispose() {
      mixer.stopAllAction();
      scene.traverse((node) => {
        if (node instanceof Mesh) (node.geometry as BufferGeometry).dispose();
      });
      for (const material of owned) material.dispose();
    },
  };
}

/** Loads a bundled GLB body (local file, never a remote URL). */
export async function loadGltfBody(url: string, options: BodyOptions): Promise<FigureBody> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltfBodyFrom(gltf.scene, gltf.animations, options);
}
