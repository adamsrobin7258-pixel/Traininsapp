/**
 * The Kalethra rig (asset contract bones) derived from MakeHuman's default skeleton: bone
 * positions from MakeHuman's joint helpers, skin weights merged from its 163 bones into the
 * contract bones (fingers into the hand, toes into the foot, face bones into the head …).
 */

/** Contract bone → [parent, MakeHuman bone whose head is this bone's position, merged bones]. */
export const RIG = [
  ['root', null, null, []],
  ['pelvis', 'root', 'root', ['root', 'pelvis.L', 'pelvis.R']],
  ['spine', 'pelvis', 'spine05', ['spine05', 'spine04', 'spine03']],
  ['chest', 'spine', 'spine02', ['spine02', 'spine01', 'breast.L', 'breast.R']],
  ['neck', 'chest', 'neck01', ['neck01', 'neck02', 'neck03']],
  ['head', 'neck', 'head', ['head', '*face']],
  ...['L', 'R'].flatMap((s) => [
    [`shoulder_${s}`, 'chest', `clavicle.${s}`, [`clavicle.${s}`, `shoulder01.${s}`]],
    [`upperArm_${s}`, `shoulder_${s}`, `upperarm01.${s}`, [`upperarm01.${s}`, `upperarm02.${s}`]],
    [`forearm_${s}`, `upperArm_${s}`, `lowerarm01.${s}`, [`lowerarm01.${s}`]],
    // Not required by the contract: carries part of the forearm's turn (pronation), so turning
    // the hand does not wring the elbow.
    [`forearmTwist_${s}`, `forearm_${s}`, `lowerarm02.${s}`, [`lowerarm02.${s}`]],
    [`hand_${s}`, `forearmTwist_${s}`, `wrist.${s}`, [`wrist.${s}`, `*hand.${s}`]],
    [`thigh_${s}`, 'pelvis', `upperleg01.${s}`, [`upperleg01.${s}`, `upperleg02.${s}`]],
    [`shin_${s}`, `thigh_${s}`, `lowerleg01.${s}`, [`lowerleg01.${s}`, `lowerleg02.${s}`]],
    [`foot_${s}`, `shin_${s}`, `foot.${s}`, [`foot.${s}`, `*toes.${s}`]],
  ]),
];

/**
 * Hand bones of the male body (phase 18.4, beyond the contract): the four fingers' first
 * phalanges, their middle and end phalanges, and the thumb – so a clip can close the hand around
 * a bar. A variant without them keeps fingers merged into `hand_*`.
 */
const HAND_BONES = ['L', 'R'].flatMap((s) => [
  [`fingers_${s}`, `hand_${s}`, `finger3-1.${s}`, [2, 3, 4, 5].map((f) => `finger${f}-1.${s}`)],
  [
    `fingerTips_${s}`,
    `fingers_${s}`,
    `finger3-2.${s}`,
    [2, 3, 4, 5].flatMap((f) => [`finger${f}-2.${s}`, `finger${f}-3.${s}`]),
  ],
  [`thumb_${s}`, `hand_${s}`, `finger1-1.${s}`, [1, 2, 3].map((k) => `finger1-${k}.${s}`)],
]);

/** The rig of a variant: the contract bones, for the male body with hand bones. */
export function rigFor(variant) {
  return variant === 'male' ? [...RIG, ...HAND_BONES] : RIG;
}

/** Which rig bone a MakeHuman bone's weights go to. */
function contractBoneOf(mhBone, mhBones, rig = RIG) {
  for (const [name, , , merged] of rig) {
    if (merged.includes(mhBone)) return name;
  }
  const side = mhBone.endsWith('.L') ? 'L' : mhBone.endsWith('.R') ? 'R' : null;
  if (side && /finger|metacarpal|thumb/.test(mhBone)) return `hand_${side}`;
  if (side && /toe/.test(mhBone)) return `foot_${side}`;
  // Walk up to the first bone that is mapped (face bones → head, …).
  let parent = mhBones[mhBone]?.parent;
  while (parent) {
    for (const [name, , , merged] of rig) if (merged.includes(parent)) return name;
    parent = mhBones[parent]?.parent;
  }
  return 'head';
}

const mean = (positions, verts) => {
  let x = 0,
    y = 0,
    z = 0;
  for (const v of verts) {
    x += positions[v * 3];
    y += positions[v * 3 + 1];
    z += positions[v * 3 + 2];
  }
  return [x / verts.length, y / verts.length, z / verts.length];
};

/** Joint positions (metres, already shaped) of the contract bones. */
export function rigJoints(skeleton, positions, rig = RIG) {
  const joints = new Map();
  for (const [name, , mhBone] of rig) {
    if (!mhBone) continue;
    const verts = skeleton.joints[skeleton.bones[mhBone].head];
    joints.set(name, mean(positions, verts));
  }
  joints.set('root', [0, 0, 0]);
  // Useful ends for posing: wrists' tails, head top etc.
  const tail = (mhBone) => mean(positions, skeleton.joints[skeleton.bones[mhBone].tail]);
  return { joints, tail };
}

/** Per-vertex top-4 weights of the contract bones (indices into RIG order). */
export function rigWeights(skeleton, mhWeights, vertexCount, rig = RIG) {
  const names = rig.map(([name]) => name);
  const per = Array.from({ length: vertexCount }, () => new Map());
  for (const [mhBone, list] of Object.entries(mhWeights)) {
    const bone = names.indexOf(contractBoneOf(mhBone, skeleton.bones, rig));
    for (const [v, w] of list) {
      if (v >= vertexCount) continue;
      per[v].set(bone, (per[v].get(bone) ?? 0) + w);
    }
  }
  const joints = new Uint8Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let v = 0; v < vertexCount; v++) {
    const top = [...per[v]].sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (top.length === 0) top.push([names.indexOf('pelvis'), 1]);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    top.forEach(([bone, w], i) => {
      joints[v * 4 + i] = bone;
      weights[v * 4 + i] = w / sum;
    });
  }
  return { joints, weights, names };
}
