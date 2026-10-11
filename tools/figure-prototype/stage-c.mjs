/**
 * Prototype stage C – writes the prototype GLB from stage A (rig, weights) and stage B (forms,
 * components, fibre map).
 *
 *   WORK=<dir> OUT=<file.glb> node tools/figure-prototype/stage-c.mjs
 *
 * Skeleton, clips and props come from the production exporter (tools/figures/lib/export.mjs,
 * called with no body meshes, so the clips are generated exactly as in production – from this
 * body's own joints and hands); the body is then added:
 *
 *  - one node per region (contract names `muscle_<group>[_<part>]` / `body_<part>`), each a
 *    skinned primitive in the skin form with one morph target `muscle` (position and normal
 *    deltas to the écorché form) – same vertices, same weights, so both views move identically;
 *  - `_MUSCLE_GROUPS` / `_MUSCLE_WEIGHTS` per vertex as in the contract (soft highlight);
 *  - `proto_hair`, `proto_drape` (skin view only) and `proto_eye_L/R`, skinned with the weights of
 *    the body vertices they come from (eyes: the head);
 *  - materials `stone` (body, hair), `drape`, `eye`, and `stone_muscle` with the fibre normal map
 *    (not used by a primitive; the viewer switches the body to it in the muscle view).
 *
 * Nothing in the production assets or contract changes; the file goes to OUT only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportGlb } from '../figures/lib/export.mjs';
import { clipDefinitions } from '../figures/lib/clips.mjs';
import { handModel } from '../figures/lib/grip.mjs';
import { rigFor } from '../figures/lib/rig.mjs';
import { readGlb, writeGlb } from '../figures/lib/repair.mjs';

const WORK = process.env.WORK;
const OUT = process.env.OUT;
if (!WORK || !OUT) {
  console.error('Set WORK (stage folders a/ and b/) and OUT (GLB file).');
  process.exit(1);
}
const LOOK = JSON.parse(readFileSync(new URL('./look.json', import.meta.url), 'utf8'));
const TYPES = {
  Float64Array,
  Float32Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
};
const read = (dir, spec) => {
  const buf = readFileSync(join(dir, spec.file));
  const Type = TYPES[spec.type];
  return new Type(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const A = join(WORK, 'a');
const B = join(WORK, 'b');
const metaA = JSON.parse(readFileSync(join(A, 'body.json'), 'utf8'));
const metaB = JSON.parse(readFileSync(join(B, 'proto.json'), 'utf8'));
const arrA = Object.fromEntries(Object.entries(metaA.arrays).map(([k, s]) => [k, read(A, s)]));
const arrB = Object.fromEntries(Object.entries(metaB.arrays).map(([k, s]) => [k, read(B, s)]));
const VARIANT = 'male';
const rig = rigFor(VARIANT);
const names = metaA.jointNames;

// ── Body for the clip generator (skin form, stage A's weights and joints) ─────────────────────
const skinPos = Float64Array.from(arrB.skin);
const tris = arrB.tris;
const used = [...new Set(tris)];
const joints = new Map(Object.entries(metaA.joints));
// Skin weights as repaired in stage B (py/weights.py), else stage A's.
const weightJoints = arrB.weightJoints ?? arrA.weightJoints;
const weightValues = arrB.weightValues ?? arrA.weightValues;
const weights = { joints: weightJoints, weights: weightValues, names };
const body = { positions: skinPos, used, weights, joints };
/** Bench and seat: back depth and chest front of the bare body (no garment layer). */
function measure() {
  const p = skinPos;
  const pelvis = joints.get('pelvis');
  const shoulder = joints.get('upperArm_L');
  let back = Infinity;
  let chest = -Infinity;
  for (const v of used) {
    const [x, y, z] = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
    if (Math.abs(x) < 0.15 && y > pelvis[1] - 0.12 && y < shoulder[1]) back = Math.min(back, z);
    if (Math.abs(x) < 0.12 && y > shoulder[1] - 0.2 && y < shoulder[1] - 0.06)
      chest = Math.max(chest, z);
  }
  // The drape adds a little at the seat (bench): 4 mm.
  return { backDepth: pelvis[2] - back + 0.004, chestFront: chest, seatDrop: 0.1 };
}
const clips = clipDefinitions(joints, measure(), {
  shoulderRhythm: true,
  rig,
  hands: { L: handModel(body, 'L'), R: handModel(body, 'R') },
});

const { glb: base } = exportGlb({
  variant: VARIANT,
  meshes: [],
  weights,
  source: new Int32Array(0),
  rest: joints,
  rig,
  clips,
  normalPng: null,
  copyright:
    'Prototype. Anatomy based on "Proxy Human base Mesh" by sphere_joe ' +
    '(https://sketchfab.com/mundane_x), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), ' +
    'modified for Kalethra; not endorsed by the author. Topology, face, hands, feet, skeleton: ' +
    'MakeHuman 1.x (CC0 1.0).',
  extras: {
    kalethra: {
      contract: 1,
      variant: VARIANT,
      units: 'metre',
      up: '+Y',
      front: '+Z',
      origin: 'floor, under the pelvis',
      prototype: {
        phase: '1A',
        views: ['skin', 'muscle'],
        morph: 'muscle',
        skinOnly: ['proto_hair', 'proto_drape'],
        generator: 'tools/figure-prototype',
      },
    },
  },
});

// ── Append body, components and materials ───────────────────────────────────────────────────
const { json, bin: baseBin } = readGlb(base);
// Called without a normal map, the production exporter still writes `normalTexture: { index:
// null }` into its skin and cloth materials (unused here): drop the dangling reference.
for (const m of json.materials)
  if (m.normalTexture && m.normalTexture.index == null) delete m.normalTexture;
const chunks = [baseBin];
let length = baseBin.length;
function view(array, target) {
  const pad = (4 - (length % 4)) % 4;
  if (pad) {
    chunks.push(new Uint8Array(pad));
    length += pad;
  }
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  json.bufferViews.push({
    buffer: 0,
    byteOffset: length,
    byteLength: bytes.length,
    ...(target ? { target } : {}),
  });
  chunks.push(bytes);
  length += bytes.length;
  return json.bufferViews.length - 1;
}
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function accessor(array, type, { target = 34962, minMax = false, normalized = false } = {}) {
  const componentType =
    array instanceof Float32Array
      ? 5126
      : array instanceof Uint32Array
        ? 5125
        : array instanceof Uint16Array
          ? 5123
          : 5121;
  const n = SIZE[type];
  const acc = { bufferView: view(array, target), componentType, count: array.length / n, type };
  if (normalized) acc.normalized = true;
  if (minMax) {
    const min = new Array(n).fill(Infinity);
    const max = new Array(n).fill(-Infinity);
    for (let i = 0; i < array.length; i++) {
      min[i % n] = Math.min(min[i % n], array[i]);
      max[i % n] = Math.max(max[i % n], array[i]);
    }
    acc.min = min.map(Math.fround);
    acc.max = max.map(Math.fround);
  }
  json.accessors.push(acc);
  return json.accessors.length - 1;
}
const linear = (hex) =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
const material = (name, hex, roughness, extra = {}) => {
  json.materials.push({
    name,
    pbrMetallicRoughness: {
      baseColorFactor: [...linear(hex), 1],
      metallicFactor: 0,
      roughnessFactor: roughness,
    },
    ...extra,
  });
  return json.materials.length - 1;
};
const mStone = material('stone', LOOK.stone.color, LOOK.stone.roughness);
const mDrape = material('drape', LOOK.cloth.color, LOOK.cloth.roughness);
const mEye = material('eye', LOOK.eyes.color, LOOK.eyes.roughness);
const fibrePng = readFileSync(join(B, metaB.fibreMap));
json.images ??= [];
json.textures ??= [];
json.samplers ??= [];
json.images.push({
  name: 'fibre_normal',
  mimeType: 'image/png',
  bufferView: view(new Uint8Array(fibrePng)),
});
json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 });
json.textures.push({ source: json.images.length - 1, sampler: json.samplers.length - 1 });
const mMuscle = material('stone_muscle', LOOK.stone.color, LOOK.stone.roughness, {
  normalTexture: { index: json.textures.length - 1, scale: LOOK.muscleView.fibreNormalScale },
});

const skinIndex = json.skins.findIndex((s) => s.name === 'kalethra_rig');
const rootNode = json.nodes.findIndex((n) => n.name === `kalethra_${VARIANT}`);
const children = json.nodes[rootNode].children;
let triangles = 0;

// Per corner (uv index) attributes of the body.
const trisUv = arrB.trisUv;
const cornerVertex = new Int32Array(arrB.uvs.length / 2).fill(-1);
for (let i = 0; i < tris.length; i++) cornerVertex[trisUv[i]] = tris[i];
const muscle = arrB.muscle;
const regions = metaB.regions;
const triRegion = arrB.triRegion;
const nodeName = (label) =>
  label.startsWith('skin_') ? `body_${label.slice(5)}` : `muscle_${label}`;

function skinAttributes(vertexOf, n) {
  const J = new Uint8Array(n * 4);
  const W = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = vertexOf(i);
    let sum = 0;
    let largest = 0;
    for (let k = 0; k < 4; k++) {
      J[i * 4 + k] = weightJoints[v * 4 + k];
      W[i * 4 + k] = Math.round(weightValues[v * 4 + k] * 255);
      sum += W[i * 4 + k];
      if (W[i * 4 + k] > W[i * 4 + largest]) largest = k;
    }
    W[i * 4 + largest] += 255 - sum;
  }
  return { J, W };
}

regions.forEach((label, r) => {
  const corners = new Map();
  const list = [];
  const index = [];
  for (let t = 0; t < triRegion.length; t++) {
    if (triRegion[t] !== r) continue;
    for (let k = 0; k < 3; k++) {
      const c = trisUv[t * 3 + k];
      let i = corners.get(c);
      if (i === undefined) {
        i = list.length;
        corners.set(c, i);
        list.push(c);
      }
      index.push(i);
    }
  }
  const n = list.length;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const dPos = new Float32Array(n * 3);
  const dNor = new Float32Array(n * 3);
  const tan = new Float32Array(n * 4);
  const uv = new Float32Array(n * 2);
  const g4 = new Uint8Array(n * 4);
  const w4 = new Uint8Array(n * 4);
  list.forEach((c, i) => {
    const v = cornerVertex[c];
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = arrB.skin[v * 3 + k];
      nor[i * 3 + k] = arrB.skinNormals[v * 3 + k];
      dPos[i * 3 + k] = muscle[v * 3 + k] - arrB.skin[v * 3 + k];
      dNor[i * 3 + k] = arrB.muscleNormals[v * 3 + k] - arrB.skinNormals[v * 3 + k];
      tan[i * 4 + k] = arrB.tangents[c * 3 + k];
    }
    tan[i * 4 + 3] = 1;
    uv[i * 2] = arrB.uvs[c * 2];
    uv[i * 2 + 1] = 1 - arrB.uvs[c * 2 + 1];
    for (let k = 0; k < 4; k++) {
      g4[i * 4 + k] = arrB.groups4[v * 4 + k];
      w4[i * 4 + k] = arrB.weights4[v * 4 + k];
    }
  });
  const { J, W } = skinAttributes((i) => cornerVertex[list[i]], n);
  triangles += index.length / 3;
  const indices = n < 65536 ? Uint16Array.from(index) : Uint32Array.from(index);
  const primitive = {
    attributes: {
      POSITION: accessor(pos, 'VEC3', { minMax: true }),
      NORMAL: accessor(nor, 'VEC3'),
      TANGENT: accessor(tan, 'VEC4'),
      TEXCOORD_0: accessor(uv, 'VEC2'),
      JOINTS_0: accessor(J, 'VEC4'),
      WEIGHTS_0: accessor(W, 'VEC4', { normalized: true }),
      _MUSCLE_GROUPS: accessor(g4, 'VEC4'),
      _MUSCLE_WEIGHTS: accessor(w4, 'VEC4', { normalized: true }),
    },
    targets: [
      { POSITION: accessor(dPos, 'VEC3', { minMax: true }), NORMAL: accessor(dNor, 'VEC3') },
    ],
    indices: accessor(indices, 'SCALAR', { target: 34963 }),
    material: mStone,
  };
  const name = nodeName(label);
  json.meshes.push({
    name,
    primitives: [primitive],
    weights: [0],
    extras: { targetNames: ['muscle'] },
  });
  json.nodes.push({ name, mesh: json.meshes.length - 1, skin: skinIndex });
  children.push(json.nodes.length - 1);
});

// Components.
const headJoint = names.indexOf('head');
for (const [name, spec] of Object.entries(metaB.components)) {
  const P = read(B, spec.positions);
  const N = read(B, spec.normals);
  const T = read(B, spec.tris);
  const n = P.length / 3;
  let J;
  let W;
  if (spec.src) {
    const src = read(B, spec.src);
    ({ J, W } = skinAttributes((i) => src[i], n));
  } else {
    J = new Uint8Array(n * 4);
    W = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      J[i * 4] = headJoint;
      W[i * 4] = 255;
    }
  }
  triangles += T.length / 3;
  const indices = n < 65536 ? Uint16Array.from(T) : Uint32Array.from(T);
  const mat = name === 'drape' ? mDrape : name.startsWith('eye') ? mEye : mStone;
  json.meshes.push({
    name: `proto_${name}`,
    primitives: [
      {
        attributes: {
          POSITION: accessor(P, 'VEC3', { minMax: true }),
          NORMAL: accessor(N, 'VEC3'),
          JOINTS_0: accessor(J, 'VEC4'),
          WEIGHTS_0: accessor(W, 'VEC4', { normalized: true }),
        },
        indices: accessor(indices, 'SCALAR', { target: 34963 }),
        material: mat,
      },
    ],
  });
  json.nodes.push({ name: `proto_${name}`, mesh: json.meshes.length - 1, skin: skinIndex });
  children.push(json.nodes.length - 1);
}
json.nodes[rootNode].extras = {
  ...(json.nodes[rootNode].extras ?? {}),
  muscleGroups: metaB.groups,
  prototypeMaterials: { muscle: mMuscle },
};

const bin = new Uint8Array(length);
let offset = 0;
for (const c of chunks) {
  bin.set(c, offset);
  offset += c.length;
}
json.buffers[0].byteLength = bin.length;
const glb = writeGlb({ json, bin });
writeFileSync(OUT, glb);
console.log(
  `prototype: ${(glb.length / 1048576).toFixed(2)} MiB, ${triangles} body triangles (+ props), ` +
    `${regions.length} regions, ${clips.length} clips → ${OUT}`,
);
