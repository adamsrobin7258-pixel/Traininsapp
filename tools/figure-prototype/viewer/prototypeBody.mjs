/**
 * The prototype body (phase 1A): the production body interface (FigureBody: root, clip, view,
 * advance, setHighlight, setPalette, dispose) plus `setView('skin' | 'muscle')`.
 *
 * Not part of the app: it sits beside the production code (src/modules/training/figure/
 * gltfBody.ts is unchanged) and is loaded by the prototype viewer and its checks only.
 *
 *  - Skin view (default): body in the skin form, carved hair cap and white drape visible, stone
 *    material without the fibre map; a trained group is tinted towards the Kalethra accent (as
 *    production).
 *  - Muscle view: morph target `muscle` at 1 (écorché form), hair and drape hidden, every muscle
 *    group in its own colour (look.json) over the stone, with the fibre normal map; trained groups
 *    stay strong, the others are dimmed.
 *  - Corrective shapes (`fix_*` morph targets) follow their bone's bend every frame (drivers in
 *    the GLB's root extras), in both views.
 *
 * Looks (option `look`): '1A' – the phase-1A look described above (group colours, fibre map,
 * plane-wave stone variation); '1C' – phase 1C (look.json → sculpture1C): one warm-ivory stone
 * family in both views, no group colours (trained groups in a slightly deeper stone tone), no
 * fibre map (the texture is then never decoded or uploaded), non-periodic grain, stone drape.
 * The GLB is the same for both.
 */
import { AnimationMixer, Box3, Color, MeshStandardMaterial, Sphere, Vector3 } from 'three';
import {
  REQUIRED_BONES,
  clipVariant,
  muscleGroupOfNode,
  propVariantOfNode,
  resolveClip,
  validateFigureAsset,
} from '@/modules/training/figure/contract';
import look from '../look.json';

export const VIEWS = ['skin', 'muscle'];
export const DEFAULT_VIEW = 'skin';
export const LOOKS = ['1A', '1C'];
export const STILL_PHASE = 0.3;
const VIEW_ANGLES = {
  horizontalPush: { azimuth: 74, elevation: 30 },
  horizontalPull: { azimuth: 60, elevation: 16 },
  verticalPull: { azimuth: 0, elevation: 10 },
  rest: { azimuth: 0, elevation: 6 },
};
const VOLUME_MARGIN = 0.16;
const SKIN_ONLY = /^proto_(hair|drape)$/;

const linearColor = (hex) => new Color(hex); // three converts sRGB hex to the working (linear) space

function stoneUniforms(lookName) {
  if (lookName === '1C') {
    const g = look.sculpture1C.stone.grain;
    return {
      uGrain: {
        value: [g.coarse.scale, g.coarse.amount, g.fine.scale, g.fine.amount],
      },
      uWarmCool: { value: [g.warmCool.scale, g.warmCool.amount] },
    };
  }
  const s = look.stone;
  return {
    uStoneDirs: {
      value: s.noise.dirs.map((d) => new Vector3(...d).normalize()),
    },
    uStonePhases: { value: s.noise.phases },
    uStoneVar: {
      value: [
        s.variationLarge.scale,
        s.variationLarge.amount,
        s.variationFine.scale,
        s.variationFine.amount,
      ],
    },
    uWarm: { value: s.warmCool },
  };
}

// Phase-1A variation: six plane waves per scale (periodic; the fine scale is below a pixel).
const PLANE_WAVES = `uniform vec3 uStoneDirs[6];
uniform float uStonePhases[6];
uniform vec4 uStoneVar;
uniform float uWarm;
float stoneNoise(vec3 p, float s) {
  float a = 0.0;
  for (int i = 0; i < 6; i++) a += sin(dot(p, uStoneDirs[i]) / s * 6.2831853 + uStonePhases[i]);
  return a / 1.7320508;
}`;
const PLANE_WAVES_COLOUR = `float big = stoneNoise(vRest, uStoneVar.x) * uStoneVar.y;
float fine = stoneNoise(vRest * 1.7, uStoneVar.z) * uStoneVar.w;
float warm = stoneNoise(vRest + vec3(3.1), uStoneVar.x * 1.6) * uWarm;
vec3 stone = diffuse * (1.0 + big + fine) * vec3(1.0 + warm, 1.0, 1.0 - warm);`;

// Phase-1C grain: smooth value noise (hash lattice, no repeating direction), two octaves of a
// few centimetres – large enough not to flicker at the viewer's distance, small enough to read
// as worked stone, not as stains.
const VALUE_NOISE = `uniform vec4 uGrain;
uniform vec2 uWarmCool;
float grainHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float grainNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(mix(grainHash(i), grainHash(i + vec3(1, 0, 0)), f.x),
        mix(grainHash(i + vec3(0, 1, 0)), grainHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(grainHash(i + vec3(0, 0, 1)), grainHash(i + vec3(1, 0, 1)), f.x),
        mix(grainHash(i + vec3(0, 1, 1)), grainHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
  return n * 2.0 - 1.0;
}`;
const VALUE_NOISE_COLOUR = `float coarse = grainNoise(vRest / uGrain.x) * uGrain.y;
float fine = grainNoise(vRest / uGrain.z + vec3(7.3)) * uGrain.w;
float warm = grainNoise(vRest / uWarmCool.x + vec3(19.1)) * uWarmCool.y;
vec3 stone = diffuse * (1.0 + coarse + fine) * vec3(1.0 + warm, 1.0, 1.0 - warm);`;

/**
 * Stone material: base colour varied in the rest pose's object space (so the pattern stays on
 * the body when it moves), optionally tinted per vertex by the muscle groups.
 */
function stoneMaterial({ color, roughness, groups = null, normalMap = null, lookName = '1A' }) {
  const material = new MeshStandardMaterial({
    color: linearColor(color),
    roughness,
    metalness: 0,
    ...(normalMap ? { normalMap } : {}),
  });
  const uniforms = stoneUniforms(lookName);
  const valueNoise = lookName === '1C';
  const slots = groups ? groups.mix.value.length : 0;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (groups) {
      shader.uniforms.uMix = groups.mix;
      shader.uniforms.uTint = groups.tint;
    }
    const at = (c) => `int(_muscle_groups.${c} + 0.5)`;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRest;
varying vec3 vTint;
varying float vAmount;
${
  groups
    ? `attribute vec4 _muscle_groups;
attribute vec4 _muscle_weights;
uniform float uMix[${String(slots)}];
uniform vec3 uTint[${String(slots)}];`
    : ''
}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vRest = position;
${
  groups
    ? `vec4 mixes = vec4(uMix[${at('x')}], uMix[${at('y')}], uMix[${at('z')}], uMix[${at('w')}]) * _muscle_weights;
vAmount = mixes.x + mixes.y + mixes.z + mixes.w;
vec3 tint = uTint[${at('x')}] * mixes.x + uTint[${at('y')}] * mixes.y + uTint[${at('z')}] * mixes.z + uTint[${at('w')}] * mixes.w;
vTint = vAmount > 0.0001 ? tint / vAmount : vec3(0.0);`
    : 'vAmount = 0.0; vTint = vec3(0.0);'
}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
${valueNoise ? VALUE_NOISE : PLANE_WAVES}
varying vec3 vRest;
varying vec3 vTint;
varying float vAmount;`,
      )
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `${valueNoise ? VALUE_NOISE_COLOUR : PLANE_WAVES_COLOUR}
vec4 diffuseColor = vec4(mix(stone, vTint, clamp(vAmount, 0.0, 1.0)), opacity);`,
      );
  };
  material.customProgramCacheKey = () =>
    `kalethra-prototype-stone-${lookName}-${groups ? 'groups' : 'plain'}-${normalMap ? 'fibres' : 'smooth'}`;
  return material;
}

/** Per group: how far the tint goes (levels → mix) and with which colour, for a view. */
export function groupTints(groupNames, highlight, view, accent = look.accent, lookName = '1A') {
  if (lookName === '1C') {
    // One stone family in both views: only trained groups get the deeper stone tone.
    const h = look.sculpture1C.highlight;
    const mix = [];
    const tint = [];
    for (const group of [...groupNames, null]) {
      const level = group ? highlight[group] : undefined;
      mix.push(level === 'primary' ? h.primaryMix : level === 'secondary' ? h.secondaryMix : 0);
      tint.push(h.tone);
    }
    return { mix, tint };
  }
  const any = Object.values(highlight).some(Boolean);
  const mv = look.muscleView;
  const sv = look.skinView;
  const mix = [];
  const tint = [];
  for (const group of [...groupNames, null]) {
    const level = group ? highlight[group] : undefined;
    if (view === 'muscle') {
      mix.push(
        group === null
          ? 0
          : level === 'primary'
            ? mv.primaryMix
            : level === 'secondary'
              ? mv.secondaryMix
              : any
                ? mv.dimmedMix
                : mv.baseMix,
      );
      tint.push(group ? (look.groups[group] ?? look.stone.color) : look.stone.color);
    } else {
      mix.push(level === 'primary' ? sv.primaryMix : level === 'secondary' ? sv.secondaryMix : 0);
      tint.push(accent);
    }
  }
  return { mix, tint };
}

/**
 * Builds the prototype body from a loaded GLTF (scene, animations, parser).
 * Options: clip, highlight, palette ({ accent, equipment, metal }), view ('skin' | 'muscle').
 */
export async function prototypeBodyFrom(
  gltf,
  { clip: requested, highlight, palette, view = DEFAULT_VIEW, look: lookName = '1A' },
) {
  if (!LOOKS.includes(lookName)) throw new Error(`unknown look ${String(lookName)}`);
  const sculpture = lookName === '1C' ? look.sculpture1C : null;
  const scene = gltf.scene;
  const animations = gltf.animations;
  const nodeNames = [];
  const boneNames = [];
  scene.traverse((node) => {
    nodeNames.push(node.name);
    if (node.isBone) boneNames.push(node.name);
  });
  const report = validateFigureAsset({
    nodeNames,
    boneNames,
    clipNames: animations.map((a) => a.name),
  });
  if (!report.ok) throw new Error(`Prototype asset breaks the contract: ${JSON.stringify(report)}`);

  let root = null;
  scene.traverse((node) => {
    if (node.userData.muscleGroups) root = node;
  });
  if (!root) throw new Error('Prototype asset without muscle group list');
  const groupNames = root.userData.muscleGroups;
  const drivers = root.userData.correctives ?? [];
  const fibreIndex = root.userData.prototypeMaterials?.muscle;
  // 1C without fibres: the material (and its 4096² texture) is never requested.
  const useFibres = !sculpture || sculpture.fibres.use;
  const fibreMaterial =
    useFibres && fibreIndex !== undefined && gltf.parser
      ? await gltf.parser.getDependency('material', fibreIndex)
      : null;
  const fibreMap = fibreMaterial?.normalMap ?? null;

  const clipName = resolveClip(
    requested,
    animations.map((a) => a.name),
  );
  const clip = animations.find((a) => a.name === clipName);
  const equipment = clipName ? clipVariant(clipName) : null;

  const groups = { mix: { value: new Array(groupNames.length + 1).fill(0) }, tint: { value: [] } };
  for (let i = 0; i <= groupNames.length; i++) groups.tint.value.push(new Color());
  const stone = sculpture ? sculpture.stone : look.stone;
  const cloth = sculpture ? sculpture.drape : look.cloth;
  const eyes = sculpture ? sculpture.eyes : look.eyes;
  const fibreScale = sculpture ? sculpture.fibres.normalScale : look.muscleView.fibreNormalScale;
  const skinMaterial = stoneMaterial({
    color: stone.color,
    roughness: stone.roughness,
    groups,
    lookName,
  });
  const muscleMaterial = stoneMaterial({
    color: stone.color,
    roughness: stone.roughness,
    groups,
    normalMap: fibreMap,
    lookName,
  });
  muscleMaterial.normalScale.set(fibreScale, fibreScale);
  const hairMaterial = stoneMaterial({ color: stone.color, roughness: stone.roughness, lookName });
  const drapeMaterial = stoneMaterial({ color: cloth.color, roughness: cloth.roughness, lookName });
  const eyeMaterial = stoneMaterial({ color: eyes.color, roughness: eyes.roughness, lookName });
  const owned = [skinMaterial, muscleMaterial, hairMaterial, drapeMaterial, eyeMaterial];

  const bodyMeshes = [];
  const skinOnly = [];
  const props = [];
  scene.traverse((node) => {
    const prop = propVariantOfNode(node.name);
    if (prop) node.visible = prop === equipment;
    if (!node.isMesh) return;
    let p = node;
    let propVariant = null;
    while (p) {
      propVariant = propVariant ?? propVariantOfNode(p.name);
      p = p.parent;
    }
    if (propVariant) {
      const material = node.material.clone();
      node.material = material;
      owned.push(material);
      props.push({ material, metal: material.metalness > 0.3 });
      return;
    }
    const name = node.name;
    if (/^proto_hair/.test(name)) node.material = hairMaterial;
    else if (/^proto_drape/.test(name)) node.material = drapeMaterial;
    else if (/^proto_eye/.test(name)) node.material = eyeMaterial;
    else {
      node.material = skinMaterial;
      bodyMeshes.push(node);
    }
    if (SKIN_ONLY.test(name) || SKIN_ONLY.test(node.parent?.name ?? '')) skinOnly.push(node);
  });

  let currentView = view;
  let current = highlight;
  let accent = palette.accent ?? look.accent;
  const applyHighlight = () => {
    const { mix, tint } = groupTints(groupNames, current, currentView, accent, lookName);
    mix.forEach((m, i) => (groups.mix.value[i] = m));
    tint.forEach((t, i) => groups.tint.value[i].set(t));
    for (const mesh of bodyMeshes) {
      const group = muscleGroupOfNode(mesh.name);
      mesh.userData.level = group ? (current[group] ?? 'neutral') : 'neutral';
    }
  };
  const applyView = () => {
    for (const mesh of bodyMeshes) {
      mesh.material = currentView === 'muscle' ? muscleMaterial : skinMaterial;
      const index = mesh.morphTargetDictionary?.muscle;
      if (index !== undefined) mesh.morphTargetInfluences[index] = currentView === 'muscle' ? 1 : 0;
    }
    for (const mesh of skinOnly) mesh.visible = currentView === 'skin';
    applyHighlight();
  };
  const applyProps = (next) => {
    for (const { material, metal } of props)
      material.color.set(metal ? next.metal : next.equipment);
  };

  // Corrective shapes: each driver's bone bend → its morph target's influence.
  const driverBones = drivers.map((d) => ({ ...d, node: scene.getObjectByName(d.bone) }));
  const applyCorrectives = () => {
    for (const d of driverBones) {
      if (!d.node) continue;
      const angle = (2 * Math.acos(Math.min(1, Math.abs(d.node.quaternion.w))) * 180) / Math.PI;
      const x = Math.min(1, Math.max(0, (angle - d.from) / (d.to - d.from)));
      const w = x * x * (3 - 2 * x);
      for (const mesh of bodyMeshes) {
        const index = mesh.morphTargetDictionary?.[d.name];
        if (index !== undefined) mesh.morphTargetInfluences[index] = w;
      }
    }
  };

  applyView();
  applyProps(palette);
  const mixer = new AnimationMixer(scene);
  if (clip) mixer.clipAction(clip).play();
  const animated = Boolean(clip && clip.duration > 0 && clipName !== 'rest');
  mixer.update(animated && clip ? clip.duration * STILL_PHASE : 0);
  applyCorrectives();

  scene.updateMatrixWorld(true);
  const box = new Box3();
  const point = new Vector3();
  for (const name of REQUIRED_BONES) {
    const bone = scene.getObjectByName(name);
    if (bone) box.expandByPoint(bone.getWorldPosition(point));
  }
  box.expandByScalar(VOLUME_MARGIN);
  const sphere = box.getBoundingSphere(new Sphere());
  const angles = VIEW_ANGLES[(clipName ?? 'rest').split('_')[0]] ?? { azimuth: 0, elevation: 10 };

  return {
    root: scene,
    source: 'asset',
    clip: clipName ?? 'rest',
    animated,
    duration: clip?.duration ?? 0,
    view: { ...angles, radius: sphere.radius, y: sphere.center.y },
    get displayView() {
      return currentView;
    },
    look: lookName,
    /** Whether the fibre map is in use (1C: never loaded). */
    fibres: Boolean(fibreMap),
    advance(seconds) {
      mixer.update(seconds);
      applyCorrectives();
    },
    setHighlight(next) {
      current = next;
      applyHighlight();
    },
    setPalette(next) {
      accent = next.accent ?? accent;
      applyHighlight();
      applyProps(next);
    },
    setView(next) {
      if (!VIEWS.includes(next)) throw new Error(`unknown view ${String(next)}`);
      currentView = next;
      applyView();
    },
    /** The current influence of every morph target on one body mesh (for checks). */
    morphState() {
      const mesh = bodyMeshes[0];
      return Object.fromEntries(
        Object.entries(mesh?.morphTargetDictionary ?? {}).map(([k, i]) => [
          k,
          mesh.morphTargetInfluences[i],
        ]),
      );
    },
    groupState() {
      return { mix: [...groups.mix.value], tint: groups.tint.value.map((c) => c.getHexString()) };
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      for (const material of owned) material.dispose();
      const skeletons = new Set();
      scene.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry.dispose();
        if (node.isSkinnedMesh) skeletons.add(node.skeleton);
      });
      // The skeleton's bone texture is a GPU texture of its own (one per rebuild otherwise).
      for (const skeleton of skeletons) skeleton.dispose();
      fibreMap?.dispose();
    },
  };
}
