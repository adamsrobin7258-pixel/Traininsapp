/**
 * Splitting the sculpted surface into the asset's meshes: one node per region (muscle part or
 * neutral skin region), one primitive per material (skin, clothing). Normals come from the whole
 * surface, so the split shows no seams.
 */

/** Node name of a region: muscles by the contract, everything else `body_<part>`. */
export function nodeName(label) {
  return label.startsWith('skin_') ? `body_${label.slice(5)}` : `muscle_${label}`;
}

/** Material of a layer. */
export const MATERIAL_OF_LAYER = { skin: 'skin', top: 'cloth', shorts: 'cloth' };

/**
 * @returns [{ name, label, primitives: [{ material, positions, normals, uvs, source, indices }] }]
 */
export function splitMeshes(surface, uvs, tangents = new Map()) {
  const regions = new Map();
  const primitiveOf = (label, material) => {
    if (!regions.has(label)) regions.set(label, new Map());
    const map = regions.get(label);
    if (!map.has(material)) map.set(material, { index: new Map(), corners: [], indices: [] });
    return map.get(material);
  };
  const addFace = (prim, corners) => {
    const ids = corners.map(([s, t]) => {
      const k = `${s}|${t}`;
      let i = prim.index.get(k);
      if (i === undefined) {
        i = prim.corners.length;
        prim.index.set(k, i);
        prim.corners.push([s, t]);
      }
      return i;
    });
    for (let k = 1; k + 1 < ids.length; k++) prim.indices.push(ids[0], ids[k], ids[k + 1]);
  };
  for (const f of surface.faces) {
    addFace(
      primitiveOf(f.label, MATERIAL_OF_LAYER[f.layer]),
      f.v.map((s, k) => [s, f.t[k]]),
    );
  }
  // Hems: own vertices with a face normal (a crisp edge, not smoothed into the surface).
  const hemNormals = [];
  for (const h of surface.hems) {
    const p = (i) => [0, 1, 2].map((k) => surface.positions[h.v[i] * 3 + k]);
    const [a, b, c] = [p(0), p(1), p(2)];
    const u = a.map((x, k) => b[k] - x);
    const w = a.map((x, k) => c[k] - x);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n) || 1;
    const id = hemNormals.length;
    hemNormals.push(n.map((x) => x / l));
    addFace(
      primitiveOf(h.label, MATERIAL_OF_LAYER[h.layer]),
      h.v.map((s) => [s, `hem${id}`]),
    );
  }

  const result = [];
  for (const [label, map] of [...regions].sort(([a], [b]) => a.localeCompare(b))) {
    const primitives = [];
    for (const [material, prim] of map) {
      const n = prim.corners.length;
      const positions = new Float32Array(n * 3);
      const normals = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2);
      const source = new Int32Array(n);
      const tangent = new Float32Array(n * 4);
      prim.corners.forEach(([s, t], i) => {
        source[i] = s;
        for (let k = 0; k < 3; k++) positions[i * 3 + k] = surface.positions[s * 3 + k];
        if (typeof t === 'string') {
          const hn = hemNormals[Number(t.slice(3))];
          for (let k = 0; k < 3; k++) normals[i * 3 + k] = hn[k];
          const up = Math.abs(hn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
          const d = up[0] * hn[0] + up[1] * hn[1] + up[2] * hn[2];
          const o = [up[0] - d * hn[0], up[1] - d * hn[1], up[2] - d * hn[2]];
          const l = Math.hypot(...o);
          for (let k = 0; k < 3; k++) tangent[i * 4 + k] = o[k] / l;
          tangent[i * 4 + 3] = 1;
        } else {
          for (let k = 0; k < 3; k++) normals[i * 3 + k] = surface.normals[s * 3 + k];
          // glTF UV origin is top left; MakeHuman's (OBJ) is bottom left.
          uv[i * 2] = uvs[t * 2];
          uv[i * 2 + 1] = 1 - uvs[t * 2 + 1];
          const tg = tangents.get(`${s}|${t}`) ?? [1, 0, 0];
          for (let k = 0; k < 3; k++) tangent[i * 4 + k] = tg[k];
          tangent[i * 4 + 3] = 1;
        }
      });
      primitives.push({
        material,
        positions,
        normals,
        uvs: uv,
        tangents: tangent,
        source,
        indices: Uint32Array.from(prim.indices),
      });
    }
    result.push({ name: nodeName(label), label, primitives });
  }
  return result;
}
