import { Color, Mesh, type MeshStandardMaterial } from 'three';
import { FIGURE_MUSCLES, muscleHighlight } from '@/core/training';
import { buildFigure, type FigurePalette } from './figureModel';

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

/** Material colour and level of every part named after a muscle group. */
function muscles(model: ReturnType<typeof buildFigure>) {
  const parts = new Map<string, { hex: string; level: string }>();
  model.root.traverse((object) => {
    if (object instanceof Mesh && object.name.startsWith('muscle:')) {
      const material = object.material as MeshStandardMaterial;
      parts.set(object.name.slice('muscle:'.length), {
        hex: material.color.getHexString(),
        level: String(material.userData.level),
      });
    }
  });
  return parts;
}

const hex = (color: string) => new Color(color).getHexString();

describe('Kalethra figure model', () => {
  it('has one named part per muscle group – the contract for a later modelled figure', () => {
    const model = buildFigure('stand', PALETTE, {});
    expect([...muscles(model).keys()].sort()).toEqual([...FIGURE_MUSCLES].sort());
    model.dispose();
  });

  it('highlights primary in the accent, secondary softer, the rest neutral', () => {
    const highlight = muscleHighlight({
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps', 'shoulders'],
    });
    const parts = muscles(buildFigure('benchPress', PALETTE, highlight));
    expect(parts.get('chest')).toEqual({ hex: hex(PALETTE.accent), level: 'primary' });
    expect(parts.get('triceps')?.level).toBe('secondary');
    expect(parts.get('shoulders')?.level).toBe('secondary');
    // Secondary lies between its neutral surface and the accent – visible, but quieter.
    const secondary = parts.get('triceps')?.hex;
    expect(secondary).not.toBe(hex(PALETTE.accent));
    expect(secondary).not.toBe(hex(PALETTE.body));
    for (const group of ['lats', 'back', 'core', 'quadriceps', 'calves']) {
      expect(parts.get(group)?.level, group).toBe('neutral');
    }
    expect(parts.get('lats')?.hex).toBe(hex(PALETTE.shirt));
    expect(parts.get('calves')?.hex).toBe(hex(PALETTE.body));
  });

  it('updates the highlight and the theme colours in place', () => {
    const model = buildFigure('latPulldown', PALETTE, {});
    model.setHighlight({ lats: 'primary' });
    expect(muscles(model).get('lats')).toEqual({ hex: hex(PALETTE.accent), level: 'primary' });
    model.setPalette({ ...PALETTE, accent: '#93b597' });
    expect(muscles(model).get('lats')?.hex).toBe(hex('#93b597'));
  });

  it('moves the bar with the hands through the repetition', () => {
    const model = buildFigure('benchPress', PALETTE, {});
    const bar = () => {
      let y = 0;
      model.root.traverse((object) => {
        // The bar is the group holding the rod and plates, child of the root.
        if (object.parent === model.root && object.children.length === 3) y = object.position.y;
      });
      return y;
    };
    model.setPhase(0);
    const top = bar();
    model.setPhase(0.5);
    const bottom = bar();
    expect(top - bottom).toBeGreaterThan(0.3);
    model.dispose();
  });
});
