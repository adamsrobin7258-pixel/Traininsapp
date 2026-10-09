/**
 * The bundled Kalethra bodies (public/figure/…): file validation, and the real assets through the
 * app's import path – muscle mapping, highlight, clips, props, turning, disposal.
 *
 * jsdom decodes no images, so for the scene tests the detail normal map is left out of the
 * parsed copy; the file validation checks it (size, format) on the untouched file.
 */
import type { Color } from 'three';
import {
  Group,
  Mesh,
  type BufferGeometry,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIGURE_MUSCLES, type FigureMuscle } from '@/core/training';
import { readProjectFile } from '@/test/projectFiles';
import { validateGlb } from './assetValidator';
import { PRIMARY_MIX, type FigurePalette } from './body';
import {
  ASSET_BUDGET,
  FIGURE_VARIANTS,
  figureAssetFor,
  muscleGroupOfNode,
  type FigureVariant,
} from './contract';
import { STILL_PHASE, gltfBodyFrom, loadGltfBody, loadedUsers } from './gltfBody';

const PALETTE = {
  accent: '#557a5b',
  equipment: '#5d6066',
  metal: '#a7aaaf',
} as FigurePalette;

function fileOf(variant: FigureVariant): ArrayBuffer {
  return readProjectFile(`public/${figureAssetFor(variant) ?? ''}`);
}

/** The GLB with images and textures removed (jsdom cannot decode them). */
function withoutImages(file: ArrayBuffer): ArrayBuffer {
  const view = new DataView(file);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(file, 20, jsonLength))) as {
    images?: unknown;
    textures?: unknown;
    samplers?: unknown;
    materials?: { normalTexture?: unknown }[];
  };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of json.materials ?? []) delete material.normalTexture;
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const bin = new Uint8Array(file, 20 + jsonLength);
  const out = new Uint8Array(20 + jsonBytes.length + bin.length);
  const header = new DataView(out.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, out.length, true);
  header.setUint32(12, jsonBytes.length, true);
  header.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  out.set(bin, 20 + jsonBytes.length);
  return out.buffer;
}

const parsed = new Map<FigureVariant, Promise<GLTF>>();
function gltfOf(variant: FigureVariant): Promise<GLTF> {
  let gltf = parsed.get(variant);
  if (!gltf) {
    gltf = new GLTFLoader().parseAsync(withoutImages(fileOf(variant)), '');
    parsed.set(variant, gltf);
  }
  return gltf;
}

async function bodyOf(variant: FigureVariant, clip: string, highlight = {}) {
  const gltf = await gltfOf(variant);
  const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
  return gltfBodyFrom(clone(gltf.scene), gltf.animations, { clip, highlight, palette: PALETTE });
}

function musclesOf(root: Object3D) {
  const found = new Map<FigureMuscle, MeshStandardMaterial[]>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    let group: FigureMuscle | null = null;
    for (let n: Object3D | null = node; n && !group; n = n.parent)
      group = muscleGroupOfNode(n.name);
    if (!group) return;
    found.set(group, [...(found.get(group) ?? []), node.material as MeshStandardMaterial]);
  });
  return found;
}

function worldOf(root: Object3D, name: string) {
  return (root.getObjectByName(name) as Object3D).getWorldPosition(new Vector3());
}

describe.each(FIGURE_VARIANTS)('Kalethra body "%s"', (variant) => {
  it('passes the file validator and keeps every budget', async () => {
    const report = validateGlb(fileOf(variant), { variant });
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats.triangles).toBeLessThanOrEqual(ASSET_BUDGET.maxTriangles);
    expect(report.stats.bytes).toBeLessThanOrEqual(ASSET_BUDGET.maxBytes);
    expect(report.stats.materials).toBeLessThanOrEqual(ASSET_BUDGET.maxMaterials);
    for (const texture of report.stats.textures) {
      expect(Math.max(texture.width, texture.height)).toBeLessThanOrEqual(
        ASSET_BUDGET.maxTextureSize,
      );
    }
    expect(report.stats.clips).toEqual(['rest', 'horizontalPush_bench', 'verticalPull_cable']);
    await expect(`${JSON.stringify(report, null, 2)}\n`).toMatchFileSnapshot(
      `../../../../assets/figure/validation/${variant}.json`,
    );
  });

  it('maps every muscle group to modelled meshes and highlights primary > secondary > neutral', async () => {
    const body = await bodyOf(variant, 'rest', { chest: 'primary', triceps: 'secondary' });
    expect(body.source).toBe('asset');
    const muscles = musclesOf(body.root);
    expect([...muscles.keys()].sort()).toEqual([...FIGURE_MUSCLES].sort());
    const accent = new MeshStandardMaterial({ color: PALETTE.accent }).color;
    // The chest lights up – on the skin and on the top above it: mostly the accent, a little of
    // the surface (skin, fabric) stays.
    const towardsAccent = (color: Color) =>
      Math.hypot(color.r - accent.r, color.g - accent.g, color.b - accent.b);
    for (const material of muscles.get('chest') ?? []) {
      expect(material.userData.level).toBe('primary');
      expect(towardsAccent(material.color)).toBeLessThanOrEqual((1 - PRIMARY_MIX) * Math.sqrt(3));
    }
    for (const material of muscles.get('triceps') ?? []) {
      expect(material.userData.level).toBe('secondary');
      expect(material.color.equals(accent)).toBe(false);
    }
    for (const material of muscles.get('quadriceps') ?? []) {
      expect(material.userData.level).toBe('neutral');
    }
    body.dispose();
  });

  it('plays the exercise clips and shows only the clip’s equipment', async () => {
    const bench = await bodyOf(variant, 'horizontalPush_bench');
    expect(bench.clip).toBe('horizontalPush_bench');
    expect(bench.animated).toBe(true);
    const visible = (name: string) => (bench.root.getObjectByName(name) as Object3D).visible;
    expect(visible('prop_bench_frame')).toBe(true);
    expect(visible('prop_bench_bar')).toBe(true);
    expect(visible('prop_cable_frame')).toBe(false);
    // The bar moves with the hands over the repetition.
    bench.root.updateMatrixWorld(true);
    const before = worldOf(bench.root, 'hand_L');
    bench.advance(4.4 * (0.5 - STILL_PHASE));
    bench.root.updateMatrixWorld(true);
    expect(worldOf(bench.root, 'hand_L').distanceTo(before)).toBeGreaterThan(0.07);
    bench.dispose();

    const pulldown = await bodyOf(variant, 'verticalPull_cable');
    expect(pulldown.clip).toBe('verticalPull_cable');
    expect((pulldown.root.getObjectByName('prop_cable_wire') as Object3D).visible).toBe(true);
    expect((pulldown.root.getObjectByName('prop_bench_bar') as Object3D).visible).toBe(false);
    pulldown.dispose();

    // A movement without its own clip yet stands in the rest pose, without equipment.
    const squat = await bodyOf(variant, 'squat');
    expect(squat.clip).toBe('rest');
    expect(squat.animated).toBe(false);
    squat.root.traverse((node) => {
      if (node.name.startsWith('prop_')) expect(node.visible).toBe(false);
    });
    squat.dispose();
  });

  it('turns only with the stage: body, bar and hands keep their relation (no double turn)', async () => {
    const body = await bodyOf(variant, 'horizontalPush_bench');
    const stage = new Group();
    stage.add(body.root);
    const relation = () => {
      stage.updateMatrixWorld(true);
      const bar = worldOf(body.root, 'prop_bench_bar');
      return [
        worldOf(body.root, 'hand_L').distanceTo(bar),
        worldOf(body.root, 'hand_R').distanceTo(bar),
      ];
    };
    const still = relation();
    for (const yaw of [0.7, Math.PI, -2.1]) {
      stage.rotation.y = yaw;
      const turned = relation();
      expect(turned[0]).toBeCloseTo(still[0] ?? 0, 5);
      expect(turned[1]).toBeCloseTo(still[1] ?? 0, 5);
    }
    // Front and back: turned by half a circle, the back faces the camera (+Z).
    const rest = await bodyOf(variant, 'rest');
    const view = new Group();
    view.add(rest.root);
    const z = (name: string) => {
      view.updateMatrixWorld(true);
      return worldOf(rest.root, name).z;
    };
    expect(z('chest')).toBeGreaterThan(z('spine') - 0.2);
    expect(z('head')).toBeGreaterThan(-0.2);
    const frontHand = worldOf(rest.root, 'hand_L').x;
    view.rotation.y = Math.PI;
    view.updateMatrixWorld(true);
    expect(Math.sign(worldOf(rest.root, 'hand_L').x)).toBe(-Math.sign(frontHand));
    body.dispose();
    rest.dispose();
  });
});

/** Distance of a world point to the axis of a bar prop (bars run along their local X). */
function offBar(root: Object3D, bar: string, point: Vector3) {
  const local = (root.getObjectByName(bar) as Object3D).worldToLocal(point.clone());
  return { radial: Math.hypot(local.y, local.z), along: local.x };
}

describe('Kalethra body "male" – grip and shoulder girdle', () => {
  it('carries the CC BY 4.0 credit of its modelled source in the file', async () => {
    const { asset } = (await gltfOf('male')).parser.json as {
      asset: { copyright?: string; extras: { kalethra: { source: string } } };
    };
    expect(asset.copyright).toMatch(/"Proxy Human base Mesh" by sphere_joe/);
    expect(asset.copyright).toMatch(/CC BY 4\.0/);
    expect(asset.copyright).toMatch(/Modified for Kalethra/);
    expect(asset.extras.kalethra.source).toMatch(/modified/);
  });

  it.each([
    ['horizontalPush_bench', 'prop_bench_bar'],
    ['verticalPull_cable', 'prop_cable_bar'],
  ])('holds the bar in the fingers over the whole repetition (%s)', async (clip, bar) => {
    const body = await bodyOf('male', clip);
    const seen: number[] = [];
    for (let step = 0; step < 12; step++) {
      body.root.updateMatrixWorld(true);
      for (const side of ['L', 'R']) {
        const fingers = offBar(body.root, bar, worldOf(body.root, `fingers_${side}`));
        const tips = offBar(body.root, bar, worldOf(body.root, `fingerTips_${side}`));
        seen.push(fingers.radial, tips.radial);
        // The hands sit left and right of the centre, inside the bar.
        expect(Math.sign(fingers.along)).toBe(side === 'L' ? 1 : -1);
        expect(Math.abs(fingers.along)).toBeLessThan(0.55);
      }
      body.advance(0.37);
    }
    // Bone origins sit inside the fingers: bar radius (1.4 cm) plus half a finger – no gap.
    expect(Math.max(...seen)).toBeLessThan(0.04);
    body.dispose();
  });

  it('closes the fingers around the bar and lifts the shoulder girdle with the arm', async () => {
    const rest = await bodyOf('male', 'rest');
    const pulldown = await bodyOf('male', 'verticalPull_cable');
    for (const body of [rest, pulldown]) body.root.updateMatrixWorld(true);
    const bend = (root: Object3D, side: string) => {
      const hand = worldOf(root, `hand_${side}`);
      const fingers = worldOf(root, `fingers_${side}`);
      const tips = worldOf(root, `fingerTips_${side}`);
      return fingers.clone().sub(hand).angleTo(tips.clone().sub(fingers));
    };
    for (const side of ['L', 'R']) {
      // Relaxed at rest, curled around the bar in the clip.
      expect(bend(pulldown.root, side)).toBeGreaterThan(bend(rest.root, side) + 0.7);
      expect(rest.root.getObjectByName(`thumb_${side}`)).toBeTruthy();
      // Arms overhead: the shoulder rises with the arm (scapulohumeral rhythm).
      const raised =
        worldOf(pulldown.root, `upperArm_${side}`).y - worldOf(pulldown.root, 'chest').y;
      const hanging = worldOf(rest.root, `upperArm_${side}`).y - worldOf(rest.root, 'chest').y;
      expect(raised - hanging).toBeGreaterThan(0.02);
    }
    rest.dispose();
    pulldown.dispose();
  });
});

describe('Kalethra bodies – variants and resources', () => {
  it('has two own anatomical models, not one scaled body', async () => {
    const male = await gltfOf('male');
    const female = await gltfOf('female');
    const height = (gltf: GLTF) => {
      gltf.scene.updateMatrixWorld(true);
      return worldOf(gltf.scene, 'head').y;
    };
    expect(height(male)).toBeGreaterThan(height(female));
    // Shoulder-to-hip relation differs (not a uniform scale of the same body).
    const ratio = (gltf: GLTF) =>
      worldOf(gltf.scene, 'upperArm_L').x / worldOf(gltf.scene, 'thigh_L').x;
    expect(Math.abs(ratio(male) - ratio(female))).toBeGreaterThan(0.05);
  });

  it('loads a file once for several bodies and frees it with the last one', async () => {
    const gltf = await gltfOf('female');
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const lats: BufferGeometry[] = [];
    gltf.scene.getObjectByName('muscle_lats')?.traverse((node) => {
      if (node instanceof Mesh) lats.push(node.geometry as BufferGeometry);
    });
    const geometry = lats[0];
    if (!geometry) throw new Error('no lats mesh');
    const disposed = vi.spyOn(geometry, 'dispose');
    const url = '/figure/female/kalethra-female.glb';
    const options = { clip: 'rest', highlight: {}, palette: PALETTE };
    const [front, back] = await Promise.all([
      loadGltfBody(url, options),
      loadGltfBody(url, options),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(loadedUsers(url)).toBe(2);
    // Each body has its own skeleton.
    expect(front.root.getObjectByName('pelvis')).not.toBe(back.root.getObjectByName('pelvis'));
    front.dispose();
    expect(loadedUsers(url)).toBe(1);
    await Promise.resolve();
    expect(disposed).not.toHaveBeenCalled();
    back.dispose();
    expect(loadedUsers(url)).toBe(0);
    await new Promise((done) => setTimeout(done, 0));
    expect(disposed).toHaveBeenCalled();
    load.mockRestore();
    parsed.delete('female');
  });
});
