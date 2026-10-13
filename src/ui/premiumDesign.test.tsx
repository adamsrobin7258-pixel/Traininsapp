import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BrandMark } from './brand/BrandMark';
import { SYMBOL_PATH } from './brand/brandArt';
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
