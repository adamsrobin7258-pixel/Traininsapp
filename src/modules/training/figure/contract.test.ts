import { PropertyBinding } from 'three';
import { EXERCISE_VISUALS, FIGURE_MOVEMENTS, FIGURE_MUSCLES } from '@/core/training';
import {
  ASSET_BUDGET,
  DEFAULT_FIGURE_VARIANT,
  FIGURE_ASSETS,
  FIGURE_VARIANTS,
  MUSCLE_PARTS,
  REQUIRED_BONES,
  SAFE_NAME,
  figureAssetFor,
  figureVariantFor,
  isClipName,
  muscleGroupOfNode,
  muscleNodeName,
  resolveClip,
  validateFigureAsset,
} from './contract';

const allMuscles = FIGURE_MUSCLES.map((group) => muscleNodeName(group));
const complete = {
  nodeNames: ['Armature', 'body:skin', ...allMuscles, 'muscle_shoulders_front'],
  boneNames: [...REQUIRED_BONES],
  clipNames: ['rest', 'horizontalPush_bench', 'verticalPull'],
};

describe('figure asset contract', () => {
  it('picks the body variant from the existing profile field, with one fixed default', () => {
    expect(FIGURE_VARIANTS).toEqual(['male', 'female']);
    expect(figureVariantFor('male')).toBe('male');
    expect(figureVariantFor('female')).toBe('female');
    expect(figureVariantFor('unspecified')).toBe(DEFAULT_FIGURE_VARIANT);
    expect(figureVariantFor(null)).toBe(DEFAULT_FIGURE_VARIANT);
  });

  it('has no modelled body yet – both variants use the fallback until an asset is bundled', () => {
    expect(FIGURE_ASSETS).toEqual({ male: null, female: null });
    expect(figureAssetFor('male')).toBeNull();
    expect(figureAssetFor('female')).toBeNull();
  });

  it('names muscle nodes semantically by the muscle groups of the exercise library', () => {
    expect(muscleNodeName('chest')).toBe('muscle_chest');
    expect(muscleNodeName('shoulders', 'rear')).toBe('muscle_shoulders_rear');
    expect(muscleGroupOfNode('muscle_chest')).toBe('chest');
    expect(muscleGroupOfNode('muscle_shoulders_front')).toBe('shoulders');
    expect(muscleGroupOfNode('muscle_back_erectors')).toBe('back');
    // Not a muscle node, an unknown group, or no index-style names.
    expect(muscleGroupOfNode('body:skin')).toBeNull();
    expect(muscleGroupOfNode('muscle_neck')).toBeNull();
    expect(muscleGroupOfNode('mesh_17')).toBeNull();
    expect(muscleGroupOfNode('muscle_fullBody')).toBeNull();
    // Every finer part of the contract maps back to its group.
    for (const group of FIGURE_MUSCLES) {
      for (const part of MUSCLE_PARTS[group]) {
        expect(muscleGroupOfNode(muscleNodeName(group, part))).toBe(group);
      }
    }
  });

  it('names clips by movement type, optionally with an equipment variant', () => {
    for (const movement of FIGURE_MOVEMENTS) expect(isClipName(movement)).toBe(true);
    expect(isClipName('horizontalPush_bench')).toBe(true);
    expect(isClipName('verticalPull_cable')).toBe(true);
    expect(isClipName('benchPress')).toBe(false);
    expect(isClipName('horizontalPush_bench.extra')).toBe(false);
    expect(isClipName('Take 001')).toBe(false);
  });

  it('resolves a clip to the exact one, else its movement type, else the rest pose', () => {
    const clips = ['rest', 'horizontalPush', 'verticalPull_cable'];
    expect(resolveClip('verticalPull_cable', clips)).toBe('verticalPull_cable');
    expect(resolveClip('horizontalPush_bench', clips)).toBe('horizontalPush');
    expect(resolveClip('squat', clips)).toBe('rest');
    expect(resolveClip('squat', [])).toBeNull();
  });

  it('accepts a complete asset', () => {
    expect(validateFigureAsset(complete)).toEqual({
      ok: true,
      missingMuscles: [],
      missingBones: [],
      unknownMuscleNodes: [],
      invalidClips: [],
      hasRestClip: true,
    });
  });

  it('reports what an asset is missing', () => {
    const report = validateFigureAsset({
      nodeNames: [...allMuscles.filter((name) => name !== 'muscle_lats'), 'muscle_latts'],
      boneNames: REQUIRED_BONES.filter((bone) => bone !== 'forearm_R'),
      clipNames: ['benchPress'],
    });
    expect(report.ok).toBe(false);
    expect(report.missingMuscles).toEqual(['lats']);
    expect(report.unknownMuscleNodes).toEqual(['muscle_latts']);
    expect(report.missingBones).toEqual(['forearm_R']);
    expect(report.invalidClips).toEqual(['benchPress']);
    expect(report.hasRestClip).toBe(false);
  });

  it('requires a skeleton for both sides and keeps budgets for phones', () => {
    for (const bone of ['upperArm_L', 'upperArm_R', 'thigh_L', 'thigh_R', 'pelvis', 'head']) {
      expect(REQUIRED_BONES).toContain(bone);
    }
    expect(ASSET_BUDGET.maxBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(ASSET_BUDGET.maxTriangles).toBeLessThanOrEqual(60_000);
  });

  it('uses only names the glTF loader keeps unchanged (no ":" "." "/" "[" "]")', () => {
    const names = [
      ...FIGURE_MUSCLES.map((group) => muscleNodeName(group)),
      ...FIGURE_MUSCLES.flatMap((group) =>
        MUSCLE_PARTS[group].map((part) => muscleNodeName(group, part)),
      ),
      ...REQUIRED_BONES,
      ...FIGURE_MOVEMENTS,
      ...Object.values(EXERCISE_VISUALS).flatMap((entry) => (entry.variant ? [entry.variant] : [])),
    ];
    for (const name of names) {
      expect(name, name).toMatch(SAFE_NAME);
      expect(PropertyBinding.sanitizeNodeName(name)).toBe(name);
    }
  });
});
