/**
 * Sculpting the segmented body: grooves between muscles, a slight belly per muscle, clothing as
 * its own layer (offset outwards, with a hem where it ends) and smooth normals computed on the
 * whole surface – so splitting into muscle nodes later leaves no visible seams.
 */

/** Groove depth (metres) between two regions. */
function grooveDepth(a, b) {
  const skinA = a.startsWith('skin_');
  const skinB = b.startsWith('skin_');
  if (skinA && skinB) return 0;
  if (skinA || skinB) return 0.0014;
  const groupA = a.split('_')[0];
  const groupB = b.split('_')[0];
  return groupA === groupB ? 0.0018 : 0.0032;
}

/** Layer offsets above the skin (metres). */
export const LAYER_OFFSET = { skin: 0, shorts: 0.0022, top: 0.0036 };
const GROOVE_IN_CLOTH = 0.4;

function vertexNormals(positions, faces, count) {
  const normals = new Float64Array(count * 3);
  for (const f of faces) {
    const v = f.v;
    for (let k = 1; k + 1 < v.length; k++) {
      const [a, b, c] = [v[0], v[k], v[k + 1]];
      const u = [0, 1, 2].map((i) => positions[b * 3 + i] - positions[a * 3 + i]);
      const w = [0, 1, 2].map((i) => positions[c * 3 + i] - positions[a * 3 + i]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      for (const x of [a, b, c]) for (let i = 0; i < 3; i++) normals[x * 3 + i] += n[i];
    }
  }
  for (let i = 0; i < count; i++) {
    const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) normals[i * 3 + k] /= l;
  }
  return normals;
}

/** Multi-source Dijkstra over mesh edges: distance to the nearest seed and that seed. */
function distances(positions, adjacency, seeds, limit) {
  const count = adjacency.length;
  const dist = new Float64Array(count).fill(Infinity);
  const source = new Int32Array(count).fill(-1);
  const heap = [];
  const push = (d, v) => {
    heap.push([d, v]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (const v of seeds) {
    dist[v] = 0;
    source[v] = v;
    push(0, v);
  }
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v] || d > limit) continue;
    for (const u of adjacency[v]) {
      const e = Math.hypot(
        positions[u * 3] - positions[v * 3],
        positions[u * 3 + 1] - positions[v * 3 + 1],
        positions[u * 3 + 2] - positions[v * 3 + 2],
      );
      if (d + e < dist[u]) {
        dist[u] = d + e;
        source[u] = source[v];
        push(d + e, u);
      }
    }
  }
  return { dist, source };
}

/**
 * @returns surface: one entry per (vertex, layer) with its position and normal; faces with
 *   their region, layer and corner references; hems as extra faces of the clothing.
 */
export function sculptBody(body, labels, layers, { bulge = 0.0015 } = {}) {
  const { positions: original, faces } = body;
  const count = original.length / 3;
  const adjacency = Array.from({ length: count }, () => new Set());
  const vertexLabels = Array.from({ length: count }, () => new Set());
  const vertexLayers = Array.from({ length: count }, () => new Set());
  faces.forEach((f, i) => {
    f.v.forEach((v, k) => {
      const next = f.v[(k + 1) % f.v.length];
      adjacency[v].add(next);
      adjacency[next].add(v);
      vertexLabels[v].add(labels[i]);
      vertexLayers[v].add(layers[i]);
    });
  });
  const adj = adjacency.map((s) => [...s]);
  const normals = vertexNormals(original, faces, count);

  // Grooves along region borders.
  const seedDepth = new Float64Array(count);
  const seeds = [];
  for (let v = 0; v < count; v++) {
    const list = [...vertexLabels[v]];
    if (list.length < 2) continue;
    let depth = 0;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        depth = Math.max(depth, grooveDepth(list[i], list[j]));
    if (depth > 0) {
      seedDepth[v] = depth;
      seeds.push(v);
    }
  }
  const { dist, source } = distances(original, adj, seeds, 0.04);
  const positions = Float64Array.from(original);
  const width = 0.011;
  const field = new Float64Array(count);
  for (let v = 0; v < count; v++) {
    if (!vertexLabels[v].size) continue;
    const muscle = [...vertexLabels[v]].some((l) => !l.startsWith('skin_'));
    let offset = 0;
    if (source[v] >= 0) offset -= seedDepth[source[v]] * Math.exp(-((dist[v] / width) ** 2));
    // Muscle belly: rises from the border towards the middle of the region.
    if (muscle && Number.isFinite(dist[v]))
      offset += bulge * (1 - Math.exp(-((dist[v] / 0.02) ** 2)));
    else if (muscle) offset += bulge;
    if (!vertexLayers[v].has('skin')) offset *= GROOVE_IN_CLOTH;
    field[v] = offset;
  }
  // Soften the field: a border that steps along the mesh grid becomes a calm valley.
  for (let pass = 0; pass < 10; pass++) {
    const next = Float64Array.from(field);
    for (let v = 0; v < count; v++) {
      if (!vertexLabels[v].size) continue;
      let sum = 0;
      for (const u of adj[v]) sum += field[u];
      next[v] = 0.5 * field[v] + (0.5 * sum) / adj[v].length;
    }
    field.set(next);
  }
  for (let v = 0; v < count; v++) {
    for (let k = 0; k < 3; k++) positions[v * 3 + k] += normals[v * 3 + k] * field[v];
  }

  // Fabric bridges small forms: under the top the chest is calmed (no nipples showing through),
  // elsewhere small dents (navel) fill in a little.
  const clothOnly = (v) => vertexLayers[v].size === 1 && !vertexLayers[v].has('skin');
  const chest = (v) => [...vertexLabels[v]].some((l) => l.startsWith('chest_'));
  for (let pass = 0; pass < 24; pass++) {
    const next = Float64Array.from(positions);
    for (let v = 0; v < count; v++) {
      if (!clothOnly(v) || (pass >= 4 && !chest(v))) continue;
      const c = [0, 0, 0];
      for (const u of adj[v])
        for (let k = 0; k < 3; k++) c[k] += positions[u * 3 + k] / adj[v].length;
      // Only along the normal: moving across the surface would pull the (straightened) region
      // borders back onto the mesh grid.
      let along = 0;
      for (let k = 0; k < 3; k++) along += (c[k] - positions[v * 3 + k]) * normals[v * 3 + k];
      for (let k = 0; k < 3; k++) next[v * 3 + k] += 0.5 * along * normals[v * 3 + k];
    }
    positions.set(next);
  }

  // One surface vertex per (vertex, layer).
  const surface = new Map(); // `${v}|${layer}` → index
  const out = { positions: [], source: [], layer: [] };
  const corner = (v, layer) => {
    const k = `${v}|${layer}`;
    let i = surface.get(k);
    if (i === undefined) {
      i = out.source.length;
      surface.set(k, i);
      out.source.push(v);
      out.layer.push(layer);
    }
    return i;
  };
  const surfaceFaces = faces.map((f, i) => ({
    label: labels[i],
    layer: layers[i],
    v: f.v.map((v) => corner(v, layers[i])),
    t: f.t,
    parent: f.parent ?? i,
  }));
  // Layer offset along the sculpted normal.
  const sculpted = vertexNormals(positions, faces, count);
  const surfacePositions = new Float64Array(out.source.length * 3);
  out.source.forEach((v, i) => {
    const offset = LAYER_OFFSET[out.layer[i]];
    for (let k = 0; k < 3; k++)
      surfacePositions[i * 3 + k] = positions[v * 3 + k] + sculpted[v * 3 + k] * offset;
  });
  // Smooth normals per layer (faces of the same layer only).
  const surfaceNormals = vertexNormals(surfacePositions, surfaceFaces, out.source.length);

  // Hems: where a face's edge borders a face of a lower layer, a strip closes the step.
  const edgeOwner = new Map();
  surfaceFaces.forEach((f, i) => {
    const raw = faces[i].v;
    raw.forEach((a, k) => {
      const b = raw[(k + 1) % raw.length];
      edgeOwner.set(`${a}_${b}`, i);
    });
  });
  const hems = [];
  surfaceFaces.forEach((f, i) => {
    const raw = faces[i].v;
    raw.forEach((a, k) => {
      const b = raw[(k + 1) % raw.length];
      const other = edgeOwner.get(`${b}_${a}`);
      if (other === undefined) return;
      const lower = surfaceFaces[other].layer;
      if (LAYER_OFFSET[lower] >= LAYER_OFFSET[f.layer]) return;
      hems.push({
        label: f.label,
        layer: f.layer,
        v: [corner(b, f.layer), corner(a, f.layer), corner(a, lower), corner(b, lower)],
      });
    });
  });
  return {
    positions: surfacePositions,
    normals: surfaceNormals,
    source: Int32Array.from(out.source),
    layer: out.layer,
    faces: surfaceFaces,
    hems,
  };
}
