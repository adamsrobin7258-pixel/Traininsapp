/**
 * Hand refinement of the male body (phase 18.5). Its hands keep MakeHuman's form (transfer.mjs),
 * and MakeHuman's whole-body muscle and weight targets thicken them too: a palm about 5 cm deep,
 * fingers about 2.2 cm, lying against each other – the gloved look of the device test. Its finger
 * joints also sit close under the back of the fingers, so a bent finger crushes its palm side.
 *
 * 1. Joints: every finger joint moves into the middle of its phalanx's cross-section.
 * 2. Form: fingers slimmer (more across the depth than the width), the palm flatter towards the
 *    knuckles – both about their own centre, blended by the skin weights like a pose, so the
 *    knuckles, webs and the wrist stay continuous.
 * 3. Rest: the fingers fan out a little from the middle finger, so they read as fingers.
 */
import { Quaternion, Vector3 } from 'three';
import { FINGERS } from './rig.mjs';
import { handModel } from './grip.mjs';

/** Form factors (1 = unchanged). */
export const HAND_FORM = {
  fingerDepth: 0.84,
  fingerWidth: 0.9,
  thumbDepth: 0.9,
  palmDepth: 0.8,
  /** Fan-out of the fingers at rest (degrees, away from the middle finger). */
  spread: { index: 3, middle: 0, ring: -2.5, pinky: -5 },
};

const v3 = (a) => new Vector3(...a);

export function refineHands(body) {
  const positions = Float64Array.from(body.positions);
  const joints = new Map([...body.joints].map(([k, p]) => [k, [...p]]));
  const { weights, used } = body;
  const names = weights.names;
  for (const side of ['L', 'R']) {
    const hand = handModel(body, side);
    const index = (name) => names.indexOf(name);
    // Per bone of the hand: a map of a rest point to its refined place.
    const maps = new Map();
    const centreOf = (finger, k) => {
      const ph = hand.fingers[finger].phalanges[k];
      const bone = index(`${finger}${k + 1}_${side}`);
      let lo = [Infinity, Infinity];
      let hi = [-Infinity, -Infinity];
      for (const v of used) {
        if (weights.joints[v * 4] !== bone) continue;
        const rel = v3([0, 1, 2].map((c) => body.positions[v * 3 + c])).sub(ph.head);
        const t = rel.dot(ph.dir) / ph.length;
        if (t < 0.25 || t > 0.75) continue;
        const a = rel.dot(ph.palmar);
        const b = rel.dot(ph.axis);
        lo = [Math.min(lo[0], a), Math.min(lo[1], b)];
        hi = [Math.max(hi[0], a), Math.max(hi[1], b)];
      }
      if (!Number.isFinite(lo[0])) return new Vector3();
      return ph.palmar
        .clone()
        .multiplyScalar((lo[0] + hi[0]) / 2)
        .add(ph.axis.clone().multiplyScalar((lo[1] + hi[1]) / 2));
    };
    for (const finger of FINGERS) {
      const F = hand.fingers[finger];
      const thumb = finger === 'thumb';
      // Fan-out about the palm normal at the knuckle (the finger's whole chain).
      const angle = ((HAND_FORM.spread[finger] ?? 0) * Math.PI) / 180;
      const knuckle = F.phalanges[0].head;
      // Positive angle turns the finger towards the index side.
      const towardsIndex = hand.across.clone().negate();
      const axis = new Vector3().crossVectors(hand.along, towardsIndex).normalize();
      const fan = new Quaternion().setFromAxisAngle(axis, angle);
      const fanned = (p) => p.clone().sub(knuckle).applyQuaternion(fan).add(knuckle);
      F.phalanges.forEach((ph, k) => {
        const name = `${finger}${k + 1}_${side}`;
        // Thumb metacarpal: part of the palm (thenar) – only moved with its joint.
        const centre = thumb && k === 0 ? new Vector3() : centreOf(finger, k);
        const depth = thumb ? HAND_FORM.thumbDepth : HAND_FORM.fingerDepth;
        const width = thumb ? 1 : HAND_FORM.fingerWidth;
        const line = ph.head.clone().add(centre);
        maps.set(name, (p) => {
          const rel = p.clone().sub(line);
          const along = rel.dot(ph.dir);
          const a = rel.dot(ph.palmar);
          const b = rel.dot(ph.axis);
          const slim =
            thumb && k === 0
              ? p.clone()
              : line
                  .clone()
                  .add(ph.dir.clone().multiplyScalar(along))
                  .add(ph.palmar.clone().multiplyScalar(a * depth))
                  .add(ph.axis.clone().multiplyScalar(b * width));
          return fanned(slim);
        });
        // The joint moves into the middle of the cross-section (and fans with the finger).
        joints.set(name, fanned(line).toArray());
      });
    }
    // Palm: flatter about its middle, full from a third of the way to the knuckles.
    const mid = (s) => {
      let lo = Infinity;
      let hi = -Infinity;
      const at = s * hand.palmLength;
      const centreAcross = hand.centre.clone().sub(hand.wrist).dot(hand.across);
      for (const v of used) {
        if (weights.joints[v * 4] !== index(`hand_${side}`)) continue;
        const rel = v3([0, 1, 2].map((c) => body.positions[v * 3 + c])).sub(hand.wrist);
        if (Math.abs(rel.dot(hand.along) - at) > 0.01) continue;
        if (Math.abs(rel.dot(hand.across) - centreAcross) > 0.03) continue;
        lo = Math.min(lo, rel.dot(hand.palm));
        hi = Math.max(hi, rel.dot(hand.palm));
      }
      return Number.isFinite(lo) ? (lo + hi) / 2 : 0;
    };
    const mids = [0.3, 0.5, 0.7, 0.9, 1.1].map((s) => [s, mid(s)]);
    const midAt = (s) => {
      if (s <= mids[0][0]) return mids[0][1];
      for (let i = 1; i < mids.length; i++)
        if (s <= mids[i][0]) {
          const [s0, m0] = mids[i - 1];
          const [s1, m1] = mids[i];
          return m0 + ((m1 - m0) * (s - s0)) / (s1 - s0);
        }
      return mids.at(-1)[1];
    };
    maps.set(`hand_${side}`, (p) => {
      const rel = p.clone().sub(hand.wrist);
      const s = rel.dot(hand.along) / hand.palmLength;
      const t = Math.min(1, Math.max(0, (s - 0.1) / 0.25));
      const k = 1 - (1 - HAND_FORM.palmDepth) * t * t * (3 - 2 * t);
      const off = rel.dot(hand.palm) - midAt(s);
      return p.clone().add(hand.palm.clone().multiplyScalar(off * (k - 1)));
    });
    // Blend per vertex by its weights (bones without a map keep the point).
    for (const v of used) {
      let share = 0;
      for (let k = 0; k < 4; k++) if (maps.has(names[weights.joints[v * 4 + k]])) share = 1;
      if (!share) continue;
      const p = v3([0, 1, 2].map((c) => body.positions[v * 3 + c]));
      const out = new Vector3();
      for (let k = 0; k < 4; k++) {
        const w = weights.weights[v * 4 + k];
        if (!w) continue;
        const map = maps.get(names[weights.joints[v * 4 + k]]);
        out.add((map ? map(p) : p.clone()).multiplyScalar(w));
      }
      for (let c = 0; c < 3; c++) positions[v * 3 + c] = out.getComponent(c);
    }
  }
  return { ...body, positions, joints };
}
