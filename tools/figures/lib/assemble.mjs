/** The shaped, posed body of a variant: positions, faces, rig, ready for segmentation. */
import { readBaseMesh, readSkeleton, readWeights } from './makehuman.mjs';
import { neighbours, poseMatrices, restPose, skin, smoothHead, twistForearms } from './pose.mjs';
import { rigFor, rigJoints, rigWeights } from './rig.mjs';
import { buildShape } from './shape.mjs';
import { relaxHands } from './hands.mjs';
import { subdivideBody } from './subdivide.mjs';

export function loadSources(dataDir) {
  return {
    dataDir,
    mesh: readBaseMesh(dataDir),
    skeleton: readSkeleton(dataDir),
    mhWeights: readWeights(dataDir),
  };
}

export function assembleBody(sources, variant) {
  const { dataDir, mesh, skeleton, mhWeights } = sources;
  const faces = mesh.faces.filter((f) => f.group === 'body');
  const used = [...new Set(faces.flatMap((f) => f.v))];
  const shaped = relaxHands(buildShape(dataDir, mesh, variant), skeleton, mhWeights);
  const rig = rigFor(variant);
  const { joints, tail } = rigJoints(skeleton, shaped, rig);
  const weights = rigWeights(skeleton, mhWeights, shaped.length / 3, rig);
  const { world, heads } = poseMatrices(joints, restPose(joints, tail), rig);
  let positions = skin(shaped, weights, world);
  positions = twistForearms(positions, weights, heads, Number(process.env.TWIST ?? 10));
  positions = smoothHead(positions, weights, neighbours(faces, positions.length / 3), used);
  // Floor at y = 0.
  let minY = Infinity;
  for (const v of used) minY = Math.min(minY, positions[v * 3 + 1]);
  // Origin under the body's centre: between the hip joints (MakeHuman's pelvis joint sits near
  // the back).
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
  // Trunk and limbs get one subdivision step; head, hands and feet are dense already.
  const dense = new Set(
    weights.names
      .map((n, i) =>
        /^(head|hand_[LR]|foot_[LR]|fingers_[LR]|fingerTips_[LR]|thumb_[LR])$/.test(n) ? i : -1,
      )
      .filter((i) => i >= 0),
  );
  return subdivideBody(
    { positions, faces, used, weights, joints: posedJoints, uvs: mesh.uvs },
    (f) => f.v.every((v) => !dense.has(weights.joints[v * 4])),
  );
}
