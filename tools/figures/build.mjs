/**
 * Builds the final Kalethra body assets from MakeHuman 1.x data (CC0):
 *
 *   MAKEHUMAN_DATA=/path/to/makehuman/makehuman/data node tools/figures/build.mjs
 *
 * Writes public/figure/<variant>/kalethra-<variant>.glb for male and female. The pipeline:
 * shape (MakeHuman targets) → rest pose (contract rig, LBS) → relaxed hands, featureless head →
 * one subdivision step on trunk and limbs → muscle segmentation and clothing layers →
 * sculpting (grooves, bellies, hems) → detail normal map → skin, clips, props → GLB → local
 * surface repair (lib/repair.mjs).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleBody, loadSources } from './lib/assemble.mjs';
import { segmentBody, smoothBorders } from './lib/segment.mjs';
import { sculptBody, LAYER_OFFSET, LAYER_OFFSET_MODELLED } from './lib/sculpt.mjs';
import { splitMeshes } from './lib/meshes.mjs';
import { bakeNormalMap, surfaceTangents } from './lib/bake.mjs';
import { encodePng } from './lib/png.mjs';
import { clipDefinitions } from './lib/clips.mjs';
import { MATERIALS, exportGlb } from './lib/export.mjs';
import { SHAPES } from './lib/shape.mjs';
import { rigFor } from './lib/rig.mjs';
import { detailNormalField, readSculpt, sculptRegions, transferAnatomy } from './lib/transfer.mjs';
import { refineHands } from './lib/handform.mjs';
import { handModel } from './lib/grip.mjs';
import { muscleBlend } from './lib/highlight.mjs';
import { repairBody } from './lib/repair.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = process.env.MAKEHUMAN_DATA;
if (!DATA) {
  console.error('Set MAKEHUMAN_DATA to the data folder of a MakeHuman 1.x checkout (see docs).');
  process.exit(1);
}
const NORMAL_MAP_SIZE = Number(process.env.NORMAL_MAP_SIZE ?? 2048);
/**
 * Modelled anatomy per variant (sculpt data from tools/figure-experiment, CC BY 4.0 source –
 * see assets/figure/male/source/ATTRIBUTION.md); a variant without one keeps the MakeHuman form.
 */
const SCULPTS = { male: 'assets/figure/male/source/kalethra-male-sculpt.bin.gz' };
/** Credit carried in the file itself (glTF asset.copyright) – required by CC BY 4.0. */
const CREDITS = {
  male: {
    copyright:
      'Based on "Proxy Human base Mesh" by sphere_joe (https://sketchfab.com/mundane_x), ' +
      'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified for Kalethra; ' +
      'not endorsed by the author. Topology, hands and feet: MakeHuman 1.x (CC0 1.0).',
    source:
      'Modelled anatomy from "Proxy Human base Mesh" by sphere_joe (CC BY 4.0, modified), ' +
      'fitted onto the MakeHuman 1.x base mesh, skeleton and weights (CC0 1.0)',
  },
};
/** A fitted top over modelled abdominals: smooth longer than over the calmer MakeHuman form. */
const FABRIC_PASSES_MODELLED = 14;
/** Gentler straightening of the clothing edges: the fitted mesh is finer at the neck, and long
 * straightening there folds edge triangles over. */
const BORDER_ITERATIONS_MODELLED = 4;
/** The top's openings of the modelled body (metres; arm hole centre relative to the shoulder joint). */
const ARMHOLE = {
  x: 1.0,
  width: 0.085,
  drop: 0.035,
  depth: 0.16,
  // Back of the neck opening: below the fold of the neck when the head lies or bends.
  neckBack: 0.07,
};
const OUT = process.env.OUT ?? join(ROOT, 'public/figure');
/** Specs written next to the assets (assets/figure/…), so a change shows up in review. */
const SPECS = process.env.OUT ? null : join(ROOT, 'assets/figure');
const writeJson = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
};

/** Measurements the clips need: how the body lies on a bench and touches a bar. */
function measure(body, layerOffset = LAYER_OFFSET) {
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
    backDepth: pelvis[2] - back + layerOffset.top,
    chestFront: chest + layerOffset.top,
    seatDrop: 0.1,
  };
}

const sources = loadSources(DATA);
const clipSpecs = {};
// VARIANTS=male builds one variant only (quicker while working on it).
for (const variant of (process.env.VARIANTS ?? 'male,female').split(',')) {
  const started = Date.now();
  // The male body takes the modelled Kalethra anatomy (phase 18.4, see lib/transfer.mjs).
  const sculptFile = SCULPTS[variant];
  const sculpt = sculptFile ? readSculpt(join(ROOT, sculptFile)) : null;
  // …and slimmer hands with their finger joints in the fingers' middle (lib/handform.mjs).
  const body = sculpt
    ? refineHands(transferAnatomy(assembleBody(sources, variant), sculpt))
    : assembleBody(sources, variant);
  const { labels, layers } = segmentBody(
    body,
    sculpt ? { armhole: ARMHOLE, region: sculptRegions(sculpt) } : {},
  );
  smoothBorders(
    body,
    labels,
    layers,
    sculpt ? BORDER_ITERATIONS_MODELLED : 12,
    sculpt ? { foldSafe: true } : {},
  );
  const surface = sculptBody(
    body,
    labels,
    layers,
    sculpt
      ? { grooves: 0, fabricPasses: FABRIC_PASSES_MODELLED, layerOffset: LAYER_OFFSET_MODELLED }
      : {},
  );
  const tangents = surfaceTangents(surface, body.uvs);
  const meshes = splitMeshes(surface, body.uvs, tangents);
  const normalPng = encodePng(
    NORMAL_MAP_SIZE,
    NORMAL_MAP_SIZE,
    bakeNormalMap(
      surface,
      body.uvs,
      tangents,
      body.joints,
      NORMAL_MAP_SIZE,
      sculpt
        ? {
            detail: detailNormalField(sculpt),
            detailWeight: Float64Array.from(surface.source, (v) => body.detail[v]),
          }
        : {},
    ),
  );
  // The modelled body closes its hands around the bars and moves its shoulder girdle with the arm.
  const clips = clipDefinitions(
    body.joints,
    measure(body, sculpt ? LAYER_OFFSET_MODELLED : LAYER_OFFSET),
    sculpt
      ? {
          shoulderRhythm: true,
          rig: rigFor(variant),
          hands: { L: handModel(body, 'L'), R: handModel(body, 'R') },
        }
      : {},
  );
  const { glb: exported, triangles } = exportGlb({
    variant,
    meshes,
    weights: body.weights,
    source: surface.source,
    rest: body.joints,
    rig: rigFor(variant),
    clips,
    normalPng,
    copyright: CREDITS[variant]?.copyright,
    // The modelled body's highlight fades into its neighbours (lib/highlight.mjs).
    muscleBlend: sculpt ? muscleBlend(surface) : null,
    extras: {
      kalethra: {
        contract: 1,
        variant,
        units: 'metre',
        up: '+Y',
        front: '+Z',
        origin: 'floor, under the pelvis',
        shape: SHAPES[variant],
        source:
          CREDITS[variant]?.source ??
          'MakeHuman 1.x base mesh, targets, skeleton and weights (CC0 1.0)',
        generator: 'tools/figures/build.mjs',
      },
    },
  });
  // Last step: local surface repair of the finished mesh (lib/repair.mjs).
  const { glb, report } = repairBody(exported, variant);
  console.log(`${variant}: repair ${JSON.stringify(report)}`);
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
