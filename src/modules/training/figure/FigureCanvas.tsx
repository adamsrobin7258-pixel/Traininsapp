import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from 'react';
import type { MuscleHighlight } from '@/core/training';
import { readFigurePalette } from './environment';
import type { FigureRenderer } from './figureRenderer';
import type { FigurePose } from './rig';

/** Pixels of horizontal drag per radian of turn. */
const DRAG_PER_RADIAN = 90;

/**
 * Canvas with one Kalethra figure (or front and back side by side). three.js is loaded only
 * here, on first use, as a separate chunk; the renderer is freed when the canvas goes away.
 * Declarative: `side`, `playing` and the highlight drive the figure; `interactive` lets a
 * horizontal drag turn it. If 3D cannot start, `onFailed` is called and nothing breaks.
 */
export function FigureCanvas({
  pose,
  highlight,
  side = 'front',
  pair = false,
  quality,
  playing = false,
  smooth = true,
  interactive = false,
  onFailed,
  className,
}: {
  pose: FigurePose;
  highlight: MuscleHighlight;
  side?: 'front' | 'back';
  pair?: boolean;
  quality: 'small' | 'large';
  playing?: boolean;
  /** Turn smoothly to a new side; off with reduced motion. */
  smooth?: boolean;
  interactive?: boolean;
  onFailed?: () => void;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<FigureRenderer | null>(null);
  const drag = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  // A new figure shows its side at once; later side changes may turn smoothly.
  const first = useRef(true);
  const failed = useEffectEvent(() => onFailed?.());
  const highlightKey = JSON.stringify(highlight);

  useEffect(() => {
    let cancelled = false;
    let instance: FigureRenderer | null = null;
    import('./figureRenderer')
      .then(({ createFigureRenderer }) => {
        if (cancelled || !canvas.current) return;
        instance = createFigureRenderer(canvas.current, {
          pose,
          highlight: JSON.parse(highlightKey) as MuscleHighlight,
          pair,
          quality,
          palette: readFigurePalette(),
        });
        renderer.current = instance;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) failed();
      });
    return () => {
      cancelled = true;
      instance?.dispose();
      renderer.current = null;
      first.current = true;
      setReady(false);
    };
  }, [pose, highlightKey, pair, quality]);

  // Turn to the requested side – the nearest way round, even after dragging.
  useEffect(() => {
    const current = renderer.current;
    if (!ready || !current || pair) return;
    const base = side === 'back' ? Math.PI : 0;
    const yaw = current.yaw();
    const target = base + Math.round((yaw - base) / (2 * Math.PI)) * 2 * Math.PI;
    current.setYaw(target, smooth && !first.current);
    first.current = false;
  }, [ready, side, pair, smooth]);

  useEffect(() => {
    if (ready) renderer.current?.setPlaying(playing);
  }, [ready, playing]);

  // Follow the theme (light/dark) and the canvas size.
  useEffect(() => {
    if (!ready || !canvas.current) return;
    const theme = new MutationObserver(() => {
      renderer.current?.setPalette(readFigurePalette());
    });
    theme.observe(document.documentElement, { attributes: true });
    const size =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            renderer.current?.resize();
          })
        : null;
    size?.observe(canvas.current);
    return () => {
      theme.disconnect();
      size?.disconnect();
    };
  }, [ready]);

  const pointer = interactive
    ? {
        onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
          drag.current = event.clientX;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Not every environment supports pointer capture; dragging still works without it.
          }
        },
        onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
          if (drag.current === null) return;
          renderer.current?.rotateBy((event.clientX - drag.current) / DRAG_PER_RADIAN);
          drag.current = event.clientX;
        },
        onPointerUp() {
          drag.current = null;
        },
        onPointerCancel() {
          drag.current = null;
        },
      }
    : {};

  return (
    <canvas
      ref={canvas}
      className={className}
      data-ready={ready}
      data-testid="figure-canvas"
      aria-hidden="true"
      {...pointer}
    />
  );
}
