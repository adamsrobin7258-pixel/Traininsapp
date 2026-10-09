/**
 * Anatomy transfer (male body since phase 18.4): the MakeHuman topology – joint loops, skin
 * weights, hands, feet, UVs – takes the form of the sculpted Kalethra body (assets/figure/male/
 * source, made by tools/figure-experiment from the CC BY 4.0 base mesh).
 *
 * 1. Bones: the sculpt's joints are measured on its limbs (centre lines of arm and leg); the
 *    torso keeps MakeHuman's joints, scaled to the sculpt's height.
 * 2. Warp: every vertex follows its bones (linear blend of per-bone maps: limbs turn and stretch
 *    to the sculpt's axes, the trunk scales) – the MakeHuman body now stands like the sculpt.
 * 3. Fit: trunk, limbs and head are moved onto the sculpt's large form (nearest form point with a
 *    matching normal, smoothed over the mesh, a few rounds); hands and feet keep their MakeHuman
 *    shape (finger and toe topology) and blend in at wrist and ankle.
 * 4. Folds the fit leaves in concave places are smoothed out, and the shoulder girdle's skin
 *    weights are reworked (chest → scapula → upper arm), so raised arms do not fold the back in.
 * The sculpt's grooves and fibres are not geometry here: `detailNormal` hands them to the
 * normal-map bake.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Quaternion, Vector3 } from 'three';
import { FINGER_BONE } from './rig.mjs';

export function readSculpt(path) {
  const raw = gunzipSync(readFileSync(path));
  const headerLength = raw.readUInt32LE(0);
  const header = JSON.parse(raw.subarray(4, 4 + headerLength).toString('utf8'));
  const n = header.count;
  let o = 4 + headerLength;
  const take = (bytes) => {
    const slice = raw.subarray(o, o + bytes);
    o += bytes;
    // Copy: typed arrays need aligned offsets.
    return new Uint8Array(slice).buffer;
  };
  const position = new Int16Array(take(n * 6));
  const formNormal = new Int8Array(take(n * 3));
  const sculptNormal = new Int8Array(take(n * 3));
  const part = new Uint8Array(take(n));
  const label = header.labels ? new Uint8Array(take(n)) : null;
  const positions = new Float64Array(n * 3);
  for (let i = 0; i < n * 3; i++) positions[i] = position[i] * header.positionUnit;
  const unit = (a) => {
    const out = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = a[i * 3] / 127,
        y = a[i * 3 + 1] / 127,
        z = a[i * 3 + 2] / 127;
      const l = Math.hypot(x, y, z) || 1;
      out[i * 3] = x / l;
      out[i * 3 + 1] = y / l;
      out[i * 3 + 2] = z / l;
    }
    return out;
  };
  return {
    count: n,
    positions,
    formNormals: unit(formNormal),
    sculptNormals: unit(sculptNormal),
    part,
    label,
    labels: header.labels ?? [],
  };
}

/** Uniform grid over points for nearest-neighbour queries. */
export function pointGrid(positions, cell, select = () => true) {
  const map = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    if (!select(i)) continue;
    const k = key(
      Math.floor(positions[i * 3] / cell),
      Math.floor(positions[i * 3 + 1] / cell),
      Math.floor(positions[i * 3 + 2] / cell),
    );
    let list = map.get(k);
    if (!list) map.set(k, (list = []));
    list.push(i);
  }
  /** Nearest point within `radius` accepted by `ok(i, d2)`, scored by `score(i, d2)`; -1 if none. */
  function nearest(p, radius, score = (i, d2) => d2) {
    const cx = Math.floor(p[0] / cell),
      cy = Math.floor(p[1] / cell),
      cz = Math.floor(p[2] / cell);
    const r = Math.ceil(radius / cell);
    let best = -1;
    let bestScore = Infinity;
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++) {
          const list = map.get(key(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          for (const i of list) {
            const ex = positions[i * 3] - p[0],
              ey = positions[i * 3 + 1] - p[1],
              ez = positions[i * 3 + 2] - p[2];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 > radius * radius) continue;
            const s = score(i, d2);
            if (s < bestScore) {
              bestScore = s;
              best = i;
            }
          }
        }
    return best;
  }
  return { nearest };
}

/** Sculpt part ids (see stage6_export_sculpt.py). */
const PART = { torso: 0, arm_L: 1, arm_R: 2, leg_L: 3, leg_R: 4, head: 5 };

function partOfBone(name) {
  const side = name.endsWith('_L') ? 'L' : name.endsWith('_R') ? 'R' : null;
  const base = name.replace(/_[LR]$/, '');
  if (['upperArm', 'forearm', 'forearmTwist', 'hand'].includes(base)) return PART[`arm_${side}`];
  if (['thigh', 'shin', 'foot'].includes(base)) return PART[`leg_${side}`];
  if (base === 'head' || base === 'neck') return PART.head;
  return PART.torso;
}

/** Centre line (point, unit direction pointing up) of a limb part between two heights. */
function limbLine(sculpt, part, y0, y1) {
  const centres = [];
  const p = sculpt.positions;
  for (let y = y0; y <= y1 + 1e-9; y += 0.01) {
    let lo = [Infinity, Infinity],
      hi = [-Infinity, -Infinity],
      n = 0;
    for (let i = 0; i < sculpt.count; i++) {
      if (sculpt.part[i] !== part || Math.abs(p[i * 3 + 1] - y) > 0.004) continue;
      lo = [Math.min(lo[0], p[i * 3]), Math.min(lo[1], p[i * 3 + 2])];
      hi = [Math.max(hi[0], p[i * 3]), Math.max(hi[1], p[i * 3 + 2])];
      n++;
    }
    if (n > 20) centres.push([(lo[0] + hi[0]) / 2, y, (lo[1] + hi[1]) / 2]);
  }
  // Least squares line x(y), z(y).
  const m = centres.length;
  const my = centres.reduce((s, c) => s + c[1], 0) / m;
  const fit = (k) => {
    const mk = centres.reduce((s, c) => s + c[k], 0) / m;
    let num = 0,
      den = 0;
    for (const c of centres) {
      num += (c[1] - my) * (c[k] - mk);
      den += (c[1] - my) ** 2;
    }
    const slope = num / den;
    return (y) => mk + slope * (y - my);
  };
  const fx = fit(0),
    fz = fit(2);
  return (y) => [fx(y), y, fz(y)];
}

/**
 * Joint heights of the sculpt (metres) – where its shoulder, elbow, wrist, hip, knee and ankle
 * pivot – read off the model in Blender; the joints sit on the limbs' centre lines there.
 */
const SCULPT_JOINT_HEIGHT = {
  upperArm: 1.4,
  forearm: 1.125,
  hand: 0.94,
  thigh: 0.945,
  shin: 0.5,
  foot: 0.085,
};

/** Rest joints of the sculpted body: limbs measured, trunk from MakeHuman scaled to its height. */
export function sculptJoints(sculpt, mhJoints, scale) {
  const joints = new Map();
  for (const [name, p] of mhJoints) joints.set(name, [p[0] * scale, p[1] * scale, p[2] * scale]);
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const arm = PART[`arm_${side}`];
    const leg = PART[`leg_${side}`];
    const upper = limbLine(sculpt, arm, 1.17, 1.31);
    const fore = limbLine(sculpt, arm, 0.97, 1.09);
    const thigh = limbLine(sculpt, leg, 0.6, 0.82);
    const shin = limbLine(sculpt, leg, 0.16, 0.4);
    const H = SCULPT_JOINT_HEIGHT;
    const elbow = upper(H.forearm).map((v, k) => (v + fore(H.forearm)[k]) / 2);
    const knee = thigh(H.shin).map((v, k) => (v + shin(H.shin)[k]) / 2);
    joints.set(`upperArm_${side}`, upper(H.upperArm));
    joints.set(`forearm_${side}`, elbow);
    joints.set(`hand_${side}`, fore(H.hand));
    const wrist = joints.get(`hand_${side}`);
    joints.set(
      `forearmTwist_${side}`,
      elbow.map((v, k) => (v + wrist[k]) / 2),
    );
    joints.set(`thigh_${side}`, thigh(H.thigh));
    joints.set(`shin_${side}`, knee);
    joints.set(`foot_${side}`, shin(H.foot));
    // Mirror-exact: the sculpt is symmetric, the measurement nearly so.
    void s;
  }
  for (const name of [...joints.keys()].filter((n) => n.endsWith('_L'))) {
    const l = joints.get(name);
    const r = joints.get(name.replace(/_L$/, '_R'));
    const m = [(l[0] - r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2];
    joints.set(name, m);
    joints.set(name.replace(/_L$/, '_R'), [-m[0], m[1], m[2]]);
  }
  joints.set('root', [0, 0, 0]);
  return joints;
}

const CHILD = {
  upperArm: 'forearm',
  forearm: 'hand',
  forearmTwist: 'hand',
  thigh: 'shin',
  shin: 'foot',
};

/** Map of one bone: rest point of the MakeHuman body → point of the sculpted body. */
function boneMaps(mhJoints, target, scale) {
  const maps = new Map();
  for (const name of mhJoints.keys()) {
    const base = name.replace(/_[LR]$/, '');
    const side = name.slice(base.length);
    const childBase = CHILD[base];
    if (childBase) {
      const h = new Vector3(...mhJoints.get(name));
      const c = new Vector3(...mhJoints.get(childBase + side));
      const H = new Vector3(...target.get(base === 'forearmTwist' ? `forearm${side}` : name));
      const C = new Vector3(...target.get(childBase + side));
      const from = c
        .clone()
        .sub(base === 'forearmTwist' ? new Vector3(...mhJoints.get(`forearm${side}`)) : h);
      const to = C.clone().sub(H);
      const q = new Quaternion().setFromUnitVectors(
        from.clone().normalize(),
        to.clone().normalize(),
      );
      const axial = to.length() / from.length();
      const axis = to.clone().normalize();
      const origin = base === 'forearmTwist' ? new Vector3(...mhJoints.get(`forearm${side}`)) : h;
      maps.set(name, (p) => {
        const v = new Vector3(...p).sub(origin).multiplyScalar(scale).applyQuaternion(q);
        // Stretch along the bone to the sculpt's length; thickness follows the fit.
        const along = v.dot(axis);
        v.add(axis.clone().multiplyScalar(along * (axial / scale - 1)));
        return v.add(H).toArray();
      });
    } else if (FINGER_BONE.test(name)) {
      continue; // follow the hand (below)
    } else if (base === 'hand' || base === 'foot') {
      // Hands and feet keep their own shape: they turn with the forearm / shin and sit on the
      // new wrist / ankle.
      const parentBase = base === 'hand' ? 'forearm' : 'shin';
      const parentMap = null;
      void parentMap;
      const h = new Vector3(...mhJoints.get(name));
      const H = new Vector3(...target.get(name));
      const pa = new Vector3(...mhJoints.get(parentBase + side));
      const PA = new Vector3(...target.get(parentBase + side));
      const q =
        base === 'hand'
          ? new Quaternion().setFromUnitVectors(
              h.clone().sub(pa).normalize(),
              H.clone().sub(PA).normalize(),
            )
          : new Quaternion();
      maps.set(name, (p) =>
        new Vector3(...p).sub(h).multiplyScalar(scale).applyQuaternion(q).add(H).toArray(),
      );
    } else {
      maps.set(name, (p) => [p[0] * scale, p[1] * scale, p[2] * scale]);
    }
  }
  for (const name of mhJoints.keys()) {
    if (!FINGER_BONE.test(name)) continue;
    const hand = maps.get(`hand${name.slice(-2)}`);
    maps.set(name, hand);
    target.set(name, hand(mhJoints.get(name)));
  }
  return maps;
}

function neighbourList(faces, count) {
  const list = Array.from({ length: count }, () => new Set());
  for (const f of faces)
    for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i];
      const b = f.v[(i + 1) % f.v.length];
      list[a].add(b);
      list[b].add(a);
    }
  return list.map((s) => [...s]);
}

function vertexNormals(positions, faces, count) {
  const normals = new Float64Array(count * 3);
  for (const f of faces) {
    const v = f.v;
    for (let k = 1; k + 1 < v.length; k++) {
      const [a, b, c] = [v[0], v[k], v[k + 1]];
      const u = [0, 1, 2].map((i) => positions[b * 3 + i] - positions[a * 3 + i]);
      const w = [0, 1, 2].map((i) => positions[c * 3 + i] - positions[a * 3 + i]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      for (const x of [a, b, c]) for (let i = 0; i < 3; i++) normals[x * 3 + i] += n[i];
    }
  }
  for (let i = 0; i < count; i++) {
    const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) normals[i * 3 + k] /= l;
  }
  return normals;
}

/**
 * Gives the assembled MakeHuman body the sculpt's form. Returns a new body (positions, joints)
 * plus `fit` per vertex (1 = on the sculpt, 0 = MakeHuman shape: hands, feet).
 */
export function transferAnatomy(body, sculpt, { rounds = 4 } = {}) {
  const { positions, faces, used, weights, joints: mhJoints } = body;
  const count = positions.length / 3;
  const names = weights.names;
  let mhTop = 0;
  for (const v of used) mhTop = Math.max(mhTop, positions[v * 3 + 1]);
  let sculptTop = 0;
  for (let i = 0; i < sculpt.count; i++)
    sculptTop = Math.max(sculptTop, sculpt.positions[i * 3 + 1]);
  const scale = sculptTop / mhTop;
  const target = sculptJoints(sculpt, mhJoints, scale);
  const maps = boneMaps(mhJoints, target, scale);
  // The sculpt carries its head further back than MakeHuman: head (and half of it the neck)
  // move there rigidly, so the radial head fit below only shapes.
  const strength = headStrength(body);
  const scaled = positions.map((x) => x * scale);
  const { cm, cs } = headCentres(scaled, strength, sculpt);
  const off = cs.map((x, c) => x - cm[c]);
  for (const [name, share] of [
    ['head', 1],
    ['neck', 0.5],
  ]) {
    maps.set(name, (p) => p.map((x, c) => x * scale + share * off[c]));
    target.set(
      name,
      target.get(name).map((x, c) => x + share * off[c]),
    );
  }

  // 2. Warp (linear blend of the bone maps).
  const warped = new Float64Array(positions.length);
  const fit = new Float64Array(count);
  const handOrFoot = new Set(
    names
      .map((n, i) => (/^(hand|foot)_/.test(n) || FINGER_BONE.test(n) ? i : -1))
      .filter((i) => i >= 0),
  );
  for (const v of used) {
    const p = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
    const out = [0, 0, 0];
    let sum = 0;
    let keep = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights.weights[v * 4 + k];
      if (!w) continue;
      const j = weights.joints[v * 4 + k];
      const q = maps.get(names[j])(p);
      for (let c = 0; c < 3; c++) out[c] += w * q[c];
      sum += w;
      if (handOrFoot.has(j)) keep += w;
    }
    for (let c = 0; c < 3; c++) warped[v * 3 + c] = out[c] / (sum || 1);
    // Fit fades out over the wrist and ankle.
    fit[v] = 1 - Math.min(1, Math.max(0, (keep - 0.25) / 0.5));
  }

  // 3. Fit onto the sculpt's form.
  const vertexPart = new Uint8Array(count);
  for (const v of used) vertexPart[v] = partOfBone(names[weights.joints[v * 4]]);
  // The head is fitted separately (radially, below); here it only follows the neck.
  const headIndex = names.indexOf('head');
  for (const v of used) {
    let h = 0;
    for (let k = 0; k < 4; k++)
      if (weights.joints[v * 4 + k] === headIndex) h += weights.weights[v * 4 + k];
    fit[v] *= 1 - Math.min(1, Math.max(0, (h - 0.3) / 0.4));
  }
  const grid = pointGrid(sculpt.positions, 0.02, (i) => i % 3 === 0);
  const adjacency = neighbourList(faces, count);
  const usedSet = new Uint8Array(count);
  for (const v of used) usedSet[v] = 1;
  // Wider, softer transition from fitted forearm/shin to the MakeHuman hand/foot (no ring).
  for (let pass = 0; pass < 24; pass++) {
    const next = Float64Array.from(fit);
    for (const v of used) {
      let sum = 0,
        m = 0;
      for (const u of adjacency[v]) if (usedSet[u]) ((sum += fit[u]), m++);
      if (m) next[v] = 0.5 * fit[v] + 0.5 * (sum / m);
    }
    fit.set(next);
  }
  let current = warped;
  for (let round = 0; round < rounds; round++) {
    const normals = vertexNormals(current, faces, count);
    const disp = new Float64Array(count * 3);
    const found = new Uint8Array(count);
    for (const v of used) {
      if (fit[v] <= 0) continue;
      const p = [current[v * 3], current[v * 3 + 1], current[v * 3 + 2]];
      const n = [normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]];
      const i = grid.nearest(p, 0.045, (i, d2) => {
        const fn = sculpt.formNormals;
        const agree = fn[i * 3] * n[0] + fn[i * 3 + 1] * n[1] + fn[i * 3 + 2] * n[2];
        if (agree < 0.35) return Infinity;
        // Same body part preferred: limbs do not snap to the trunk beside them.
        const other = sculpt.part[i] !== vertexPart[v] ? 0.012 : 0;
        return Math.sqrt(d2) + other + (1 - agree) * 0.01;
      });
      if (i < 0) continue;
      const q = [sculpt.positions[i * 3], sculpt.positions[i * 3 + 1], sculpt.positions[i * 3 + 2]];
      const fn = [
        sculpt.formNormals[i * 3],
        sculpt.formNormals[i * 3 + 1],
        sculpt.formNormals[i * 3 + 2],
      ];
      // Onto the sculpt's tangent plane at q.
      const off = (p[0] - q[0]) * fn[0] + (p[1] - q[1]) * fn[1] + (p[2] - q[2]) * fn[2];
      for (let c = 0; c < 3; c++) disp[v * 3 + c] = -off * fn[c];
      found[v] = 1;
    }
    // Smooth the displacement over the mesh: the topology follows, it does not crumple.
    let field = disp;
    for (let pass = 0; pass < 8; pass++) {
      const next = Float64Array.from(field);
      for (const v of used) {
        const nb = adjacency[v];
        let x = 0,
          y = 0,
          z = 0,
          m = 0;
        for (const u of nb) {
          if (!usedSet[u]) continue;
          x += field[u * 3];
          y += field[u * 3 + 1];
          z += field[u * 3 + 2];
          m++;
        }
        if (!m) continue;
        const keep = found[v] ? 0.5 : 0;
        next[v * 3] = keep * field[v * 3] + (1 - keep) * (x / m);
        next[v * 3 + 1] = keep * field[v * 3 + 1] + (1 - keep) * (y / m);
        next[v * 3 + 2] = keep * field[v * 3 + 2] + (1 - keep) * (z / m);
      }
      field = next;
    }
    const nextPositions = Float64Array.from(current);
    for (const v of used)
      for (let c = 0; c < 3; c++) nextPositions[v * 3 + c] += fit[v] * field[v * 3 + c];
    current = nextPositions;
  }
  // Snapping onto the nearest sculpt point folds the mesh where the surface is concave (behind
  // and below the armpit, along the scapula): smooth those folds out.
  current = relaxFolds(current, faces, used, adjacency, fit);
  // Head: radial fit from the skull centre (MakeHuman's head is already a smooth star-shaped
  // surface, see smoothHead; nearest-point snapping would fold the hidden eye and mouth rims).
  current = fitHead(current, body, sculpt);
  current = blendHeadSeam(current, body, adjacency, usedSet);
  const smoothWeights = girdleWeights(body, current, target, adjacency);
  // Floor at y = 0 (feet keep their MakeHuman soles).
  let minY = Infinity;
  for (const v of used) minY = Math.min(minY, current[v * 3 + 1]);
  for (let v = 0; v < count; v++) current[v * 3 + 1] -= minY;
  for (const [name, p] of target) if (name !== 'root') target.set(name, [p[0], p[1] - minY, p[2]]);
  // Relief from the sculpt where the surface was fitted to it. Not on hands and feet (MakeHuman
  // shape) and not on the face: the head takes the sculpt's form as geometry; relief on top of
  // the coarser head mesh reads as smudges.
  const detail = fit;
  return { ...body, positions: current, joints: target, fit, detail, weights: smoothWeights };
}

/** Fold repair: a face pair counts as folded above this angle; rings around it that relax. */
const FOLD = {
  angle: 70,
  rings: 2,
  rounds: 6,
};

/** Unit normal of a (planar enough) polygon, Newell's method. */
function faceNormal(p, f) {
  const n = [0, 0, 0];
  for (let i = 0; i < f.v.length; i++) {
    const a = f.v[i] * 3;
    const b = f.v[(i + 1) % f.v.length] * 3;
    n[0] += (p[a + 1] - p[b + 1]) * (p[a + 2] + p[b + 2]);
    n[1] += (p[a + 2] - p[b + 2]) * (p[a] + p[b]);
    n[2] += (p[a] - p[b]) * (p[a + 1] + p[b + 1]);
  }
  const l = Math.hypot(...n) || 1;
  return n.map((x) => x / l);
}

/**
 * Smooths the fitted surface where it folded (neighbouring faces turned against each other by
 * more than `FOLD.angle`): those vertices and a few rings around them relax towards their
 * neighbours' centre, a few rounds until the folds are gone. Only fitted vertices move (hands,
 * feet and the head keep their form); elsewhere nothing changes.
 */
function relaxFolds(positions, faces, used, adjacency, fit) {
  const count = positions.length / 3;
  const out = Float64Array.from(positions);
  const limit = Math.cos((FOLD.angle * Math.PI) / 180);
  const edgeFaces = new Map();
  faces.forEach((f, i) => {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k];
      const b = f.v[(k + 1) % f.v.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!edgeFaces.has(key)) edgeFaces.set(key, []);
      edgeFaces.get(key).push(i);
    }
  });
  const pairs = [...edgeFaces].filter(([, l]) => l.length === 2);
  for (let round = 0; round < FOLD.rounds; round++) {
    const normals = faces.map((f) => faceNormal(out, f));
    let mark = new Uint8Array(count);
    let folds = 0;
    for (const [key, [i, j]] of pairs) {
      const a = normals[i];
      const b = normals[j];
      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > limit) continue;
      const [x, y] = key.split('_').map(Number);
      if (fit[x] <= 0 && fit[y] <= 0) continue;
      folds++;
      for (const v of [...faces[i].v, ...faces[j].v]) mark[v] = 1;
    }
    if (!folds) break;
    for (let ring = 0; ring < FOLD.rings; ring++) {
      const next = Uint8Array.from(mark);
      for (const v of used) if (mark[v]) for (const u of adjacency[v]) next[u] = 1;
      mark = next;
    }
    for (let pass = 0; pass < 10; pass++) {
      const next = Float64Array.from(out);
      for (const v of used) {
        if (!mark[v] || fit[v] <= 0) continue;
        const nb = adjacency[v];
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (const u of nb) sum += out[u * 3 + c];
          next[v * 3 + c] += 0.5 * fit[v] * (sum / nb.length - out[v * 3 + c]);
        }
      }
      out.set(next);
    }
  }
  return out;
}

/**
 * The sculpt's fine relief at a point of the fitted surface: the change from the form normal
 * to the sculpt normal at the nearest sculpt point (world space), or null if none is close.
 */
export function detailNormalField(sculpt) {
  const grid = pointGrid(sculpt.positions, 0.005);
  return (p, n) => {
    const i = grid.nearest(p, 0.01, (i, d2) => {
      const fn = sculpt.formNormals;
      const agree = fn[i * 3] * n[0] + fn[i * 3 + 1] * n[1] + fn[i * 3 + 2] * n[2];
      return agree < 0.5 ? Infinity : d2;
    });
    if (i < 0) return null;
    return [0, 1, 2].map((c) => sculpt.sculptNormals[i * 3 + c] - sculpt.formNormals[i * 3 + c]);
  };
}

/** Head weight per vertex (0…1, eased) – the region the radial head fit owns. */
function headStrength(body) {
  const { weights, used } = body;
  const head = weights.names.indexOf('head');
  const out = new Float64Array(body.positions.length / 3);
  for (const v of used) {
    let h = 0;
    for (let k = 0; k < 4; k++)
      if (weights.joints[v * 4 + k] === head) h += weights.weights[v * 4 + k];
    const t = Math.min(1, Math.max(0, (h - 0.3) / 0.4));
    out[v] = t * t * (3 - 2 * t);
  }
  return out;
}

function headCentres(positions, strength, sculpt) {
  const count = positions.length / 3;
  // Both heads: bounding box of the top 22 cm; centres aligned (the sculpt's posture differs).
  const box = (get, n, keep) => {
    let top = -Infinity;
    for (let i = 0; i < n; i++) if (keep(i)) top = Math.max(top, get(i)[1]);
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) {
      if (!keep(i)) continue;
      const p = get(i);
      if (p[1] < top - 0.22) continue;
      for (let c = 0; c < 3; c++) {
        lo[c] = Math.min(lo[c], p[c]);
        hi[c] = Math.max(hi[c], p[c]);
      }
    }
    return { lo, hi, top };
  };
  const mh = box(
    (v) => [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]],
    count,
    (v) => strength[v] >= 1,
  );
  const sc = box(
    (i) => [sculpt.positions[i * 3], sculpt.positions[i * 3 + 1], sculpt.positions[i * 3 + 2]],
    sculpt.count,
    (i) => sculpt.part[i] === PART.head,
  );
  // Skull centre as in smoothHead: middle of the box, a little back from the face (+Z front).
  const centreOf = (b) => [
    (b.lo[0] + b.hi[0]) / 2,
    b.lo[1] + (b.hi[1] - b.lo[1]) * 0.55,
    b.lo[2] + (b.hi[2] - b.lo[2]) * 0.45,
  ];
  return { cm: centreOf(mh), cs: centreOf(sc) };
}

/** Outer radius per direction (0.75° cells) of a point set around a centre; null where empty. */
function radialProfile(points, centre) {
  const T = 240,
    P = 480;
  const radius = new Float64Array(T * P).fill(NaN);
  const cell = (u) => [
    Math.min(T - 1, Math.floor((Math.acos(Math.max(-1, Math.min(1, u[1]))) / Math.PI) * T)),
    Math.min(P - 1, Math.floor(((Math.atan2(u[0], u[2]) + Math.PI) / (2 * Math.PI)) * P)),
  ];
  for (const p of points) {
    const d = [0, 1, 2].map((c) => p[c] - centre[c]);
    const r = Math.hypot(...d);
    if (r > 0.2 || r < 1e-6) continue;
    const [t, q] = cell(d.map((x) => x / r));
    const k = t * P + q;
    if (Number.isNaN(radius[k]) || r > radius[k]) radius[k] = r;
  }
  // Empty cells take the mean of their filled neighbours (filled cells stay as measured).
  for (let pass = 0; pass < 6; pass++) {
    const next = Float64Array.from(radius);
    for (let t = 0; t < T; t++)
      for (let q = 0; q < P; q++) {
        if (!Number.isNaN(radius[t * P + q])) continue;
        let sum = 0,
          n = 0;
        for (const [dt, dq] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const tt = t + dt;
          if (tt < 0 || tt >= T) continue;
          const value = radius[tt * P + ((q + dq + P) % P)];
          if (!Number.isNaN(value)) ((sum += value), n++);
        }
        if (n) next[t * P + q] = sum / n;
      }
    radius.set(next);
  }
  return (u) => {
    const theta = (Math.acos(Math.max(-1, Math.min(1, u[1]))) / Math.PI) * T - 0.5;
    const phi = ((Math.atan2(u[0], u[2]) + Math.PI) / (2 * Math.PI)) * P - 0.5;
    const t0 = Math.max(0, Math.min(T - 1, Math.floor(theta)));
    const t1 = Math.min(T - 1, t0 + 1);
    const ft = Math.max(0, Math.min(1, theta - t0));
    const q0 = ((Math.floor(phi) % P) + P) % P;
    const q1 = (q0 + 1) % P;
    const fq = phi - Math.floor(phi);
    const at = (t, q) => radius[t * P + q];
    const v =
      (at(t0, q0) * (1 - fq) + at(t0, q1) * fq) * (1 - ft) +
      (at(t1, q0) * (1 - fq) + at(t1, q1) * fq) * ft;
    return Number.isNaN(v) ? null : v;
  };
}

/**
 * Head: every vertex moves radially (from the skull centre) by the difference between the
 * sculpt's head surface and MakeHuman's in its direction. Only the shape difference is carried
 * over, so the hidden eye and mouth rims MakeHuman keeps just below its surface stay below it.
 */
function fitHead(positions, body, sculpt) {
  const strength = headStrength(body);
  const count = positions.length / 3;
  const { cm, cs } = headCentres(positions, strength, sculpt);
  const sculptPoints = [];
  for (let i = 0; i < sculpt.count; i++)
    if (sculpt.part[i] === PART.head || sculpt.part[i] === PART.torso)
      sculptPoints.push([
        sculpt.positions[i * 3],
        sculpt.positions[i * 3 + 1],
        sculpt.positions[i * 3 + 2],
      ]);
  const mhPoints = [];
  for (let v = 0; v < count; v++)
    if (strength[v] > 0)
      mhPoints.push([positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]]);
  const target = radialProfile(sculptPoints, cs);
  const source = radialProfile(mhPoints, cm);
  const out = Float64Array.from(positions);
  for (let v = 0; v < count; v++) {
    const s = strength[v];
    if (!s) continue;
    const d = [0, 1, 2].map((c) => positions[v * 3 + c] - cm[c]);
    const r = Math.hypot(...d) || 1e-9;
    const u = d.map((x) => x / r);
    const a = target(u);
    const b = source(u);
    const nr = a !== null && b !== null ? r + (a - b) : r;
    for (let c = 0; c < 3; c++) {
      const placed = cs[c] + u[c] * nr;
      out[v * 3 + c] = positions[v * 3 + c] + s * (placed - positions[v * 3 + c]);
    }
  }
  return out;
}

/**
 * The band where the radially fitted head meets the fitted neck: smoothed over the mesh, so the
 * head does not sit on the neck with a step.
 */
function blendHeadSeam(positions, body, adjacency, usedSet) {
  const strength = headStrength(body);
  const count = positions.length / 3;
  // Band: some head weight but not the full head, widened by three rings.
  let band = new Uint8Array(count);
  for (let v = 0; v < count; v++) if (usedSet[v] && strength[v] > 0 && strength[v] < 1) band[v] = 1;
  for (let ring = 0; ring < 3; ring++) {
    const next = Uint8Array.from(band);
    for (let v = 0; v < count; v++)
      if (band[v]) for (const u of adjacency[v]) if (usedSet[u]) next[u] = 1;
    band = next;
  }
  let out = Float64Array.from(positions);
  for (let pass = 0; pass < 20; pass++) {
    const next = Float64Array.from(out);
    for (let v = 0; v < count; v++) {
      if (!band[v]) continue;
      const nb = adjacency[v].filter((u) => usedSet[u]);
      if (!nb.length) continue;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (const u of nb) sum += out[u * 3 + c];
        next[v * 3 + c] = 0.5 * out[v * 3 + c] + 0.5 * (sum / nb.length);
      }
    }
    out = next;
  }
  return out;
}

/** Shoulder girdle skinning (phase 18.5): how far around the shoulder joint the weights are
 * reworked (metres), the share of the chest ↔ upper arm overlap handed to the girdle, and the
 * smoothing passes. */
const GIRDLE = {
  inner: 0.06,
  outer: 0.2,
  share: 1,
  passes: 120,
};

/**
 * Skin weights of the shoulder girdle. MakeHuman hands the skin behind and in front of the
 * armpit (latissimus, teres, the pectoral fold) from the chest straight to the upper arm within
 * about 2 cm, the scapula (`shoulder_*`) carrying only a few per cent. With the arm raised by
 * 150° linear blend skinning then averages two transforms that far apart over that narrow band,
 * and the skin behind the armpit folds inwards (device test 0.29.0: "the back bends in").
 *
 * 1. Where chest and upper arm overlap, a share of both goes to the shoulder girdle: the
 *    transition runs chest → scapula → upper arm, in smaller steps (the girdle turns with the
 *    arm, see the scapulohumeral rhythm in clips.mjs).
 * 2. The weights are smoothed over the mesh around the shoulder joint (fading out between
 *    `inner` and `outer` distance), chest-only vertices included, so the band widens.
 */
function girdleWeights(body, positions, joints, adjacency) {
  const { weights, used } = body;
  const names = weights.names;
  const count = positions.length / 3;
  const index = (name) => names.indexOf(name);
  const trunk = new Set(['chest', 'spine'].map(index));
  const girdleBones = new Set(
    names
      .map((n, i) => (/^(chest|spine|shoulder_[LR]|upperArm_[LR])$/.test(n) ? i : -1))
      .filter((i) => i >= 0),
  );
  let maps = Array.from({ length: count }, (_, v) => {
    const m = new Map();
    for (let k = 0; k < 4; k++) {
      const w = weights.weights[v * 4 + k];
      if (w) m.set(weights.joints[v * 4 + k], (m.get(weights.joints[v * 4 + k]) ?? 0) + w);
    }
    return m;
  });
  // Blend factor per vertex: 1 near the shoulder joint, 0 beyond `outer` or off the girdle.
  const blend = new Float64Array(count);
  const sideOf = new Int8Array(count);
  for (const v of used) {
    const x = positions[v * 3];
    const s = x >= 0 ? 'L' : 'R';
    const j = joints.get(`upperArm_${s}`);
    const d = Math.hypot(x - j[0], positions[v * 3 + 1] - j[1], positions[v * 3 + 2] - j[2]);
    let share = 0;
    for (const [b, w] of maps[v]) if (girdleBones.has(b)) share += w;
    if (share < 0.98) continue;
    const t = Math.min(1, Math.max(0, (GIRDLE.outer - d) / (GIRDLE.outer - GIRDLE.inner)));
    blend[v] = t * t * (3 - 2 * t);
    sideOf[v] = s === 'L' ? 1 : -1;
  }
  // 1. Overlap of trunk and upper arm → shoulder girdle.
  for (const v of used) {
    if (!blend[v]) continue;
    const s = sideOf[v] > 0 ? 'L' : 'R';
    const upper = index(`upperArm_${s}`);
    const girdle = index(`shoulder_${s}`);
    const m = maps[v];
    let wt = 0;
    for (const b of trunk) wt += m.get(b) ?? 0;
    const wu = m.get(upper) ?? 0;
    const moved = GIRDLE.share * Math.min(wt, wu) * blend[v];
    if (!moved) continue;
    for (const b of trunk) if (m.has(b)) m.set(b, m.get(b) - (moved * m.get(b)) / wt);
    m.set(upper, wu - moved);
    m.set(girdle, (m.get(girdle) ?? 0) + 2 * moved);
  }
  // 2. Smoothing around the joint (vertices outside stay as they are and hold the border).
  for (let pass = 0; pass < GIRDLE.passes; pass++) {
    const next = maps.slice();
    for (const v of used) {
      if (!blend[v]) continue;
      const nb = adjacency[v];
      const avg = new Map();
      for (const u of nb)
        for (const [j, w] of maps[u]) avg.set(j, (avg.get(j) ?? 0) + w / nb.length);
      const k = 0.5 * blend[v];
      const m = new Map();
      for (const j of new Set([...maps[v].keys(), ...avg.keys()]))
        m.set(j, (1 - k) * (maps[v].get(j) ?? 0) + k * (avg.get(j) ?? 0));
      next[v] = m;
    }
    maps = next;
  }
  const out = Float32Array.from(weights.weights);
  const outJoints = Uint8Array.from(weights.joints);
  for (const v of used) {
    if (!blend[v]) continue;
    const top = [...maps[v]]
      .filter(([, w]) => w > 1e-6)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    for (let k = 0; k < 4; k++) {
      outJoints[v * 4 + k] = top[k]?.[0] ?? 0;
      out[v * 4 + k] = top[k] ? top[k][1] / sum : 0;
    }
  }
  return { ...weights, joints: outJoints, weights: out };
}

/**
 * The sculpt's muscle region at a point of the fitted body (contract region name), or null
 * where the sculpt models no muscle there. Limbs only look at their own side.
 */
export function sculptRegions(sculpt) {
  if (!sculpt.label) return null;
  const grid = pointGrid(sculpt.positions, 0.01, (i) => sculpt.label[i] > 0);
  // Regions that cross from the trunk onto the arm (the shoulder girdle's muscles).
  const girdle = /^(chest_|shoulders_|lats|back_trapezius)/;
  return (p, bone) => {
    const base = bone.replace(/_[LR]$/, '');
    // Trunk and upper arm only: the neck, the forearms and the legs keep the rules' regions.
    if (!['pelvis', 'spine', 'chest', 'shoulder', 'upperArm'].includes(base)) return null;
    const part = partOfBone(bone);
    const i = grid.nearest(p, 0.02, (i, d2) => {
      const name = sculpt.labels[sculpt.label[i] - 1];
      if (sculpt.part[i] !== part && !girdle.test(name)) return Infinity;
      return d2;
    });
    const name = i < 0 ? null : sculpt.labels[sculpt.label[i] - 1];
    // The hip's regions stay with the rules (they follow the shorts' edge there).
    return name && !name.startsWith('glutes_') ? name : null;
  };
}
