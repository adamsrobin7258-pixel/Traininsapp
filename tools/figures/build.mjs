/**
 * Builds the final Kalethra body assets from MakeHuman 1.x data (CC0):
 *
 *   MAKEHUMAN_DATA=/path/to/makehuman/makehuman/data node tools/figures/build.mjs
 *
 * Writes public/figure/<variant>/kalethra-<variant>.glb for male and female. The pipeline:
 * shape (MakeHuman targets) → rest pose (contract rig, LBS) → relaxed hands, featureless head →
 * one subdivision step on trunk and limbs → muscle segmentation and clothing layers →
 * sculpting (grooves, bellies, hems) → detail normal map → skin, clips, props → GLB.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBody, loadSources } from './lib/assemble.mjs';
import { segmentBody, smoothBorders } from './lib/segment.mjs';
import { sculptBody, LAYER_OFFSET } from './lib/sculpt.mjs';
import { splitMeshes } from './lib/meshes.mjs';
import { bakeNormalMap, surfaceTangents } from './lib/bake.mjs';
import { encodePng } from './lib/png.mjs';
import { clipDefinitions } from './lib/clips.mjs';
import { MATERIALS, exportGlb } from './lib/export.mjs';
import { SHAPES } from './lib/shape.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = process.env.MAKEHUMAN_DATA;
if (!DATA) {
  console.error('Set MAKEHUMAN_DATA to the data folder of a MakeHuman 1.x checkout (see docs).');
  process.exit(1);
}
const NORMAL_MAP_SIZE = Number(process.env.NORMAL_MAP_SIZE ?? 2048);
const OUT = process.env.OUT ?? join(ROOT, 'public/figure');
/** Specs written next to the assets (assets/figure/…), so a change shows up in review. */
const SPECS = process.env.OUT ? null : join(ROOT, 'assets/figure');
const writeJson = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
};

/** Measurements the clips need: how the body lies on a bench and touches a bar. */
function measure(body) {
  const p = body.positions;
  const pelvis = body.joints.get('pelvis');
  const shoulder = body.joints.get('upperArm_L');
  let back = Infinity;
  let chest = -Infinity;
  for (const v of body.used) {
    const [x, y, z] = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
    if (Math.abs(x) < 0.15 && y > pelvis[1] - 0.12 && y < shoulder[1]) back = Math.min(back, z);
    if (Math.abs(x) < 0.12 && y > shoulder[1] - 0.2 && y < shoulder[1] - 0.06)
      chest = Math.max(chest, z);
  }
  return {
    backDepth: pelvis[2] - back + LAYER_OFFSET.top,
    chestFront: chest + LAYER_OFFSET.top,
    seatDrop: 0.1,
  };
}

const sources = loadSources(DATA);
const clipSpecs = {};
for (const variant of ['male', 'female']) {
  const started = Date.now();
  const body = assembleBody(sources, variant);
  const { labels, layers } = segmentBody(body);
  smoothBorders(body, labels, layers);
  const surface = sculptBody(body, labels, layers);
  const tangents = surfaceTangents(surface, body.uvs);
  const meshes = splitMeshes(surface, body.uvs, tangents);
  const normalPng = encodePng(
    NORMAL_MAP_SIZE,
    NORMAL_MAP_SIZE,
    bakeNormalMap(surface, body.uvs, tangents, body.joints, NORMAL_MAP_SIZE),
  );
  const clips = clipDefinitions(body.joints, measure(body));
  const { glb, triangles } = exportGlb({
    variant,
    meshes,
    weights: body.weights,
    source: surface.source,
    rest: body.joints,
    clips,
    normalPng,
    extras: {
      kalethra: {
        contract: 1,
        variant,
        units: 'metre',
        up: '+Y',
        front: '+Z',
        origin: 'floor, under the pelvis',
        shape: SHAPES[variant],
        source: 'MakeHuman 1.x base mesh, targets, skeleton and weights (CC0 1.0)',
        generator: 'tools/figures/build.mjs',
      },
    },
  });
  const dir = join(OUT, variant);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `kalethra-${variant}.glb`);
  writeFileSync(file, glb);
  if (SPECS) {
    const height = Math.max(...body.used.map((v) => body.positions[v * 3 + 1]));
    writeJson(join(SPECS, variant, 'shape.json'), {
      variant,
      file: `public/figure/${variant}/kalethra-${variant}.glb`,
      makehuman: SHAPES[variant],
      heightMetres: Number(height.toFixed(3)),
      triangles,
      bytes: glb.length,
      normalMap: { size: NORMAL_MAP_SIZE, bytes: normalPng.length },
      bodyMeshes: meshes.map((mesh) => mesh.name),
      bones: Object.fromEntries(
        [...body.joints].map(([name, p]) => [name, p.map((x) => Number(x.toFixed(4)))]),
      ),
    });
    clipSpecs[variant] = clips.map(({ name, duration, variant: equipment }) => ({
      name,
      duration,
      equipment,
    }));
  }
  console.log(
    `${variant}: ${(glb.length / 1024 / 1024).toFixed(2)} MB, ${triangles} triangles, ` +
      `normal map ${NORMAL_MAP_SIZE}² ${(normalPng.length / 1024 / 1024).toFixed(2)} MB, ` +
      `${meshes.length} body meshes, ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
}

if (SPECS) {
  writeJson(join(SPECS, 'animations', 'clips.json'), {
    note: 'Clips of both bodies (same names and timing); generated by tools/figures/build.mjs.',
    sampleStepSeconds: 0.1,
    clips: clipSpecs.male,
  });
  writeJson(join(SPECS, 'materials', 'materials.json'), {
    note: 'sRGB design colours; the GLB stores them as linear factors. Generated by tools/figures/build.mjs.',
    materials: MATERIALS,
    detailNormalMap: {
      size: NORMAL_MAP_SIZE,
      format: 'PNG, tangent space, embedded',
      usedBy: ['skin', 'cloth'],
    },
  });
}
