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
  Matrix3,
  Mesh,
  type BufferGeometry,
  MeshStandardMaterial,
  SkinnedMesh,
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

interface GltfJson {
  images?: unknown;
  textures?: unknown;
  samplers?: unknown;
  materials?: { normalTexture?: unknown }[];
  nodes?: { extras?: { muscleGroups?: unknown } }[];
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
}

/** A copy of a GLB with its JSON changed by `edit` (binary chunk unchanged). */
function editedGlb(file: ArrayBuffer, edit: (json: GltfJson) => void): ArrayBuffer {
  const view = new DataView(file);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(file, 20, jsonLength)),
  ) as GltfJson;
  edit(json);
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

/** The GLB with images and textures removed (jsdom cannot decode them). */
function withoutImages(file: ArrayBuffer): ArrayBuffer {
  return editedGlb(file, (json) => {
    delete json.images;
    delete json.textures;
    delete json.samplers;
    for (const material of json.materials ?? []) delete material.normalTexture;
  });
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

/** The skinned meshes below a node. */
function skinnedMeshes(root: Object3D): SkinnedMesh[] {
  const out: SkinnedMesh[] = [];
  root.traverse((node) => {
    if (node instanceof SkinnedMesh) out.push(node as SkinnedMesh);
  });
  return out;
}

/** Radius of the bars (tools/figures/lib/props.mjs). */
const BAR_RADIUS = 0.014;
const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;

/**
 * The skinned hand vertices (world, current pose) with the finger bone that moves each most –
 * what is actually drawn, not bone origins.
 */
function handVertices(root: Object3D) {
  root.updateMatrixWorld(true);
  const out: { point: Vector3; bone: string }[] = [];
  for (const mesh of skinnedMeshes(root)) {
    if (![mesh.name, mesh.parent?.name].some((n) => n?.startsWith('body_hands'))) continue;
    mesh.skeleton.update();
    const geometry = mesh.geometry;
    const index = geometry.getAttribute('skinIndex');
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const point = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
      out.push({ point, bone: mesh.skeleton.bones[index.getComponent(i, 0)]?.name ?? '' });
    }
  }
  return out;
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
  ])(
    'holds the bar with every finger over the whole repetition, never through it (%s)',
    async (clip, bar) => {
      const body = await bodyOf('male', clip);
      for (let step = 0; step < 8; step++) {
        const hands = handVertices(body.root).map(({ point, bone }) => ({
          bone,
          ...offBar(body.root, bar, point),
        }));
        // Nothing of the hand inside the bar (1 mm tolerance for the quantised weights).
        const deepest = Math.min(...hands.map((h) => h.radial - BAR_RADIUS));
        expect(deepest).toBeGreaterThan(-0.001);
        for (const side of ['L', 'R']) {
          const own = hands.filter((h) => h.bone.endsWith(`_${side}`));
          // Left and right of the centre, inside the bar's length.
          for (const h of own) expect(Math.abs(h.along)).toBeLessThan(0.55);
          expect(Math.sign(own[0]?.along ?? 0)).toBe(side === 'L' ? 1 : -1);
          // Every finger and the thumb touch the bar (skin within 3 mm of its surface).
          for (const finger of [...FINGERS, 'thumb']) {
            const gap = Math.min(
              ...own.filter((h) => h.bone.startsWith(finger)).map((h) => h.radial - BAR_RADIUS),
            );
            expect(gap, `${finger} ${side} at step ${String(step)}`).toBeLessThan(0.003);
          }
        }
        body.advance(0.55);
      }
      body.dispose();
    },
  );

  it('closes every finger around the bar from an open hand, and lifts the shoulder girdle', async () => {
    const rest = await bodyOf('male', 'rest');
    const pulldown = await bodyOf('male', 'verticalPull_cable');
    for (const body of [rest, pulldown]) body.root.updateMatrixWorld(true);
    // Curl of a finger: from the back of the hand (wrist → knuckle) to its middle phalanx.
    const curl = (root: Object3D, finger: string, side: string) => {
      const [hand, a, b, c] = [`hand_${side}`, 1, 2, 3].map((k) =>
        typeof k === 'string' ? worldOf(root, k) : worldOf(root, `${finger}${String(k)}_${side}`),
      ) as [Vector3, Vector3, Vector3, Vector3];
      return a.clone().sub(hand).angleTo(c.clone().sub(b));
    };
    for (const side of ['L', 'R']) {
      // Each finger has its own joints and closes on its own (not one bone for all fingers).
      for (const finger of FINGERS)
        expect(curl(pulldown.root, finger, side), `${finger} ${side}`).toBeGreaterThan(
          curl(rest.root, finger, side) + 0.6,
        );
      expect(rest.root.getObjectByName(`thumb3_${side}`)).toBeTruthy();
      // Arms overhead: the shoulder rises with the arm (scapulohumeral rhythm).
      const raised =
        worldOf(pulldown.root, `upperArm_${side}`).y - worldOf(pulldown.root, 'chest').y;
      const hanging = worldOf(rest.root, `upperArm_${side}`).y - worldOf(rest.root, 'chest').y;
      expect(raised - hanging).toBeGreaterThan(0.02);
    }
    rest.dispose();
    pulldown.dispose();
  });

  it('fades highlights softly into the neighbouring muscles, primary > secondary > neutral', async () => {
    const body = await bodyOf('male', 'rest', { chest: 'primary', triceps: 'secondary' });
    const found = { groups: [] as string[] };
    const blended: MeshStandardMaterial[] = [];
    let shared = 0;
    let total = 0;
    body.root.traverse((node) => {
      const list = (node.userData as { muscleGroups?: string[] }).muscleGroups;
      if (list) found.groups = list;
      if (!(node instanceof Mesh)) return;
      const geometry = node.geometry as BufferGeometry;
      if (!geometry.hasAttribute('_muscle_weights')) return;
      const weights = geometry.getAttribute('_muscle_weights');
      blended.push(node.material as MeshStandardMaterial);
      for (let i = 0; i < weights.count; i++) {
        total++;
        // Shared vertices: no group owns them completely – the transition band.
        if (weights.getX(i) < 0.95) shared++;
      }
    });
    const { groups } = found;
    expect([...groups].sort()).toEqual([...FIGURE_MUSCLES].sort());
    // A band, not a cut: part of the surface is shared between groups, most of it is not.
    expect(shared / total).toBeGreaterThan(0.05);
    expect(shared / total).toBeLessThan(0.6);
    // The shader takes each group's level from the highlight.
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );',
    };
    const material = blended[0];
    if (!material) throw new Error('no blended material');
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.vertexShader).toContain('_muscle_weights');
    expect(shader.fragmentShader).toContain('mix( uSurface, uAccent, vMuscleMix )');
    const mix = shader.uniforms.uMuscleMix?.value as Float32Array;
    const level = (group: string) => mix[groups.indexOf(group)];
    expect(level('chest')).toBeCloseTo(PRIMARY_MIX);
    expect(level('triceps')).toBeGreaterThan(0);
    expect(level('triceps')).toBeLessThan(level('chest') ?? 0);
    expect(level('quadriceps')).toBe(0);
    // No muscle (head, hands …): never tinted.
    expect(mix[groups.length]).toBe(0);
    body.setHighlight({ quadriceps: 'primary' });
    expect(level('chest')).toBe(0);
    expect(level('quadriceps')).toBeCloseTo(PRIMARY_MIX);
    body.dispose();
  });
});

describe('Kalethra body "male" – soft highlight in the file', () => {
  it('rejects broken soft-highlight data', () => {
    const male = fileOf('male');
    expect(validateGlb(male, { variant: 'male' }).errors).toEqual([]);
    const oneSided = editedGlb(male, (json) => {
      const primitive = json.meshes?.[0]?.primitives[0];
      if (primitive) delete primitive.attributes._MUSCLE_GROUPS;
    });
    expect(validateGlb(oneSided).errors.join()).toMatch(/only one of _MUSCLE_GROUPS/);
    const noList = editedGlb(male, (json) => {
      for (const node of json.nodes ?? []) delete node.extras;
    });
    expect(validateGlb(noList).errors.join()).toMatch(/list of known muscle groups/);
    const unknown = editedGlb(male, (json) => {
      for (const node of json.nodes ?? [])
        if (node.extras?.muscleGroups) node.extras.muscleGroups = ['chest', 'wings'];
    });
    expect(validateGlb(unknown).errors.join()).toMatch(/list of known muscle groups/);
  });
});

/**
 * Local deformation of the back and shoulders in a clip pose: every sampled vertex's surrounding
 * (3.5 cm along the surface, rest pose) is fitted rigidly to where it is posed; what is left along
 * the normal is the dent (< 0) or bulge the skinning makes there. Returns the deepest dent (m).
 */
function deepestDent(root: Object3D): number {
  root.updateMatrixWorld(true);
  const BACK = /^muscle_(lats|back|shoulders|triceps|chest_upper)/;
  const verts: { mesh: SkinnedMesh; i: number; rest: Vector3; back: boolean }[] = [];
  const ids = new Map<string, number>();
  const triangles: number[][] = [];
  for (const node of skinnedMeshes(root)) {
    const name = [node.name, node.parent?.name ?? ''].find((n) => /^(muscle|body)_/.test(n)) ?? '';
    const material = (node.material as MeshStandardMaterial).name;
    const geometry = node.geometry;
    const position = geometry.getAttribute('position');
    const local: number[] = [];
    for (let i = 0; i < position.count; i++) {
      const rest = new Vector3().fromBufferAttribute(position, i);
      const key = `${material}|${rest
        .toArray()
        .map((x) => Math.round(x * 1e4))
        .join(',')}`;
      let id = ids.get(key);
      if (id === undefined) {
        id = verts.length;
        ids.set(key, id);
        verts.push({ mesh: node, i, rest, back: BACK.test(name) && rest.y > 1 });
      }
      local.push(id);
    }
    const index = geometry.getIndex();
    if (!index) continue;
    for (let t = 0; t < index.count; t += 3)
      triangles.push([0, 1, 2].map((k) => local[index.getX(t + k)] ?? 0));
  }
  const neighbours = verts.map(() => new Set<number>());
  for (const [a = 0, b = 0, c = 0] of triangles) {
    neighbours[a]?.add(b).add(c);
    neighbours[b]?.add(a).add(c);
    neighbours[c]?.add(a).add(b);
  }
  const posed = verts.map(({ mesh, i }) => {
    mesh.skeleton.update();
    return mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld);
  });
  const normals = verts.map(() => new Vector3());
  for (const [a = 0, b = 0, c = 0] of triangles) {
    const n = new Vector3().crossVectors(
      (posed[b] as Vector3).clone().sub(posed[a] as Vector3),
      (posed[c] as Vector3).clone().sub(posed[a] as Vector3),
    );
    for (const v of [a, b, c]) normals[v]?.add(n);
  }
  let deepest = 0;
  verts.forEach((vertex, k) => {
    if (!vertex.back || k % 3 !== 0) return;
    // Surrounding along the surface (rest pose).
    const distance = new Map<number, number>([[k, 0]]);
    const queue = [k];
    while (queue.length) {
      const u = queue.shift() ?? k;
      for (const w of neighbours[u] ?? []) {
        const d =
          (distance.get(u) ?? 0) +
          (verts[u] as typeof vertex).rest.distanceTo((verts[w] as typeof vertex).rest);
        if (d < 0.035 && d < (distance.get(w) ?? Infinity)) {
          if (!distance.has(w)) queue.push(w);
          distance.set(w, d);
        }
      }
    }
    const hood = [...distance.keys()];
    if (hood.length < 6) return;
    const restCentre = new Vector3();
    const posedCentre = new Vector3();
    for (const u of hood) {
      restCentre.add((verts[u] as typeof vertex).rest);
      posedCentre.add(posed[u] as Vector3);
    }
    restCentre.divideScalar(hood.length);
    posedCentre.divideScalar(hood.length);
    // Best rotation (polar decomposition of the covariance).
    const h = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const e = h.elements;
    for (const u of hood) {
      const a = (verts[u] as typeof vertex).rest.clone().sub(restCentre);
      const b = (posed[u] as Vector3).clone().sub(posedCentre);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          e[j * 3 + i] = (e[j * 3 + i] ?? 0) + b.getComponent(i) * a.getComponent(j);
    }
    let r = h.clone();
    for (let it = 0; it < 25; it++) {
      const inverse = r.clone().invert().transpose().elements;
      r = new Matrix3().fromArray(r.elements.map((x, i) => (x + (inverse[i] ?? 0)) / 2));
    }
    const expected = vertex.rest.clone().sub(restCentre).applyMatrix3(r).add(posedCentre);
    const off = (posed[k] as Vector3)
      .clone()
      .sub(expected)
      .dot((normals[k] as Vector3).normalize());
    deepest = Math.min(deepest, off);
  });
  return deepest;
}

describe('Kalethra body "male" – back and shoulders in motion', () => {
  it.each(['verticalPull_cable', 'horizontalPush_bench'])(
    'keeps the back continuous: no dent deeper than 9 mm in any phase (%s)',
    async (clip) => {
      const body = await bodyOf('male', clip);
      // 0.29.0 folded the skin behind the armpit in by 9–12 mm in these phases.
      for (let step = 0; step < 5; step++) {
        expect(deepestDent(body.root)).toBeGreaterThan(-0.009);
        body.advance(0.45);
      }
      body.dispose();
    },
  );
});

/**
 * Skin faces folded against their own corners in the current pose, where the head meets the
 * neck at the back (band from the rest positions: neck joint up to just above the head joint,
 * behind the neck), and kinks sharper than 60° there – the saw-tooth edge of 0.30.0.
 */
function posedHeadNeck(root: Object3D): { folded: number; sharp: number } {
  root.updateMatrixWorld(true);
  const ids = new Map<string, number>();
  const rest: Vector3[] = [];
  const posed: Vector3[] = [];
  const triangles: number[][] = [];
  let neck: Vector3 | null = null;
  let head: Vector3 | null = null;
  for (const mesh of skinnedMeshes(root)) {
    if ((mesh.material as MeshStandardMaterial).name !== 'skin') continue;
    mesh.skeleton.update();
    mesh.skeleton.bones.forEach((bone, k) => {
      const inverse = mesh.skeleton.boneInverses[k];
      if (!inverse) return;
      const at = new Vector3().setFromMatrixPosition(inverse).negate();
      if (bone.name === 'neck') neck = at;
      if (bone.name === 'head') head = at;
    });
    const position = mesh.geometry.getAttribute('position');
    const local: number[] = [];
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i);
      const key = p
        .toArray()
        .map((x) => Math.round(x * 1e4))
        .join(',');
      let id = ids.get(key);
      if (id === undefined) {
        id = rest.length;
        ids.set(key, id);
        rest.push(p);
        posed.push(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
      }
      local.push(id);
    }
    const index = mesh.geometry.getIndex();
    if (!index) continue;
    for (let t = 0; t < index.count; t += 3)
      triangles.push([0, 1, 2].map((k) => local[index.getX(t + k)] ?? 0));
  }
  const n = neck as Vector3 | null;
  const h = head as Vector3 | null;
  if (!n || !h) throw new Error('neck and head bones expected');
  const inside = (v: number) => {
    const p = rest[v] as Vector3;
    return p.y > n.y && p.y < h.y + 0.02 && p.z < n.z + 0.02;
  };
  const faceNormal = ([a = 0, b = 0, c = 0]: number[]) =>
    new Vector3()
      .crossVectors(
        (posed[b] as Vector3).clone().sub(posed[a] as Vector3),
        (posed[c] as Vector3).clone().sub(posed[a] as Vector3),
      )
      .normalize();
  const normals = rest.map(() => new Vector3());
  for (const t of triangles) for (const v of t) normals[v]?.add(faceNormal(t));
  for (const normal of normals) normal.normalize();
  let folded = 0;
  const edges = new Map<string, Vector3[]>();
  for (const t of triangles) {
    if (!t.every(inside)) continue;
    const f = faceNormal(t);
    const mean = t.reduce((sum, v) => sum + f.dot(normals[v] as Vector3), 0) / 3;
    if (mean < 0.2) folded++;
    for (let k = 0; k < 3; k++) {
      const a = t[k] ?? 0;
      const b = t[(k + 1) % 3] ?? 0;
      const key = a < b ? `${String(a)}_${String(b)}` : `${String(b)}_${String(a)}`;
      edges.set(key, [...(edges.get(key) ?? []), f]);
    }
  }
  // Sharp kinks: neighbouring faces turned more than 60° against each other.
  let sharp = 0;
  for (const list of edges.values()) {
    if (list.length === 2 && (list[0] as Vector3).dot(list[1] as Vector3) < 0.5) sharp++;
  }
  return { folded, sharp };
}

describe('Kalethra body "female" – head and neck in motion', () => {
  it.each(['rest', 'verticalPull_cable', 'horizontalPush_bench'])(
    'head and neck join without folds or a saw-tooth edge (%s)',
    async (clip) => {
      const body = await bodyOf('female', clip);
      const counts: { folded: number; sharp: number }[] = [];
      for (let step = 0; step < 5; step++) {
        counts.push(posedHeadNeck(body.root));
        body.advance(0.45);
      }
      body.dispose();
      // Before Phase A in every pose: 15 folded faces, 51 kinks sharper than 60°.
      expect(Math.max(...counts.map((c) => c.folded))).toBe(0);
      expect(Math.max(...counts.map((c) => c.sharp))).toBeLessThanOrEqual(3);
    },
  );
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
