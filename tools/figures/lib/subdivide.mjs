/**
 * One Catmull-Clark step on the trunk and limbs. MakeHuman's body is dense at head, hands and
 * feet but coarse elsewhere (2–3 cm faces) – too coarse for muscle borders and grooves. Faces
 * outside the subdivided part keep their vertices; edges they share with it get the new edge
 * points inserted, so there are no cracks.
 */

const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

/**
 * @param body positions (flat), uvs (flat), faces [{group, v, t}], weights {joints, weights, names}
 * @param subdivide (face) => boolean
 */
export function subdivideBody(body, subdivide) {
  const { faces, weights } = body;
  const positions = Array.from(body.positions);
  const uvs = Array.from(body.uvs);
  const vertexCount = positions.length / 3;
  const vertexWeights = [];
  for (let v = 0; v < vertexCount; v++) {
    const map = new Map();
    for (let k = 0; k < 4; k++) {
      const w = weights.weights[v * 4 + k];
      if (w) map.set(weights.joints[v * 4 + k], w);
    }
    vertexWeights.push(map);
  }
  const P = (v) => [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
  const avgWeights = (list) => {
    const map = new Map();
    for (const v of list)
      for (const [j, w] of vertexWeights[v]) map.set(j, (map.get(j) ?? 0) + w / list.length);
    return map;
  };
  const addVertex = (p, w) => {
    positions.push(...p);
    vertexWeights.push(w);
    return positions.length / 3 - 1;
  };
  const addUv = (() => {
    const index = new Map();
    return (k, uv) => {
      if (k && index.has(k)) return index.get(k);
      uvs.push(...uv);
      const i = uvs.length / 2 - 1;
      if (k) index.set(k, i);
      return i;
    };
  })();
  const UV = (t) => [uvs[t * 2], uvs[t * 2 + 1]];

  const inSet = faces.map(subdivide);
  // Face points.
  const facePoint = faces.map((f, i) => {
    if (!inSet[i]) return null;
    const p = [0, 0, 0];
    for (const v of f.v) P(v).forEach((x, k) => (p[k] += x / f.v.length));
    return p;
  });
  // Edges: adjacent faces.
  const edgeFaces = new Map();
  faces.forEach((f, i) => {
    for (let k = 0; k < f.v.length; k++) {
      const e = key(f.v[k], f.v[(k + 1) % f.v.length]);
      if (!edgeFaces.has(e)) edgeFaces.set(e, []);
      edgeFaces.get(e).push(i);
    }
  });
  // Edge points for every edge touching a subdivided face.
  const edgePoint = new Map();
  const edgePosition = new Map();
  for (const [e, list] of edgeFaces) {
    if (!list.some((i) => inSet[i])) continue;
    const [a, b] = e.split('_').map(Number);
    const mid = P(a).map((x, k) => (x + P(b)[k]) / 2);
    const smooth = list.length === 2 && list.every((i) => inSet[i]);
    const p = smooth
      ? mid.map((x, k) => (x * 2 + facePoint[list[0]][k] + facePoint[list[1]][k]) / 4)
      : mid;
    edgePosition.set(e, mid);
    edgePoint.set(e, addVertex(p, avgWeights([a, b])));
  }
  // Moved original vertices (only where every surrounding face is subdivided).
  const vertexFaces = Array.from({ length: vertexCount }, () => []);
  faces.forEach((f, i) => f.v.forEach((v) => vertexFaces[v].push(i)));
  const moved = new Map();
  for (let v = 0; v < vertexCount; v++) {
    const around = vertexFaces[v];
    if (!around.length || !around.every((i) => inSet[i])) continue;
    const ring = new Set();
    for (const i of around) {
      const f = faces[i];
      const k = f.v.indexOf(v);
      ring.add(key(v, f.v[(k + 1) % f.v.length]));
      ring.add(key(v, f.v[(k - 1 + f.v.length) % f.v.length]));
    }
    if ([...ring].some((e) => edgeFaces.get(e).length !== 2)) continue; // mesh border
    const n = around.length;
    const Q = [0, 0, 0];
    for (const i of around) facePoint[i].forEach((x, k) => (Q[k] += x / n));
    const R = [0, 0, 0];
    for (const e of ring) edgePosition.get(e).forEach((x, k) => (R[k] += x / ring.size));
    const p = P(v);
    moved.set(
      v,
      p.map((x, k) => (Q[k] + 2 * R[k] + (n - 3) * x) / n),
    );
  }
  for (const [v, p] of moved) p.forEach((x, k) => (positions[v * 3 + k] = x));

  const out = [];
  faces.forEach((f, i) => {
    const n = f.v.length;
    if (inSet[i]) {
      const centre = addVertex(facePoint[i], avgWeights(f.v));
      const centreUv = addUv(
        null,
        f.t.map(UV).reduce((s, uv) => [s[0] + uv[0] / n, s[1] + uv[1] / n], [0, 0]),
      );
      for (let k = 0; k < n; k++) {
        const prev = (k - 1 + n) % n;
        const next = (k + 1) % n;
        const eNext = key(f.v[k], f.v[next]);
        const ePrev = key(f.v[prev], f.v[k]);
        const uvNext = addUv(
          key(f.t[k], f.t[next]),
          UV(f.t[k]).map((x, c) => (x + UV(f.t[next])[c]) / 2),
        );
        const uvPrev = addUv(
          key(f.t[prev], f.t[k]),
          UV(f.t[prev]).map((x, c) => (x + UV(f.t[k])[c]) / 2),
        );
        out.push({
          group: f.group,
          parent: i,
          v: [f.v[k], edgePoint.get(eNext), centre, edgePoint.get(ePrev)],
          t: [f.t[k], uvNext, centreUv, uvPrev],
        });
      }
      return;
    }
    // Neighbour of the subdivided part: insert the new edge points into its outline.
    const v = [];
    const t = [];
    let first = -1;
    for (let k = 0; k < n; k++) {
      const next = (k + 1) % n;
      v.push(f.v[k]);
      t.push(f.t[k]);
      const e = key(f.v[k], f.v[next]);
      if (edgePoint.has(e)) {
        if (first < 0) first = v.length;
        v.push(edgePoint.get(e));
        t.push(
          addUv(
            key(f.t[k], f.t[next]),
            UV(f.t[k]).map((x, c) => (x + UV(f.t[next])[c]) / 2),
          ),
        );
      }
    }
    // Start the outline at an inserted point, so a triangle fan never spans a straight edge.
    const r = Math.max(0, first);
    out.push({
      group: f.group,
      parent: i,
      v: [...v.slice(r), ...v.slice(0, r)],
      t: [...t.slice(r), ...t.slice(0, r)],
    });
  });

  const count = positions.length / 3;
  const joints = new Uint8Array(count * 4);
  const w4 = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    const top = [...vertexWeights[v]].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    top.forEach(([j, w], k) => {
      joints[v * 4 + k] = j;
      w4[v * 4 + k] = w / sum;
    });
  }
  return {
    ...body,
    positions: Float64Array.from(positions),
    uvs: Float64Array.from(uvs),
    faces: out,
    used: [...new Set(out.flatMap((f) => f.v))],
    weights: { joints, weights: w4, names: weights.names },
  };
}
