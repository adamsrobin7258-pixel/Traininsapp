/**
 * The body's movement clips, named by the asset contract (`<movement>[_<variant>]`). Authored like
 * the code-built figure's motions: hands and feet follow targets, elbows and knees by two-bone IK
 * with a pole, the forearms turn the palms into the grip (shared between forearm, twist bone and
 * hand). Every bone's rest rotation is the identity, so a pose is a world rotation per bone.
 *
 * World layout of the scene (metres, +Y up, +Z front of the standing figure): the bench runs along
 * Z with its top at 0.45 m, the head end towards −Z; the pulldown seat at 0.455 m, the tower in
 * front of the user. Equipment: `prop_<variant>_<part>` nodes, shown only with clips of that variant.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { RIG } from './rig.mjs';

const v3 = (a) => new Vector3(...a);

/** Rotation taking frame (a0, b0) to frame (a1, b1); a ⟂ b in each. */
function frameRotation(a0, b0, a1, b1) {
  const basis = (a, b) => {
    const x = a.clone().normalize();
    const y = b
      .clone()
      .sub(x.clone().multiplyScalar(b.dot(x)))
      .normalize();
    const z = new Vector3().crossVectors(x, y);
    return new Matrix4().makeBasis(x, y, z);
  };
  const m = basis(a1, b1).multiply(basis(a0, b0).transpose());
  return new Quaternion().setFromRotationMatrix(m);
}

const perp = (v, axis) =>
  v
    .clone()
    .sub(axis.clone().multiplyScalar(v.dot(axis)))
    .normalize();

/** Two-bone IK (bone lengths kept, out-of-reach targets clamped); returns the middle joint. */
function solveTwoBone(root, target, a, b, pole) {
  const toTarget = target.clone().sub(root);
  const dir = toTarget.clone().normalize();
  const dist = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, toTarget.length()));
  const cos = (a * a + dist * dist - b * b) / (2 * a * dist);
  const bend = perp(pole, dir);
  return root
    .clone()
    .add(dir.clone().multiplyScalar(a * cos))
    .add(bend.multiplyScalar(a * Math.sqrt(Math.max(0, 1 - cos * cos))));
}

/** Closing angles (degrees) of a full grip around a bar. */
const GRIP = {
  knuckles: 62,
  middle: 78,
  thumbOpposition: 40,
  thumbFlex: -30,
};

/**
 * The shoulder girdle with the arm (scapulohumeral rhythm): above ~40° of arm elevation the
 * clavicle lifts with about a third of it, and it comes forward when the hands reach to the
 * front – the shoulder follows the arm instead of the skin folding in the armpit. Only for
 * frames that ask for it (`frame.shoulderRhythm`); otherwise the girdle stays with the chest.
 */
function shoulderGirdle(frame, s, chest, restOf, heads) {
  if (!frame.shoulderRhythm) return chest;
  const i = s === 'L' ? 0 : 1;
  const sx = s === 'L' ? 1 : -1;
  // Where the shoulder joint would be with the girdle at rest on the chest.
  const girdle = restOf(`shoulder_${s}`)
    .sub(restOf('chest'))
    .applyQuaternion(chest)
    .add(heads.get('chest'));
  const joint = restOf(`upperArm_${s}`)
    .sub(restOf(`shoulder_${s}`))
    .applyQuaternion(chest)
    .add(girdle);
  const toHand = frame.hands[i]
    .clone()
    .sub(joint)
    .applyQuaternion(chest.clone().invert())
    .normalize();
  const elevation = Math.acos(Math.max(-1, Math.min(1, -toHand.y)));
  const lift = Math.min(20, Math.max(0, ((elevation * 180) / Math.PI - 45) * 0.28));
  const forward = Math.min(10, Math.max(0, toHand.z) * 12);
  const local = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), (sx * lift * Math.PI) / 180)
    .premultiply(
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (-sx * forward * Math.PI) / 180),
    );
  return chest.clone().multiply(local);
}

/** 0 → 1 → 0 over a loop with a short calm hold at both turns (as the code-built figure). */
export function repetition(phase) {
  const p = phase - Math.floor(phase);
  const wave = (1 - Math.cos(2 * Math.PI * p)) / 2;
  return wave * wave * (3 - 2 * wave);
}
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

/**
 * Poses the rig for one frame.
 * @param rest Map bone → rest joint position (world)
 * @param frame { pelvis: {position, rotation}, hands: [L,R] world targets, elbowPoles, feet,
 *   kneePoles, palms: [L,R] world direction the palm should face (null = keep) }
 * @returns { world: Map bone → Quaternion, heads: Map bone → Vector3 }
 */
export function poseFrame(rest, frame, rig = RIG) {
  const ORDER = rig.map(([name]) => name);
  const PARENT = new Map(rig.map(([name, parent]) => [name, parent]));
  const world = new Map();
  const heads = new Map();
  const restOf = (name) => v3(rest.get(name));
  const place = (name, rotation) => {
    const parent = PARENT.get(name);
    world.set(name, rotation);
    if (!parent) heads.set(name, restOf(name));
    else if (name === 'pelvis') heads.set(name, frame.pelvis.position.clone());
    else {
      const offset = restOf(name).sub(restOf(parent)).applyQuaternion(world.get(parent));
      heads.set(name, heads.get(parent).clone().add(offset));
    }
  };
  const qp = frame.pelvis.rotation;
  place('root', new Quaternion());
  place('pelvis', qp);
  for (const name of ['spine', 'chest', 'neck', 'head']) place(name, frame.spine?.[name] ?? qp);

  ['L', 'R'].forEach((s, i) => {
    const sx = s === 'L' ? 1 : -1;
    place(`shoulder_${s}`, shoulderGirdle(frame, s, world.get('chest'), restOf, heads));
    // Arm.
    const S0 = restOf(`upperArm_${s}`);
    const E0 = restOf(`forearm_${s}`);
    const W0 = restOf(`hand_${s}`);
    const upper0 = E0.clone().sub(S0);
    const fore0 = W0.clone().sub(E0);
    const up0 = upper0.clone().normalize();
    const f0 = fore0.clone().normalize();
    const restQ = world.get(`shoulder_${s}`);
    // Rest hinge: elbow points back (−Z) in the rest pose, in the shoulder's current frame.
    const hinge0 = new Vector3().crossVectors(up0, perp(new Vector3(0, 0, -1), up0)).normalize();
    // Place the upper arm first with the rest rotation to know where the shoulder joint is.
    place(`upperArm_${s}`, restQ);
    const S = heads.get(`upperArm_${s}`);
    const W = frame.hands[i];
    const E = solveTwoBone(S, W, upper0.length(), fore0.length(), frame.elbowPoles[i]);
    const u1 = E.clone().sub(S).normalize();
    const f1 = W.clone().sub(E).normalize();
    const pole1 = perp(frame.elbowPoles[i], u1);
    const hinge1 = new Vector3().crossVectors(u1, pole1).normalize();
    const qUpper = frameRotation(up0, hinge0, u1, hinge1);
    world.set(`upperArm_${s}`, qUpper);
    const qFore = frameRotation(f0, perp(hinge0, f0), f1, perp(hinge1, f1));
    // Palm into the grip: the turn needed about the forearm, shared by forearm, twist and hand.
    let turn = 0;
    if (frame.palms?.[i]) {
      const palm = perp(new Vector3(-sx, 0, 0), f0).applyQuaternion(qFore);
      const want = perp(frame.palms[i], f1);
      turn = Math.atan2(new Vector3().crossVectors(palm, want).dot(f1), palm.dot(want));
    }
    const twist = (share) => new Quaternion().setFromAxisAngle(f1, turn * share).multiply(qFore);
    place(`forearm_${s}`, twist(0.25));
    place(`forearmTwist_${s}`, twist(0.7));
    place(`hand_${s}`, twist(1));
    if (PARENT.has(`fingers_${s}`)) {
      // Grip: the fingers close at the knuckles and the middle joints, the thumb comes in.
      const g = frame.grip ?? 0;
      const handQ = world.get(`hand_${s}`);
      const along0 = restOf(`fingers_${s}`)
        .sub(restOf(`hand_${s}`))
        .normalize();
      const palm0 = perp(new Vector3(-sx, 0, 0), along0);
      const axis = new Vector3().crossVectors(along0, palm0).normalize().applyQuaternion(handQ);
      const curl = (deg) =>
        new Quaternion().setFromAxisAngle(axis, (deg * Math.PI * g) / 180).multiply(handQ);
      place(`fingers_${s}`, curl(GRIP.knuckles));
      place(`fingerTips_${s}`, curl(GRIP.knuckles + GRIP.middle));
      // Thumb from its saddle joint: turned in front of the palm (opposition), then flexed.
      const along = along0.clone().applyQuaternion(handQ);
      const opposition = new Quaternion().setFromAxisAngle(
        along,
        (-sx * GRIP.thumbOpposition * Math.PI * g) / 180,
      );
      const flex = new Quaternion().setFromAxisAngle(axis, (GRIP.thumbFlex * Math.PI * g) / 180);
      place(`thumb_${s}`, flex.multiply(opposition).multiply(handQ));
    }

    // Leg.
    const H0 = restOf(`thigh_${s}`);
    const K0 = restOf(`shin_${s}`);
    const A0 = restOf(`foot_${s}`);
    const thigh0 = K0.clone().sub(H0);
    const shin0 = A0.clone().sub(K0);
    const t0 = thigh0.clone().normalize();
    const s0 = shin0.clone().normalize();
    const knee0 = new Vector3().crossVectors(t0, perp(new Vector3(0, 0, 1), t0)).normalize();
    place(`thigh_${s}`, qp);
    const H = heads.get(`thigh_${s}`);
    const A = frame.feet[i];
    const K = solveTwoBone(H, A, thigh0.length(), shin0.length(), frame.kneePoles[i]);
    const t1 = K.clone().sub(H).normalize();
    const s1 = A.clone().sub(K).normalize();
    const knee1 = new Vector3().crossVectors(t1, perp(frame.kneePoles[i], t1)).normalize();
    world.set(`thigh_${s}`, frameRotation(t0, knee0, t1, knee1));
    place(`shin_${s}`, frameRotation(s0, perp(knee0, s0), s1, perp(knee1, s1)));
    place(`foot_${s}`, frame.footRotation ?? new Quaternion());
  });
  // Heads of the children of re-rotated bones.
  const ordered = new Map();
  for (const name of ORDER) {
    const parent = PARENT.get(name);
    if (!parent) ordered.set(name, restOf(name));
    else if (name === 'pelvis') ordered.set(name, frame.pelvis.position.clone());
    else
      ordered.set(
        name,
        ordered
          .get(parent)
          .clone()
          .add(restOf(name).sub(restOf(parent)).applyQuaternion(world.get(parent))),
      );
  }
  return { world, heads: ordered };
}

/** Local rotations (parent space) of a posed frame, for the glTF animation channels. */
export function localRotations(world, rig = RIG) {
  const ORDER = rig.map(([name]) => name);
  const PARENT = new Map(rig.map(([name, parent]) => [name, parent]));
  const local = new Map();
  for (const name of ORDER) {
    const parent = PARENT.get(name);
    const q = world.get(name) ?? new Quaternion();
    local.set(name, parent ? world.get(parent).clone().invert().multiply(q) : q.clone());
  }
  return local;
}

/**
 * Clip definitions for a body (its rest joints and a few measurements).
 * @param rest Map bone → [x, y, z]
 * @param body { backDepth: distance pelvis joint → back surface, chestFront: chest surface z in
 *   front of the shoulder joint, seatDrop: pelvis joint above the seat when sitting }
 */
export function clipDefinitions(rest, body, { grip = false, shoulderRhythm = false } = {}) {
  const motion = { ...(grip ? { grip: 1 } : {}), ...(shoulderRhythm ? { shoulderRhythm } : {}) };
  const R = (name) => v3(rest.get(name));
  const pelvis0 = R('pelvis');
  const shoulder0 = R('upperArm_L');
  const armLength = R('forearm_L').distanceTo(shoulder0) + R('hand_L').distanceTo(R('forearm_L'));
  const ankle = R('foot_L').y;
  const gripX = shoulder0.x + 0.13;

  // Bench press: lying on the back, head towards −Z.
  const lying = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  const benchTop = 0.45;
  const lyingPelvis = new Vector3(0, benchTop + body.backDepth, 0.2);
  /** Body coordinates relative to the pelvis joint (standing frame) → world, lying. */
  const fromLyingBody = (p) => v3(p).sub(pelvis0).applyQuaternion(lying).add(lyingPelvis);

  const bench = {
    name: 'horizontalPush_bench',
    duration: 4.4,
    variant: 'bench',
    frame(phase) {
      const d = repetition(phase);
      const sy = shoulder0.y;
      const hand = (sx) =>
        fromLyingBody(
          lerp(
            [sx * gripX, sy - 0.04, shoulder0.z + armLength * 0.93],
            [sx * gripX, sy - 0.14, body.chestFront - 0.04],
            d,
          ),
        );
      const pole = (sx) => v3(lerp([sx, -0.2, -0.3], [sx, -0.35, -0.8], d)).applyQuaternion(lying);
      const toFeet = new Vector3(0, -1, 0).applyQuaternion(lying);
      return {
        pelvis: { position: lyingPelvis.clone(), rotation: lying.clone() },
        hands: [hand(1), hand(-1)],
        elbowPoles: [pole(1), pole(-1)],
        palms: [toFeet, toFeet],
        ...motion,
        feet: [new Vector3(0.24, ankle, 0.66), new Vector3(-0.24, ankle, 0.66)],
        kneePoles: [new Vector3(0.3, 1, 0.2), new Vector3(-0.3, 1, 0.2)],
      };
    },
    /** Bar: centre between the grips (along the hands, in the palm). */
    bar: true,
  };

  // Lat pulldown: seated, the tower in front.
  const seat = 0.455;
  const seatedPelvis = new Vector3(0, seat + body.seatDrop, 0.02);
  const pulldown = {
    name: 'verticalPull_cable',
    duration: 4.4,
    variant: 'cable',
    frame(phase) {
      const d = repetition(phase);
      const lean = new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0),
        -(8 + 6 * d) * (Math.PI / 180),
      );
      const fromSeated = (p) => v3(p).sub(pelvis0).applyQuaternion(lean).add(seatedPelvis);
      const sy = shoulder0.y;
      const hand = (sx) =>
        v3(
          lerp(
            [sx * (gripX + 0.07), seatedPelvis.y + (sy - pelvis0.y) + 0.5, 0.06],
            [sx * (gripX + 0.03), seatedPelvis.y + (sy - pelvis0.y) - 0.02, body.chestFront + 0.06],
            d,
          ),
        );
      const pole = (sx) => v3(lerp([sx, 0.1, -0.3], [sx * 0.6, -1, -0.45], d));
      return {
        pelvis: { position: seatedPelvis.clone(), rotation: lean.clone() },
        spine: {},
        hands: [hand(1), hand(-1)],
        elbowPoles: [pole(1), pole(-1)],
        palms: [new Vector3(0, 0, 1), new Vector3(0, 0, 1)],
        ...motion,
        feet: [new Vector3(0.17, ankle, 0.46), new Vector3(-0.17, ankle, 0.46)],
        kneePoles: [new Vector3(0.15, 0.3, 1), new Vector3(-0.15, 0.3, 1)],
        _fromSeated: fromSeated,
      };
    },
    bar: true,
    cable: true,
  };

  // Rest: the standing rest pose (one key).
  const restClip = {
    name: 'rest',
    duration: 0,
    variant: null,
    frame: null,
  };
  return [restClip, bench, pulldown];
}
