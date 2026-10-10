import { render, screen } from '@testing-library/react';
import { Icon } from './Icon';
import { ICON_FOR, ICON_NAMES, ICON_NEEDS_LABEL } from './roles';

describe('icon system', () => {
  it('maps every documented topic to an existing icon', () => {
    for (const [role, name] of Object.entries(ICON_FOR)) {
      expect(ICON_NAMES, role).toContain(name);
    }
    for (const topic of [
      'training',
      'nutrition',
      'health',
      'weight',
      'water',
      'sleep',
      'progress',
      'navForward',
      'navBack',
      'settings',
    ]) {
      expect(ICON_FOR, topic).toHaveProperty(topic);
    }
  });

  it('gives every topic its own symbol (no icon stands for two areas)', () => {
    const areas = [
      'training',
      'nutrition',
      'health',
      'weight',
      'water',
      'sleep',
      'progress',
    ] as const;
    const names = areas.map((area) => ICON_FOR[area]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('separates energy, recipes, activities, steps and distance (Phase C.2)', () => {
    const roles = ['energy', 'recipe', 'activity', 'steps', 'distance'] as const;
    const names = roles.map((role) => ICON_FOR[role]);
    expect(new Set(names).size).toBe(names.length);
    expect(ICON_FOR.energy).toBe('flame');
  });

  it('is used by role in the modules – "flame" only means energy', () => {
    const files = import.meta.glob<string>('/src/modules/**/*.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(files).length).toBeGreaterThan(50);
    const offenders = Object.entries(files)
      .filter(([path]) => !path.endsWith('.test.tsx'))
      .filter(([, source]) => /(icon|name)="flame"|'flame'/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('only lists mapped roles as needing a label', () => {
    for (const role of ICON_NEEDS_LABEL) expect(ICON_FOR).toHaveProperty(role);
  });

  it.each(ICON_NAMES)('"%s" is a 24 px line icon in the text color', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('is announced with its label when it carries meaning on its own', () => {
    render(<Icon name="warning" label="Warnung" />);
    const icon = screen.getByRole('img', { name: 'Warnung' });
    expect(icon).not.toHaveAttribute('aria-hidden');
  });
});
