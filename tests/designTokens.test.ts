// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Kalethra's visual identity rests on one token file; these checks keep it complete. */
const tokens = readFileSync(resolve(import.meta.dirname, '..', 'src/ui/tokens.css'), 'utf8');
const block = (selector: string) => {
  const start = tokens.indexOf(`${selector} {`);
  return tokens.slice(start, tokens.indexOf('\n}', start));
};

describe('design tokens', () => {
  const required = [
    '--color-bg',
    '--color-surface',
    '--color-surface-elevated',
    '--color-accent',
    '--color-accent-subtle',
    '--color-text',
    '--color-text-secondary',
    '--color-text-tertiary',
    '--color-border',
    '--color-positive',
    '--color-warning',
    '--color-critical',
    '--color-water',
    '--color-disabled',
  ];

  it.each([':root', ":root[data-theme='dark']"])('defines every color for %s', (selector) => {
    const css = block(selector);
    for (const token of required) expect(css, token).toContain(`${token}:`);
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
