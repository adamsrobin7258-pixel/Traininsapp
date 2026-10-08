/**
 * The experimental Sketchfab-based body against the existing Kalethra asset contract: the file
 * validator (container, names, contract, budgets, coordinate system) and the app's import path
 * (muscle mapping, highlight, clips). Writes the validator report next to the asset.
 */
import { writeFileSync } from 'node:fs';
import { MeshStandardMaterial, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FIGURE_MUSCLES } from '@/core/training';
import { readProjectFile } from '@/test/projectFiles';
import { validateGlb } from '@/modules/training/figure/assetValidator';
import { muscleGroupOfNode } from '@/modules/training/figure/contract';
import { gltfBodyFrom } from '@/modules/training/figure/gltfBody';

const DIR = 'assets/figure/experimental/sketchfab-base';
const FILE = `${DIR}/male_kalethra_experimental.glb`;
const PALETTE = { accent: '#557a5b', equipment: '#5d6066', metal: '#a7aaaf' };

/** jsdom decodes no images: the parsed copy leaves the normal map out (the validator sees it). */
function withoutImages(file) {
  const view = new DataView(file);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(file, 20, jsonLength)));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of json.materials ?? []) delete material.normalTexture;
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const bin = new Uint8Array(file, 20 + jsonLength);
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

describe('experimental body (Sketchfab base mesh)', () => {
  it('passes the Kalethra file validator', () => {
    const report = validateGlb(readProjectFile(FILE), { variant: 'male' });
    writeFileSync(`${DIR}/validation.json`, `${JSON.stringify(report, null, 2)}\n`);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('loads through the app path: all muscle groups, highlight, clips', async () => {
    const gltf = await new GLTFLoader().parseAsync(withoutImages(readProjectFile(FILE)), '');
    const body = gltfBodyFrom(clone(gltf.scene), gltf.animations, {
      clip: 'horizontalPush_bench',
      highlight: { chest: 'primary', triceps: 'secondary' },
      palette: PALETTE,
    });
    expect(body.source).toBe('asset');
    expect(body.clip).toBe('horizontalPush_bench');
    const groups = new Set();
    const accent = new MeshStandardMaterial({ color: PALETTE.accent }).color;
    body.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const group = muscleGroupOfNode(node.name);
      if (!group) return;
      groups.add(group);
      if (group === 'chest') expect(node.material.color.equals(accent)).toBe(true);
    });
    expect([...groups].sort()).toEqual([...FIGURE_MUSCLES].sort());
    body.dispose();
  });
});
