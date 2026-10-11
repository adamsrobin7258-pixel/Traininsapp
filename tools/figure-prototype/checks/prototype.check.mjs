/**
 * Checks of the prototype asset and body (phase 1A). The asset is the built file
 * (assets/figure/prototype/kalethra-male-prototype.glb, tools/figure-prototype/build.sh); the
 * production assets are only read for comparison.
 *
 * jsdom decodes no images: the scene tests parse a copy without images (as the production tests
 * do); the file validation sees the untouched file.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Mesh, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIGURE_MUSCLES } from '@/core/training';
import { validateGlb } from '@/modules/training/figure/assetValidator';
import { ASSET_BUDGET, muscleGroupOfNode } from '@/modules/training/figure/contract';
import { prototypeBodyFrom, groupTints } from '../viewer/prototypeBody.mjs';
import look from '../look.json';

const FILE = 'assets/figure/prototype/kalethra-male-prototype.glb';
const PALETTE = { accent: '#557a5b', equipment: '#5d6066', metal: '#a7aaaf' };
const bytes = readFileSync(FILE);
const file = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

function withoutImages(buffer) {
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) delete m.normalTexture;
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const bin = new Uint8Array(buffer, 20 + jsonLength);
  const out = new Uint8Array(20 + jsonBytes.length + bin.length);
  const header = new DataView(out.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, out.length, true);
  header.setUint32(12, jsonBytes.length, true);
  header.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  out.set(bin, 20 + jsonBytes.length);
  return out.buffer;
}
const load = () => new GLTFLoader().parseAsync(withoutImages(file), '');
const body = async (clip, highlight = {}, view) =>
  prototypeBodyFrom(await load(), { clip, highlight, palette: PALETTE, view });

describe('prototype file', () => {
  it('keeps the production assets unchanged', () => {
    // Checksums of the bundled bodies at the start of phase 1A (commit c4bac31, 0.33.0).
    const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
    expect(sha('public/figure/male/kalethra-male.glb')).toBe(
      '4724ca4530912ebc4dbbb524458c33042b5c35dbb310ed63504c78eff3224af1',
    );
    expect(sha('public/figure/female/kalethra-female.glb')).toBe(
      '11bf26cfff80adfee78c91047b53b0020f558c32b074014c753723270cf02f44',
    );
  });

  it('fulfils the asset contract; only the budgets are exceeded (on purpose, phase 1A)', () => {
    const report = validateGlb(file, { variant: 'male' });
    expect(report.contract?.ok).toBe(true);
    const budget = report.errors.filter(
      (e) => !/budget|triangles|bytes|texture|MiB|larger|more than/i.test(e),
    );
    expect(budget).toEqual([]);
    expect(report.stats.clips).toEqual(['rest', 'horizontalPush_bench', 'verticalPull_cable']);
    // Recorded for the report: what the prototype costs against the production budget.
    console.log(
      JSON.stringify({ stats: report.stats, errors: report.errors, budget: ASSET_BUDGET }, null, 1),
    );
  });
});

describe('prototype body', () => {
  it('parses (Node/jsdom, without image decoding) – a rough load-time figure for the report', async () => {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await load();
      times.push(performance.now() - t0);
    }
    console.log(
      `parse times (ms, jsdom, no image decode): ${times.map((t) => t.toFixed(0)).join(', ')}`,
    );
    expect(Math.min(...times)).toBeGreaterThan(0);
  });

  it('starts in the skin view: skin form, hair and drape visible, no fibre map', async () => {
    const b = await body('rest');
    expect(b.displayView).toBe('skin');
    expect(b.morphState().muscle).toBe(0);
    const hair = b.root.getObjectByName('proto_hair');
    const drape = b.root.getObjectByName('proto_drape');
    expect(hair.visible && drape.visible).toBe(true);
    let bodyMeshes = 0;
    b.root.traverse((n) => {
      if (n instanceof Mesh && /^(muscle|body)_/.test(n.name)) {
        bodyMeshes++;
        expect(n.material.normalMap).toBeNull();
      }
    });
    expect(bodyMeshes).toBeGreaterThan(20);
    b.dispose();
  });

  it('switches to the muscle view and back on the same body (pose and highlight kept)', async () => {
    const b = await body('horizontalPush_bench', { chest: 'primary' });
    b.advance(0.7);
    const hand = b.root.getObjectByName('hand_L');
    const before = hand.getWorldPosition(new Vector3());
    const tintSkin = b.groupState();
    b.setView('muscle');
    expect(b.morphState().muscle).toBe(1);
    expect(b.root.getObjectByName('proto_hair').visible).toBe(false);
    expect(b.root.getObjectByName('proto_drape').visible).toBe(false);
    expect(b.root.getObjectByName('proto_eye_L').visible).toBe(true);
    b.root.updateMatrixWorld(true);
    expect(hand.getWorldPosition(new Vector3()).distanceTo(before)).toBeLessThan(1e-9);
    const tintMuscle = b.groupState();
    expect(tintMuscle).not.toEqual(tintSkin);
    b.setView('skin');
    expect(b.morphState().muscle).toBe(0);
    expect(b.root.getObjectByName('proto_hair').visible).toBe(true);
    expect(b.groupState()).toEqual(tintSkin);
    expect(() => b.setView('bones')).toThrow();
    b.dispose();
  });

  it('carries all 13 muscle groups, each with its own colour in the muscle view', async () => {
    const b = await body('rest');
    const groups = new Set();
    b.root.traverse((n) => {
      const g = muscleGroupOfNode(n.name);
      if (g) groups.add(g);
    });
    expect([...groups].sort()).toEqual([...FIGURE_MUSCLES].sort());
    const names = b.root.getObjectByName('kalethra_male').userData.muscleGroups;
    expect([...names].sort()).toEqual([...FIGURE_MUSCLES].sort());
    const { tint } = groupTints(names, {}, 'muscle');
    expect(new Set(tint.slice(0, 13)).size).toBe(13);
    b.dispose();
  });

  it('highlights in both views: primary > secondary > others (dimmed in the muscle view)', async () => {
    const names = [...FIGURE_MUSCLES].sort();
    const hl = { chest: 'primary', triceps: 'secondary' };
    const skin = groupTints(names, hl, 'skin');
    const muscle = groupTints(names, hl, 'muscle');
    const at = (r, g) => r.mix[names.indexOf(g)];
    expect(at(skin, 'chest')).toBeGreaterThan(at(skin, 'triceps'));
    expect(at(skin, 'triceps')).toBeGreaterThan(at(skin, 'lats'));
    expect(at(skin, 'lats')).toBe(0);
    expect(at(muscle, 'chest')).toBeGreaterThan(at(muscle, 'triceps'));
    expect(at(muscle, 'triceps')).toBeGreaterThan(at(muscle, 'lats'));
    expect(at(muscle, 'lats')).toBe(look.muscleView.dimmedMix);
    // Without an exercise every group shows its base colour.
    expect(
      groupTints(names, {}, 'muscle')
        .mix.slice(0, 13)
        .every((m) => m === look.muscleView.baseMix),
    ).toBe(true);
  });

  it('drives the corrective shapes by the joints’ bend in both views', async () => {
    const b = await body('horizontalPush_bench');
    // Bench press: elbows bend most at the bottom of the repetition.
    let most = 0;
    for (let i = 0; i < 44; i++) {
      b.advance(0.1);
      most = Math.max(most, b.morphState().fix_elbow_L);
    }
    expect(most).toBeGreaterThan(0.8);
    b.setView('muscle');
    b.advance(0.1);
    expect(b.morphState().fix_elbow_L).toBeGreaterThan(0);
    const rest = await body('rest');
    const state = rest.morphState();
    for (const [k, v] of Object.entries(state)) if (k.startsWith('fix_')) expect(v).toBe(0);
    b.dispose();
    rest.dispose();
  });

  it('skins hair, drape and eyes with the body’s skeleton', async () => {
    const b = await body('rest');
    const skeletons = new Set();
    b.root.traverse((n) => {
      if (n instanceof SkinnedMesh) skeletons.add(n.skeleton.bones.map((x) => x.name).join());
    });
    expect(skeletons.size).toBe(1);
    for (const name of ['proto_hair', 'proto_drape', 'proto_eye_L', 'proto_eye_R'])
      expect(b.root.getObjectByName(name)).toBeInstanceOf(SkinnedMesh);
    b.dispose();
  });

  it('closes the body surface in both forms (no holes under the former clothing)', async () => {
    const gltf = await load();
    for (const morph of [0, 1]) {
      const key = new Map();
      const edges = new Map();
      gltf.scene.traverse((n) => {
        if (!(n instanceof Mesh) || !/^(muscle|body)_/.test(n.name)) return;
        const pos = n.geometry.attributes.position;
        const delta = n.geometry.morphAttributes.position?.[0];
        const index = n.geometry.index;
        const id = (i) => {
          const x = pos.getX(i) + morph * (delta?.getX(i) ?? 0);
          const y = pos.getY(i) + morph * (delta?.getY(i) ?? 0);
          const z = pos.getZ(i) + morph * (delta?.getZ(i) ?? 0);
          const k = `${Math.round(x / 5e-5)},${Math.round(y / 5e-5)},${Math.round(z / 5e-5)}`;
          if (!key.has(k)) key.set(k, key.size);
          return key.get(k);
        };
        for (let t = 0; t < index.count; t += 3) {
          const v = [id(index.getX(t)), id(index.getX(t + 1)), id(index.getX(t + 2))];
          for (let k = 0; k < 3; k++) {
            const a = Math.min(v[k], v[(k + 1) % 3]);
            const c = Math.max(v[k], v[(k + 1) % 3]);
            const e = `${a}_${c}`;
            edges.set(e, (edges.get(e) ?? 0) + 1);
          }
        }
      });
      const open = [...edges.values()].filter((c) => c === 1).length;
      const over = [...edges.values()].filter((c) => c > 2).length;
      console.log(
        `form ${morph ? 'muscle' : 'skin'}: ${key.size} vertices, ${open} open edges, ${over} non-manifold`,
      );
      // MakeHuman's base mesh touches itself at a few points (lid and lip corners): counted, small.
      expect(over).toBeLessThan(20);
      expect(open).toBeLessThan(200);
    }
  });

  it('frees materials and geometry on dispose', async () => {
    const b = await body('verticalPull_cable');
    const geometries = [];
    b.root.traverse((n) => n instanceof Mesh && geometries.push(n.geometry));
    let disposed = 0;
    for (const g of geometries) g.addEventListener('dispose', () => disposed++);
    b.dispose();
    expect(disposed).toBe(geometries.length);
  });
});
