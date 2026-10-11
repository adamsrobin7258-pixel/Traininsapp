/**
 * Prototype stage A – the male body as a closed surface with a realistic head.
 *
 *   MAKEHUMAN_DATA=… WORK=<dir> node tools/figure-prototype/stage-a.mjs
 *
 * Differs from the production assembly (tools/figures/lib/assemble.mjs, unchanged) in three
 * points: the head keeps MakeHuman's face (no `smoothHead`), the trunk and limbs get a second
 * Catmull-Clark step (finer muscle borders), and no clothing layer is cut – every face is skin,
 * so the body is closed under the former top and shorts. The modelled anatomy is transferred as
 * in production (lib/transfer.mjs); afterwards the head is put back to MakeHuman's face, fitted
 * as a whole onto the transferred head (similarity transform), and the eye and hair helpers of
 * the MakeHuman base mesh follow it.
 *
 * Writes WORK/body.json (meta) and WORK/*.bin (arrays) for stage B (Python).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources } from '../figures/lib/assemble.mjs';
import { neighbours, poseMatrices, restPose, skin, twistForearms } from '../figures/lib/pose.mjs';
import { FINGER_BONE, rigFor, rigJoints, rigWeights } from '../figures/lib/rig.mjs';
import { buildShape } from '../figures/lib/shape.mjs';
import { relaxHands } from '../figures/lib/hands.mjs';
import { subdivideBody } from '../figures/lib/subdivide.mjs';
import { readSculpt, sculptRegions, transferAnatomy } from '../figures/lib/transfer.mjs';
import { refineHands } from '../figures/lib/handform.mjs';
import { segmentBody, smoothBorders } from '../figures/lib/segment.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = process.env.MAKEHUMAN_DATA;
const WORK = process.env.WORK;
if (!DATA || !WORK) {
  console.error('Set MAKEHUMAN_DATA (MakeHuman 1.x data folder) and WORK (output folder).');
  process.exit(1);
}
const VARIANT = 'male';
/** Same arm-hole spec as production – only used by the segmentation's rules, no clothing here. */
const ARMHOLE = { x: 1.0, width: 0.085, drop: 0.035, depth: 0.16, neckBack: 0.07 };

const started = Date.now();
const log = (msg) => console.log(`[A ${((Date.now() - started) / 1000).toFixed(0)}s] ${msg}`);

// ── 1. Shape and rest pose (production steps, without the featureless head) ──────────────────
const sources = loadSources(DATA);
const { mesh, skeleton, mhWeights } = sources;
const bodyFaces = mesh.faces.filter((f) => f.group === 'body');
const shaped = relaxHands(buildShape(DATA, mesh, VARIANT), skeleton, mhWeights);
const rig = rigFor(VARIANT);
const { joints, tail } = rigJoints(skeleton, shaped, rig);
const weights = rigWeights(skeleton, mhWeights, shaped.length / 3, rig);
const { world, heads } = poseMatrices(joints, restPose(joints, tail), rig);
let positions = skin(shaped, weights, world);
positions = twistForearms(positions, weights, heads, Number(process.env.TWIST ?? 10));
let minY = Infinity;
for (const f of bodyFaces) for (const v of f.v) minY = Math.min(minY, positions[v * 3 + 1]);
const hipL = heads.get('thigh_L');
const hipR = heads.get('thigh_R');
const shift = [-(hipL[0] + hipR[0]) / 2, -minY, -(hipL[2] + hipR[2]) / 2];
for (let i = 0; i < positions.length; i += 3) {
  positions[i] += shift[0];
  positions[i + 1] += shift[1];
  positions[i + 2] += shift[2];
}
const posedJoints = new Map(
  [...heads].map(([name, p]) => [
    name,
    name === 'root' ? [0, 0, 0] : [p[0] + shift[0], p[1] + shift[1], p[2] + shift[2]],
  ]),
);
log('shape and rest pose');

// Helper meshes of the base mesh that the prototype uses (eyes, hair cap), in the same pose.
const helperGroups = ['helper-l-eye', 'helper-r-eye', 'helper-hair'];
const helpers = Object.fromEntries(
  helperGroups.map((group) => {
    const faces = mesh.faces.filter((f) => f.group === group);
    const verts = [...new Set(faces.flatMap((f) => f.v))].sort((a, b) => a - b);
    const local = new Map(verts.map((v, i) => [v, i]));
    return [
      group,
      {
        positions: Float64Array.from(
          verts.flatMap((v) => [0, 1, 2].map((c) => positions[v * 3 + c])),
        ),
        faces: faces.map((f) => f.v.map((v) => local.get(v))),
        source: verts,
      },
    ];
  }),
);

// ── 2. First subdivision step on trunk and limbs (as production) ─────────────────────────────
const dense = new Set(
  weights.names
    .map((n, i) => (/^(head|hand_[LR]|foot_[LR])$/.test(n) || FINGER_BONE.test(n) ? i : -1))
    .filter((i) => i >= 0),
);
const outsideDense = (w) => (f) => f.v.every((v) => !dense.has(w.joints[v * 4]));
// The transfer is tuned to the production density (one step); the second step follows after
// it (section 4b) – snapping a finer mesh onto the sculpt folds the back.
let body = subdivideBody(
  { positions, faces: bodyFaces, used: [], weights, joints: posedJoints, uvs: mesh.uvs },
  outsideDense(weights),
);
log(`subdivided: ${body.used.length} vertices, ${body.faces.length} faces`);
const preTransfer = Float64Array.from(body.positions);

// ── 3. Modelled anatomy (production transfer and hand refinement) ─────────────────────────────
const sculpt = readSculpt(join(ROOT, 'assets/figure/male/source/kalethra-male-sculpt.bin.gz'));
body = refineHands(transferAnatomy(body, sculpt));
log('anatomy transferred');

// ── 4. MakeHuman's face back: similarity fit of the original head onto the transferred one ────
const headIndex = body.weights.names.indexOf('head');
const headShare = new Float64Array(body.positions.length / 3);
for (const v of body.used)
  for (let k = 0; k < 4; k++)
    if (body.weights.joints[v * 4 + k] === headIndex)
      headShare[v] += body.weights.weights[v * 4 + k];
const fullHead = body.used.filter((v) => headShare[v] > 0.99);
const similarity = fitSimilarity(
  fullHead.map((v) => [0, 1, 2].map((c) => preTransfer[v * 3 + c])),
  fullHead.map((v) => [0, 1, 2].map((c) => body.positions[v * 3 + c])),
);
const apply = (p) => {
  const { s, R, t } = similarity;
  return [0, 1, 2].map((r) => s * (R[r][0] * p[0] + R[r][1] * p[1] + R[r][2] * p[2]) + t[r]);
};
const faceKept = new Float64Array(body.positions.length / 3);
for (const v of body.used) {
  // Full face where the head owns the vertex; the neck seam keeps the transferred form.
  const x = Math.min(1, Math.max(0, (headShare[v] - 0.55) / 0.4));
  const w = x * x * (3 - 2 * x);
  if (!w) continue;
  faceKept[v] = w;
  const q = apply([0, 1, 2].map((c) => preTransfer[v * 3 + c]));
  for (let c = 0; c < 3; c++)
    body.positions[v * 3 + c] = (1 - w) * body.positions[v * 3 + c] + w * q[c];
}
for (const helper of Object.values(helpers)) {
  for (let i = 0; i < helper.positions.length; i += 3) {
    // Helpers hang on the shaped, posed MakeHuman mesh; the transfer moved the floor (minY).
    const q = apply([helper.positions[i], helper.positions[i + 1], helper.positions[i + 2]]);
    helper.positions.set(q, i);
  }
}
log(`face kept (similarity scale ${similarity.s.toFixed(4)})`);

// ── 4b. Second subdivision step on trunk and limbs, after the transfer ───────────────────────
// Per-vertex data of the coarse mesh (relief weight, kept face) goes to stage B as is; stage B
// maps it onto the fine vertices by proximity and projects the fine mesh onto the sculpt.
const coarse = {
  positions: Float64Array.from(body.positions),
  used: Int32Array.from(body.used),
  detail: Float64Array.from(body.detail),
  faceKept: Float64Array.from(faceKept),
};
if (Number(process.env.SUBDIV_LEVELS ?? 2) > 1) {
  // Everything this time, head, hands and feet included (smoother face, fingers and hair line).
  body = subdivideBody(body, () => true);
  log(`second step: ${body.used.length} vertices, ${body.faces.length} faces`);
}

// ── 5. Regions (production segmentation, sculpt labels); no clothing layer ────────────────────
const { labels, layers: clothing } = segmentBody(body, {
  armhole: ARMHOLE,
  region: sculptRegions(sculpt),
});
// Every face stays skin; the production clothing layers are only passed on as a hint (stage B
// derives the drape's region from the former shorts).
const layers = labels.map(() => 'skin');
smoothBorders(body, labels, layers, 4, { foldSafe: true });
log('segmented');

// ── 6. Dump ───────────────────────────────────────────────────────────────────────────────────
mkdirSync(WORK, { recursive: true });
const bin = (name, array) => {
  writeFileSync(join(WORK, name), Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  return { file: name, type: array.constructor.name, length: array.length };
};
const faceOffsets = new Int32Array(body.faces.length + 1);
body.faces.forEach((f, i) => (faceOffsets[i + 1] = faceOffsets[i] + f.v.length));
const faceVerts = Int32Array.from(body.faces.flatMap((f) => f.v));
const faceUvs = Int32Array.from(body.faces.flatMap((f) => f.t));
const regionNames = [...new Set(labels)].sort();
const meta = {
  variant: VARIANT,
  rig: rig.map(([name, parent]) => [name, parent]),
  jointNames: body.weights.names,
  joints: Object.fromEntries([...body.joints].map(([n, p]) => [n, [...p]])),
  regionNames,
  arrays: {
    positions: bin('positions.f64', Float64Array.from(body.positions)),
    uvs: bin('uvs.f64', Float64Array.from(body.uvs)),
    used: bin('used.i32', Int32Array.from(body.used)),
    faceOffsets: bin('faceOffsets.i32', faceOffsets),
    faceVerts: bin('faceVerts.i32', faceVerts),
    faceUvs: bin('faceUvs.i32', faceUvs),
    faceRegion: bin('faceRegion.i32', Int32Array.from(labels.map((l) => regionNames.indexOf(l)))),
    faceShorts: bin(
      'faceShorts.u8',
      Uint8Array.from(clothing.map((l) => (l === 'shorts' ? 1 : 0))),
    ),
    weightJoints: bin('weightJoints.u8', Uint8Array.from(body.weights.joints)),
    weightValues: bin('weightValues.f32', Float32Array.from(body.weights.weights)),
    coarsePositions: bin('coarsePositions.f64', coarse.positions),
    coarseUsed: bin('coarseUsed.i32', coarse.used),
    coarseDetail: bin('coarseDetail.f64', coarse.detail),
    coarseFaceKept: bin('coarseFaceKept.f64', coarse.faceKept),
  },
  helpers: Object.fromEntries(
    Object.entries(helpers).map(([group, h]) => [
      group,
      {
        positions: bin(`${group}.positions.f64`, h.positions),
        faceOffsets: bin(
          `${group}.faceOffsets.i32`,
          Int32Array.from(h.faces.reduce((o, f) => [...o, o[o.length - 1] + f.length], [0])),
        ),
        faceVerts: bin(`${group}.faceVerts.i32`, Int32Array.from(h.faces.flat())),
        source: bin(`${group}.source.i32`, Int32Array.from(h.source)),
      },
    ]),
  ),
};
writeFileSync(join(WORK, 'body.json'), JSON.stringify(meta, null, 1));
log(`written to ${WORK}`);

/**
 * Least-squares similarity transform (scale, rotation, translation) mapping points A onto B
 * (Umeyama). Rotation by Horn's quaternion method – no matrix library needed.
 */
function fitSimilarity(A, B) {
  const n = A.length;
  const ca = [0, 1, 2].map((c) => A.reduce((s, p) => s + p[c], 0) / n);
  const cb = [0, 1, 2].map((c) => B.reduce((s, p) => s + p[c], 0) / n);
  const S = [0, 1, 2].map(() => [0, 0, 0]);
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const a = A[i].map((x, c) => x - ca[c]);
    const b = B[i].map((x, c) => x - cb[c]);
    va += a[0] ** 2 + a[1] ** 2 + a[2] ** 2;
    vb += b[0] ** 2 + b[1] ** 2 + b[2] ** 2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += a[r] * b[c];
  }
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  // Largest eigenvector by power iteration on a shifted matrix (positive definite).
  const shiftBy = 2 * Math.hypot(...S.flat()) + 1e-9;
  let q = [1, 0, 0, 0];
  for (let it = 0; it < 500; it++) {
    const next = N.map((row, r) => row.reduce((s, x, c) => s + x * q[c], 0) + shiftBy * q[r]);
    const l = Math.hypot(...next);
    q = next.map((x) => x / l);
  }
  const [w, x, y, z] = q;
  const R = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  const s = Math.sqrt(vb / va);
  const t = [0, 1, 2].map((r) => cb[r] - s * (R[r][0] * ca[0] + R[r][1] * ca[1] + R[r][2] * ca[2]));
  return { s, R, t };
}
