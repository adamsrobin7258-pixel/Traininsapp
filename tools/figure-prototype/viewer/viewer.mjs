/**
 * Prototype viewer (phase 1A): the large figure view of the app, rebuilt with the prototype
 * body – same lights, tone mapping and camera as figureRenderer.ts – plus the view toggle
 * "Muskeln zeigen / Haut zeigen" in the controls row. Run with `npx vite` from the project root
 * and open /tools/figure-prototype/viewer/ (also on a phone in the same network: `--host`).
 *
 * Query (for automated shots): view=skin|muscle, ex=bench|pull|rest|restAll, side=front|back,
 * t=<seconds> (still frame), w/h (canvas size).
 */
import {
  ACESFilmicToneMapping,
  Group,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addFigureLights } from '@/modules/training/figure/figureRenderer';
import { prototypeBodyFrom, DEFAULT_VIEW } from './prototypeBody.mjs';

const ASSET = '/assets/figure/prototype/kalethra-male-prototype.glb';
const EXERCISES = {
  bench: {
    clip: 'horizontalPush_bench',
    highlight: { chest: 'primary', triceps: 'secondary', shoulders: 'secondary' },
    labels: ['Brust', 'Trizeps, Schultern'],
  },
  pull: {
    clip: 'verticalPull_cable',
    highlight: { lats: 'primary', biceps: 'secondary', back: 'secondary' },
    labels: ['Latissimus', 'Bizeps, oberer Rücken'],
  },
  rest: { clip: 'rest', highlight: {}, labels: ['–', ''] },
  restAll: {
    clip: 'rest',
    highlight: {
      chest: 'primary',
      back: 'primary',
      quadriceps: 'primary',
      hamstrings: 'secondary',
      glutes: 'secondary',
    },
    labels: ['Brust, Rücken, Quadrizeps', 'Beinbeuger, Gesäß'],
  },
};
const PALETTE = { accent: '#557a5b', equipment: '#bdbab1', metal: '#8f8d87' };

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const stageEl = document.getElementById('stage');
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
// Shader problems are shown on the page (device test: nothing must fail silently).
const problems = [];
renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
  const log = [
    gl.getProgramInfoLog(program),
    gl.getShaderInfoLog(vertex),
    gl.getShaderInfoLog(fragment),
  ]
    .filter(Boolean)
    .join(' | ');
  problems.push(`Shader-Fehler: ${log.slice(0, 300)}`);
  console.error('Shader error', log);
};
window.addEventListener('error', (e) => problems.push(`Fehler: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => problems.push(`Fehler: ${String(e.reason)}`));
const scene = new Scene();
addFigureLights(scene);
const stage = new Group();
scene.add(stage);
const camera = new PerspectiveCamera(30, 3 / 4, 0.05, 20);

const state = {
  exercise: q.get('ex') ?? 'bench',
  view: q.get('view') ?? DEFAULT_VIEW,
  side: q.get('side') ?? 'front',
  playing: !q.has('t'),
};
const loadStarted = performance.now();
const gltfPromise = new GLTFLoader().loadAsync(ASSET);
let body = null;
let gltf = null;

function size() {
  const w = Number(q.get('w') ?? stageEl.clientWidth);
  const h = Number(q.get('h') ?? stageEl.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function frame() {
  const v = body.view;
  const el = (v.elevation * Math.PI) / 180;
  const dist = (v.radius / Math.sin((camera.fov * Math.PI) / 360)) * 0.92;
  camera.position.set(0, v.y + dist * Math.sin(el), dist * Math.cos(el));
  camera.lookAt(0, v.y, 0);
  stage.rotation.y = (((v.azimuth + (state.side === 'back' ? 180 : 0)) * Math.PI) / 180) * -1;
}

async function build() {
  gltf = gltf ?? (await gltfPromise);
  if (body) {
    stage.remove(body.root);
    body.dispose();
    gltf = await new GLTFLoader().loadAsync(ASSET); // fresh scene per exercise (as the app's clones)
  }
  const ex = EXERCISES[state.exercise];
  body = await prototypeBodyFrom(gltf, {
    clip: ex.clip,
    highlight: ex.highlight,
    palette: PALETTE,
    view: state.view,
  });
  stage.add(body.root);
  if (q.has('t') && body.duration > 0) {
    // Still frame at clip time t (the body starts at 30 % of its loop).
    const d = body.duration;
    body.advance((((Number(q.get('t')) - d * 0.3) % d) + d) % d);
  }
  frame();
  legend();
}

function legend() {
  const ex = EXERCISES[state.exercise];
  document.getElementById('legend').innerHTML =
    `<dt>Primär</dt><dd>${ex.labels[0]}</dd>` +
    (ex.labels[1] ? `<dt>Sekundär</dt><dd>${ex.labels[1]}</dd>` : '');
  const viewBtn = document.getElementById('view');
  viewBtn.textContent = state.view === 'skin' ? 'Muskeln zeigen' : 'Haut zeigen';
  viewBtn.setAttribute('aria-pressed', String(state.view === 'muscle'));
  document.getElementById('side').textContent =
    state.side === 'front' ? 'Rückseite zeigen' : 'Vorderseite zeigen';
  const play = document.getElementById('play');
  play.textContent = state.playing ? 'Pause' : 'Abspielen';
  play.setAttribute('aria-pressed', String(state.playing));
}

document.getElementById('view').addEventListener('click', () => {
  state.view = state.view === 'skin' ? 'muscle' : 'skin';
  body.setView(state.view); // the same body: clip time, side and highlight stay
  legend();
});
document.getElementById('side').addEventListener('click', () => {
  state.side = state.side === 'front' ? 'back' : 'front';
  frame();
  legend();
});
document.getElementById('play').addEventListener('click', () => {
  state.playing = !state.playing;
  legend();
});
const select = document.getElementById('exercise');
select.value = state.exercise;
select.addEventListener('change', () => {
  state.exercise = select.value;
  void build();
});
// Drag to turn (like the app's large view).
let drag = null;
stageEl.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, r: stage.rotation.y }));
window.addEventListener('pointerup', () => (drag = null));
window.addEventListener('pointermove', (e) => {
  if (drag) stage.rotation.y = drag.r + (e.clientX - drag.x) * 0.01;
});

size();
window.addEventListener('resize', size);
await build();
const loadMs = performance.now() - loadStarted;
const download = performance.getEntriesByType('resource').find((r) => r.name.endsWith('.glb'));
document.body.dataset.ready = 'true';
const gpu = (() => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
})();

// Render loop with measurements (shown below the figure): real frame times over the last
// 5 seconds – average fps and the slowest frame – plus what the browser reports itself.
let last = performance.now();
let frameTimes = [];
const stats = document.getElementById('stats');
const info = renderer.info;
const mib = (b) => (b / 1048576).toFixed(0);
function report() {
  const total = frameTimes.reduce((a, b) => a + b, 0);
  const fps = frameTimes.length / (total / 1000);
  const slowest = Math.max(...frameTimes);
  const heap = performance.memory
    ? `JS-Speicher (gemessen): ${mib(performance.memory.usedJSHeapSize)} MiB`
    : 'JS-Speicher: vom Browser nicht gemeldet';
  stats.textContent = [
    `GPU: ${gpu}`,
    `Laden gesamt (gemessen): ${loadMs.toFixed(0)} ms` +
      (download
        ? ` · davon Download ${download.duration.toFixed(0)} ms (${mib(download.transferSize || download.encodedBodySize)} MiB)`
        : ''),
    `Bildrate (gemessen, letzte 5 s): ${fps.toFixed(0)} fps · langsamstes Bild ${slowest.toFixed(0)} ms`,
    `${info.render.triangles.toLocaleString('de-DE')} Dreiecke/Bild · ${info.memory.geometries} Geometrien · ${info.memory.textures} Texturen · Pixelverhältnis ${renderer.getPixelRatio()}`,
    heap,
    'Grafikspeicher: ca. 117 MiB (Schätzung aus der Datei, nicht gemessen)',
    `Ansicht: ${state.view === 'skin' ? 'Haut' : 'Muskeln'} · Übung: ${state.exercise} · Seite: ${state.side === 'front' ? 'vorne' : 'hinten'}`,
    ...(problems.length ? problems : ['Fehler: keine']),
  ].join('\n');
}
function loop(now) {
  const ms = now - last;
  last = now;
  frameTimes.push(ms);
  const dt = Math.min(0.1, ms / 1000);
  if (state.playing && body.animated) body.advance(dt);
  renderer.render(scene, camera);
  let sum = 0;
  for (let i = frameTimes.length - 1; i >= 0; i--) {
    sum += frameTimes[i];
    if (sum > 5000) {
      frameTimes = frameTimes.slice(i);
      break;
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setInterval(report, 1000);
