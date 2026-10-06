/**
 * Reading the MakeHuman 1.x data (CC0 since September 2020): base mesh, shape targets,
 * skeleton and skin weights. Units of MakeHuman: decimetres, +Y up, +Z front.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readBaseMesh(dataDir) {
  const text = readFileSync(join(dataDir, '3dobjs/base.obj'), 'utf8');
  const positions = [];
  const uvs = [];
  const faces = []; // { group, v: [i…], t: [i…] }
  let group = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.split(/\s+/);
      positions.push(+x, +y, +z);
    } else if (line.startsWith('vt ')) {
      const [, u, v] = line.split(/\s+/);
      uvs.push(+u, +v);
    } else if (line.startsWith('g ')) {
      group = line.slice(2).trim();
    } else if (line.startsWith('f ')) {
      const parts = line.trim().split(/\s+/).slice(1);
      faces.push({
        group,
        v: parts.map((p) => +p.split('/')[0] - 1),
        t: parts.map((p) => +p.split('/')[1] - 1),
      });
    }
  }
  return { positions: Float64Array.from(positions), uvs: Float64Array.from(uvs), faces };
}

/** A target: sparse vertex offsets. */
export function readTarget(dataDir, path) {
  const text = readFileSync(join(dataDir, 'targets', path), 'utf8');
  const offsets = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [i, x, y, z] = line.trim().split(/\s+/);
    offsets.push([+i, +x, +y, +z]);
  }
  return offsets;
}

export function applyTargets(dataDir, positions, weighted) {
  const out = Float64Array.from(positions);
  for (const [path, weight] of weighted) {
    if (weight === 0) continue;
    for (const [i, x, y, z] of readTarget(dataDir, path)) {
      out[i * 3] += x * weight;
      out[i * 3 + 1] += y * weight;
      out[i * 3 + 2] += z * weight;
    }
  }
  return out;
}

/** The centre of a `joint-*` helper group of the base mesh (where MakeHuman places joints). */
export function jointCenters(mesh, positions) {
  const sums = new Map();
  for (const face of mesh.faces) {
    if (!face.group.startsWith('joint-')) continue;
    let entry = sums.get(face.group);
    if (!entry) sums.set(face.group, (entry = { set: new Set() }));
    for (const v of face.v) entry.set.add(v);
  }
  const centers = new Map();
  for (const [name, { set }] of sums) {
    let x = 0,
      y = 0,
      z = 0;
    for (const v of set) {
      x += positions[v * 3];
      y += positions[v * 3 + 1];
      z += positions[v * 3 + 2];
    }
    centers.set(name, [x / set.size, y / set.size, z / set.size]);
  }
  return centers;
}

export function readSkeleton(dataDir) {
  return JSON.parse(readFileSync(join(dataDir, 'rigs/default.mhskel'), 'utf8'));
}

export function readWeights(dataDir) {
  return JSON.parse(readFileSync(join(dataDir, 'rigs/default_weights.mhw'), 'utf8')).weights;
}
