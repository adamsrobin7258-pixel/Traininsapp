/**
 * Draws one or two Kalethra figures into a canvas. Separate chunk: loaded only when a figure is
 * shown. Renders on demand – a still figure is drawn once; the loop runs only while the motion
 * plays or the figure turns – and frees its WebGL context when closed.
 */
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import type { MuscleHighlight } from '@/core/training';
import { buildFigure, type FigureModel, type FigurePalette } from './figureModel';
import type { FigurePose } from './rig';

export interface FigureRendererOptions {
  pose: FigurePose;
  highlight: MuscleHighlight;
  /** Front and back side by side (workout summary). */
  pair: boolean;
  palette: FigurePalette;
  /** Higher detail for the large view; the small view stays light. */
  quality: 'small' | 'large';
}

export interface FigureRenderer {
  setPlaying(playing: boolean): void;
  /** Turns the figure to an angle (radians around the vertical axis). */
  setYaw(yaw: number, smooth: boolean): void;
  rotateBy(delta: number): void;
  yaw(): number;
  setPalette(palette: FigurePalette): void;
  resize(): void;
  dispose(): void;
}

/**
 * Camera per posture: where it looks from (degrees), at which height, and the radius around
 * that point that must stay in view – the distance follows from it and the canvas shape, so the
 * figure fits a tall phone view as well as a small tile, whichever way it is turned.
 */
const CAMERA: Record<
  FigurePose,
  { azimuth: number; elevation: number; radius: number; y: number }
> = {
  benchPress: { azimuth: 74, elevation: 30, radius: 0.98, y: 0.55 },
  latPulldown: { azimuth: 0, elevation: 10, radius: 1.02, y: 1.1 },
  stand: { azimuth: 0, elevation: 6, radius: 0.98, y: 0.92 },
};
const PAIR_RADIUS = 1.3;

export function createFigureRenderer(
  canvas: HTMLCanvasElement,
  options: FigureRendererOptions,
): FigureRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: options.quality === 'large' ? 'high-performance' : 'low-power',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x8a8678, 1.9));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(2.2, 3.5, 3);
  const rim = new DirectionalLight(0xffffff, 0.7);
  rim.position.set(-2.5, 2.2, -3);
  scene.add(key, rim);

  const stage = new Group();
  scene.add(stage);
  const figures: { model: FigureModel; pivot: Group; offset: number }[] = [];
  // One figure (turned by `setYaw`), or front and back side by side.
  const sides = options.pair ? [0, Math.PI] : [0];
  sides.forEach((offset, index) => {
    const model = buildFigure(options.pose, options.palette, options.highlight);
    const pivot = new Group();
    pivot.add(model.root);
    if (options.pair) pivot.position.x = index === 0 ? -0.55 : 0.55;
    stage.add(pivot);
    figures.push({ model, pivot, offset });
  });
  const motion = figures[0]?.model.motion;

  const view = CAMERA[options.pose];
  const camera = new PerspectiveCamera(30, 1, 0.1, 30);
  const az = (view.azimuth * Math.PI) / 180;
  const el = (view.elevation * Math.PI) / 180;
  const radius = options.pair ? PAIR_RADIUS : view.radius;

  function placeCamera() {
    const vertical = (camera.fov * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2);
    camera.position.set(
      Math.sin(az) * Math.cos(el) * distance,
      view.y + Math.sin(el) * distance,
      Math.cos(az) * Math.cos(el) * distance,
    );
    camera.lookAt(0, view.y, 0);
  }

  let yaw = 0;
  let targetYaw = 0;
  let phase = motion?.stillPhase ?? 0;
  let playing = false;
  let frame = 0;
  let last = 0;
  let disposed = false;

  function applyYaw() {
    for (const figure of figures) figure.pivot.rotation.y = figure.offset + yaw;
  }

  function draw() {
    renderer.render(scene, camera);
  }

  function tick(now: number) {
    frame = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (playing && motion && motion.durationS > 0) {
      phase = (phase + dt / motion.durationS) % 1;
      for (const figure of figures) figure.model.setPhase(phase);
    }
    const turning = Math.abs(targetYaw - yaw) > 0.001;
    if (turning) {
      yaw += (targetYaw - yaw) * Math.min(1, dt * 7);
      applyYaw();
    }
    draw();
    if (playing || turning) frame = requestAnimationFrame(tick);
    else last = 0;
  }

  function request() {
    if (!frame && !disposed) frame = requestAnimationFrame(tick);
  }

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    placeCamera();
    request();
  }

  resize();
  applyYaw();
  draw();

  return {
    setPlaying(next) {
      playing = next;
      if (next) request();
    },
    setYaw(next, smooth) {
      targetYaw = next;
      if (!smooth) {
        yaw = next;
        applyYaw();
      }
      request();
    },
    rotateBy(delta) {
      targetYaw += delta;
      yaw = targetYaw;
      applyYaw();
      request();
    },
    yaw: () => targetYaw,
    setPalette(palette) {
      for (const figure of figures) figure.model.setPalette(palette);
      request();
    },
    resize,
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      for (const figure of figures) figure.model.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
