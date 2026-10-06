/**
 * Equipment geometry (boxes and cylinders) for the clips: bench, barbell, pulldown machine, bar
 * and cable. Simple, calm forms – the body is the subject, the equipment only explains the pose.
 */

/** Merges parts into one mesh: { positions, normals, indices }. */
function merge(parts) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (const part of parts) {
    const base = positions.length / 3;
    positions.push(...part.positions);
    normals.push(...part.normals);
    indices.push(...part.indices.map((i) => i + base));
  }
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    indices: Uint16Array.from(indices),
  };
}

export function box(w, h, d, [cx, cy, cz]) {
  const positions = [];
  const normals = [];
  const indices = [];
  const faces = [
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ],
    [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
    [
      [0, -1, 0],
      [0, 0, -1],
      [1, 0, 0],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [-1, 0, 0],
      [0, 1, 0],
    ],
  ];
  const half = [w / 2, h / 2, d / 2];
  for (const [n, u, v] of faces) {
    const base = positions.length / 3;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      positions.push(
        ...[0, 1, 2].map((k) => [cx, cy, cz][k] + (n[k] + u[k] * a + v[k] * b) * half[k]),
      );
      normals.push(...n);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
}

/** Cylinder along `axis` ('x' or 'y'), centred at `c`, with caps. */
export function cylinder(radius, length, c, axis = 'y', segments = 20) {
  const positions = [];
  const normals = [];
  const indices = [];
  const map = (along, a, b) => (axis === 'y' ? [a, along, b] : [along, a, b]);
  const at = (p) => p.map((x, k) => x + c[k]);
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const a = Math.cos(t);
    const b = Math.sin(t);
    for (const along of [-length / 2, length / 2]) {
      positions.push(...at(map(along, a * radius, b * radius)));
      normals.push(...map(0, a, b));
    }
  }
  for (let i = 0; i < segments; i++) {
    const k = i * 2;
    indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  for (const [along, sign] of [
    [-length / 2, -1],
    [length / 2, 1],
  ]) {
    const centre = positions.length / 3;
    positions.push(...at(map(along, 0, 0)));
    normals.push(...map(sign, 0, 0));
    const ring = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      positions.push(...at(map(along, Math.cos(t) * radius, Math.sin(t) * radius)));
      normals.push(...map(sign, 0, 0));
    }
    for (let i = 0; i < segments; i++) {
      if (sign > 0) indices.push(centre, ring + i, ring + i + 1);
      else indices.push(centre, ring + i + 1, ring + i);
    }
  }
  // Along Y the (a, along, b) parametrisation is mirrored and winds inwards: turn it outwards.
  if (axis === 'y')
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  return { positions, normals, indices };
}

/** Props per clip variant: { name, material, mesh } (meshes in their node's local space). */
export function propMeshes() {
  return [
    {
      name: 'prop_bench_frame',
      material: 'equipment',
      mesh: merge([
        box(0.3, 0.07, 1.2, [0, 0.415, -0.15]),
        box(0.24, 0.38, 0.06, [0, 0.19, -0.6]),
        box(0.24, 0.38, 0.06, [0, 0.19, 0.3]),
      ]),
    },
    {
      // Local space: the bar along X, centred at the origin (the clip moves the node).
      name: 'prop_bench_bar',
      material: 'metal',
      mesh: merge([
        cylinder(0.014, 1.5, [0, 0, 0], 'x'),
        cylinder(0.11, 0.035, [0.58, 0, 0], 'x', 32),
        cylinder(0.11, 0.035, [-0.58, 0, 0], 'x', 32),
      ]),
    },
    {
      name: 'prop_cable_frame',
      material: 'equipment',
      mesh: merge([
        box(0.42, 0.07, 0.36, [0, 0.42, 0.02]),
        box(0.08, 0.38, 0.08, [0, 0.19, 0.02]),
        box(0.07, 2.3, 0.07, [0, 1.15, 0.72]),
        box(0.07, 0.07, 0.72, [0, 2.3, 0.4]),
        cylinder(0.05, 0.42, [0, 0.72, 0.33], 'x', 24),
        box(0.07, 0.04, 0.4, [0, 0.72, 0.53]),
      ]),
    },
    {
      name: 'prop_cable_bar',
      material: 'metal',
      mesh: merge([cylinder(0.014, 1.1, [0, 0, 0], 'x')]),
    },
    {
      // Local space: a unit-length wire from the origin up +Y (the clip scales it to the pulley).
      name: 'prop_cable_wire',
      material: 'metal',
      mesh: merge([cylinder(0.005, 1, [0, 0.5, 0], 'y', 8)]),
    },
  ];
}

/** Where the pulldown cable runs to. */
export const PULLEY = [0, 2.27, 0.06];
