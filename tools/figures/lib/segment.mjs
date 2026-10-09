/**
 * Muscle segmentation: every face of the posed body gets a region of the asset contract
 * (`chest_upper`, `lats`, `quadriceps` …) or a neutral skin region (`skin_head` …), and a layer
 * (bare skin, top, shorts). Rules work in anatomical landmarks of the posed rig – shoulder and hip
 * height, limb axes, torso cross-section – so both variants use the same rules on their own
 * proportions.
 */

import { FINGER_BONE } from './rig.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const DEG = Math.PI / 180;

/** Position along a limb (0 at `from`, 1 at `to`) and the angle around it (0 lateral, +90 front). */
function limb(c, from, to, side) {
  const axis = sub(to, from);
  const length = Math.hypot(...axis);
  const a = norm(axis);
  const rel = sub(c, from);
  const t = dot(rel, a) / length;
  const radial = sub(rel, scale(a, dot(rel, a)));
  const lateral = norm(sub([side, 0, 0], scale(a, a[0] * side)));
  const front = norm(sub([0, 0, 1], scale(a, a[2])));
  return { t, phi: Math.atan2(dot(radial, front), dot(radial, lateral)) / DEG };
}

/**
 * Options: `armhole` – cut the top's arm holes as a smooth, deeper opening around the shoulder
 * joint (geometric, not from the dominant bone): the hem stays a calm line when the arm is
 * raised, and the armpit skin no longer folds over the fabric (male body since phase 18.4).
 * `region(point, bone)` – the modelled body's own muscle region at a point (or null): it wins
 * over the rules, so highlighting follows the modelled anatomy; neutral parts (head, hands, feet,
 * knees …) always come from the rules.
 */
export function segmentBody(body, { armhole = null, region = null } = {}) {
  const { positions: p, faces, weights, joints: J } = body;
  const names = weights.names;
  const vertexCount = p.length / 3;
  // Dominant contract bone per vertex.
  const vertexBone = new Array(vertexCount);
  for (let v = 0; v < vertexCount; v++) vertexBone[v] = names[weights.joints[v * 4]];

  const Ys = J.get('upperArm_L')[1];
  const Yp = J.get('pelvis')[1];
  const L = Ys - Yp;
  const xS = J.get('upperArm_L')[0];

  // Torso cross-section per centimetre: front/back z and half width.
  const torsoBones = new Set(['pelvis', 'spine', 'chest']);
  const buckets = new Map();
  for (let v = 0; v < vertexCount; v++) {
    if (!torsoBones.has(vertexBone[v])) continue;
    const k = Math.round(p[v * 3 + 1] * 100);
    const b = buckets.get(k) ?? { zMin: Infinity, zMax: -Infinity, x: 0 };
    b.zMin = Math.min(b.zMin, p[v * 3 + 2]);
    b.zMax = Math.max(b.zMax, p[v * 3 + 2]);
    b.x = Math.max(b.x, Math.abs(p[v * 3]));
    buckets.set(k, b);
  }
  const section = (y) => {
    const k = Math.round(y * 100);
    for (let d = 0; d < 30; d++) {
      const b = buckets.get(k + d) ?? buckets.get(k - d);
      if (b) return { mid: (b.zMin + b.zMax) / 2, depth: (b.zMax - b.zMin) / 2, width: b.x };
    }
    return { mid: 0, depth: 0.1, width: 0.15 };
  };

  const pecLow = (ax) => Ys - 0.37 * L + 0.45 * ax;
  const rectus = 0.062 * (L / 0.45);

  function torso(c, ax, bone) {
    const s = section(c[1]);
    const alpha = Math.atan2((c[2] - s.mid) / s.depth, ax / s.width) / DEG; // +90 front, -90 back
    const y = c[1];
    if (alpha > 38) {
      if (y > pecLow(ax) && ax < xS * 0.9 && bone !== 'pelvis')
        return y > Ys - 0.12 * L - 0.25 * ax ? 'chest_upper' : 'chest_lower';
      if (y < Yp - 0.035) return ax < 0.075 ? 'skin_pelvis' : 'quadriceps';
      return ax < rectus ? 'core_rectus' : 'core_obliques';
    }
    if (alpha > -30) {
      if (y > pecLow(ax) - 0.06) return 'lats';
      if (bone === 'pelvis' && y < Yp + 0.05) return 'glutes_medius';
      return 'core_obliques';
    }
    // Back.
    const trapBottom = Ys - 0.58 * L;
    const trapWidth = xS * 0.95 * Math.max(0, (y - trapBottom) / (Ys - trapBottom)) ** 2.2;
    if (bone === 'pelvis') {
      if (y > Yp + 0.06)
        return ax < 0.06 ? 'back_erectors' : y > Yp + 0.1 * L ? 'lats' : 'core_obliques';
      return y > Yp - 0.005 && ax > 0.075 ? 'glutes_medius' : 'glutes_maximus';
    }
    if (y > Ys + 0.01 || ax < trapWidth) return 'back_trapezius';
    // Erectors: a band either side of the spine, wider towards the lower back.
    if (ax < 0.045 + 0.02 * Math.min(1, Math.max(0, (Ys - 0.35 * L - y) / (0.3 * L))))
      return 'back_erectors';
    if (ax < 0.1 - 0.12 * (Ys - 0.08 * L - y) && y > Ys - 0.36 * L && y < Ys - 0.08 * L)
      return 'back_rhomboids';
    // Exposed shoulder blade (infraspinatus, teres): rear shoulder.
    if (y > Ys - 0.3 * L && ax > 0.1) return 'shoulders_rear';
    if (y > Yp + 0.1 * L) return 'lats';
    return ax < 0.065 ? 'back_erectors' : 'core_obliques';
  }

  function upperArm(c, S, side) {
    const { t, phi } = limb(c, J.get(`upperArm_${S}`), J.get(`forearm_${S}`), side);
    const lateral = Math.cos(phi * DEG);
    if (lateral > -0.35 && t < 0.2 + 0.28 * Math.max(0, lateral)) {
      return phi > 38 ? 'shoulders_front' : phi < -38 ? 'shoulders_rear' : 'shoulders_middle';
    }
    return phi > 0 && phi < 170 ? 'biceps' : 'triceps';
  }

  function classify(c, bone) {
    const side = c[0] >= 0 ? 1 : -1;
    const S = side > 0 ? 'L' : 'R';
    const ax = Math.abs(c[0]);
    // Finger bones (male rig) are hand.
    const named = FINGER_BONE.test(bone) ? 'hand' : bone.replace(/_[LR]$/, '');
    // The forearm's twist bone is forearm (the female 18.2 asset still runs it through the
    // trunk rules – kept unchanged until that body is rebuilt).
    const base = region && named === 'forearmTwist' ? 'forearm' : named;
    switch (base) {
      case 'head':
        return 'skin_head';
      case 'neck':
        return c[2] < J.get('neck')[2] - 0.015 && c[1] < J.get('head')[1]
          ? 'back_trapezius'
          : 'skin_neck';
      case 'hand':
        return 'skin_hands';
      case 'foot':
        return 'skin_feet';
      case 'forearm': {
        const { t, phi } = limb(c, J.get(`forearm_${S}`), J.get(`hand_${S}`), side);
        // Medial-front side: flexors; lateral-back side: extensors (neutral hand, thumb forward).
        const towardsFlexors = Math.cos((phi - 150) * DEG);
        if (t < 0.06 && phi < -60 && phi > -150) return 'triceps';
        return towardsFlexors > 0 ? 'forearms_flexors' : 'forearms_extensors';
      }
      case 'upperArm':
        return upperArm(c, S, side);
      case 'shoulder': {
        const shoulder = J.get(`upperArm_${S}`);
        if (ax > xS * 0.72 && c[1] < Ys + 0.06) {
          if (c[1] < shoulder[1] - 0.03) return upperArm(c, S, side);
          const dz = c[2] - shoulder[2];
          return dz > 0.03 ? 'shoulders_front' : dz < -0.03 ? 'shoulders_rear' : 'shoulders_middle';
        }
        const s = section(c[1]);
        if (c[2] > s.mid + 0.02 && c[1] < Ys + 0.02) return torso(c, ax, 'chest');
        return 'back_trapezius';
      }
      case 'thigh': {
        const hip = J.get(`thigh_${S}`);
        const knee = J.get(`shin_${S}`);
        const { t, phi } = limb(c, hip, knee, side);
        const back = Math.sin(phi * DEG) < -0.35;
        if (back && c[1] > hip[1] - 0.135 * (L / 0.45) - 0.02 * Math.max(0, Math.cos(phi * DEG)))
          return 'glutes_maximus';
        if (Math.cos(phi * DEG) > 0.2 && Math.sin(phi * DEG) < 0.2 && c[1] > hip[1] - 0.035)
          return 'glutes_medius';
        if (t > 0.9 && Math.sin(phi * DEG) > 0.3) return 'skin_knees';
        if (Math.cos(phi * DEG) < -0.5 && t < 0.72) return 'adductors';
        if (back && t > 0.05) return 'hamstrings';
        if (Math.sin(phi * DEG) < -0.15) return t < 0.25 ? 'glutes_maximus' : 'hamstrings';
        return 'quadriceps';
      }
      case 'shin': {
        const { t, phi } = limb(c, J.get(`shin_${S}`), J.get(`foot_${S}`), side);
        const s = Math.sin(phi * DEG);
        if (t < 0.06 && s > 0.2) return 'skin_knees';
        if (s < -0.3 && t < 0.52) return 'calves_gastrocnemius';
        if (s < 0.1 && t > 0.2 && t < 0.78) return 'calves_soleus';
        return 'skin_shins';
      }
      default:
        return torso(c, ax, base);
    }
  }

  const labels = faces.map((f) => {
    const c = [0, 0, 0];
    const bones = new Map();
    for (const v of f.v) {
      for (let k = 0; k < 3; k++) c[k] += p[v * 3 + k] / f.v.length;
      for (let k = 0; k < 4; k++) {
        const w = weights.weights[v * 4 + k];
        if (!w) continue;
        const name = names[weights.joints[v * 4 + k]];
        bones.set(name, (bones.get(name) ?? 0) + w);
      }
    }
    const bone = [...bones].sort((a, b) => b[1] - a[1])[0][0];
    const rule = classify(c, bone);
    const modelled = region && !rule.startsWith('skin_') ? region(c, bone) : null;
    return { c, bone, label: modelled ?? rule };
  });

  // Smooth label borders: majority over edge neighbours.
  const faceNeighbours = faceAdjacency(faces);
  let current = labels.map((l) => l.label);
  for (let pass = 0; pass < 10; pass++) {
    current = current.map((label, i) => {
      const counts = new Map([[label, 1.5]]);
      for (const j of faceNeighbours[i]) counts.set(current[j], (counts.get(current[j]) ?? 0) + 1);
      return [...counts].sort((a, b) => b[1] - a[1])[0][0];
    });
  }

  if (region) current = mergeIslands(body, current, faceNeighbours);

  // Clothing layer: tight sleeveless top and short shorts.
  const layers = labels.map(({ c, bone }, i) => {
    const label = current[i];
    const base = bone.replace(/_[LR]$/, '');
    const ax = Math.abs(c[0]);
    const y = c[1];
    const hemTop = Yp + 0.05;
    if (['chest', 'spine', 'pelvis', 'shoulder', 'neck'].includes(base) || label === 'lats') {
      if (label.startsWith('skin_') && label !== 'skin_pelvis') return 'skin';
      if (y >= hemTop) {
        if (base === 'neck' || (ax < 0.42 * xS && y > Ys + 0.03)) return 'skin';
        // Arm hole: an ellipse around the shoulder joint.
        if (((ax - xS) / (0.36 * xS)) ** 2 + ((y - Ys) / (0.24 * L)) ** 2 < 1) return 'skin';
        if (
          armhole &&
          ((ax - xS * armhole.x) / armhole.width) ** 2 +
            ((y - Ys + armhole.drop) / armhole.depth) ** 2 <
            1
        )
          return 'skin';
        // Neck opening: deeper in front than at the back; between it and the arm hole runs the strap.
        const front = c[2] > section(y).mid;
        const top = Ys + 0.05;
        const back = armhole?.neckBack ?? 0.055;
        if ((ax / (0.19 * xS * 2)) ** 2 + ((y - top) / (front ? 0.11 : back)) ** 2 < 1)
          return 'skin';
        return 'top';
      }
    }
    if (['pelvis', 'spine', 'thigh'].includes(base) || label.startsWith('glutes')) {
      if (y >= hemTop) return 'top';
      const side = c[0] >= 0 ? 'L' : 'R';
      const hip = J.get(`thigh_${side}`);
      const knee = J.get(`shin_${side}`);
      const medial = Math.max(0, (hip[0] * Math.sign(c[0]) - c[0] * Math.sign(c[0])) / 0.08);
      const hem = hip[1] - (hip[1] - knee[1]) * (0.36 - 0.1 * Math.min(1, medial));
      return y > hem ? 'shorts' : 'skin';
    }
    return 'skin';
  });
  return { labels: current, layers };
}

/** Below this area (m²) a stray piece of a region joins its surroundings. */
const ISLAND_AREA = 0.003;

/**
 * Stray pieces of a region (modelled body): every muscle region is far larger than this; a small
 * separate piece – the back's erectors on the front of the belly, a speck of triceps in the
 * armpit – takes the label its border mostly touches. Such specks read as stains once
 * highlights fade softly into their surroundings.
 */
function mergeIslands(body, labels, neighbours) {
  const { positions: p, faces } = body;
  const area = faces.map((f) => {
    let sum = 0;
    for (let k = 1; k + 1 < f.v.length; k++) {
      const a = [0, 1, 2].map((c) => p[f.v[k] * 3 + c] - p[f.v[0] * 3 + c]);
      const b = [0, 1, 2].map((c) => p[f.v[k + 1] * 3 + c] - p[f.v[0] * 3 + c]);
      sum +=
        Math.hypot(
          a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0],
        ) / 2;
    }
    return sum;
  });
  let out = labels.slice();
  for (let round = 0; round < 4; round++) {
    const piece = new Int32Array(out.length).fill(-1);
    const pieces = [];
    for (let i = 0; i < out.length; i++) {
      if (piece[i] >= 0) continue;
      const list = [i];
      piece[i] = pieces.length;
      let size = 0;
      for (let n = 0; n < list.length; n++) {
        const f = list[n];
        size += area[f];
        for (const g of neighbours[f])
          if (piece[g] < 0 && out[g] === out[i]) {
            piece[g] = pieces.length;
            list.push(g);
          }
      }
      pieces.push({ label: out[i], faces: list, size });
    }
    let changed = false;
    const next = out.slice();
    for (const q of pieces) {
      if (q.size >= ISLAND_AREA || q.label.startsWith('skin_')) continue;
      const counts = new Map();
      for (const f of q.faces)
        for (const g of neighbours[f])
          if (out[g] !== q.label) counts.set(out[g], (counts.get(out[g]) ?? 0) + 1);
      const best = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      if (!best) continue;
      for (const f of q.faces) next[f] = best[0];
      changed = true;
    }
    out = next;
    if (!changed) break;
  }
  return out;
}

export function faceAdjacency(faces) {
  const edges = new Map();
  const list = faces.map(() => []);
  faces.forEach((f, i) => {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k];
      const b = f.v[(k + 1) % f.v.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const other = edges.get(key);
      if (other === undefined) edges.set(key, i);
      else {
        list[i].push(other);
        list[other].push(i);
      }
    }
  });
  return list;
}

/**
 * Straightens the borders between regions and layers: the faces follow the mesh grid, so a
 * border is a staircase. Every vertex on exactly one border moves towards the middle of its two
 * border neighbours (within its tangent plane); junctions of three regions stay put.
 */
export function smoothBorders(body, labels, layers, iterations = 12, { foldSafe = false } = {}) {
  // Clothing edges first (on their own, so muscle borders crossing them do not pin them), then
  // every border.
  smoothBordersOf(body, (i) => layers[i], iterations * 6, foldSafe);
  smoothBordersOf(body, (i) => `${labels[i]}|${layers[i]}`, iterations * 6, foldSafe);
}

/** Fold-safe straightening: a move that turns a face by more than this is taken back. */
const FOLD_SAFE_COS = Math.cos((40 * Math.PI) / 180);

function faceNormalOf(p, f) {
  const n = [0, 0, 0];
  for (let i = 0; i < f.v.length; i++) {
    const a = f.v[i] * 3;
    const b = f.v[(i + 1) % f.v.length] * 3;
    n[0] += (p[a + 1] - p[b + 1]) * (p[a + 2] + p[b + 2]);
    n[1] += (p[a + 2] - p[b + 2]) * (p[a] + p[b]);
    n[2] += (p[a] - p[b]) * (p[a + 1] + p[b + 1]);
  }
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/**
 * `foldSafe` (modelled body, phase 18.5): on a fine mesh, straightening a jagged border pulls a
 * vertex across its neighbours and folds faces over – invisible at rest, a crumpled crease when
 * the skin stretches (behind the armpit with the arm raised). Every move is checked against the
 * faces around the vertex; a move that turns one of them by more than 40° from where it started
 * is taken back and the vertex stays.
 */
function smoothBordersOf(body, regionOf, iterations, foldSafe = false) {
  const { positions: p, faces } = body;
  const edgeFaces = new Map();
  faces.forEach((f, i) => {
    f.v.forEach((a, k) => {
      const b = f.v[(k + 1) % f.v.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeFaces.has(key)) edgeFaces.set(key, []);
      edgeFaces.get(key).push(i);
    });
  });
  const borderNeighbours = new Map();
  const vertexRegions = new Map();
  faces.forEach((f, i) => {
    for (const v of f.v) {
      if (!vertexRegions.has(v)) vertexRegions.set(v, new Set());
      vertexRegions.get(v).add(regionOf(i));
    }
  });
  for (const [key, list] of edgeFaces) {
    if (list.length !== 2 || regionOf(list[0]) === regionOf(list[1])) continue;
    const [a, b] = key.split('_').map(Number);
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      if (!borderNeighbours.has(x)) borderNeighbours.set(x, []);
      borderNeighbours.get(x).push(y);
    }
  }
  const movable = [...borderNeighbours].filter(
    ([v, nb]) => nb.length === 2 && vertexRegions.get(v).size === 2,
  );
  // Surface normal per vertex for the tangent-plane constraint.
  const normal = new Map();
  for (const f of faces) {
    const [a, b, c] = f.v;
    const u = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]);
    const w = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of f.v) {
      const m = normal.get(v) ?? [0, 0, 0];
      normal.set(v, [m[0] + n[0], m[1] + n[1], m[2] + n[2]]);
    }
  }
  const facesOf = new Map();
  const start = foldSafe ? faces.map((f) => faceNormalOf(p, f)) : null;
  if (foldSafe)
    faces.forEach((f, i) => {
      for (const v of f.v) {
        if (!facesOf.has(v)) facesOf.set(v, []);
        facesOf.get(v).push(i);
      }
    });
  const frozen = new Set();
  for (let it = 0; it < iterations; it++) {
    const moves = movable
      .filter(([v]) => !frozen.has(v))
      .map(([v, [a, b]]) => {
        const target = [0, 1, 2].map((k) => (p[a * 3 + k] + p[b * 3 + k]) / 2 - p[v * 3 + k]);
        const n = normal.get(v);
        const l = Math.hypot(...n) || 1;
        const along = (target[0] * n[0] + target[1] * n[1] + target[2] * n[2]) / l;
        return [v, target.map((x, k) => 0.5 * (x - (along * n[k]) / l))];
      });
    for (const [v, d] of moves) for (let k = 0; k < 3; k++) p[v * 3 + k] += d[k];
    if (!foldSafe) continue;
    // Take back moves that folded a face (checked after all moves of the step: neighbours move
    // together).
    const turned = (v) =>
      facesOf.get(v).some((i) => {
        const n = faceNormalOf(p, faces[i]);
        const m = start[i];
        return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < FOLD_SAFE_COS;
      });
    for (const [v, d] of moves) {
      if (!turned(v)) continue;
      for (let k = 0; k < 3; k++) p[v * 3 + k] -= d[k];
      frozen.add(v);
    }
  }
}
