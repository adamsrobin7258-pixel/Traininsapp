/**
 * Gripping a bar (male rig with finger bones, phase 18.5). The bar is the reference, not the
 * wrist: each exercise moves the bar, every hand holds it at an explicit grip reference – a line
 * in the hand's rest frame where the bar's axis lies (in the palm for the bench press, at the base
 * of the fingers for the pulldown) – and the arm follows the hand. The fingers and the thumb
 * close around the bar until their palmar surface touches it (contact solved per phalanx on the
 * measured hand: joint positions, phalanx lengths and thickness of the finished body), so the
 * bar neither runs through the hand nor floats beside it.
 *
 * All of it happens in the hand's rest frame (world axes of the rest pose); a clip turns the
 * result with the hand.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { FINGERS } from './rig.mjs';

/** Radius of both bars (metres), see props.mjs. */
export const BAR_RADIUS = 0.014;
/** Air between skin and bar the solver aims for (the skin then touches visibly). */
const CONTACT = 0.0008;

const v3 = (a) => new Vector3(...a);
const perp = (v, axis) =>
  v
    .clone()
    .sub(axis.clone().multiplyScalar(v.dot(axis)))
    .normalize();
const DEG = Math.PI / 180;

/** Joint limits (degrees) per phalanx: [extension, flexion]. */
const LIMITS = {
  finger: [
    [-10, 90],
    [0, 105],
    [0, 80],
  ],
  thumb: [
    [-10, 50],
    [-10, 60],
    [-10, 80],
  ],
};

/**
 * The hand of the finished body (rest pose): wrist, palm frame, and per finger its joints, tip,
 * phalanx directions, flexion axes and palmar thickness – measured on the skinned vertices.
 * @param body { positions, used, weights: { joints, weights, names }, joints: Map }
 */
export function handModel(body, side) {
  const sx = side === 'L' ? 1 : -1;
  const J = (name) => v3(body.joints.get(name));
  const wrist = J(`hand_${side}`);
  const knuckle = (f) => J(`${f}1_${side}`);
  // Palm frame: across the knuckles (index → little finger), along the hand, palm normal (out of
  // the palm; in the rest pose the palms face the thighs).
  const across = knuckle('pinky').sub(knuckle('index')).normalize();
  const centre = knuckle('index').add(knuckle('pinky')).multiplyScalar(0.5);
  const along = perp(centre.clone().sub(wrist), across);
  let palm = new Vector3().crossVectors(across, along).normalize();
  if (palm.x * -sx < 0) palm.negate();

  // Vertices per bone (largest weight).
  const names = body.weights.names;
  const byBone = new Map();
  for (const v of body.used) {
    const bone = names[body.weights.joints[v * 4]];
    if (!bone.endsWith(`_${side}`)) continue;
    if (!byBone.has(bone)) byBone.set(bone, []);
    byBone.get(bone).push(v3([0, 1, 2].map((c) => body.positions[v * 3 + c])));
  }
  const fingers = {};
  for (const finger of FINGERS) {
    const joints = [1, 2, 3].map((k) => J(`${finger}${k}_${side}`));
    const last = joints[2].clone().sub(joints[1]).normalize();
    // Tip: the farthest end-phalanx vertex along the last phalanx.
    let reach = 0;
    for (const p of byBone.get(`${finger}3_${side}`) ?? [])
      reach = Math.max(reach, p.clone().sub(joints[2]).dot(last));
    const tip = joints[2].clone().add(last.clone().multiplyScalar(reach));
    const ends = [joints[1], joints[2], tip];
    const phalanges = joints.map((head, k) => {
      const end = ends[k];
      const length = end.distanceTo(head);
      const dir = end.clone().sub(head).normalize();
      const palmar = perp(palm, dir);
      // Flexion turns the phalanx towards the palm.
      const axis = new Vector3().crossVectors(dir, palmar).normalize();
      // Palmar thickness: skin in front of the bone axis, middle of the phalanx (not the joints).
      let thick = 0;
      let count = 0;
      for (const p of byBone.get(`${finger}${k + 1}_${side}`) ?? []) {
        const rel = p.clone().sub(head);
        const t = rel.dot(dir) / length;
        if (t < 0.2 || t > (k === 2 ? 0.7 : 0.8)) continue;
        thick = Math.max(thick, rel.sub(dir.clone().multiplyScalar(rel.dot(dir))).dot(palmar));
        count++;
      }
      return { head, length, dir, palmar, axis, thick: count ? thick : 0.008 };
    });
    fingers[finger] = { phalanges, tip };
  }
  // Palm surface: how far the palm's skin lies in front of the wrist–knuckle plane, along the hand.
  const palmPoints = byBone.get(`hand_${side}`) ?? [];
  const palmLength = centre.clone().sub(wrist).dot(along);
  const palmSurface = (s) => {
    let best = -Infinity;
    const at = s * palmLength;
    for (const p of palmPoints) {
      const rel = p.clone().sub(wrist);
      if (Math.abs(rel.dot(along) - at) > 0.008) continue;
      // Only the middle of the palm (between index and little finger rays).
      const a = rel.dot(across) - centre.clone().sub(wrist).dot(across);
      if (Math.abs(a) > 0.03) continue;
      best = Math.max(best, rel.dot(palm));
    }
    return best;
  };
  return { side, sx, wrist, across, along, palm, centre, palmLength, palmSurface, fingers };
}

/**
 * Grip reference: the bar's axis in the hand's rest frame. `at` is where across the palm it
 * lies (0 wrist … 1 knuckles), `oblique` how much it turns towards the wrist at the little
 * finger (degrees; a real grip crosses the palm diagonally).
 */
export function gripLine(hand, { at, oblique = 0 }) {
  const { wrist, along, across, palm } = hand;
  const surface = hand.palmSurface(at);
  const centreAcross = hand.centre.clone().sub(wrist).dot(across);
  const point = wrist
    .clone()
    .add(along.clone().multiplyScalar(at * hand.palmLength))
    .add(across.clone().multiplyScalar(centreAcross))
    .add(palm.clone().multiplyScalar(surface + BAR_RADIUS + CONTACT));
  // Turned about the palm normal: the little-finger end towards the wrist.
  const sign = new Vector3().crossVectors(palm, across).dot(along) > 0 ? -1 : 1;
  const axis = across.clone().applyAxisAngle(palm, sign * oblique * DEG);
  return { point, axis };
}

/** Closest distance between segment [a, b] and the infinite line (p, unit d). */
function segmentLineDistance(a, b, p, d) {
  const u = b.clone().sub(a);
  const w = a.clone().sub(p);
  const A = u.dot(u);
  const B = u.dot(d);
  const den = A - B * B;
  const s = Math.max(0, Math.min(1, den > 1e-12 ? (B * d.dot(w) - u.dot(w)) / den : 0));
  const q = a.clone().add(u.multiplyScalar(s));
  const t = q.clone().sub(p).dot(d);
  return q.distanceTo(p.clone().add(d.clone().multiplyScalar(t)));
}

/** Closest distance between two segments (sampled; short segments, enough for a contact). */
function segmentDistance(a, b, c, d) {
  let best = Infinity;
  for (let i = 0; i <= 10; i++) {
    const p = a.clone().lerp(b, i / 10);
    const u = d.clone().sub(c);
    const t = Math.max(0, Math.min(1, p.clone().sub(c).dot(u) / (u.dot(u) || 1)));
    best = Math.min(best, p.distanceTo(c.clone().add(u.multiplyScalar(t))));
  }
  return best;
}

/**
 * Poses one finger from the metacarpal rotation `start`: the knuckle and middle joint take the
 * given angles, the end joint closes from its extension limit until its palmar surface touches
 * the bar (or reaches its limit). Returns absolute rotations (rest frame), the joint angles and
 * the gap per phalanx (metres between skin and bar, negative = into the bar).
 */
function wrap(finger, bar, limits, start, angles) {
  const rotations = [];
  const gaps = [];
  const used = [];
  let R = start.clone();
  const heads = finger.phalanges.map((ph) => ph.head);
  const ends = [heads[1], heads[2], finger.tip];
  let origin = heads[0].clone();
  for (let k = 0; k < 3; k++) {
    const ph = finger.phalanges[k];
    const axis = ph.axis.clone().applyQuaternion(R);
    const offset = ends[k].clone().sub(heads[k]).applyQuaternion(R);
    const gapAt = (deg) => {
      const end = origin.clone().add(offset.clone().applyAxisAngle(axis, deg * DEG));
      return segmentLineDistance(origin, end, bar.point, bar.axis) - (BAR_RADIUS + ph.thick);
    };
    const [lo, hi] = limits[k];
    let angle = angles[k] ?? hi;
    if (angles[k] === undefined)
      for (let deg = lo; deg <= hi; deg += 0.5) {
        if (gapAt(deg) <= CONTACT) {
          angle = deg;
          break;
        }
      }
    R = new Quaternion().setFromAxisAngle(axis, angle * DEG).multiply(R);
    rotations.push(R.clone());
    gaps.push(gapAt(angle));
    used.push(angle);
    origin = origin.clone().add(offset.clone().applyAxisAngle(axis, angle * DEG));
  }
  return { rotations, gaps, angles: used, tip: origin };
}

/**
 * How far a fingertip reaches into the palm (metres, > 0 = into it): its pad against the palm's
 * skin where it lands, between the wrist and the knuckles.
 */
function intoPalm(hand, tip, thick) {
  const rel = tip.clone().sub(hand.wrist);
  const s = rel.dot(hand.along) / hand.palmLength;
  if (s < 0.1 || s > 1.05) return 0;
  const surface = hand.palmSurface(Math.min(1, Math.max(0.2, s)));
  if (!Number.isFinite(surface)) return 0;
  return surface + thick - rel.dot(hand.palm);
}

/**
 * How well a finger holds: no phalanx in the bar, the middle and end phalanx on it (the first one
 * may stay a little off when the bar lies in the palm), and the joints bent as a gripping finger
 * bends them – the middle joint at least as much as the knuckle, the end joint about two thirds
 * of the middle one (1 mm of gap weighs as much as 10° off that pattern).
 */
function holdScore({ gaps, angles: [mcp, pip, dip] }, palm = 0) {
  let score = palm > 0 ? 60 * palm * palm : 0;
  gaps.forEach((g, k) => {
    if (g < 0) score += 60 * g * g;
    else score += (k === 0 ? 0.3 : 1) * g * g;
  });
  const off = (deg) => ((deg / 10) * 0.001) ** 2;
  score += off(dip - 0.67 * pip) + off(Math.max(0, mcp - pip));
  return score;
}

/**
 * Closes one finger around the bar: knuckle and middle joint are searched together (the end
 * joint closes by contact for each pair) for the hold above, the fingertip kept out of the palm –
 * a long finger bends more at the knuckle, a short one wraps with its middle joint.
 */
function closeFinger(hand, finger, bar, limits) {
  let best = null;
  const pad = finger.phalanges[2].thick;
  for (let mcp = limits[0][0]; mcp <= limits[0][1]; mcp += 2)
    for (let pip = limits[1][0]; pip <= limits[1][1]; pip += 2) {
      const result = wrap(finger, bar, limits, new Quaternion(), [mcp, pip]);
      const score = holdScore(result, intoPalm(hand, result.tip, pad));
      if (!best || score < best.score) best = { score, ...result };
    }
  return best;
}

/** Posed segments of a finger for rotations (rest frame). */
function segments(finger, rotations) {
  const heads = finger.phalanges.map((ph) => ph.head);
  const ends = [heads[1], heads[2], finger.tip];
  const out = [];
  let origin = heads[0].clone();
  for (let k = 0; k < 3; k++) {
    const offset = ends[k].clone().sub(heads[k]).applyQuaternion(rotations[k]);
    const end = origin.clone().add(offset);
    out.push([origin, end]);
    origin = end;
  }
  return out;
}

/**
 * The grip pose of a hand around a bar line (rest frame): absolute rotation per finger bone
 * (`index1_L` …) and a report (gaps per phalanx, metres; negative = into the bar).
 */
export function gripPose(hand, bar) {
  const rotations = new Map();
  const report = {};
  const s = hand.side;
  for (const finger of FINGERS.slice(1)) {
    const { rotations: r, gaps } = closeFinger(hand, hand.fingers[finger], bar, LIMITS.finger);
    r.forEach((q, k) => rotations.set(`${finger}${k + 1}_${s}`, q));
    report[finger] = gaps;
  }
  // Thumb: its metacarpal swings in front of the palm and turns (opposition) so that the thumb
  // wraps the bar from the other side and rests against the index finger; the two phalanges
  // then close by contact. Searched over the metacarpal's turn.
  const thumb = hand.fingers.thumb;
  const index = segments(
    hand.fingers.index,
    [1, 2, 3].map((k) => rotations.get(`index${k}_${s}`)),
  );
  const indexThick = hand.fingers.index.phalanges[1].thick;
  const base = thumb.phalanges[0];
  let best = null;
  // Grid search: thumb1 = start (no contact flexion), thumb2/3 close by contact.
  for (let a = -40; a <= 40; a += 5)
    for (let b = -20; b <= 60; b += 5)
      for (let c = -10; c <= 90; c += 10) {
        const start = new Quaternion()
          .setFromAxisAngle(hand.palm, a * DEG)
          .multiply(new Quaternion().setFromAxisAngle(hand.across, b * DEG))
          .multiply(new Quaternion().setFromAxisAngle(base.dir, c * DEG));
        const result = thumbWith(thumb, start, bar);
        const segs = segments(thumb, result.rotations);
        // Wrapping: both phalanges against the bar, the end phalanx on the index finger.
        let score = 0;
        for (const g of result.gaps.slice(1)) score += g > 0 ? g * g * 4 : g * g * 400;
        const metacarpalGap =
          segmentLineDistance(segs[0][0], segs[0][1], bar.point, bar.axis) -
          (BAR_RADIUS + base.thick);
        if (metacarpalGap < 0) score += metacarpalGap * metacarpalGap * 400;
        const toIndex =
          Math.min(
            segmentDistance(segs[2][0], segs[2][1], index[1][0], index[1][1]),
            segmentDistance(segs[2][0], segs[2][1], index[2][0], index[2][1]),
          ) -
          (thumb.phalanges[2].thick + indexThick);
        score += toIndex > 0 ? toIndex * toIndex : toIndex * toIndex * 100;
        // Keep the thumb's own turn moderate (its metacarpal shares weights with the palm).
        score += ((Math.abs(a) + Math.abs(b) + Math.abs(c) * 0.5) * 1e-4) ** 2;
        if (!best || score < best.score) best = { score, result, angles: [a, b, c] };
      }
  best.result.rotations.forEach((q, k) => rotations.set(`thumb${k + 1}_${s}`, q));
  report.thumb = best.result.gaps;
  report.thumbAngles = best.angles;
  return { rotations, report };
}

/** Thumb from a metacarpal rotation: metacarpal fixed, the two phalanges close by contact. */
function thumbWith(thumb, start, bar) {
  return wrap(thumb, bar, LIMITS.thumb, start, [0]);
}

/**
 * World rotation of a hand holding the bar: the grip line's axis onto the bar's axis (index
 * towards the middle of the bar), turned about the bar so that the hand continues the forearm
 * as well as it can (a bar is round: the hand may roll on it). `forearmFor(wrist)` returns the
 * forearm direction the arm takes to reach a wrist position (IK), `forearmDir` is the forearm
 * direction the hand continues at rest, `preferredPalm` the side of the bar the palm is on
 * (overhand).
 */
export function handOnBar({
  hand,
  line,
  barPoint,
  outward,
  preferredPalm,
  forearmFor,
  forearmDir,
}) {
  const base = frameRotation(
    line.axis,
    perp(hand.palm, line.axis),
    outward,
    perp(preferredPalm, outward),
  );
  let best = null;
  for (let deg = -80; deg <= 80; deg += 1) {
    const q = new Quaternion().setFromAxisAngle(outward, deg * DEG).multiply(base);
    const wrist = wristFor(hand, line, barPoint, q);
    const fore = forearmFor(wrist);
    const bend = forearmDir.clone().applyQuaternion(q).angleTo(fore);
    if (!best || bend < best.bend) best = { bend, q, wrist };
  }
  return best;
}

/** Wrist position for a hand rotation that puts the grip line on the bar point. */
export function wristFor(hand, line, barPoint, q) {
  return barPoint.clone().sub(line.point.clone().sub(hand.wrist).applyQuaternion(q));
}

/** Rotation taking frame (a0, b0) to frame (a1, b1); a ⟂ b in each. */
function frameRotation(a0, b0, a1, b1) {
  const basis = (a, b) => {
    const x = a.clone().normalize();
    const y = perp(b, x);
    return new Matrix4().makeBasis(x, y, new Vector3().crossVectors(x, y));
  };
  return new Quaternion().setFromRotationMatrix(basis(a1, b1).multiply(basis(a0, b0).transpose()));
}
