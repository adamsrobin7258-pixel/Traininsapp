/**
 * FALLBACK BODY – a technical placeholder, not the final Kalethra visual.
 *
 * Built in code from soft shapes (no external asset, no licence question), so the 3D features –
 * muscle highlight, clips, turning, front/back – work before the modelled bodies exist and on
 * devices where an asset cannot be loaded. It implements the same `FigureBody` interface and
 * names its muscle parts by the asset contract (`muscle_<group>`), exactly like a GLB body will.
 * See docs/EXERCISE_VISUALS.md for the target quality it does not reach.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  CircleGeometry,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { FIGURE_MUSCLES, type FigureMuscle, type MuscleHighlight } from '@/core/training';
import { SECONDARY_MIX, type BodyOptions, type FigureBody } from './body';
import { muscleNodeName, resolveClip } from './contract';
import {
  BODY,
  FALLBACK_CLIPS,
  normalize,
  scale,
  skeleton,
  sub,
  type MotionDefinition,
  type Skeleton,
  type Vec3,
} from './rig';

type Base = 'body' | 'shirt' | 'shorts';

/** Which surface a muscle group sits on (its neutral colour). */
const MUSCLE_BASE: Record<FigureMuscle, Base> = {
  chest: 'shirt',
  back: 'shirt',
  lats: 'shirt',
  shoulders: 'shirt',
  core: 'shirt',
  biceps: 'body',
  triceps: 'body',
  forearms: 'body',
  glutes: 'shorts',
  quadriceps: 'body',
  hamstrings: 'body',
  adductors: 'body',
  calves: 'body',
};

const matte = (color: string) =>
  new MeshStandardMaterial({ color: new Color(color), roughness: 0.88, metalness: 0 });

const SPHERE = new SphereGeometry(1, 28, 18);

function atY(mesh: Mesh, y: number): Mesh {
  mesh.position.y = y;
  return mesh;
}

function ellipsoid(material: MeshStandardMaterial, position: Vec3, size: Vec3, rotZ = 0): Mesh {
  const mesh = new Mesh(SPHERE, material);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  mesh.rotation.z = rotZ;
  return mesh;
}

function capsule(material: MeshStandardMaterial, radius: number, lengthM: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, lengthM, 6, 20), material);
  mesh.position.y = -lengthM / 2;
  return mesh;
}

/** A tapered body part turned around Y and flattened front to back (torso, pelvis). */
function lathe(material: MeshStandardMaterial, profile: [number, number][], depth: number) {
  const mesh = new Mesh(
    new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      40,
    ),
    material,
  );
  mesh.scale.z = depth;
  return mesh;
}

/**
 * Local frame of a bone: origin at the parent joint, the bone along local −Y, local +Z = its
 * front. `front` comes from the IK's bend direction, which is always at a clear angle to the
 * bone, so the twist is stable – no flips while a limb moves or the figure turns.
 */
export function boneFrame(from: Vec3, to: Vec3, front: Vec3): { position: Vec3; basis: Matrix4 } {
  const y = normalize(sub(from, to));
  const z = normalize(sub(front, scale(y, front[0] * y[0] + front[1] * y[1] + front[2] * y[2])));
  const yv = new Vector3(...y);
  const zv = new Vector3(...z);
  const xv = new Vector3().crossVectors(yv, zv).normalize();
  zv.crossVectors(xv, yv).normalize();
  return { position: from, basis: new Matrix4().makeBasis(xv, yv, zv) };
}

function orient(group: Object3D, from: Vec3, to: Vec3, front: Vec3) {
  const frame = boneFrame(from, to, front);
  group.position.set(...frame.position);
  group.quaternion.setFromRotationMatrix(frame.basis);
}

/** Contact shadow: a soft radial fade, made from data (no canvas needed). */
function shadowTexture(): DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * Math.pow(1 - d, 2));
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

/** The fallback body playing a clip (resolved to the clips it has). */
export function createFallbackBody({
  clip: requested,
  palette,
  highlight,
}: BodyOptions): FigureBody {
  const clip = resolveClip(requested, Object.keys(FALLBACK_CLIPS)) ?? 'rest';
  const motion: MotionDefinition =
    FALLBACK_CLIPS[clip] ?? (FALLBACK_CLIPS.rest as MotionDefinition);
  const materials = {
    body: matte(palette.body),
    shirt: matte(palette.shirt),
    shorts: matte(palette.shorts),
    shoe: matte(palette.shoe),
    equipment: matte(palette.equipment),
    metal: new MeshStandardMaterial({
      color: new Color(palette.metal),
      roughness: 0.55,
      metalness: 0.2,
    }),
  };
  const muscle = Object.fromEntries(
    FIGURE_MUSCLES.map((group) => [group, matte(palette[MUSCLE_BASE[group]])]),
  ) as Record<FigureMuscle, MeshStandardMaterial>;
  const named = (mesh: Mesh, group: FigureMuscle) => {
    mesh.name = muscleNodeName(group);
    // A soft relief, not a separate pad: flatten the part a little towards the surface.
    if (mesh.geometry === SPHERE) mesh.scale.z *= 0.82;
    return mesh;
  };

  // root: the body's coordinate system (floor y = 0). body: posture and skeleton. Props
  // (equipment, bar, cable, shadow) are siblings of `body` under `root`.
  const root = new Group();
  root.name = 'figure';
  const body = new Group();
  body.name = 'skeleton';
  root.add(body);

  // Torso (shirt) and pelvis (shorts).
  body.add(
    lathe(
      materials.shirt,
      [
        [0.0, -0.03],
        [0.13, -0.02],
        [0.143, 0.08],
        [0.138, 0.16],
        [0.158, 0.28],
        [0.183, 0.38],
        [0.178, 0.45],
        [0.13, 0.51],
        [0.0, 0.535],
      ],
      0.62,
    ),
    lathe(
      materials.shorts,
      [
        [0.0, -0.17],
        [0.12, -0.165],
        [0.165, -0.1],
        [0.16, 0.0],
        [0.14, 0.06],
        [0.0, 0.065],
      ],
      0.7,
    ),
  );
  // Neck and a reduced head: no face, no hair.
  const neck = new Mesh(new CylinderGeometry(0.048, 0.055, 0.14, 20), materials.body);
  neck.position.y = BODY.neckY + 0.03;
  const head = ellipsoid(materials.body, [0, BODY.headY, 0.005], [0.093, 0.112, 0.1]);
  body.add(neck, head);

  // Muscle groups on the torso – subtle relief, coloured when used.
  for (const side of [1, -1]) {
    body.add(
      named(
        ellipsoid(muscle.chest, [0.074 * side, 0.375, 0.084], [0.083, 0.058, 0.034], 0.12 * side),
        'chest',
      ),
      named(
        ellipsoid(muscle.lats, [0.1 * side, 0.25, -0.066], [0.058, 0.125, 0.03], -0.28 * side),
        'lats',
      ),
      named(
        ellipsoid(muscle.glutes, [0.068 * side, -0.085, -0.098], [0.074, 0.074, 0.048]),
        'glutes',
      ),
    );
  }
  body.add(
    named(ellipsoid(muscle.core, [0, 0.165, 0.074], [0.075, 0.115, 0.03]), 'core'),
    named(ellipsoid(muscle.back, [0, 0.4, -0.084], [0.125, 0.085, 0.034]), 'back'),
    named(ellipsoid(muscle.back, [0, 0.49, -0.035], [0.09, 0.03, 0.052]), 'back'),
  );

  // Limbs: one group per bone, oriented every frame.
  const limbs = [1, -1].map((side) => {
    const upperArm = new Group();
    upperArm.add(
      capsule(materials.body, 0.05, BODY.upperArm - 0.05),
      // Short sleeve.
      atY(new Mesh(new CylinderGeometry(0.06, 0.057, 0.1, 20), materials.shirt), -0.04),
      named(ellipsoid(muscle.shoulders, [0, -0.025, 0], [0.072, 0.082, 0.07]), 'shoulders'),
      named(ellipsoid(muscle.biceps, [0, -0.16, 0.028], [0.036, 0.08, 0.03]), 'biceps'),
      named(ellipsoid(muscle.triceps, [0, -0.15, -0.03], [0.037, 0.09, 0.031]), 'triceps'),
    );
    const forearm = new Group();
    forearm.add(
      named(capsule(muscle.forearms, 0.04, BODY.forearm - 0.04), 'forearms'),
      named(ellipsoid(muscle.forearms, [0, -0.075, 0], [0.048, 0.085, 0.045]), 'forearms'),
      ellipsoid(materials.body, [0, -BODY.forearm - 0.035, 0], [0.034, 0.05, 0.022]),
    );
    const thigh = new Group();
    thigh.add(
      capsule(materials.body, 0.07, BODY.thigh - 0.07),
      atY(new Mesh(new CylinderGeometry(0.088, 0.083, 0.17, 24), materials.shorts), -0.07),
      named(ellipsoid(muscle.quadriceps, [0, -0.27, 0.042], [0.06, 0.12, 0.04]), 'quadriceps'),
      named(ellipsoid(muscle.hamstrings, [0, -0.27, -0.04], [0.056, 0.12, 0.037]), 'hamstrings'),
      named(ellipsoid(muscle.adductors, [-0.036 * side, -0.2, 0], [0.03, 0.1, 0.045]), 'adductors'),
    );
    const shin = new Group();
    shin.add(
      capsule(materials.body, 0.048, BODY.shin - 0.05),
      named(ellipsoid(muscle.calves, [0, -0.12, -0.032], [0.047, 0.1, 0.04]), 'calves'),
      ellipsoid(materials.shoe, [0, -BODY.shin - 0.02, 0.055], [0.05, 0.04, 0.11]),
    );
    body.add(upperArm, forearm, thigh, shin);
    return { upperArm, forearm, thigh, shin };
  });

  // Equipment in world coordinates.
  const equipment = new Group();
  equipment.name = 'prop_equipment';
  root.add(equipment);
  const box = (w: number, h: number, d: number, at: Vec3, material = materials.equipment) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(...at);
    equipment.add(mesh);
    return mesh;
  };
  if (motion.equipment === 'bench') {
    box(0.3, 0.07, 1.2, [0, 0.415, -0.15]);
    box(0.24, 0.38, 0.06, [0, 0.19, -0.6]);
    box(0.24, 0.38, 0.06, [0, 0.19, 0.3]);
  } else if (motion.equipment === 'pulldown') {
    box(0.42, 0.07, 0.36, [0, 0.42, 0.02]);
    box(0.08, 0.38, 0.08, [0, 0.19, 0.02]);
    // The tower stands in front of the user (as on a real machine), so the back stays visible.
    box(0.07, 2.3, 0.07, [0, 1.15, 0.72]);
    box(0.07, 0.07, 0.68, [0, 2.3, 0.4]);
    const pad = new Mesh(new CylinderGeometry(0.05, 0.05, 0.42, 16), materials.equipment);
    pad.rotation.z = Math.PI / 2;
    pad.position.set(0, 0.78, 0.33);
    equipment.add(pad);
  }

  // Bar between the hands, cable to the pulley.
  const bar = new Group();
  bar.name = 'prop_bar';
  if (motion.bar) {
    const width = motion.equipment === 'bench' ? 1.5 : 1.1;
    const rod = new Mesh(new CylinderGeometry(0.014, 0.014, width, 12), materials.metal);
    rod.rotation.z = Math.PI / 2;
    bar.add(rod);
    if (motion.equipment === 'bench') {
      for (const side of [1, -1]) {
        const plate = new Mesh(new CylinderGeometry(0.11, 0.11, 0.035, 28), materials.metal);
        plate.rotation.z = Math.PI / 2;
        plate.position.x = 0.58 * side;
        bar.add(plate);
      }
    }
    root.add(bar);
  }
  const cable =
    motion.equipment === 'pulldown'
      ? new Mesh(new CylinderGeometry(0.005, 0.005, 1, 6), materials.metal)
      : null;
  if (cable) {
    cable.name = 'prop_cable';
    root.add(cable);
  }

  // Posture: lying with the back on the bench, sitting on the seat, or standing.
  if (motion.posture === 'supine') {
    body.rotation.x = -Math.PI / 2;
    body.position.set(0, 0.56, 0.2);
  } else if (motion.posture === 'seated') {
    body.position.set(0, 0.61, 0);
  } else {
    body.position.set(0, 0.98, 0);
  }

  const shadowMaterial = new MeshBasicMaterial({
    color: new Color(palette.shadow),
    map: shadowTexture(),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadow = new Mesh(new CircleGeometry(0.9, 40), shadowMaterial);
  shadow.name = 'prop_shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  shadow.scale.set(motion.posture === 'supine' ? 0.8 : 0.7, 1, 1);
  root.add(shadow);

  // Skeleton coordinates → root coordinates, through the skeleton's *local* transform only.
  // (Using world matrices here once let the bar follow the view's turn twice.)
  const toRoot = (point: Vec3): Vector3 => {
    body.updateMatrix();
    return new Vector3(...point).applyMatrix4(body.matrix);
  };

  function applySkeleton(s: Skeleton) {
    limbs.forEach((limb, i) => {
      const side = i as 0 | 1;
      // Biceps on the inner side of the elbow; quadriceps on the side the knee points to.
      const armFront = scale(s.elbowBend[side], -1);
      orient(limb.upperArm, s.shoulder[side], s.elbow[side], armFront);
      orient(limb.forearm, s.elbow[side], s.hand[side], armFront);
      orient(limb.thigh, s.hip[side], s.knee[side], s.kneeBend[side]);
      orient(limb.shin, s.knee[side], s.foot[side], s.kneeBend[side]);
    });
    if (motion.bar) {
      const left = toRoot(s.hand[0]);
      const right = toRoot(s.hand[1]);
      bar.position.copy(left).add(right).multiplyScalar(0.5);
      bar.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), left.clone().sub(right).normalize());
      if (cable) {
        const top = new Vector3(0, 2.27, 0.08);
        const length = top.distanceTo(bar.position);
        cable.position.copy(top).add(bar.position).multiplyScalar(0.5);
        cable.scale.set(1, length, 1);
        cable.quaternion.copy(
          new Quaternion().setFromUnitVectors(
            new Vector3(0, 1, 0),
            top.clone().sub(bar.position).normalize(),
          ),
        );
      }
    }
  }

  function setHighlight(highlight: MuscleHighlight) {
    for (const group of FIGURE_MUSCLES) {
      const base = new Color(current[MUSCLE_BASE[group]]);
      const accent = new Color(current.accent);
      const level = highlight[group];
      muscle[group].color.copy(
        level === 'primary'
          ? accent
          : level === 'secondary'
            ? base.lerp(accent, SECONDARY_MIX)
            : base,
      );
      muscle[group].userData.level = level ?? 'neutral';
    }
  }

  let current = palette;
  let lastHighlight = highlight;
  let phase = motion.stillPhase;
  setHighlight(highlight);
  applySkeleton(skeleton(motion, phase));

  return {
    root,
    source: 'fallback',
    clip,
    animated: motion.durationS > 0,
    view: motion.view,
    advance(seconds) {
      if (motion.durationS <= 0) return;
      phase = (phase + seconds / motion.durationS) % 1;
      applySkeleton(skeleton(motion, phase));
    },
    setHighlight(next) {
      lastHighlight = next;
      setHighlight(next);
    },
    setPalette(next) {
      current = next;
      for (const key of ['body', 'shirt', 'shorts', 'shoe', 'equipment', 'metal'] as const) {
        materials[key].color.set(next[key]);
      }
      shadowMaterial.color.set(next.shadow);
      setHighlight(lastHighlight);
    },
    dispose() {
      const geometries = new Set<BufferGeometry>();
      root.traverse((object) => {
        if (object instanceof Mesh && object.geometry !== SPHERE) {
          geometries.add(object.geometry as BufferGeometry);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of [...Object.values(materials), ...Object.values(muscle)]) {
        material.dispose();
      }
      shadowMaterial.map?.dispose();
      shadowMaterial.dispose();
    },
  };
}
