/**
 * Draws one body (or front and back side by side) into a canvas. Separate chunk: loaded only
 * when a figure is shown. Renders on demand – a still figure is drawn once; the loop runs only
 * while a clip plays or the figure turns – and frees its WebGL context when closed.
 *
 * Scene hierarchy (the source of every transform):
 *   scene
 *   ├─ lights, camera (fixed)
 *   └─ stage            ← the only node the view turns (drag, front/back)
 *      └─ slot(s)       ← fixed placement (pair: left/right, the second one turned once)
 *         └─ body.root  ← the body's own coordinate system; only the body writes below it
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
import type { BodyOptions, FigureBody, FigurePalette } from './body';
import { figureAssetFor, type FigureVariant } from './contract';
import { createFallbackBody } from './fallbackBody';

export interface FigureRendererOptions {
  /** Requested clip ("horizontalPush_bench", "rest" …). */
  clip: string;
  highlight: MuscleHighlight;
  /** Front and back side by side (workout summary). */
  pair: boolean;
  palette: FigurePalette;
  /** Higher detail for the large view; the small view stays light. */
  quality: 'small' | 'large';
  /** Body variant from the profile; decides which asset is loaded. */
  variant: FigureVariant;
}

export interface FigureRenderer {
  /** "asset" or "fallback" – which body is shown. */
  source: 'asset' | 'fallback';
  /** Whether the shown clip moves. */
  animated: boolean;
  setPlaying(playing: boolean): void;
  /** Turns the stage to an angle (radians around the vertical axis). */
  setYaw(yaw: number, smooth: boolean): void;
  rotateBy(delta: number): void;
  yaw(): number;
  setPalette(palette: FigurePalette): void;
  resize(): void;
  dispose(): void;
}

const PAIR_RADIUS = 1.3;

/**
 * Studio light, fixed to the camera (the stage turns under it): a soft sky/ground fill, a key
 * from the upper side that models the muscle forms, a weak fill from the other side and a rim
 * from behind. Calmer fill than key, so the modelled anatomy reads without harsh shadows.
 */
export function addFigureLights(scene: Scene) {
  scene.add(new HemisphereLight(0xffffff, 0x8a8678, 1.15));
  const key = new DirectionalLight(0xfff6ec, 2.5);
  key.position.set(3.2, 3.2, 2.2);
  const fill = new DirectionalLight(0xeef2ff, 0.55);
  fill.position.set(-3, 1.2, 2.4);
  const rim = new DirectionalLight(0xffffff, 0.9);
  rim.position.set(-2.5, 2.2, -3);
  scene.add(key, fill, rim);
}

/** URL of a bundled asset: relative to the app's base, never to the current route. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/**
 * The body for a variant ("male" / "female"): its modelled asset. Only if no asset is bundled,
 * or it cannot be loaded or breaks the contract, the code-built fallback body is used – a
 * technical fallback, not the Kalethra figure. Never fails.
 */
export async function loadBody(variant: FigureVariant, options: BodyOptions): Promise<FigureBody> {
  const asset = figureAssetFor(variant);
  if (asset) {
    try {
      const { loadGltfBody } = await import('./gltfBody');
      return await loadGltfBody(assetUrl(asset), options);
    } catch (error) {
      console.warn('Kalethra body asset unavailable, using the technical fallback body', error);
    }
  }
  return createFallbackBody(options);
}

export async function createFigureRenderer(
  canvas: HTMLCanvasElement,
  options: FigureRendererOptions,
): Promise<FigureRenderer> {
  const bodyOptions: BodyOptions = {
    clip: options.clip,
    highlight: options.highlight,
    palette: options.palette,
  };
  const bodies = await Promise.all(
    (options.pair ? [0, 1] : [0]).map(() => loadBody(options.variant, bodyOptions)),
  );
  const lead = bodies[0];
  if (!lead) throw new Error('no body');
  const first: FigureBody = lead;

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
  addFigureLights(scene);

  const stage = new Group();
  stage.name = 'stage';
  scene.add(stage);
  bodies.forEach((body, index) => {
    const slot = new Group();
    slot.name = `slot${String(index)}`;
    if (options.pair) {
      slot.position.x = index === 0 ? -0.55 : 0.55;
      // The second figure shows its back – a fixed placement, not part of the view's turn.
      if (index === 1) slot.rotation.y = Math.PI;
    }
    slot.add(body.root);
    stage.add(slot);
  });

  const view = first.view;
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
  let playing = false;
  let frame = 0;
  let last = 0;
  let disposed = false;

  function draw() {
    renderer.render(scene, camera);
  }

  function tick(now: number) {
    frame = 0;
    if (disposed) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (playing && first.animated) {
      for (const body of bodies) body.advance(dt);
    }
    const turning = Math.abs(targetYaw - yaw) > 0.001;
    if (turning) yaw += (targetYaw - yaw) * Math.min(1, dt * 7);
    else yaw = targetYaw;
    stage.rotation.y = yaw;
    draw();
    if ((playing && first.animated) || turning) frame = requestAnimationFrame(tick);
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
  draw();

  return {
    source: first.source,
    animated: first.animated,
    setPlaying(next) {
      playing = next;
      if (next) request();
    },
    setYaw(next, smooth) {
      targetYaw = next;
      if (!smooth) {
        yaw = next;
        stage.rotation.y = yaw;
      }
      request();
    },
    rotateBy(delta) {
      targetYaw += delta;
      yaw = targetYaw;
      stage.rotation.y = yaw;
      request();
    },
    yaw: () => targetYaw,
    setPalette(palette) {
      for (const body of bodies) body.setPalette(palette);
      request();
    },
    resize,
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      for (const body of bodies) body.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
