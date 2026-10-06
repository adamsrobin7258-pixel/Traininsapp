/**
 * Posing the shaped body with linear blend skinning (contract rig), and the featureless head.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { RIG } from './rig.mjs';

const PARENT = new Map(RIG.map(([name, parent]) => [name, parent]));
const ORDER = RIG.map(([name]) => name);

/**
 * World skinning matrices for local rotations (bone → Quaternion, in world axes at the bone's
 * rest head). Returns per bone the matrix rest → posed and the posed head positions.
 */
export function poseMatrices(joints, rotations) {
  const world = new Map();
  const rotationWorld = new Map();
  const heads = new Map();
  for (const name of ORDER) {
    const parent = PARENT.get(name);
    const rest = new Vector3(...joints.get(name));
    const parentRotation = parent ? rotationWorld.get(parent) : new Quaternion();
    const parentMatrix = parent ? world.get(parent) : new Matrix4();
    const head = rest.clone().applyMatrix4(parentMatrix);
    const rotation = parentRotation.clone().multiply(rotations.get(name) ?? new Quaternion());
    const matrix = new Matrix4()
      .makeTranslation(head.x, head.y, head.z)
      .multiply(new Matrix4().makeRotationFromQuaternion(rotation))
      .multiply(new Matrix4().makeTranslation(-rest.x, -rest.y, -rest.z));
    world.set(name, matrix);
    rotationWorld.set(name, rotation);
    heads.set(name, [head.x, head.y, head.z]);
  }
  return { world, heads };
}

export function skin(positions, weights, matrices) {
  const out = new Float64Array(positions.length);
  const v = new Vector3();
  const sum = new Vector3();
  const tmp = new Vector3();
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    sum.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = weights.weights[i * 4 + k];
      if (!w) continue;
      tmp
        .copy(v)
        .applyMatrix4(matrices.get(weights.names[weights.joints[i * 4 + k]]))
        .multiplyScalar(w);
      sum.add(tmp);
    }
    out[i * 3] = sum.x;
    out[i * 3 + 1] = sum.y;
    out[i * 3 + 2] = sum.z;
  }
  return out;
}

/** Shortest rotation turning direction a into direction b. */
export function turn(a, b) {
  return new Quaternion().setFromUnitVectors(
    new Vector3(...a).normalize(),
    new Vector3(...b).normalize(),
  );
}

/**
 * Anatomical rest pose: upright, arms about 12° from the body, elbows relaxed, palms towards
 * the thighs. Returns local rotations (world axes) per bone.
 */
export function restPose(joints, tail) {
  const rotations = new Map();
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  for (const s of ['L', 'R']) {
    const sign = s === 'L' ? 1 : -1;
    const shoulder = joints.get(`upperArm_${s}`);
    const elbow = joints.get(`forearm_${s}`);
    const wrist = joints.get(`hand_${s}`);
    const angle = (12 * Math.PI) / 180;
    const upperTarget = [Math.sin(angle) * sign, -Math.cos(angle), 0.02];
    const qUpper = turn(sub(elbow, shoulder), upperTarget);
    rotations.set(`upperArm_${s}`, qUpper);
    // Forearm: relative to the turned upper arm, a relaxed slight bend forwards.
    const forearmNow = new Vector3(...sub(wrist, elbow)).applyQuaternion(qUpper);
    const forearmTarget = new Vector3(Math.sin((9 * Math.PI) / 180) * sign, -1, 0.14).normalize();
    const qFore = new Quaternion().setFromUnitVectors(forearmNow.normalize(), forearmTarget);
    // Palms towards the thighs: turn the forearm about its own axis.
    // World-space correction → local rotation under the turned upper arm.
    const local = qUpper.clone().invert().multiply(qFore).multiply(qUpper);
    rotations.set(`forearm_${s}`, local);
  }
  return rotations;
}

export function neighbours(faces, count) {
  const list = Array.from({ length: count }, () => new Set());
  for (const f of faces) {
    for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i];
      const b = f.v[(i + 1) % f.v.length];
      list[a].add(b);
      list[b].add(a);
    }
  }
  return list.map((set) => [...set]);
}

/**
 * Featureless head. The head's outline is measured as a radial profile around the skull centre
 * (largest radius per direction), smoothed strongly on the sphere – jaw, chin, forehead and
 * skull keep their anatomical form, while eyes, nose, mouth and ears (small, local bumps and
 * dents) vanish. Every head vertex is placed on that smooth surface; vertices that lay clearly
 * inside (mouth and eye cavities) end up just below it and stay hidden. The neck blends in.
 */
export function smoothHead(positions, weights, adjacency, used) {
  const head = weights.names.indexOf('head');
  const strength = new Float64Array(positions.length / 3);
  const region = [];
  for (const v of used) {
    for (let k = 0; k < 4; k++) {
      if (weights.joints[v * 4 + k] === head) strength[v] += weights.weights[v * 4 + k];
    }
    strength[v] = Math.min(1, Math.max(0, (strength[v] - 0.45) / 0.45));
    if (strength[v] > 0) region.push(v);
  }
  const full = region.filter((v) => strength[v] >= 1);
  // Centre of the skull: middle of the full-head bounding box, a little back from the face.
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of full) {
    for (let c = 0; c < 3; c++) {
      lo[c] = Math.min(lo[c], positions[v * 3 + c]);
      hi[c] = Math.max(hi[c], positions[v * 3 + c]);
    }
  }
  const centre = [
    (lo[0] + hi[0]) / 2,
    lo[1] + (hi[1] - lo[1]) * 0.5,
    lo[2] + (hi[2] - lo[2]) * 0.45,
  ];
  const T = 36;
  const P = 72;
  const bin = (d) => {
    const theta = Math.acos(Math.max(-1, Math.min(1, d[1])));
    const phi = Math.atan2(d[0], d[2]) + Math.PI;
    return [
      Math.min(T - 1, Math.floor((theta / Math.PI) * T)),
      Math.min(P - 1, Math.floor((phi / (2 * Math.PI)) * P)),
    ];
  };
  const dir = (p, v) => {
    const d = [p[v * 3] - centre[0], p[v * 3 + 1] - centre[1], p[v * 3 + 2] - centre[2]];
    const r = Math.hypot(d[0], d[1], d[2]) || 1e-9;
    return { d: [d[0] / r, d[1] / r, d[2] / r], r };
  };
  // Radial profile: robust outer radius per direction (a high percentile, not the max, so the
  // nose tip and ear rims do not count).
  const samples = Array.from({ length: T * P }, () => []);
  for (const v of region) {
    if (strength[v] < 0.6) continue;
    const { d, r } = dir(positions, v);
    const [t, q] = bin(d);
    samples[t * P + q].push(r);
  }
  let radius = samples.map((list) => {
    if (!list.length) return NaN;
    list.sort((a, b) => a - b);
    return list[Math.floor(list.length * 0.8)];
  });
  // Fill gaps and smooth on the sphere (wrapping in phi).
  for (let pass = 0; pass < 140; pass++) {
    const next = radius.slice();
    for (let t = 0; t < T; t++) {
      for (let q = 0; q < P; q++) {
        let sum = 0,
          n = 0;
        for (const [dt, dq] of [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const tt = t + dt;
          if (tt < 0 || tt >= T) continue;
          const value = radius[tt * P + ((q + dq + P) % P)];
          if (Number.isNaN(value)) continue;
          sum += value;
          n++;
        }
        if (n) next[t * P + q] = sum / n;
      }
    }
    radius = next;
  }
  const profile = (d) => {
    const theta = (Math.acos(Math.max(-1, Math.min(1, d[1]))) / Math.PI) * T - 0.5;
    const phi = ((Math.atan2(d[0], d[2]) + Math.PI) / (2 * Math.PI)) * P - 0.5;
    const t0 = Math.max(0, Math.min(T - 1, Math.floor(theta)));
    const t1 = Math.min(T - 1, t0 + 1);
    const ft = Math.max(0, Math.min(1, theta - t0));
    const q0 = ((Math.floor(phi) % P) + P) % P;
    const q1 = (q0 + 1) % P;
    const fq = phi - Math.floor(phi);
    const at = (t, q) => (Number.isNaN(radius[t * P + q]) ? 0 : radius[t * P + q]);
    return (
      (at(t0, q0) * (1 - fq) + at(t0, q1) * fq) * (1 - ft) +
      (at(t1, q0) * (1 - fq) + at(t1, q1) * fq) * ft
    );
  };
  const ease = (v) => strength[v] * strength[v] * (3 - 2 * strength[v]);
  const project = (p, from) => {
    for (const v of region) {
      const { d } = dir(p, v);
      const r = dir(from, v).r;
      const surface = profile(d);
      if (!surface) continue;
      const nr = r + (surface - r) * ease(v);
      for (let c = 0; c < 3; c++) p[v * 3 + c] = centre[c] + d[c] * nr;
    }
  };
  let out = Float64Array.from(positions);
  project(out, positions);
  // Relax folded remains (ears, eye lids, mouth) along the surface, then put them back on it.
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < 12; i++) {
      const next = Float64Array.from(out);
      for (const v of region) {
        const nb = adjacency[v];
        let x = 0,
          y = 0,
          z = 0;
        for (const u of nb) {
          x += out[u * 3];
          y += out[u * 3 + 1];
          z += out[u * 3 + 2];
        }
        const k = 0.6 * ease(v);
        next[v * 3] += k * (x / nb.length - out[v * 3]);
        next[v * 3 + 1] += k * (y / nb.length - out[v * 3 + 1]);
        next[v * 3 + 2] += k * (z / nb.length - out[v * 3 + 2]);
      }
      out = next;
    }
    project(out, out);
  }
  return out;
}

/**
 * Baked forearm twist (palms towards the thighs): the radius turns along the whole forearm, so
 * the twist grows from 0 at the elbow to the full angle at the wrist – no wrapping at the elbow.
 */
export function twistForearms(positions, weights, joints, angleDeg) {
  const out = Float64Array.from(positions);
  const index = (name) => weights.names.indexOf(name);
  for (const s of ['L', 'R']) {
    const sign = s === 'L' ? 1 : -1;
    const elbow = new Vector3(...joints.get(`forearm_${s}`));
    const wrist = new Vector3(...joints.get(`hand_${s}`));
    const axis = wrist.clone().sub(elbow);
    const length = axis.length();
    axis.normalize();
    const fore = index(`forearm_${s}`);
    const hand = index(`hand_${s}`);
    const twist = index(`forearmTwist_${s}`);
    const v = new Vector3();
    for (let i = 0; i < positions.length / 3; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) {
        const j = weights.joints[i * 4 + k];
        if (j === fore || j === twist || j === hand) w += weights.weights[i * 4 + k];
      }
      if (!w) continue;
      v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      const along = Math.max(0, Math.min(1, v.clone().sub(elbow).dot(axis) / length));
      const angle = ((sign * angleDeg * Math.PI) / 180) * along * w;
      const q = new Quaternion().setFromAxisAngle(axis, angle);
      v.sub(elbow).applyQuaternion(q).add(elbow);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
  }
  return out;
}
