/**
 * Writes a body as GLB: skeleton (contract bones, rest rotations identity), skinned muscle and
 * skin meshes, materials with the detail normal map, the clips and the equipment props.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { GltfBuilder } from './glb.mjs';
import { RIG } from './rig.mjs';
import { localRotations, poseFrame } from './clips.mjs';
import { PULLEY, propMeshes } from './props.mjs';

/** Linear colour factors (glTF), from the sRGB design colours. */
const linear = (hex) =>
  [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i + 1, i + 3), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

/** Materials: matte warm-neutral skin, matte anthracite clothing, calm equipment. */
export const MATERIALS = {
  skin: { color: '#cdbdae', roughness: 0.74, metallic: 0, normalMap: true },
  cloth: { color: '#2a2c30', roughness: 0.9, metallic: 0, normalMap: true },
  equipment: { color: '#5d6066', roughness: 0.8, metallic: 0 },
  metal: { color: '#a7aaaf', roughness: 0.42, metallic: 0.6 },
};

const SAMPLE_STEP = 0.1;

export function exportGlb({ variant, meshes, weights, source, rest, clips, normalPng, extras }) {
  const g = new GltfBuilder();
  g.json.asset.extras = extras;
  const names = RIG.map(([name]) => name);

  // Skeleton.
  const boneNode = new Map();
  for (const [name, parent] of RIG) {
    const p = rest.get(name);
    const q = parent ? rest.get(parent) : [0, 0, 0];
    const index = g.add('nodes', { name, translation: [p[0] - q[0], p[1] - q[1], p[2] - q[2]] });
    boneNode.set(name, index);
    if (parent) (g.json.nodes[boneNode.get(parent)].children ??= []).push(index);
  }
  const inverseBind = new Float32Array(names.length * 16);
  names.forEach((name, i) => {
    const p = rest.get(name);
    inverseBind.set(new Matrix4().makeTranslation(-p[0], -p[1], -p[2]).elements, i * 16);
  });
  const skin = g.add('skins', {
    name: 'kalethra_rig',
    joints: names.map((name) => boneNode.get(name)),
    inverseBindMatrices: g.accessor(inverseBind, 'MAT4'),
    skeleton: boneNode.get('root'),
  });

  // Materials.
  const texture =
    normalPng &&
    g.add('textures', {
      source: g.image(normalPng, 'detail_normal'),
      sampler: g.add('samplers', { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }),
    });
  const material = {};
  for (const [name, m] of Object.entries(MATERIALS)) {
    material[name] = g.add('materials', {
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...linear(m.color), 1],
        metallicFactor: m.metallic,
        roughnessFactor: m.roughness,
      },
      ...(m.normalMap && texture !== undefined ? { normalTexture: { index: texture } } : {}),
    });
  }

  // Body meshes, skinned.
  const children = [boneNode.get('root')];
  let triangles = 0;
  for (const mesh of meshes) {
    const primitives = mesh.primitives.map((p) => {
      const n = p.positions.length / 3;
      const joints = new Uint8Array(n * 4);
      const w = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) {
        const v = source[p.source[i]];
        let sum = 0;
        let largest = 0;
        for (let k = 0; k < 4; k++) {
          joints[i * 4 + k] = weights.joints[v * 4 + k];
          w[i * 4 + k] = Math.round(weights.weights[v * 4 + k] * 255);
          sum += w[i * 4 + k];
          if (w[i * 4 + k] > w[i * 4 + largest]) largest = k;
        }
        w[i * 4 + largest] += 255 - sum; // the quantised weights sum to exactly 1
      }
      triangles += p.indices.length / 3;
      const indices = n < 65536 ? Uint16Array.from(p.indices) : p.indices;
      return {
        attributes: {
          POSITION: g.accessor(p.positions, 'VEC3', { target: 34962, minMax: true }),
          NORMAL: g.accessor(p.normals, 'VEC3', { target: 34962 }),
          TANGENT: g.accessor(p.tangents, 'VEC4', { target: 34962 }),
          TEXCOORD_0: g.accessor(p.uvs, 'VEC2', { target: 34962 }),
          JOINTS_0: g.accessor(joints, 'VEC4', { target: 34962 }),
          WEIGHTS_0: g.accessor(w, 'VEC4', { target: 34962, normalized: true }),
        },
        indices: g.accessor(indices, 'SCALAR', { target: 34963 }),
        material: material[p.material],
      };
    });
    children.push(
      g.add('nodes', {
        name: mesh.name,
        mesh: g.add('meshes', { name: mesh.name, primitives }),
        skin,
      }),
    );
  }

  // Props.
  const propNode = new Map();
  for (const prop of propMeshes()) {
    const m = prop.mesh;
    triangles += m.indices.length / 3;
    const mesh = g.add('meshes', {
      name: prop.name,
      primitives: [
        {
          attributes: {
            POSITION: g.accessor(m.positions, 'VEC3', { target: 34962, minMax: true }),
            NORMAL: g.accessor(m.normals, 'VEC3', { target: 34962 }),
          },
          indices: g.accessor(m.indices, 'SCALAR', { target: 34963 }),
          material: material[prop.material],
        },
      ],
    });
    const index = g.add('nodes', { name: prop.name, mesh });
    propNode.set(prop.name, index);
    children.push(index);
  }
  g.json.scenes[0].nodes.push(g.add('nodes', { name: `kalethra_${variant}`, children }));

  // Clips.
  for (const clip of clips) {
    const frames = clip.frame ? Math.round(clip.duration / SAMPLE_STEP) + 1 : 1;
    const times = Float32Array.from({ length: frames }, (_, i) => i * SAMPLE_STEP);
    const rotations = new Map(names.map((name) => [name, new Float32Array(frames * 4)]));
    const pelvis = new Float32Array(frames * 3);
    const bar = { t: new Float32Array(frames * 3), r: new Float32Array(frames * 4) };
    const wire = {
      t: new Float32Array(frames * 3),
      r: new Float32Array(frames * 4),
      s: new Float32Array(frames * 3),
    };
    for (let f = 0; f < frames; f++) {
      if (!clip.frame) {
        for (const name of names) rotations.get(name).set([0, 0, 0, 1], f * 4);
        pelvis.set(rest.get('pelvis'), f * 3);
        continue;
      }
      // The last sample equals the first: a seamless loop.
      const frame = clip.frame((f % (frames - 1)) / (frames - 1));
      const { world, heads } = poseFrame(rest, frame);
      const local = localRotations(world);
      for (const name of names) {
        const q = local.get(name);
        rotations.get(name).set([q.x, q.y, q.z, q.w], f * 4);
      }
      pelvis.set(heads.get('pelvis').toArray(), f * 3);
      // Bar in the palms: centre between the grips, along the line through them.
      const grips = ['L', 'R'].map((s) => {
        const sx = s === 'L' ? 1 : -1;
        const w0 = new Vector3(...rest.get(`hand_${s}`));
        const along = w0
          .clone()
          .sub(new Vector3(...rest.get(`forearm_${s}`)))
          .normalize();
        const offset = along.multiplyScalar(0.075).add(new Vector3(-sx * 0.022, 0, 0));
        return heads
          .get(`hand_${s}`)
          .clone()
          .add(offset.applyQuaternion(world.get(`hand_${s}`)));
      });
      const centre = grips[0].clone().add(grips[1]).multiplyScalar(0.5);
      const axis = grips[0].clone().sub(grips[1]).normalize();
      const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), axis);
      bar.t.set(centre.toArray(), f * 3);
      bar.r.set([q.x, q.y, q.z, q.w], f * 4);
      const toPulley = new Vector3(...PULLEY).sub(centre);
      const qw = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        toPulley.clone().normalize(),
      );
      wire.t.set(centre.toArray(), f * 3);
      wire.r.set([qw.x, qw.y, qw.z, qw.w], f * 4);
      wire.s.set([1, toPulley.length(), 1], f * 3);
    }
    const input = g.accessor(times, 'SCALAR', { minMax: true });
    const samplers = [];
    const channels = [];
    const channel = (node, path, values, type) => {
      samplers.push({ input, output: g.accessor(values, type), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node, path } });
    };
    for (const name of names) channel(boneNode.get(name), 'rotation', rotations.get(name), 'VEC4');
    channel(boneNode.get('pelvis'), 'translation', pelvis, 'VEC3');
    if (clip.variant) {
      channel(propNode.get(`prop_${clip.variant}_bar`), 'translation', bar.t, 'VEC3');
      channel(propNode.get(`prop_${clip.variant}_bar`), 'rotation', bar.r, 'VEC4');
    }
    if (clip.cable) {
      channel(propNode.get(`prop_${clip.variant}_wire`), 'translation', wire.t, 'VEC3');
      channel(propNode.get(`prop_${clip.variant}_wire`), 'rotation', wire.r, 'VEC4');
      channel(propNode.get(`prop_${clip.variant}_wire`), 'scale', wire.s, 'VEC3');
    }
    g.add('animations', { name: clip.name, samplers, channels });
  }
  return { glb: g.toGlb(), triangles };
}
