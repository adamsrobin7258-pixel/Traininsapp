/**
 * The detail normal map: a subtle fibre structure per muscle, following each muscle's fibre
 * direction (pectoral fan to the upper arm, deltoid to its insertion, rectus vertical …), the
 * rectus' tendinous lines, a faint knit on the clothing, and a flat, pore-free skin elsewhere.
 *
 * Baked analytically: every texel knows its point on the body (rasterised in UV space), so the
 * pattern is defined in 3D – no UV stretching, no seams between UV islands.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Smooth 3D value noise in [0, 1]. */
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise([x, y, z]) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t);
  const fx = s(x - xi),
    fy = s(y - yi),
    fz = s(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
    l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}

/** Per corner (`surfaceVertex|uv`) a tangent along increasing u, smooth within a UV island. */
export function surfaceTangents(surface, uvs) {
  const sum = new Map();
  for (const f of surface.faces) {
    for (let k = 1; k + 1 < f.v.length; k++) {
      const idx = [0, k, k + 1];
      const p = idx.map((i) => [0, 1, 2].map((c) => surface.positions[f.v[i] * 3 + c]));
      const t = idx.map((i) => [uvs[f.t[i] * 2], 1 - uvs[f.t[i] * 2 + 1]]);
      const e1 = sub(p[1], p[0]);
      const e2 = sub(p[2], p[0]);
      const du1 = t[1][0] - t[0][0],
        dv1 = t[1][1] - t[0][1];
      const du2 = t[2][0] - t[0][0],
        dv2 = t[2][1] - t[0][1];
      const det = du1 * dv2 - du2 * dv1;
      if (Math.abs(det) < 1e-14) continue;
      const tangent = mul(sub(mul(e1, dv2), mul(e2, dv1)), 1 / det);
      for (const i of idx) {
        const key = `${f.v[i]}|${f.t[i]}`;
        sum.set(key, add(sum.get(key) ?? [0, 0, 0], tangent));
      }
    }
  }
  const out = new Map();
  for (const [key, t] of sum) {
    const s = Number(key.split('|')[0]);
    const n = [0, 1, 2].map((c) => surface.normals[s * 3 + c]);
    let o = sub(t, mul(n, dot(n, t)));
    if (Math.hypot(...o) < 1e-9)
      o = Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]);
    out.set(key, norm(o));
  }
  return out;
}

/** Fibre direction of a region at a point (unit, world space, rest pose). */
function fibreField(J, Ys, L) {
  const side = (p) => (p[0] >= 0 ? 'L' : 'R');
  const towards = (target) => (p) => norm(sub(target(p), p));
  const along = (from, to) => (p) =>
    norm(sub(J.get(`${to}_${side(p)}`), J.get(`${from}_${side(p)}`)));
  const sx = (p) => (p[0] >= 0 ? 1 : -1);
  return {
    chest_upper: towards((p) => add(J.get(`upperArm_${side(p)}`), [0, -0.04, 0.03])),
    chest_lower: towards((p) => add(J.get(`upperArm_${side(p)}`), [0, -0.06, 0.03])),
    shoulders_front: towards((p) => add(J.get(`upperArm_${side(p)}`), [sx(p) * 0.03, -0.13, 0.01])),
    shoulders_middle: towards((p) =>
      add(J.get(`upperArm_${side(p)}`), [sx(p) * 0.03, -0.13, 0.01]),
    ),
    shoulders_rear: towards((p) => add(J.get(`upperArm_${side(p)}`), [sx(p) * 0.03, -0.13, 0.01])),
    back_trapezius: towards((p) => add(J.get(`upperArm_${side(p)}`), [-sx(p) * 0.04, 0.02, -0.03])),
    back_rhomboids: (p) => norm([-sx(p) * 0.6, -1, 0]),
    back_erectors: () => [0, 1, 0],
    lats: towards((p) => add(J.get(`upperArm_${side(p)}`), [-sx(p) * 0.03, -0.1, 0])),
    core_rectus: () => [0, 1, 0],
    core_obliques: (p) => norm([-sx(p) * 0.6, -1, 0.5]),
    glutes_maximus: towards((p) => add(J.get(`thigh_${side(p)}`), [sx(p) * 0.06, -0.12, -0.02])),
    glutes_medius: towards((p) => add(J.get(`thigh_${side(p)}`), [sx(p) * 0.07, -0.02, 0])),
    biceps: along('upperArm', 'forearm'),
    triceps: along('upperArm', 'forearm'),
    forearms_flexors: along('forearm', 'hand'),
    forearms_extensors: along('forearm', 'hand'),
    quadriceps: along('thigh', 'shin'),
    hamstrings: along('thigh', 'shin'),
    adductors: towards((p) => add(J.get(`shin_${side(p)}`), [-sx(p) * 0.02, 0.1, 0])),
    calves_gastrocnemius: along('shin', 'foot'),
    calves_soleus: along('shin', 'foot'),
    _abs: { top: Ys - 0.42 * L, levels: [Ys - 0.5 * L, Ys - 0.64 * L, Ys - 0.79 * L] },
  };
}

/**
 * Bakes the detail normal map (tangent space, RGB, rows top to bottom).
 * @returns {Uint8Array} pixels of size × size × 3
 */
export function bakeNormalMap(surface, uvs, tangents, joints, size) {
  const Ys = joints.get('upperArm_L')[1];
  const L = Ys - joints.get('pelvis')[1];
  const fibres = fibreField(joints, Ys, L);
  const pixels = new Uint8Array(size * size * 3);
  const filled = new Uint8Array(size * size);
  const FIBRE_TILT = 0.12; // ~7° at the crest of a fibre
  const lambda = [0.0045, 0.0071];

  for (const f of surface.faces) {
    const field = fibres[f.label];
    const cloth = f.layer !== 'skin';
    const isRectus = f.label === 'core_rectus';
    for (let k = 1; k + 1 < f.v.length; k++) {
      const idx = [0, k, k + 1];
      const P = idx.map((i) => [0, 1, 2].map((c) => surface.positions[f.v[i] * 3 + c]));
      const N = idx.map((i) => [0, 1, 2].map((c) => surface.normals[f.v[i] * 3 + c]));
      const T = idx.map((i) => tangents.get(`${f.v[i]}|${f.t[i]}`) ?? [1, 0, 0]);
      const UV = idx.map((i) => [uvs[f.t[i] * 2] * size, (1 - uvs[f.t[i] * 2 + 1]) * size]);
      const minX = Math.max(0, Math.floor(Math.min(UV[0][0], UV[1][0], UV[2][0])));
      const maxX = Math.min(size - 1, Math.ceil(Math.max(UV[0][0], UV[1][0], UV[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(UV[0][1], UV[1][1], UV[2][1])));
      const maxY = Math.min(size - 1, Math.ceil(Math.max(UV[0][1], UV[1][1], UV[2][1])));
      const area =
        (UV[1][0] - UV[0][0]) * (UV[2][1] - UV[0][1]) -
        (UV[2][0] - UV[0][0]) * (UV[1][1] - UV[0][1]);
      if (Math.abs(area) < 1e-12) continue;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5,
            py = y + 0.5;
          const w1 =
            ((px - UV[0][0]) * (UV[2][1] - UV[0][1]) - (UV[2][0] - UV[0][0]) * (py - UV[0][1])) /
            area;
          const w2 =
            ((UV[1][0] - UV[0][0]) * (py - UV[0][1]) - (px - UV[0][0]) * (UV[1][1] - UV[0][1])) /
            area;
          const w0 = 1 - w1 - w2;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const b = [w0, w1, w2];
          const p = [0, 1, 2].map((c) => b[0] * P[0][c] + b[1] * P[1][c] + b[2] * P[2][c]);
          const n = norm([0, 1, 2].map((c) => b[0] * N[0][c] + b[1] * N[1][c] + b[2] * N[2][c]));
          let t = [0, 1, 2].map((c) => b[0] * T[0][c] + b[1] * T[1][c] + b[2] * T[2][c]);
          t = norm(sub(t, mul(n, dot(n, t))));
          const bt = cross(n, t);
          // Height gradient on the surface.
          let g = [0, 0, 0];
          if (field && !cloth) {
            const d = field(p);
            const across = norm(cross(n, d));
            const s = dot(p, across);
            const strength = 0.45 + 0.55 * noise(mul(p, 60)); // fibres fade in and out
            const phase = noise(mul(p, 35)) * 6.283;
            let slope = 0;
            lambda.forEach((l, i) => {
              const a = i === 0 ? 0.7 : 0.3;
              slope += a * Math.cos((6.283 * s) / l + phase * (i + 1));
            });
            g = mul(across, FIBRE_TILT * strength * slope);
          }
          if (isRectus) {
            // Linea alba and the tendinous intersections: soft, narrow valleys.
            const depth = cloth ? 0.35 : 0.8;
            const w = 0.006;
            const valley = (u) => ((-2 * u) / w) * Math.exp(-((u / w) ** 2)); // derivative of exp(-(u/w)^2)
            const gx = -depth * 0.25 * valley(p[0]);
            let gy = 0;
            if (p[1] < fibres._abs.top)
              for (const level of fibres._abs.levels) gy += -depth * 0.2 * valley(p[1] - level);
            const grad = [gx, gy, 0];
            g = add(g, sub(grad, mul(n, dot(n, grad))));
          }
          if (cloth) {
            // Fine knit: vertical ribs.
            const across = norm(cross(n, [0, 1, 0]));
            const s = dot(p, across);
            g = add(g, mul(across, 0.04 * Math.cos((6.283 * s) / 0.0026)));
          }
          const m = norm(sub(n, g));
          const o = (y * size + x) * 3;
          // 128 is exactly "no tilt", so a flat surface encodes as one constant colour.
          const encode = (x) => Math.max(0, Math.min(255, Math.floor(x * 127 + 128.5)));
          pixels[o] = encode(dot(m, t));
          pixels[o + 1] = encode(dot(m, bt));
          pixels[o + 2] = encode(dot(m, n));
          filled[y * size + x] = 1;
        }
      }
    }
  }
  // Flat everywhere else, then pad the islands so mip levels do not bleed the flat colour in.
  for (let i = 0; i < size * size; i++) {
    if (filled[i]) continue;
    pixels[i * 3] = 128;
    pixels[i * 3 + 1] = 128;
    pixels[i * 3 + 2] = 255;
  }
  let frontier = filled;
  for (let pass = 0; pass < 6; pass++) {
    const next = Uint8Array.from(frontier);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (frontier[i]) continue;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
          const j = yy * size + xx;
          if (!frontier[j]) continue;
          r += pixels[j * 3];
          g += pixels[j * 3 + 1];
          b += pixels[j * 3 + 2];
          n++;
        }
        if (!n) continue;
        pixels[i * 3] = Math.round(r / n);
        pixels[i * 3 + 1] = Math.round(g / n);
        pixels[i * 3 + 2] = Math.round(b / n);
        next[i] = 1;
      }
    }
    frontier = next;
  }
  return pixels;
}
