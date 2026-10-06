/**
 * What the 3D figure needs from its surroundings – without loading three.js: WebGL support,
 * reduced motion and the colours of the current theme.
 */
import type { FigurePalette } from './body';

let webgl: boolean | null = null;

/** Whether this device can draw the figure. Without WebGL the details simply show no figure. */
export function supportsWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    if (typeof window === 'undefined' || typeof WebGLRenderingContext === 'undefined') {
      webgl = false;
    } else {
      const canvas = document.createElement('canvas');
      webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    }
  } catch {
    webgl = false;
  }
  return webgl;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const LIGHT: Omit<FigurePalette, 'accent'> = {
  body: '#d9d3c9',
  shirt: '#4b544e',
  shorts: '#353c38',
  shoe: '#2c312e',
  equipment: '#bdbab1',
  metal: '#8f8d87',
  shadow: '#1b1f1c',
};

const DARK: Omit<FigurePalette, 'accent'> = {
  body: '#c4beb4',
  shirt: '#5c665f',
  shorts: '#454c47',
  shoe: '#323834',
  equipment: '#5e635f',
  metal: '#9a9893',
  shadow: '#000000',
};

function isDark(color: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match?.[1]) return false;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** The figure's colours for the theme in use: neutral surfaces, the Kalethra accent for muscles. */
export function readFigurePalette(): FigurePalette {
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--color-accent').trim() || '#557a5b';
  const surface = css.getPropertyValue('--color-surface').trim() || '#ffffff';
  return { ...(isDark(surface) ? DARK : LIGHT), accent };
}
