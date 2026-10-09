import {
  AnimationClip,
  Bone,
  BoxGeometry,
  BufferAttribute,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  VectorKeyframeTrack,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIGURE_MUSCLES } from '@/core/training';
import { PRIMARY_MIX, SECONDARY_MIX, type FigurePalette } from './body';
import { REQUIRED_BONES, muscleNodeName } from './contract';
import { FigureAssetError, STILL_PHASE, gltfBodyFrom } from './gltfBody';

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
      // Mostly the accent; a little of the modelled surface stays.
      hex: new Color(SKIN).lerp(new Color('#557a5b'), PRIMARY_MIX).getHexString(),
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

  it('fades the highlight per vertex when the model carries muscle weights', () => {
    const { scene, animations } = syntheticBody();
    // Soft highlight data (tools/figures/lib/highlight.mjs): group list on the root, per vertex
    // up to four groups (index; the list's length = no muscle) and their weights.
    scene.userData.muscleGroups = ['chest', 'lats'];
    const vertices = (scene.getObjectByName('muscle_chest') as Mesh).geometry.getAttribute(
      'position',
    ).count;
    const blend = (groups: number[], weights: number[]) => {
      const geometry = new BoxGeometry(0.1, 0.1, 0.1);
      const g = new Uint8Array(vertices * 4);
      const w = new Uint8Array(vertices * 4);
      for (let i = 0; i < vertices; i++) {
        g.set(groups, i * 4);
        w.set(weights, i * 4);
      }
      geometry.setAttribute('_muscle_groups', new BufferAttribute(g, 4));
      geometry.setAttribute('_muscle_weights', new BufferAttribute(w, 4, true));
      return geometry;
    };
    const skin = new MeshStandardMaterial({ color: new Color(SKIN) });
    (scene.getObjectByName('muscle_chest') as Mesh).geometry = blend([0, 1, 2, 2], [191, 64, 0, 0]);
    const head = Object.assign(new Mesh(blend([2, 0, 2, 2], [230, 25, 0, 0]), skin), {
      name: 'body_head',
    });
    scene.add(head);
    const body = gltfBodyFrom(scene, animations, {
      clip: 'rest',
      palette: PALETTE,
      highlight: { chest: 'primary', lats: 'secondary' },
    });
    const compile = (mesh: Mesh) => {
      const shader = {
        uniforms: {} as Record<string, { value: unknown }>,
        vertexShader: '#include <common>\n#include <begin_vertex>',
        fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );',
      };
      (mesh.material as MeshStandardMaterial).onBeforeCompile(shader as never, null as never);
      return shader;
    };
    const chest = compile(body.root.getObjectByName('muscle_chest') as Mesh);
    expect(chest.vertexShader).toContain('uMuscleMix[int(_muscle_groups.x + 0.5)]');
    expect(chest.fragmentShader).toContain('mix( uSurface, uAccent, vMuscleMix )');
    const mix = chest.uniforms.uMuscleMix?.value as Float32Array;
    expect([...mix]).toEqual([PRIMARY_MIX, SECONDARY_MIX, 0].map(Math.fround));
    // The neutral head takes part too (its border with the chest fades), with its own material.
    const headMesh = body.root.getObjectByName('body_head') as Mesh;
    expect(headMesh.material).not.toBe(skin);
    expect(compile(headMesh).uniforms.uMuscleMix).toBe(chest.uniforms.uMuscleMix);
    // The node colour still states its level (fallback and readers of the material).
    expect(levels(body.root).get('muscle_chest')?.level).toBe('primary');
    body.setHighlight({ lats: 'primary' });
    expect([...mix]).toEqual([0, PRIMARY_MIX, 0].map(Math.fround));
    body.dispose();
  });

  it('keeps the node tint alone for a model without muscle weights', () => {
    const { scene, animations } = syntheticBody();
    const body = gltfBodyFrom(scene, animations, {
      clip: 'rest',
      palette: PALETTE,
      highlight: { chest: 'primary' },
    });
    const chest = body.root.getObjectByName('muscle_chest') as Mesh;
    const material = chest.material as MeshStandardMaterial;
    // No own shader hook: three's standard material, tinted per node only.
    expect(Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')).toBe(false);
    expect(material.color.getHexString()).toBe(
      new Color(SKIN).lerp(new Color('#557a5b'), PRIMARY_MIX).getHexString(),
    );
    body.dispose();
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
    // A still figure stands at the clip's explaining moment, not at its first frame.
    body.advance(2 - 4 * STILL_PHASE);
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
