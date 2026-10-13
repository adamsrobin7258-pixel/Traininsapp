import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BrandMark } from './brand/BrandMark';
import { SYMBOL_PATH } from './brand/brandArt';
import { ProgressRing } from './components/ProgressRing';
import { Screen } from './components/Screen';
import { SceneArt } from './illustrations/SceneArt';
import { SCENE_TONE, type SceneName } from './illustrations/sceneTone';

/** Phase 25: depth and atmosphere – scenes, hero header and the brand badge. */
describe('SceneArt', () => {
  it.each(Object.keys(SCENE_TONE) as SceneName[])(
    '%s is an inline, decorative vector – no image request',
    (name) => {
      const { container } = render(<SceneArt name={name} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('data-scene', name);
      expect(container.querySelector('image, img, [href^="http"]')).toBeNull();
    },
  );

  it('gives every scene its own gradient ids', () => {
    const { container } = render(
      <>
        <SceneArt name="mountains" />
        <SceneArt name="mountains" />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Screen hero', () => {
  it('puts a decorative scene behind the header and keeps the title a heading', () => {
    render(
      <MemoryRouter>
        <Screen title="Training" hero="mountains">
          <p>Inhalt</p>
        </Screen>
      </MemoryRouter>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-hero', 'dark');
    expect(main.querySelector('svg[data-scene="mountains"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Training' })).toBeInTheDocument();
    // The header mark is still the one brand element.
    expect(main.querySelectorAll('[data-brand]')).toHaveLength(1);
  });

  it('a light scene keeps the normal text colour; no hero, no scene', () => {
    const { unmount } = render(
      <MemoryRouter>
        <Screen title="Ernährung" hero="harvest">
          <p>Inhalt</p>
        </Screen>
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).toHaveAttribute('data-hero', 'light');
    unmount();
    render(
      <MemoryRouter>
        <Screen title="Gesundheit">
          <p>Inhalt</p>
        </Screen>
      </MemoryRouter>,
    );
    expect(screen.getByRole('main')).not.toHaveAttribute('data-hero');
    expect(document.querySelector('[data-scene]')).toBeNull();
  });
});

describe('BrandMark badge', () => {
  it('draws the same symbol on a round disc, still decorative', () => {
    const { container } = render(<BrandMark badge />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-brand', 'symbol');
    expect(svg?.querySelector('circle')).not.toBeNull();
    const symbol = [...(svg?.querySelectorAll('path') ?? [])].find(
      (path) => path.getAttribute('d') === SYMBOL_PATH,
    );
    expect(symbol).toHaveAttribute('fill', 'currentColor');
  });
});

/** Phase 26: one ring for score and nutrition goal – value, zero, missing and beyond the goal. */
describe('ProgressRing', () => {
  const arcs = (container: HTMLElement) =>
    [...container.querySelectorAll('circle[stroke-dasharray]')].map((circle) =>
      circle.getAttribute('stroke-dasharray'),
    );

  it('draws the arc of the value and reads it out when named', () => {
    const { container } = render(
      <ProgressRing ratio={0.81} label="Kalorien" valueText="1.620 kcal von 2.000 kcal">
        1.620
      </ProgressRing>,
    );
    const ring = screen.getByRole('progressbar', { name: 'Kalorien' });
    expect(ring).toHaveAttribute('aria-valuenow', '81');
    expect(ring).toHaveAttribute('aria-valuetext', '1.620 kcal von 2.000 kcal');
    expect(ring).toHaveAttribute('data-state', 'final');
    expect(arcs(container)[0]).toBe('81 100');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows only the track for zero and for a missing value', () => {
    const zero = render(<ProgressRing ratio={0}>0</ProgressRing>);
    expect(arcs(zero.container)).toEqual([]);
    expect(zero.container.firstElementChild).toHaveAttribute('data-state', 'final');
    zero.unmount();
    const missing = render(<ProgressRing ratio={null}>–</ProgressRing>);
    expect(arcs(missing.container)).toEqual([]);
    expect(missing.container.firstElementChild).toHaveAttribute('data-state', 'empty');
    // Without a name it is decorative: the text next to it says it all.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('fills the ring at the goal and runs a second, limited lap beyond it', () => {
    const { container } = render(
      <ProgressRing ratio={1.3} label="Kalorien" valueText="2.600 kcal von 2.000 kcal" />,
    );
    const ring = screen.getByRole('progressbar', { name: 'Kalorien' });
    expect(ring).toHaveAttribute('aria-valuenow', '100');
    expect(ring).toHaveAttribute('data-over', 'true');
    const dashes = arcs(container);
    expect(dashes[0]).toBe('100 100');
    expect(dashes.at(-1)).toBe('30 100');
    // Far beyond the goal the second lap stops at one full lap.
    const far = render(<ProgressRing ratio={5} />);
    expect(arcs(far.container).at(-1)).toBe('100 100');
  });

  it('marks a preliminary value without hiding it', () => {
    const { container } = render(<ProgressRing ratio={0.3} state="preliminary" />);
    expect(container.firstElementChild).toHaveAttribute('data-state', 'preliminary');
    expect(arcs(container)[0]).toBe('30 100');
  });
});
