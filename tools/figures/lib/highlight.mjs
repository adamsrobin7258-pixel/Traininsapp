/**
 * Soft muscle highlight (male body, phase 18.5). The asset keeps one node per muscle region (the
 * contract: highlighting works per group, by node name), but a region's colour no longer ends at
 * its polygon border: every vertex carries up to four muscle groups with weights, spread over
 * the surface from the regions' faces, so a highlight fades into its neighbours over about a
 * centimetre or two – along the body, not in a straight cut. Inside a region the weight stays
 * whole: the assignment remains clear, primary stays stronger than secondary. The spreading
 * stays within one layer (skin, top, shorts): at a hem the garment's edge is the border.
 *
 * In the GLB: `_MUSCLE_GROUPS` (VEC4, unsigned byte: index into the group list, the list's length
 * = no muscle) and `_MUSCLE_WEIGHTS` (VEC4, normalised unsigned byte, sum 1) on every body
 * primitive; the group list is in the extras of the body's root node (`muscleGroups`).
 */

/** The muscle group of a region label (`chest_upper` → `chest`), or null for neutral skin. */
export function groupOfLabel(label) {
  return label.startsWith('skin_') ? null : label.split('_')[0];
}

/** Smoothing passes over the mesh (each: half own value, half the neighbours' mean). */
export const HIGHLIGHT_PASSES = 30;
/** Contrast of the blend: weights are raised to this power and renormalised – the transition
 * stays continuous but narrower, a region's inside keeps its full level. */
export const HIGHLIGHT_CONTRAST = 3.2;

/**
 * @param surface the sculpted surface (sculpt.mjs): one vertex per body vertex and layer, faces
 *   with their region label
 * @returns per surface vertex { names, groups: Uint8Array(4/vertex), weights: Uint8Array(4/vertex) }
 */
export function muscleBlend(surface, passes = HIGHLIGHT_PASSES) {
  const { positions: p, faces } = surface;
  const labels = faces.map((f) => f.label);
  const count = p.length / 3;
  const used = [...new Set(faces.flatMap((f) => f.v))];
  const names = [...new Set(labels.map(groupOfLabel).filter(Boolean))].sort();
  const none = names.length;
  const indexOf = (label) => {
    const group = groupOfLabel(label);
    return group ? names.indexOf(group) : none;
  };
  // Start: per vertex the share of its faces' area per group.
  let maps = Array.from({ length: count }, () => new Map());
  const neighbours = Array.from({ length: count }, () => new Set());
  faces.forEach((f, i) => {
    const g = indexOf(labels[i]);
    const a = [0, 1, 2].map((c) => p[f.v[1] * 3 + c] - p[f.v[0] * 3 + c]);
    const b = [0, 1, 2].map((c) => p[f.v[f.v.length - 1] * 3 + c] - p[f.v[0] * 3 + c]);
    const area = Math.hypot(
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    );
    f.v.forEach((v, k) => {
      maps[v].set(g, (maps[v].get(g) ?? 0) + area);
      const next = f.v[(k + 1) % f.v.length];
      neighbours[v].add(next);
      neighbours[next].add(v);
    });
  });
  const normalise = (m) => {
    let sum = 0;
    for (const w of m.values()) sum += w;
    for (const [g, w] of m) m.set(g, w / (sum || 1));
    return m;
  };
  maps = maps.map(normalise);
  const adjacency = neighbours.map((s) => [...s]);
  for (let pass = 0; pass < passes; pass++) {
    const next = maps.slice();
    for (const v of used) {
      const nb = adjacency[v];
      if (!nb.length) continue;
      const m = new Map();
      for (const [g, w] of maps[v]) m.set(g, 0.5 * w);
      for (const u of nb)
        for (const [g, w] of maps[u]) m.set(g, (m.get(g) ?? 0) + (0.5 * w) / nb.length);
      next[v] = m;
    }
    maps = next;
  }
  const groups = new Uint8Array(count * 4).fill(none);
  const weights = new Uint8Array(count * 4);
  for (let v = 0; v < count; v++) {
    const top = [...maps[v]]
      .map(([g, w]) => [g, w ** HIGHLIGHT_CONTRAST])
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 4);
    if (!top.length) top.push([none, 1]);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    let given = 0;
    top.forEach(([g, w], k) => {
      groups[v * 4 + k] = g;
      weights[v * 4 + k] = Math.round((w / sum) * 255);
      given += weights[v * 4 + k];
    });
    weights[v * 4] += 255 - given; // the strongest takes the rounding: sum exactly 1
  }
  return { names, groups, weights };
}
