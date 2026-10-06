// Quick static preview of the sculpted, segmented body (no rig, no texture). Not the production build.
import { writeFileSync } from 'node:fs';
import { GltfBuilder } from './lib/glb.mjs';
import { assembleBody, loadSources } from './lib/assemble.mjs';
import { segmentBody, smoothBorders } from './lib/segment.mjs';
import { sculptBody } from './lib/sculpt.mjs';
import { splitMeshes } from './lib/meshes.mjs';
import { bakeNormalMap, surfaceTangents } from './lib/bake.mjs';
import { encodePng } from './lib/png.mjs';

const DATA = process.env.MAKEHUMAN_DATA ?? '/home/user/makehumancommunity/makehuman/makehuman/data';
const OUT = process.argv[2];
const sources = loadSources(DATA);
const COLOR = { skin: [0.61, 0.52, 0.45, 1], cloth: [0.024, 0.026, 0.03, 1] };
const ROUGH = { skin: 0.78, cloth: 0.92 };
for (const variant of ['male', 'female']) {
  const body = assembleBody(sources, variant);
  const { labels, layers } = segmentBody(body);
  smoothBorders(body, labels, layers);
  const surface = sculptBody(body, labels, layers);
  const tangents = surfaceTangents(surface, body.uvs);
  const meshes = splitMeshes(surface, body.uvs, tangents);
  const size = Number(process.env.SIZE ?? 2048);
  let t0 = Date.now();
  const png = encodePng(size, size, bakeNormalMap(surface, body.uvs, tangents, body.joints, size));
  console.log(
    variant,
    'normal map',
    size,
    (png.length / 1024 / 1024).toFixed(2),
    'MB',
    Date.now() - t0,
    'ms',
  );
  writeFileSync(`${OUT}/${variant}-normal.png`, png);
  const g = new GltfBuilder();
  const texture = process.env.NOMAP
    ? null
    : g.add('textures', {
        source: g.image(png, 'detail_normal'),
        sampler: g.add('samplers', { magFilter: 9729, minFilter: 9987 }),
      });
  const materials = {};
  for (const m of ['skin', 'cloth'])
    materials[m] = g.add('materials', {
      name: m,
      pbrMetallicRoughness: {
        baseColorFactor: COLOR[m],
        metallicFactor: 0,
        roughnessFactor: ROUGH[m],
      },
      ...(texture === null ? {} : { normalTexture: { index: texture } }),
    });
  let tris = 0;
  for (const mesh of meshes) {
    const primitives = mesh.primitives.map((p) => {
      tris += p.indices.length / 3;
      return {
        attributes: {
          POSITION: g.accessor(p.positions, 'VEC3', { target: 34962, minMax: true }),
          NORMAL: g.accessor(p.normals, 'VEC3', { target: 34962 }),
          TANGENT: g.accessor(p.tangents, 'VEC4', { target: 34962 }),
          TEXCOORD_0: g.accessor(p.uvs, 'VEC2', { target: 34962 }),
        },
        indices: g.accessor(p.indices, 'SCALAR', { target: 34963 }),
        material: materials[p.material],
      };
    });
    g.json.scenes[0].nodes.push(
      g.add('nodes', { name: mesh.name, mesh: g.add('meshes', { primitives }) }),
    );
  }
  console.log(variant, 'triangles', tris, 'meshes', meshes.length);
  writeFileSync(`${OUT}/${variant}.glb`, g.toGlb());
}
