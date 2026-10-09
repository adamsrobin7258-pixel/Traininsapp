/**
 * QA page for the body assets – renders a GLB like the app (three.js, the app's body code and
 * lights) with a chosen clip time, extra bone rotations (deformation tests), highlight and
 * camera. Driven by tools/figures/qa/shoot.mjs; not part of the app bundle.
 *
 * Query: glb, clip, t (s), pose ("bone:axis:deg,…", world axes at rest), hl ("group:level,…"),
 * az, el (deg), dist, y (m), w, h, props (0/1)
 */
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MuscleHighlight } from '@/core/training';
import { gltfBodyFrom, STILL_PHASE } from '@/modules/training/figure/gltfBody';
import { addFigureLights } from '@/modules/training/figure/figureRenderer';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const w = num('w', 700);
const h = num('h', 1000);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(w, h, false);
canvas.style.width = `${String(w)}px`;
canvas.style.height = `${String(h)}px`;
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0xece9e3);
const scene = new Scene();
addFigureLights(scene);

const highlight: MuscleHighlight = {};
for (const item of (q.get('hl') ?? '').split(',').filter(Boolean)) {
  const [group, level] = item.split(':');
  (highlight as Record<string, string>)[group ?? ''] = level ?? 'primary';
}
const gltf = await new GLTFLoader().loadAsync(q.get('glb') ?? '/figure/male/kalethra-male.glb');
const body = gltfBodyFrom(gltf.scene, gltf.animations, {
  clip: q.get('clip') ?? 'rest',
  highlight,
  palette: {
    body: '#d9d3c9',
    shirt: '#4b544e',
    shorts: '#353c38',
    shoe: '#2c312e',
    equipment: '#bdbab1',
    metal: '#8f8d87',
    shadow: '#1b1f1c',
    accent: '#557a5b',
  },
});
scene.add(body.root);
const clip = gltf.animations.find((a) => a.name === body.clip);
if (clip && q.has('t'))
  body.advance(num('t', 0) - clip.duration * STILL_PHASE + clip.duration * 10);
if (q.get('props') === '0')
  body.root.traverse((n) => n.name.startsWith('prop_') && (n.visible = false));
// Extra rotations (deformation tests): applied on top of the clip, in world axes.
for (const item of (q.get('pose') ?? '').split(',').filter(Boolean)) {
  const [name, axis, deg] = item.split(':');
  const bone = body.root.getObjectByName(name ?? '');
  if (!bone) continue;
  body.root.updateMatrixWorld(true);
  const parentWorld = new Quaternion();
  bone.parent?.getWorldQuaternion(parentWorld);
  const a = new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const world = new Quaternion().setFromAxisAngle(a, (Number(deg) * Math.PI) / 180);
  // local' = parent⁻¹ · world · parent · local
  const local = parentWorld.clone().invert().multiply(world).multiply(parentWorld);
  bone.quaternion.premultiply(local);
}
body.root.updateMatrixWorld(true);
const camera = new PerspectiveCamera(num('fov', 30), w / h, 0.05, 30);
const az = (num('az', 0) * Math.PI) / 180;
const el = (num('el', 6) * Math.PI) / 180;
const dist = num('dist', 4.6);
const focus = q.get('focus') ? body.root.getObjectByName(q.get('focus') ?? '') : null;
const centre = focus ? focus.getWorldPosition(new Vector3()) : new Vector3(0, num('y', 0.9), 0);
camera.position.set(
  centre.x + Math.sin(az) * Math.cos(el) * dist,
  centre.y + Math.sin(el) * dist,
  centre.z + Math.cos(az) * Math.cos(el) * dist,
);
camera.lookAt(centre);
renderer.render(scene, camera);
(window as unknown as { __ready: boolean }).__ready = true;
