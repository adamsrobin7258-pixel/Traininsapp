import {
  Color,
  Group,
  Mesh,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { FIGURE_MUSCLES, muscleHighlight } from '@/core/training';
import type { FigureBody, FigurePalette } from './body';
import { validateFigureAsset } from './contract';
import { createFallbackBody } from './fallbackBody';
import { FALLBACK_CLIPS } from './rig';

const PALETTE: FigurePalette = {
  body: '#d9d3c9',
  shirt: '#4b544e',
  shorts: '#353c38',
  shoe: '#2c312e',
  equipment: '#bdbab1',
  metal: '#8f8d87',
  accent: '#557a5b',
  shadow: '#1b1f1c',
};

const bench = (highlight = {}) =>
  createFallbackBody({ clip: 'horizontalPush_bench', palette: PALETTE, highlight });

/** Material colour and level of every part named after a muscle group. */
function muscles(body: FigureBody) {
  const parts = new Map<string, { hex: string; level: string }>();
  body.root.traverse((object) => {
    if (object instanceof Mesh && object.name.startsWith('muscle_')) {
      const material = object.material as MeshStandardMaterial;
      parts.set(object.name.slice('muscle_'.length), {
        hex: material.color.getHexString(),
        level: String(material.userData.level),
      });
    }
  });
  return parts;
}

const hex = (color: string) => new Color(color).getHexString();

/** Local transform of every node below the root – what the body itself controls. */
function localTransforms(root: Object3D) {
  const result: number[][] = [];
  root.traverse((node) => {
    if (node === root) return;
    node.updateMatrix();
    result.push([...node.matrix.elements].map((value) => Math.round(value * 1e6) / 1e6));
  });
  return result;
}

/** The bar: a prop of the body, found by its contract name. */
function bar(root: Object3D): Object3D {
  const found = root.getObjectByName('prop_bar');
  if (!found) throw new Error('bar expected');
  return found;
}

describe('fallback body (placeholder, same contract as a modelled body)', () => {
  it('is labelled as the fallback and names one part per muscle group by the contract', () => {
    const body = createFallbackBody({ clip: 'rest', palette: PALETTE, highlight: {} });
    expect(body.source).toBe('fallback');
    expect([...muscles(body).keys()].sort()).toEqual([...new Set(FIGURE_MUSCLES)].sort());
    const names: string[] = [];
    body.root.traverse((node) => names.push(node.name));
    const report = validateFigureAsset({ nodeNames: names, boneNames: [], clipNames: [] });
    expect(report.missingMuscles).toEqual([]);
    expect(report.unknownMuscleNodes).toEqual([]);
    body.dispose();
  });

  it('plays its clips by contract name and falls back to the movement type or rest', () => {
    expect(bench().clip).toBe('horizontalPush_bench');
    expect(bench().animated).toBe(true);
    const unknownVariant = createFallbackBody({
      clip: 'horizontalPush_floor',
      palette: PALETTE,
      highlight: {},
    });
    // No floor version and no plain "horizontalPush" clip in the fallback: the rest pose.
    expect(unknownVariant.clip).toBe('rest');
    expect(unknownVariant.animated).toBe(false);
    expect(Object.keys(FALLBACK_CLIPS)).toEqual([
      'rest',
      'horizontalPush_bench',
      'verticalPull_cable',
    ]);
  });

  it('highlights primary in the accent, secondary softer, the rest neutral', () => {
    const highlight = muscleHighlight({
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps', 'shoulders'],
    });
    const parts = muscles(bench(highlight));
    expect(parts.get('chest')).toEqual({ hex: hex(PALETTE.accent), level: 'primary' });
    expect(parts.get('triceps')?.level).toBe('secondary');
    expect(parts.get('shoulders')?.level).toBe('secondary');
    const secondary = parts.get('triceps')?.hex;
    expect(secondary).not.toBe(hex(PALETTE.accent));
    expect(secondary).not.toBe(hex(PALETTE.body));
    for (const group of ['lats', 'back', 'core', 'quadriceps', 'calves']) {
      expect(parts.get(group)?.level, group).toBe('neutral');
    }
  });

  it('updates the highlight and the theme colours in place', () => {
    const body = createFallbackBody({
      clip: 'verticalPull_cable',
      palette: PALETTE,
      highlight: {},
    });
    body.setHighlight({ lats: 'primary' });
    expect(muscles(body).get('lats')).toEqual({ hex: hex(PALETTE.accent), level: 'primary' });
    body.setPalette({ ...PALETTE, accent: '#93b597' });
    expect(muscles(body).get('lats')?.hex).toBe(hex('#93b597'));
  });

  it('moves the bar with the hands through the repetition', () => {
    const body = bench();
    const heights: number[] = [];
    for (let step = 0; step < 11; step++) {
      heights.push(bar(body.root).position.y);
      body.advance(4.4 / 10);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.3);
  });

  /**
   * The defect seen on the device: with the figure turned, the bar left the hands while the
   * motion played. Turning is done by the stage above the root only; the body never reads world
   * matrices – so its own transforms are the same however the stage is turned.
   */
  it.each([0, Math.PI / 2, Math.PI, -2.4, 7])(
    'keeps every part in place under a turned stage (yaw %s) – also while playing',
    (yaw) => {
      const reference = bench();
      const turned = bench();
      const stage = new Group();
      stage.rotation.y = yaw;
      stage.add(turned.root);
      stage.updateMatrixWorld(true);
      for (let step = 0; step < 6; step++) {
        reference.advance(0.37);
        turned.advance(0.37);
        stage.rotation.y += 0.5; // turning while the clip plays
        stage.updateMatrixWorld(true);
        expect(localTransforms(turned.root)).toEqual(localTransforms(reference.root));
      }
    },
  );

  it('keeps the bar exactly between the hands in the body’s own coordinates', () => {
    const body = bench();
    const stage = new Group();
    stage.rotation.y = 1.3;
    stage.add(body.root);
    body.advance(1.1);
    stage.updateMatrixWorld(true);
    // Hands = the far end of the forearm groups (bone along −Y); compare in world space.
    const hands: Vector3[] = [];
    body.root.traverse((node) => {
      if (
        node instanceof Mesh &&
        node.name === 'muscle_forearms' &&
        (node.geometry as BufferGeometry).type === 'CapsuleGeometry'
      ) {
        hands.push(node.parent?.localToWorld(new Vector3(0, -0.26, 0)) ?? new Vector3());
      }
    });
    expect(hands).toHaveLength(2);
    const middle = (hands[0] as Vector3)
      .clone()
      .add(hands[1] as Vector3)
      .multiplyScalar(0.5);
    const barWorld = bar(body.root).getWorldPosition(new Vector3());
    expect(barWorld.distanceTo(middle)).toBeLessThan(1e-6);
  });
});
