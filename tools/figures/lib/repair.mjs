/**
 * Surface repair of a finished body GLB (Phase A, version 0.31.0) – the last step of the build,
 * on the final, subdivided mesh. It fixes what the earlier steps leave behind, locally and only
 * where it is measured:
 *
 * - Fairing (male neck and upper trapezius, male rear shoulder/armpit): the fit to the sculpt
 *   (`transfer.mjs`) leaves wrinkles of a few millimetres where it snapped into concave places
 *   and where the head seam was blended; `relaxFolds` only repairs folds above 70° on the coarse
 *   mesh. Fairing moves skin vertices along their normal only (Taubin λ/μ, so volume and muscle
 *   shape stay; no tangential sliding, so the detail normal map stays in place), within a mask
 *   with soft edges, at most `MAX_SHIFT` per vertex.
 * - Unfolding (female head/neck): `smoothHead` (`pose.mjs`) moves neck vertices with a partial
 *   head weight radially onto the skull profile; behind the neck that direction runs almost
 *   along the skin, so neighbouring triangles slide over each other (a saw-tooth edge below the
 *   back of the head). Folded triangles there are relaxed until none is left.
 *
 * - Relief (male neck and rear shoulder): the detail normal map carries the sculpt's fine relief
 *   (`detailNormalField`); at the back of the neck and on the rear deltoid that relief is the
 *   sculpt's own crumpled surface, not muscle fibre. There it is faded towards flat to
 *   `RELIEF_KEEP` (skin texels inside the mask only; the fibre map elsewhere stays).
 *
 * - Neckline (both): the top's neck opening follows the polygon edges of the finer mesh at the
 *   neck (`BORDER_ITERATIONS_MODELLED` straightens it only a little, to avoid folds), a saw-tooth
 *   of a few millimetres that the 5 mm hem repeats. The seam chain is smoothed along itself
 *   (Taubin, so the opening keeps its size), stays on the skin, and the hem rim moves with it.
 *
 * Apart from the neckline, skin vertices on a seam with the clothing (hem) never move, so the
 * clothing keeps its shape and the surface stays closed. Stored normals and tangents of moved vertices are turned by the
 * change of the surface normal (hard edges and grooves keep their own normals); everything else
 * in the file stays byte for byte. Deterministic; a file carries `extras.kalethra.repair` and is
 * never repaired twice.
 */

import { decodePng, encodePng } from './png.mjs';

export const REPAIR_VERSION = 1;

/** Largest shift of a vertex by fairing (metres) – the form of the sculpt stays. */
export const MAX_SHIFT = 0.006;

/** Smooth step 0 → 1 between a and b. */
const ramp = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Masks per variant, from the bind positions of the joints (metres). Each returns a weight
 * 0 … 1 for a point.
 */
export const REPAIR_REGIONS = {
  /** Back and sides of the neck down to the upper trapezius, not the face or the skull. */
  neckBack: (J) => {
    const neck = J.neck;
    const head = J.head;
    const span = head[1] - neck[1];
    return ([x, y, z]) =>
      ramp(y, neck[1] - 0.09, neck[1] - 0.05) *
      (1 - ramp(y, head[1] - 0.15 * span, head[1] + 0.25 * span)) *
      (1 - ramp(z, neck[2] + 0.01, neck[2] + 0.045)) *
      (1 - ramp(Math.hypot(x - neck[0], z - neck[2]), 0.12, 0.16));
  },
  /** Behind the shoulder joint: rear deltoid, armpit fold and the top of the latissimus. */
  rearShoulder: (J) => {
    const sides = ['L', 'R'].map((s) => J[`upperArm_${s}`]);
    return ([x, y, z]) => {
      let w = 0;
      for (const a of sides) {
        const d = Math.hypot(x - a[0], y - a[1], z - a[2]);
        w = Math.max(w, (1 - ramp(d, 0.09, 0.13)) * (1 - ramp(z, a[2] + 0.0, a[2] + 0.03)));
      }
      return w;
    };
  },
  /** The top's neck opening (front and back), not the arm holes beside it. */
  neckline: (J) => {
    const neck = J.neck;
    return ([x, y, z]) =>
      ramp(y, neck[1] - 0.17, neck[1] - 0.13) *
      (1 - ramp(Math.hypot(x - neck[0], (z - neck[2]) * 0.6), 0.105, 0.125));
  },
  /** Around the shoulder joints, front and back: the armpit and the arm hole of the top. */
  armpit: (J) => {
    const sides = ['L', 'R'].map((s) => J[`upperArm_${s}`]);
    return ([x, y, z]) => {
      let w = 0;
      for (const a of sides)
        w = Math.max(w, 1 - ramp(Math.hypot(x - a[0], y - a[1], z - a[2]), 0.11, 0.14));
      return w;
    };
  },
  /**
   * Band where the head meets the neck, back and sides (folds are found inside it). Not the
   * face: there `smoothHead` leaves the old mouth and eye rims hidden just below the surface.
   */
  headNeck: (J) => {
    const neck = J.neck;
    const head = J.head;
    const span = head[1] - neck[1];
    return ([, y, z]) =>
      ramp(y, neck[1] - 0.2 * span, neck[1] + 0.1 * span) *
      (1 - ramp(y, head[1] + 0.25 * span, head[1] + 0.5 * span)) *
      (1 - ramp(z, neck[2] + 0.03, neck[2] + 0.07));
  },
};

/** Fairing rounds: enough for ripples of 2–4 cm (the neck's), too few to flatten a muscle. */
export const FAIR_ITERATIONS = 100;

/** What each body gets (variant → steps). */
export const REPAIR_PLAN = {
  male: {
    fair: ['neckBack', 'rearShoulder'],
    unfold: ['armpit'],
    relief: ['neckBack', 'rearShoulder'],
    neckline: true,
    iterations: FAIR_ITERATIONS,
  },
  female: {
    fair: ['neckBack'],
    unfold: ['headNeck', 'armpit'],
    relief: [],
    neckline: true,
    iterations: FAIR_ITERATIONS,
  },
};

/** Share of the detail relief kept inside a relief mask (1 = unchanged, 0 = flat). */
export const RELIEF_KEEP = 0.2;

// ── GLB access ────────────────────────────────────────────────────────────────────────────────

const ARRAY = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Parses a GLB into its JSON and a copy of the binary chunk. */
export function readGlb(bytes) {
  const data = new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(data.subarray(20, 20 + jsonLength)));
  const binLength = view.getUint32(20 + jsonLength, true);
  const bin = data.slice(28 + jsonLength, 28 + jsonLength + binLength);
  return { json, bin };
}

/** Writes JSON and binary chunk back into a GLB (same layout as `GltfBuilder`). */
export function writeGlb({ json, bin }) {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length + binPad;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  view.setUint32(20 + jsonBytes.length, bin.length + binPad, true);
  view.setUint32(24 + jsonBytes.length, 0x004e4942, true);
  out.set(bin, 28 + jsonBytes.length);
  return out;
}

/** A live typed-array view of an accessor inside `bin` (tightly packed views only). */
function accessorView(json, bin, index) {
  const a = json.accessors[index];
  const bv = json.bufferViews[a.bufferView];
  const Type = ARRAY[a.componentType];
  const n = SIZE[a.type];
  if (bv.byteStride && bv.byteStride !== n * Type.BYTES_PER_ELEMENT) {
    throw new Error('interleaved accessors are not supported');
  }
  const offset = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Type(bin.buffer, offset, a.count * n);
}

/** Bind positions of the joints (inverse bind matrices are pure translations in this rig). */
export function bindJoints(json, bin) {
  const skin = json.skins[0];
  const ibm = accessorView(json, bin, skin.inverseBindMatrices);
  const out = {};
  skin.joints.forEach((node, k) => {
    out[json.nodes[node].name] = [-ibm[k * 16 + 12], -ibm[k * 16 + 13], -ibm[k * 16 + 14]];
  });
  return out;
}

// ── Welded surface ───────────────────────────────────────────────────────────────────────────

/**
 * The body surface over all body primitives (not the props), vertices merged by position
 * (0.1 mm): the clothing hem and the region borders are shared vertices, so moving one moves
 * every copy.
 */
export function weldBody(json, bin) {
  const ids = new Map();
  const positions = [];
  const refs = [];
  const materials = [];
  const faces = [];
  const faceMaterial = [];
  const prims = [];
  json.nodes.forEach((node) => {
    if (node.mesh === undefined || node.name.startsWith('prop_')) return;
    for (const primitive of json.meshes[node.mesh].primitives) {
      const material = json.materials[primitive.material].name;
      const P = accessorView(json, bin, primitive.attributes.POSITION);
      const I = accessorView(json, bin, primitive.indices);
      const prim = {
        primitive,
        material,
        P,
        N: accessorView(json, bin, primitive.attributes.NORMAL),
        T:
          primitive.attributes.TANGENT !== undefined
            ? accessorView(json, bin, primitive.attributes.TANGENT)
            : null,
      };
      prims.push(prim);
      const local = new Int32Array(P.length / 3);
      for (let i = 0; i < local.length; i++) {
        const key = `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
        let id = ids.get(key);
        if (id === undefined) {
          id = positions.length / 3;
          ids.set(key, id);
          positions.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
          refs.push([]);
          materials.push(new Set());
        }
        local[i] = id;
        refs[id].push([prim, i]);
        materials[id].add(material);
      }
      for (let t = 0; t < I.length; t += 3) {
        faces.push(local[I[t]], local[I[t + 1]], local[I[t + 2]]);
        faceMaterial.push(material);
      }
    }
  });
  const count = positions.length / 3;
  const neighbours = Array.from({ length: count }, () => new Set());
  const vertexFaces = Array.from({ length: count }, () => []);
  for (let f = 0; f < faces.length / 3; f++) {
    const [a, b, c] = [faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]];
    neighbours[a].add(b).add(c);
    neighbours[b].add(a).add(c);
    neighbours[c].add(a).add(b);
    vertexFaces[a].push(f);
    vertexFaces[b].push(f);
    vertexFaces[c].push(f);
  }
  return {
    count,
    positions: Float64Array.from(positions),
    refs,
    materials,
    faces: Int32Array.from(faces),
    faceMaterial,
    neighbours: neighbours.map((s) => [...s].sort((x, y) => x - y)),
    vertexFaces,
    prims,
  };
}

/** Unit normal and area of a face. */
export function faceNormal(surface, f, P = surface.positions) {
  const [a, b, c] = [
    surface.faces[f * 3] * 3,
    surface.faces[f * 3 + 1] * 3,
    surface.faces[f * 3 + 2] * 3,
  ];
  const ux = P[b] - P[a];
  const uy = P[b + 1] - P[a + 1];
  const uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a];
  const vy = P[c + 1] - P[a + 1];
  const vz = P[c + 2] - P[a + 2];
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1e-12;
  return [x / l, y / l, z / l, l / 2];
}

/** Area-weighted normal of a vertex over its faces (optionally of one material only). */
export function vertexNormal(surface, v, P = surface.positions, material = null) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const f of surface.vertexFaces[v]) {
    if (material && surface.faceMaterial[f] !== material) continue;
    const n = faceNormal(surface, f, P);
    x += n[0] * n[3];
    y += n[1] * n[3];
    z += n[2] * n[3];
  }
  const l = Math.hypot(x, y, z) || 1e-12;
  return [x / l, y / l, z / l];
}

/**
 * Faces turned against their own corners: the face normal points away from the mean normal of
 * its three vertices (dot below `limit`). On a smooth surface there are none; the turned-in hem
 * of the clothing is a deliberate fold, so only skin faces count.
 */
export function foldedSkinFaces(surface, P = surface.positions, limit = 0.2, within = null) {
  const out = [];
  for (let f = 0; f < surface.faces.length / 3; f++) {
    if (surface.faceMaterial[f] !== 'skin') continue;
    const corners = [surface.faces[f * 3], surface.faces[f * 3 + 1], surface.faces[f * 3 + 2]];
    if (within && !corners.some((v) => within[v] > 0)) continue;
    const n = faceNormal(surface, f, P);
    let dot = 0;
    for (const v of corners) {
      const m = vertexNormal(surface, v, P, 'skin');
      dot += n[0] * m[0] + n[1] * m[1] + n[2] * m[2];
    }
    if (dot / 3 < limit) out.push(f);
  }
  return out;
}

/** Skin vertex that may move: skin only, not on a seam with the clothing. */
const movable = (surface, v) => surface.materials[v].size === 1 && surface.materials[v].has('skin');

// ── Steps ────────────────────────────────────────────────────────────────────────────────────

/** Mask weight per vertex for the given region names (movable skin, or any skin vertex). */
function mask(surface, joints, names, anySkin = false) {
  const fns = names.map((name) => REPAIR_REGIONS[name](joints));
  const P = surface.positions;
  const out = new Float64Array(surface.count);
  for (let v = 0; v < surface.count; v++) {
    if (anySkin ? !surface.materials[v].has('skin') : !movable(surface, v)) continue;
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    for (const fn of fns) out[v] = Math.max(out[v], fn(p));
  }
  return out;
}

/**
 * Normal-only Taubin fairing inside `weight`: removes ripples of a few edge lengths, keeps the
 * larger form (muscles) and the volume, and never slides vertices along the surface.
 */
export function fair(surface, weight, { iterations = 14, lambda = 0.55, mu = -0.58 } = {}) {
  const start = Float64Array.from(surface.positions);
  let P = surface.positions;
  const active = [];
  for (let v = 0; v < surface.count; v++) if (weight[v] > 0) active.push(v);
  for (let it = 0; it < iterations; it++) {
    for (const step of [lambda, mu]) {
      const next = Float64Array.from(P);
      for (const v of active) {
        const nb = surface.neighbours[v];
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const u of nb) {
          cx += P[u * 3];
          cy += P[u * 3 + 1];
          cz += P[u * 3 + 2];
        }
        cx = cx / nb.length - P[v * 3];
        cy = cy / nb.length - P[v * 3 + 1];
        cz = cz / nb.length - P[v * 3 + 2];
        const n = vertexNormal(surface, v, P, 'skin');
        const along = (cx * n[0] + cy * n[1] + cz * n[2]) * step * weight[v];
        next[v * 3] += along * n[0];
        next[v * 3 + 1] += along * n[1];
        next[v * 3 + 2] += along * n[2];
      }
      P = next;
    }
  }
  // Never more than MAX_SHIFT from where the build put it.
  for (const v of active) {
    const d = [0, 1, 2].map((c) => P[v * 3 + c] - start[v * 3 + c]);
    const l = Math.hypot(...d);
    if (l > MAX_SHIFT)
      for (let c = 0; c < 3; c++) P[v * 3 + c] = start[v * 3 + c] + (d[c] * MAX_SHIFT) / l;
  }
  surface.positions = P;
}

/**
 * Relaxes folded skin faces inside `weight`: their corners and one ring around them move
 * towards their neighbours' centre (along the surface too – a fold cannot open otherwise)
 * until no folded face is left, at most `rounds` times.
 */
export function unfold(surface, weight, { rounds = 40, passes = 4, rate = 0.5 } = {}) {
  let P = surface.positions;
  let remaining = foldedSkinFaces(surface, P, 0.2, weight).length;
  for (let round = 0; round < rounds && remaining > 0; round++) {
    const marked = new Uint8Array(surface.count);
    for (const f of foldedSkinFaces(surface, P, 0.2, weight)) {
      for (let k = 0; k < 3; k++) {
        const v = surface.faces[f * 3 + k];
        marked[v] = 1;
        for (const u of surface.neighbours[v]) marked[u] = 1;
      }
    }
    for (let pass = 0; pass < passes; pass++) {
      const next = Float64Array.from(P);
      for (let v = 0; v < surface.count; v++) {
        if (!marked[v] || !movable(surface, v) || weight[v] <= 0) continue;
        const nb = surface.neighbours[v];
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (const u of nb) sum += P[u * 3 + c];
          next[v * 3 + c] += rate * (sum / nb.length - P[v * 3 + c]);
        }
      }
      P = next;
    }
    remaining = foldedSkinFaces(surface, P, 0.2, weight).length;
  }
  surface.positions = P;
  return remaining;
}

/**
 * Straightens the seam between skin and clothing inside `weight`: each seam vertex moves
 * towards the centre of its seam neighbours (Taubin λ/μ, the loop keeps its length), only in the
 * skin's tangent plane, at most `limit`; the clothing vertices next to the seam (the hem rim)
 * take the mean shift of their seam vertices, so the hem keeps its width.
 */
export function straightenSeam(
  surface,
  weight,
  { iterations = 40, lambda = 0.5, mu = -0.53, limit = 0.009 } = {},
) {
  const isSeam = (v) => surface.materials[v].size > 1;
  const chain = [];
  for (let v = 0; v < surface.count; v++) if (isSeam(v) && weight[v] > 0) chain.push(v);
  const start = Float64Array.from(surface.positions);
  let P = surface.positions;
  for (let it = 0; it < iterations; it++) {
    for (const step of [lambda, mu]) {
      const next = Float64Array.from(P);
      for (const v of chain) {
        const nb = surface.neighbours[v].filter(isSeam);
        if (nb.length < 2) continue;
        const d = [0, 1, 2].map((c) => {
          let sum = 0;
          for (const u of nb) sum += P[u * 3 + c];
          return sum / nb.length - P[v * 3 + c];
        });
        const n = vertexNormal(surface, v, P, 'skin');
        const along = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
        for (let c = 0; c < 3; c++) next[v * 3 + c] += step * weight[v] * (d[c] - along * n[c]);
      }
      P = next;
    }
  }
  const shift = new Map();
  for (const v of chain) {
    const d = [0, 1, 2].map((c) => P[v * 3 + c] - start[v * 3 + c]);
    const l = Math.hypot(...d);
    const k = l > limit ? limit / l : 1;
    for (let c = 0; c < 3; c++) P[v * 3 + c] = start[v * 3 + c] + d[c] * k;
    shift.set(
      v,
      d.map((x) => x * k),
    );
  }
  for (let v = 0; v < surface.count; v++) {
    if (isSeam(v) || !surface.materials[v].has('cloth')) continue;
    const from = surface.neighbours[v].filter((u) => shift.has(u));
    if (!from.length) continue;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (const u of from) sum += shift.get(u)[c];
      P[v * 3 + c] = start[v * 3 + c] + sum / from.length;
    }
  }
  surface.positions = P;
  return chain.length;
}

/** Shortest rotation of unit vector a onto unit vector b, applied to v (Rodrigues). */
function rotate(a, b, v) {
  const k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const s = Math.hypot(...k);
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (s < 1e-9) return v;
  const u = k.map((x) => x / s);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + cross[i] * s + u[i] * dot * (1 - c));
}

/** Writes moved positions into every primitive, turns normals and tangents with the surface. */
function writeBack(surface, original) {
  const P = surface.positions;
  const moved = new Uint8Array(surface.count);
  for (let v = 0; v < surface.count; v++) {
    for (let c = 0; c < 3; c++) {
      if (Math.fround(P[v * 3 + c]) !== Math.fround(original[v * 3 + c])) moved[v] = 1;
    }
  }
  // Normals change on moved vertices and their neighbours.
  const touched = Uint8Array.from(moved);
  for (let v = 0; v < surface.count; v++)
    if (moved[v]) for (const u of surface.neighbours[v]) touched[u] = 1;
  const primsTouched = new Set();
  for (let v = 0; v < surface.count; v++) {
    if (!touched[v]) continue;
    const turn = new Map();
    for (const [prim, i] of surface.refs[v]) {
      if (moved[v]) {
        for (let c = 0; c < 3; c++) prim.P[i * 3 + c] = P[v * 3 + c];
        primsTouched.add(prim);
      }
      if (!turn.has(prim.material)) {
        turn.set(prim.material, [
          vertexNormal(surface, v, original, prim.material),
          vertexNormal(surface, v, P, prim.material),
        ]);
      }
      const [before, after] = turn.get(prim.material);
      const n = rotate(before, after, [prim.N[i * 3], prim.N[i * 3 + 1], prim.N[i * 3 + 2]]);
      const ln = Math.hypot(...n) || 1;
      for (let c = 0; c < 3; c++) prim.N[i * 3 + c] = n[c] / ln;
      if (prim.T) {
        let t = rotate(before, after, [prim.T[i * 4], prim.T[i * 4 + 1], prim.T[i * 4 + 2]]);
        // Gram-Schmidt against the stored normal, handedness (w) unchanged.
        const nn = [prim.N[i * 3], prim.N[i * 3 + 1], prim.N[i * 3 + 2]];
        const d = t[0] * nn[0] + t[1] * nn[1] + t[2] * nn[2];
        t = t.map((x, c) => x - d * nn[c]);
        const lt = Math.hypot(...t) || 1;
        for (let c = 0; c < 3; c++) prim.T[i * 4 + c] = t[c] / lt;
      }
    }
  }
  return { moved: moved.reduce((s, x) => s + x, 0), prims: primsTouched };
}

/** Accessor bounds (required for POSITION) after the change. */
function updateBounds(json, prims) {
  for (const prim of prims) {
    const accessor = json.accessors[prim.primitive.attributes.POSITION];
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < prim.P.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], prim.P[i + c]);
        max[c] = Math.max(max[c], prim.P[i + c]);
      }
    }
    accessor.min = min;
    accessor.max = max;
  }
}

/**
 * Fades the detail normal map towards flat (tangent space 0, 0, 1) on the skin texels inside
 * `weight` (per vertex, interpolated over each skin triangle in UV space; one texel of margin
 * so filtering does not bring the old relief back at the edges). Returns the new PNG or null.
 */
function fadeRelief(json, bin, surface, weight, keep) {
  const material = json.materials.find((m) => m.name === 'skin');
  const textureIndex = material?.normalTexture?.index;
  if (textureIndex === undefined) return null;
  const image = json.images[json.textures[textureIndex].source];
  const view = json.bufferViews[image.bufferView];
  const png = decodePng(
    bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength),
  );
  const { width, height, channels, pixels } = png;
  const fade = new Float64Array(width * height);
  // Per-vertex weight for every skin primitive vertex (via its welded vertex).
  const vertexWeight = new Map();
  for (let v = 0; v < surface.count; v++) {
    if (weight[v] <= 0) continue;
    for (const [prim, i] of surface.refs[v]) {
      if (prim.material !== 'skin') continue;
      if (!vertexWeight.has(prim)) vertexWeight.set(prim, new Map());
      vertexWeight.get(prim).set(i, weight[v]);
    }
  }
  for (const [prim, weights] of vertexWeight) {
    const uv = accessorView(json, bin, prim.primitive.attributes.TEXCOORD_0);
    const I = accessorView(json, bin, prim.primitive.indices);
    for (let t = 0; t < I.length; t += 3) {
      const corners = [I[t], I[t + 1], I[t + 2]];
      const w = corners.map((i) => weights.get(i) ?? 0);
      if (!w.some((x) => x > 0)) continue;
      const px = corners.map((i) => uv[i * 2] * width - 0.5);
      const py = corners.map((i) => uv[i * 2 + 1] * height - 0.5);
      const x0 = Math.max(0, Math.floor(Math.min(...px)) - 1);
      const x1 = Math.min(width - 1, Math.ceil(Math.max(...px)) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(...py)) - 1);
      const y1 = Math.min(height - 1, Math.ceil(Math.max(...py)) + 1);
      const area = (px[1] - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (py[1] - py[0]);
      if (Math.abs(area) < 1e-12) continue;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          // Barycentric weights, clamped: texels just outside the triangle take the edge value.
          let b1 = ((x - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (y - py[0])) / area;
          let b2 = ((px[1] - px[0]) * (y - py[0]) - (x - px[0]) * (py[1] - py[0])) / area;
          let b0 = 1 - b1 - b2;
          const outside = Math.min(b0, b1, b2);
          if (outside < -1.5 / Math.sqrt(Math.abs(area))) continue;
          b0 = Math.max(0, b0);
          b1 = Math.max(0, b1);
          b2 = Math.max(0, b2);
          const sum = b0 + b1 + b2 || 1;
          const value = (b0 * w[0] + b1 * w[1] + b2 * w[2]) / sum;
          fade[y * width + x] = Math.max(fade[y * width + x], value);
        }
      }
    }
  }
  let changed = false;
  for (let k = 0; k < width * height; k++) {
    if (fade[k] <= 0) continue;
    const s = 1 - fade[k] * (1 - keep);
    const o = k * channels;
    const n = [0, 1, 2].map((c) => (pixels[o + c] / 255) * 2 - 1);
    const m = [n[0] * s, n[1] * s, n[2] * s + (1 - s)];
    const l = Math.hypot(...m) || 1;
    for (let c = 0; c < 3; c++) {
      const value = Math.round(((m[c] / l + 1) / 2) * 255);
      if (value !== pixels[o + c]) changed = true;
      pixels[o + c] = value;
    }
  }
  return changed ? { image, png: encodePng(width, height, pixels, channels) } : null;
}

/** Rebuilds the binary chunk with one buffer view replaced (offsets 4-byte aligned again). */
function replaceView(json, bin, viewIndex, bytes) {
  const parts = [];
  let length = 0;
  json.bufferViews.forEach((view, index) => {
    const data =
      index === viewIndex
        ? bytes
        : bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const pad = (4 - (length % 4)) % 4;
    length += pad;
    parts.push([length, data]);
    view.byteOffset = length;
    view.byteLength = data.length;
    length += data.length;
  });
  const out = new Uint8Array(length + ((4 - (length % 4)) % 4));
  for (const [offset, data] of parts) out.set(data, offset);
  json.buffers[0].byteLength = out.length;
  return out;
}

/**
 * Repairs a body GLB (bytes) of `variant` and returns the new bytes and a report. A file that
 * already carries the current repair is returned unchanged.
 */
export function repairBody(bytes, variant) {
  const glb = readGlb(bytes);
  const kalethra = glb.json.asset?.extras?.kalethra;
  if (kalethra?.repair?.version === REPAIR_VERSION) {
    return { glb: new Uint8Array(bytes), report: { skipped: true } };
  }
  const plan = REPAIR_PLAN[variant];
  if (!plan) throw new Error(`no repair plan for ${variant}`);
  const joints = bindJoints(glb.json, glb.bin);
  const surface = weldBody(glb.json, glb.bin);
  const original = Float64Array.from(surface.positions);
  const report = { variant };
  if (plan.neckline) {
    const weight = new Float64Array(surface.count);
    const fn = REPAIR_REGIONS.neckline(joints);
    for (let v = 0; v < surface.count; v++) {
      weight[v] = fn([
        surface.positions[v * 3],
        surface.positions[v * 3 + 1],
        surface.positions[v * 3 + 2],
      ]);
    }
    report.necklineSeam = straightenSeam(surface, weight);
  }
  if (plan.fair.length) {
    fair(surface, mask(surface, joints, plan.fair), { iterations: plan.iterations });
  }
  // Unfolding last: it also opens folds the fairing may have sharpened.
  if (plan.unfold.length) {
    const weight = mask(surface, joints, plan.unfold);
    report.foldedBefore = foldedSkinFaces(surface, original, 0.2, weight).length;
    report.foldedAfter = unfold(surface, weight);
  }
  const { moved, prims } = writeBack(surface, original);
  updateBounds(glb.json, prims);
  if (plan.relief.length) {
    const faded = fadeRelief(
      glb.json,
      glb.bin,
      surface,
      mask(surface, joints, plan.relief, true),
      RELIEF_KEEP,
    );
    if (faded) {
      glb.bin = replaceView(glb.json, glb.bin, faded.image.bufferView, faded.png);
      report.reliefFaded = true;
    }
  }
  report.movedVertices = moved;
  let largest = 0;
  for (let v = 0; v < surface.count; v++) {
    largest = Math.max(
      largest,
      Math.hypot(...[0, 1, 2].map((c) => surface.positions[v * 3 + c] - original[v * 3 + c])),
    );
  }
  report.largestShiftMm = Number((largest * 1000).toFixed(2));
  if (kalethra) {
    kalethra.repair = {
      version: REPAIR_VERSION,
      generator: 'tools/figures/lib/repair.mjs',
      steps: {
        fair: plan.fair,
        unfold: plan.unfold,
        relief: plan.relief,
        neckline: Boolean(plan.neckline),
      },
    };
  }
  return { glb: writeGlb(glb), report };
}
