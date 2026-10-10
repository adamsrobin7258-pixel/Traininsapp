// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Kalethra's visual identity rests on one token file; these checks keep it complete. */
const read = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');
const tokens = read('src/ui/tokens.css');
const block = (selector: string) => {
  const start = tokens.indexOf(`${selector} {`);
  return tokens.slice(start, tokens.indexOf('\n}', start));
};

const THEMES = { light: ':root', dark: ":root[data-theme='dark']" } as const;
type Theme = keyof typeof THEMES;

/** All `--name: value;` declarations of a theme block. */
function declarations(selector: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of block(selector).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    map.set(match[1] ?? '', (match[2] ?? '').trim());
  }
  return map;
}

/** A solid hex color of a theme; the dark theme falls back to the light value it inherits. */
function hex(theme: Theme, token: string): string {
  const value = declarations(THEMES[theme]).get(token) ?? declarations(THEMES.light).get(token);
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${theme} ${token}: ${value}`);
  return value;
}

function luminance(color: string): number {
  const channel = (offset: number) => {
    const c = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = [
  '--color-bg',
  '--color-surface',
  '--color-surface-elevated',
  '--color-surface-dialog',
  '--color-surface-accent',
];

describe('design tokens', () => {
  const required = [
    '--color-bg',
    '--color-surface',
    '--color-surface-elevated',
    '--color-surface-dialog',
    '--color-surface-muted',
    '--color-surface-pressed',
    '--color-surface-hover',
    '--color-surface-accent',
    '--color-surface-accent-border',
    '--color-control-selected',
    '--color-accent',
    '--color-accent-strong',
    '--color-accent-text',
    '--color-accent-subtle',
    '--color-accent-subtle-strong',
    '--color-on-accent',
    '--color-text',
    '--color-text-secondary',
    '--color-text-tertiary',
    '--color-disabled',
    '--color-separator',
    '--color-border',
    '--color-border-strong',
    '--color-card-border',
    '--color-positive',
    '--color-positive-subtle',
    '--color-warning',
    '--color-warning-subtle',
    '--color-critical',
    '--color-critical-subtle',
    '--color-info',
    '--color-info-subtle',
    '--color-water',
    '--color-water-subtle',
    '--color-tab-bar',
    '--color-scrim',
    '--shadow-card',
    '--shadow-raised',
    '--shadow-sheet',
    '--color-switch-knob',
  ];

  it.each(Object.values(THEMES))('defines every color for %s', (selector) => {
    const css = block(selector);
    for (const token of required) expect(css, token).toContain(`${token}:`);
  });

  it('gives the dark theme its own value for every light color (no light color leaks)', () => {
    const dark = declarations(THEMES.dark);
    for (const [token, value] of declarations(THEMES.light)) {
      if (!token.startsWith('--color-') || value.startsWith('var(')) continue;
      expect(dark.has(token), token).toBe(true);
    }
  });

  it('defines the shared scales: radii, control and icon sizes, states', () => {
    const root = block(':root');
    for (const token of [
      '--radius-control',
      '--radius-card',
      '--radius-sheet',
      '--size-control',
      '--size-control-compact',
      '--size-tap-target',
      '--size-icon',
      '--size-icon-sm',
      '--size-icon-xs',
      '--font-size-tab-label',
      '--opacity-disabled',
      '--focus-ring-width',
      '--focus-ring-offset',
      '--border-control',
    ]) {
      expect(root, token).toContain(`${token}:`);
    }
    expect(root).toContain('--size-tap-target: 2.75rem;');
  });

  it('uses the muted sage as primary – no neon, no former accent', () => {
    expect(block(':root')).toContain('--color-accent: #557a5b;');
    expect(tokens).not.toContain('#cc431c');
  });

  it('turns every motion off for reduced motion', () => {
    const reduced = tokens.slice(tokens.indexOf('prefers-reduced-motion'));
    for (const token of ['--duration-fast', '--duration-base', '--duration-slow']) {
      expect(reduced).toContain(`${token}: 0ms`);
    }
  });
});

describe.each(Object.keys(THEMES) as Theme[])('contrast – %s theme', (theme) => {
  const c = (a: string, b: string) => contrast(hex(theme, a), hex(theme, b));

  it.each(['--color-text', '--color-text-secondary', '--color-text-tertiary'])(
    '%s is readable text (≥ 4.5:1) on every surface and on muted controls',
    (text) => {
      for (const surface of [...SURFACES, '--color-surface-muted']) {
        expect(c(text, surface), surface).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each([
    '--color-accent-text',
    '--color-positive',
    '--color-warning',
    '--color-critical',
    '--color-info',
    '--color-water',
  ])('%s works as text (≥ 4.5:1) on page, card and sheet', (color) => {
    for (const surface of SURFACES) {
      expect(c(color, surface), surface).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the accent visible as icon, bar and outline (≥ 3:1) – also on muted tracks', () => {
    for (const surface of [...SURFACES, '--color-surface-muted']) {
      expect(c('--color-accent', surface), surface).toBeGreaterThanOrEqual(3);
    }
  });

  it('writes readable labels on the primary button, also when pressed', () => {
    expect(c('--color-on-accent', '--color-accent')).toBeGreaterThanOrEqual(4.5);
    expect(c('--color-on-accent', '--color-accent-strong')).toBeGreaterThanOrEqual(4.5);
  });

  it('separates muted controls (fields, tracks, steppers) from the card', () => {
    expect(c('--color-surface-muted', '--color-surface')).toBeGreaterThanOrEqual(1.2);
    expect(c('--color-control-selected', '--color-surface-muted')).toBeGreaterThanOrEqual(1.2);
  });

  it('keeps disabled content visibly quieter than tertiary text', () => {
    expect(c('--color-disabled', '--color-surface')).toBeLessThan(
      c('--color-text-tertiary', '--color-surface'),
    );
  });
});

describe('dark theme levels', () => {
  const l = (token: string) => luminance(hex('dark', token));

  it('lifts cards clearly off the page (≥ 1.25:1) – no merging surfaces', () => {
    expect(
      contrast(hex('dark', '--color-bg'), hex('dark', '--color-surface')),
    ).toBeGreaterThanOrEqual(1.25);
  });

  it('gets lighter with every level: page < sheet < card < elevated', () => {
    expect(l('--color-bg')).toBeLessThan(l('--color-surface-dialog'));
    expect(l('--color-surface-dialog')).toBeLessThan(l('--color-surface'));
    expect(l('--color-surface')).toBeLessThan(l('--color-surface-elevated'));
  });

  it('uses no pure black surface', () => {
    for (const token of SURFACES) expect(hex('dark', token).toLowerCase()).not.toBe('#000000');
  });

  it('replaces card shadows by borders', () => {
    expect(declarations(THEMES.dark).get('--shadow-card')).toBe('none');
  });
});

describe('browser theme color', () => {
  it('matches --color-bg of both themes and the initial meta tag', () => {
    const source = read('src/core/theme/applyTheme.ts');
    expect(source).toContain(`light: '${hex('light', '--color-bg')}'`);
    expect(source).toContain(`dark: '${hex('dark', '--color-bg')}'`);
    expect(read('index.html')).toContain(
      `<meta name="theme-color" content="${hex('light', '--color-bg')}" />`,
    );
  });
});
