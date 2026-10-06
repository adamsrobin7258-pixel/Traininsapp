import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  VectorKeyframeTrack,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIGURE_MUSCLES } from '@/core/training';
import type { FigurePalette } from './body';
import { REQUIRED_BONES, muscleNodeName } from './contract';
import { FigureAssetError, gltfBodyFrom } from './gltfBody';

const PALETTE = { accent: '#557a5b' } as FigurePalette;
const SKIN = '#c9b8a8';

/**
 * A tiny stand-in for a modelled body: every muscle group as a node (one split into parts),
 * the full skeleton, a rest clip and one movement clip. No real model – the contract only.
 */
function syntheticBody({ withLats = true } = {}) {
  const scene = new Group();
  scene.name = 'KalethraBody';
  const geometry = new BoxGeometry(0.1, 0.1, 0.1);
  const skin = new MeshStandardMaterial({ color: new Color(SKIN), roughness: 0.8 });
  scene.add(Object.assign(new Mesh(geometry, skin), { name: 'body:skin' }));
  for (const group of FIGURE_MUSCLES) {
    if (group === 'lats' && !withLats) continue;
    if (group === 'shoulders') {
      // A group made of parts, the parts below a group node.
      const node = new Group();
      node.name = muscleNodeName('shoulders');
      for (const part of ['front', 'middle', 'rear']) {
        node.add(
          Object.assign(new Mesh(geometry, skin), { name: muscleNodeName('shoulders', part) }),
        );
      }
      scene.add(node);
    } else {
      scene.add(Object.assign(new Mesh(geometry, skin), { name: muscleNodeName(group) }));
    }
  }
  let parent: Object3D = scene;
  for (const name of REQUIRED_BONES) {
    const bone = new Bone();
    bone.name = name;
    parent.add(bone);
    if (name === 'chest') parent = bone;
  }
  const rest = new AnimationClip('rest', 0, []);
  const press = new AnimationClip('horizontalPush_bench', 4, [
    new VectorKeyframeTrack('hand_L.position', [0, 2, 4], [0, 0, 0, 0, 0.4, 0, 0, 0, 0]),
  ]);
  return { scene, animations: [rest, press] };
}

function levels(root: Object3D) {
  const result = new Map<string, { level: string; hex: string; roughness: number }>();
  root.traverse((node) => {
    if (node instanceof Mesh && node.name.startsWith('muscle_')) {
      const material = node.material as MeshStandardMaterial;
      result.set(node.name, {
        level: String(material.userData.level),
        hex: material.color.getHexString(),
        roughness: material.roughness,
      });
    }
  });
  return result;
}

describe('modelled body (GLB import path)', () => {
  it('finds the muscle groups by name and tints only their colour – the model’s material stays', () => {
    const { scene, animations } = syntheticBody();
    const body = gltfBodyFrom(scene, animations, {
      clip: 'horizontalPush_bench',
      palette: PALETTE,
      highlight: { chest: 'primary', shoulders: 'secondary' },
    });
    expect(body.source).toBe('asset');
    const parts = levels(body.root);
    expect(parts.get('muscle_chest')).toMatchObject({
      level: 'primary',
      hex: new Color('#557a5b').getHexString(),
      roughness: 0.8,
    });
    // Every part of a group lights up together.
    for (const part of ['front', 'middle', 'rear']) {
      expect(parts.get(`muscle_shoulders_${part}`)?.level).toBe('secondary');
    }
    expect(parts.get('muscle_lats')).toMatchObject({
      level: 'neutral',
      hex: new Color(SKIN).getHexString(),
    });
    // The shared skin material is untouched; muscles got their own copies.
    const skin = body.root.getObjectByName('body:skin') as Mesh;
    expect((skin.material as MeshStandardMaterial).color.getHexString()).toBe(
      new Color(SKIN).getHexString(),
    );
  });

  it('plays the requested clip and falls back to the rest pose', () => {
    const { scene, animations } = syntheticBody();
    const body = gltfBodyFrom(scene, animations, {
      clip: 'horizontalPush_bench',
      palette: PALETTE,
      highlight: {},
    });
    expect(body.clip).toBe('horizontalPush_bench');
    expect(body.animated).toBe(true);
    const hand = body.root.getObjectByName('hand_L') as Object3D;
    body.advance(2);
    expect(hand.position.y).toBeCloseTo(0.4, 5);
    body.advance(2);
    expect(hand.position.y).toBeCloseTo(0, 5);

    const other = syntheticBody();
    const squat = gltfBodyFrom(other.scene, other.animations, {
      clip: 'squat',
      palette: PALETTE,
      highlight: {},
    });
    expect(squat.clip).toBe('rest');
    expect(squat.animated).toBe(false);
  });

  it('refuses an asset that breaks the contract (the caller then shows the fallback)', () => {
    const { scene, animations } = syntheticBody({ withLats: false });
    expect(() =>
      gltfBodyFrom(scene, animations, { clip: 'rest', palette: PALETTE, highlight: {} }),
    ).toThrow(FigureAssetError);
  });

  it('keeps the semantic node names through the glTF loader', async () => {
    // Minimal glTF 2.0 with one triangle shared by two named nodes.
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(positions.buffer)));
    const gltf = {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0, 1] }],
      nodes: [
        { name: 'muscle_chest', mesh: 0 },
        { name: 'muscle_shoulders_rear', mesh: 0 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      materials: [
        { pbrMetallicRoughness: { baseColorFactor: [0.8, 0.7, 0.6, 1], roughnessFactor: 0.9 } },
      ],
      buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${base64}` }],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [1, 1, 0],
        },
      ],
    };
    const loaded = await new GLTFLoader().parseAsync(JSON.stringify(gltf), '');
    const names: string[] = [];
    loaded.scene.traverse((node) => names.push(node.name));
    expect(names).toContain('muscle_chest');
    expect(names).toContain('muscle_shoulders_rear');
    const chest = loaded.scene.getObjectByName('muscle_chest') as Mesh;
    expect(chest.material).toBeInstanceOf(MeshStandardMaterial);
  });
});
