/**
 * Surface quality of the bundled Kalethra bodies in the rest (bind) pose – the faults found in
 * Phase A (version 0.30.1) must not come back:
 *
 * - male: wrinkled neck and upper trapezius at the back, a creased rear shoulder and armpit
 *   (already at rest, not only in the clips),
 * - female: a saw-tooth fold where the back of the head meets the neck, folded skin at the rear
 *   armpit that showed as small spikes,
 * - both: the body (skin plus clothing with its hem) stays one closed surface.
 *
 * Measured on the file itself (no three.js): vertices are merged by position (0.1 mm) over all
 * body primitives, regions are placed by the bind positions of the joints – independently of
 * the masks the repair step uses. Thresholds sit between the values before the repair (in the
 * comments) and after it, with room for a rebuild.
 */
import { readProjectFile } from '@/test/projectFiles';
import { figureAssetFor, FIGURE_VARIANTS, type FigureVariant } from './contract';

interface Json {
  asset: {
    extras?: { kalethra?: { repair?: { version: number; steps: Record<string, unknown> } } };
  };
  accessors: {
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  nodes: { name: string; mesh?: number }[];
  meshes: {
    primitives: { attributes: Record<string, number>; indices: number; material: number }[];
  }[];
  materials: { name: string }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
}

type Vec = [number, number, number];

interface Surface {
  json: Json;
  positions: number[];
  material: string[][];
  faces: number[];
  faceMaterial: string[];
  joints: Record<string, Vec>;
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function read(variant: FigureVariant): Surface {
  const file = readProjectFile(`public/${figureAssetFor(variant) ?? ''}`);
  const view = new DataView(file);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(file, 20, jsonLength))) as Json;
  const binStart = 28 + jsonLength;
  const accessor = (index: number): number[] => {
    const a = json.accessors[index];
    if (!a) throw new Error(`accessor ${String(index)}`);
    const bv = json.bufferViews[a.bufferView];
    const offset = binStart + (bv?.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const n = a.count * (SIZE[a.type] ?? 1);
    if (a.componentType === 5126) return [...new Float32Array(file.slice(offset, offset + n * 4))];
    if (a.componentType === 5125) return [...new Uint32Array(file.slice(offset, offset + n * 4))];
    return [...new Uint16Array(file.slice(offset, offset + n * 2))];
  };
  const ids = new Map<string, number>();
  const positions: number[] = [];
  const material: string[][] = [];
  const faces: number[] = [];
  const faceMaterial: string[] = [];
  for (const node of json.nodes) {
    if (node.mesh === undefined || node.name.startsWith('prop_')) continue;
    for (const primitive of json.meshes[node.mesh]?.primitives ?? []) {
      const name = json.materials[primitive.material]?.name ?? '';
      const P = accessor(primitive.attributes.POSITION ?? -1);
      const local: number[] = [];
      for (let i = 0; i < P.length / 3; i++) {
        const p = [P[i * 3] ?? 0, P[i * 3 + 1] ?? 0, P[i * 3 + 2] ?? 0];
        const key = p.map((x) => Math.round(x * 1e4)).join(',');
        let id = ids.get(key);
        if (id === undefined) {
          id = positions.length / 3;
          ids.set(key, id);
          positions.push(...p);
          material.push([]);
        }
        if (!material[id]?.includes(name)) material[id]?.push(name);
        local.push(id);
      }
      const I = accessor(primitive.indices);
      for (let t = 0; t < I.length; t += 3) {
        faces.push(local[I[t] ?? 0] ?? 0, local[I[t + 1] ?? 0] ?? 0, local[I[t + 2] ?? 0] ?? 0);
        faceMaterial.push(name);
      }
    }
  }
  const skin = json.skins[0];
  if (!skin) throw new Error('no skin');
  const inverse = accessor(skin.inverseBindMatrices);
  const joints: Record<string, Vec> = {};
  skin.joints.forEach((node, k) => {
    joints[json.nodes[node]?.name ?? ''] = [
      -(inverse[k * 16 + 12] ?? 0),
      -(inverse[k * 16 + 13] ?? 0),
      -(inverse[k * 16 + 14] ?? 0),
    ];
  });
  return { json, positions, material, faces, faceMaterial, joints };
}

const surfaces = new Map(FIGURE_VARIANTS.map((variant) => [variant, read(variant)]));
const surfaceOf = (variant: FigureVariant): Surface => {
  const surface = surfaces.get(variant);
  if (!surface) throw new Error(variant);
  return surface;
};

const at = (s: Surface, v: number): Vec => [
  s.positions[v * 3] ?? 0,
  s.positions[v * 3 + 1] ?? 0,
  s.positions[v * 3 + 2] ?? 0,
];

function faceNormal(s: Surface, f: number): Vec {
  const [a, b, c] = [0, 1, 2].map((k) => at(s, s.faces[f * 3 + k] ?? 0)) as [Vec, Vec, Vec];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec = [
    (u[1] ?? 0) * (w[2] ?? 0) - (u[2] ?? 0) * (w[1] ?? 0),
    (u[2] ?? 0) * (w[0] ?? 0) - (u[0] ?? 0) * (w[2] ?? 0),
    (u[0] ?? 0) * (w[1] ?? 0) - (u[1] ?? 0) * (w[0] ?? 0),
  ];
  const l = Math.hypot(...n) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Skin faces and edges whose corners all lie in `inside`. */
function quality(s: Surface, inside: (p: Vec) => boolean) {
  const skinFacesOf = new Map<number, number[]>();
  const edges = new Map<string, number[]>();
  for (let f = 0; f < s.faces.length / 3; f++) {
    if (s.faceMaterial[f] !== 'skin') continue;
    const corners = [0, 1, 2].map((k) => s.faces[f * 3 + k] ?? 0);
    for (const v of corners) skinFacesOf.set(v, [...(skinFacesOf.get(v) ?? []), f]);
    for (let k = 0; k < 3; k++) {
      const a = corners[k] ?? 0;
      const b = corners[(k + 1) % 3] ?? 0;
      const key = a < b ? `${String(a)}_${String(b)}` : `${String(b)}_${String(a)}`;
      edges.set(key, [...(edges.get(key) ?? []), f]);
    }
  }
  const vertexNormal = (v: number): Vec => {
    const sum: Vec = [0, 0, 0];
    for (const f of skinFacesOf.get(v) ?? []) {
      const n = faceNormal(s, f);
      sum[0] += n[0];
      sum[1] += n[1];
      sum[2] += n[2];
    }
    const l = Math.hypot(...sum) || 1;
    return [sum[0] / l, sum[1] / l, sum[2] / l];
  };
  // Creases: neighbouring skin faces turned more than 30° against each other.
  let creases = 0;
  for (const [key, list] of edges) {
    const [a, b] = key.split('_').map(Number) as [number, number];
    if (list.length !== 2 || !inside(at(s, a)) || !inside(at(s, b))) continue;
    const angle = Math.acos(
      Math.min(1, dot(faceNormal(s, list[0] ?? 0), faceNormal(s, list[1] ?? 0))),
    );
    if ((angle * 180) / Math.PI > 30) creases++;
  }
  // Folds: a face turned against the mean normal of its own corners.
  let folded = 0;
  for (let f = 0; f < s.faces.length / 3; f++) {
    if (s.faceMaterial[f] !== 'skin') continue;
    const corners = [0, 1, 2].map((k) => s.faces[f * 3 + k] ?? 0);
    if (!corners.every((v) => inside(at(s, v)))) continue;
    const n = faceNormal(s, f);
    const mean = corners.reduce((sum, v) => sum + dot(n, vertexNormal(v)), 0) / 3;
    if (mean < 0.2) folded++;
  }
  return { creases, folded };
}

/** Regions from the joints' bind positions (metres). */
function regions(s: Surface) {
  const J = s.joints;
  const neck = J.neck ?? [0, 0, 0];
  const head = J.head ?? [0, 0, 0];
  const arms = [J.upperArm_L, J.upperArm_R].filter((a): a is Vec => Boolean(a));
  return {
    neckBack: ([x, y, z]: Vec) =>
      y > neck[1] - 0.05 && y < head[1] - 0.01 && z < neck[2] && Math.hypot(x, z - neck[2]) < 0.12,
    headNeckBack: ([, y, z]: Vec) => y > neck[1] && y < head[1] + 0.02 && z < neck[2] + 0.02,
    rearShoulder: (p: Vec) => arms.some((a) => distance(p, a) < 0.1 && p[2] < a[2]),
    armpit: (p: Vec) => arms.some((a) => distance(p, a) < 0.11),
  };
}

describe.each(FIGURE_VARIANTS)('Kalethra body "%s" – surface', (variant) => {
  it('carries the surface repair of the build', () => {
    const repair = surfaceOf(variant).json.asset.extras?.kalethra?.repair;
    expect(repair?.version).toBe(1);
    expect(repair?.steps).toBeTruthy();
  });

  it('is one closed surface: skin and clothing meet without a gap', () => {
    const s = surfaceOf(variant);
    const count = new Map<string, number>();
    for (let f = 0; f < s.faces.length / 3; f++) {
      for (let k = 0; k < 3; k++) {
        const a = s.faces[f * 3 + k] ?? 0;
        const b = s.faces[f * 3 + ((k + 1) % 3)] ?? 0;
        const key = a < b ? `${String(a)}_${String(b)}` : `${String(b)}_${String(a)}`;
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    }
    expect([...count.values()].filter((n) => n === 1)).toHaveLength(0);
  });

  it('has no folded skin at the rear shoulder and armpit, already at rest', () => {
    const s = surfaceOf(variant);
    const r = regions(s);
    // Before Phase A: male 25 / 58 folded faces, female 97 / 219.
    expect(quality(s, r.rearShoulder).folded).toBe(0);
    expect(quality(s, r.armpit).folded).toBe(0);
    // Creases above 30°: male 173 → 80, female 303 → 76.
    expect(quality(s, r.rearShoulder).creases).toBeLessThan(110);
  });
});

describe('Kalethra body "male" – neck and trapezius at the back', () => {
  it('has a calm neck: few creases (before: 83 above 30°)', () => {
    const s = surfaceOf('male');
    expect(quality(s, regions(s).neckBack).creases).toBeLessThan(60);
  });
});

describe('Kalethra body "female" – head and neck', () => {
  it('joins the back of the head and the neck without a fold (before: 30 folded faces)', () => {
    const s = surfaceOf('female');
    const result = quality(s, regions(s).headNeckBack);
    expect(result.folded).toBe(0);
    // Before: 66 creases above 30°.
    expect(result.creases).toBeLessThan(10);
  });

  it('has a calm neck at the back (before: 54 creases above 30°)', () => {
    const s = surfaceOf('female');
    expect(quality(s, regions(s).neckBack).creases).toBeLessThan(20);
  });
});
