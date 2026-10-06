/**
 * Relaxed hands. MakeHuman's base hands are spread wide; a neutral standing hand has the fingers
 * close together and slightly curled. Posed with MakeHuman's own finger bones (before they are
 * merged into the contract's `hand_*` bone), so the knuckles bend where they should.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';

const mean = (positions, verts) => {
  const p = new Vector3();
  for (const v of verts)
    p.add(new Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]));
  return p.divideScalar(verts.length);
};

/** Curl per phalanx (degrees) and how far a finger closes towards the middle finger (0…1). */
const CURL = { 1: [6, 10, 8], 2: [10, 16, 12], 3: [12, 18, 14], 4: [14, 20, 15], 5: [16, 22, 16] };
const CLOSE = { 2: 0.55, 3: 0, 4: 0.55, 5: 0.6 };

export function relaxHands(positions, skeleton, mhWeights) {
  const { bones, joints } = skeleton;
  const head = (bone) => mean(positions, joints[bones[bone].head]);
  const tail = (bone) => mean(positions, joints[bones[bone].tail]);
  const matrices = new Map();
  for (const s of ['L', 'R']) {
    const wrist = head(`wrist.${s}`);
    const middle = head(`finger3-1.${s}`).sub(wrist).normalize();
    // Palm normal: across the knuckles × along the hand, oriented to the palm side (MakeHuman's
    // base hands face down).
    const across = head(`finger5-1.${s}`)
      .sub(head(`finger2-1.${s}`))
      .normalize();
    const palm = new Vector3().crossVectors(across, middle).normalize();
    if (palm.y > 0) palm.negate();
    for (let f = 1; f <= 5; f++) {
      let parent = new Matrix4();
      for (let k = 1; k <= 3; k++) {
        const bone = `finger${f}-${k}.${s}`;
        const h = head(bone);
        const along = tail(bone).sub(h).normalize();
        const rotation = new Quaternion().setFromAxisAngle(
          new Vector3().crossVectors(along, palm).normalize(),
          (CURL[f][k - 1] * Math.PI) / 180,
        );
        if (k === 1 && CLOSE[f]) {
          // Close the spread: turn the finger about the palm normal towards the middle finger.
          const flat = (v) =>
            v
              .clone()
              .sub(palm.clone().multiplyScalar(v.dot(palm)))
              .normalize();
          const a = flat(along);
          const b = flat(middle);
          const angle = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * CLOSE[f];
          const sign = Math.sign(new Vector3().crossVectors(a, b).dot(palm)) || 1;
          rotation.premultiply(new Quaternion().setFromAxisAngle(palm, sign * angle));
        }
        const local = new Matrix4()
          .makeTranslation(h.x, h.y, h.z)
          .multiply(new Matrix4().makeRotationFromQuaternion(rotation))
          .multiply(new Matrix4().makeTranslation(-h.x, -h.y, -h.z));
        parent = parent.clone().multiply(local);
        matrices.set(bone, parent);
      }
    }
  }
  const out = Float64Array.from(positions);
  const count = positions.length / 3;
  const delta = new Float64Array(count * 3);
  const v = new Vector3();
  for (const [bone, matrix] of matrices) {
    for (const [i, w] of mhWeights[bone] ?? []) {
      if (i >= count) continue;
      v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).applyMatrix4(matrix);
      delta[i * 3] += (v.x - positions[i * 3]) * w;
      delta[i * 3 + 1] += (v.y - positions[i * 3 + 1]) * w;
      delta[i * 3 + 2] += (v.z - positions[i * 3 + 2]) * w;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] += delta[i];
  return out;
}
