import { render, screen } from '@testing-library/react';
import { projectFileExists, readProjectFile } from '@/test/projectFiles';
import { BrandLogo, BrandMark } from './BrandMark';
import { SYMBOL_PATH, WORDMARK_PATH } from './brandArt';

const text = (path: string) => new TextDecoder().decode(readProjectFile(path));

/** Width, height and PNG colour type (2 = RGB, 6 = RGBA) from the IHDR chunk. */
function png(path: string) {
  const bytes = new Uint8Array(readProjectFile(path));
  expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG');
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20), colourType: bytes[25] };
}

/**
 * The bit of Node the generator check needs (the app's TypeScript setup has no Node types on
 * purpose, see src/test/projectFiles.ts).
 */
interface NodeApi {
  execFileSync: (command: string, args: string[], options: object) => unknown;
  mkdtempSync: (prefix: string) => string;
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string, options: { recursive: true }) => string[];
  statSync: (path: string) => { isFile: () => boolean };
  rmSync: (path: string, options: object) => void;
  tmpdir: () => string;
  join: (...parts: string[]) => string;
}

async function node(): Promise<NodeApi> {
  const load = async (name: string) => (await import(/* @vite-ignore */ name)) as object;
  const names: string[] = ['node:child_process', 'node:fs', 'node:os', 'node:path'];
  return Object.assign({}, ...(await Promise.all(names.map(load)))) as NodeApi;
}

const RES = 'android/app/src/main/res';
const IOS = 'ios/App/App/Assets.xcassets';

describe('brand components', () => {
  it('draws the symbol inline and keeps it decorative unless labelled', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 48 48');
    expect(svg?.querySelector('path')).toHaveAttribute('d', SYMBOL_PATH);
    expect(svg?.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    render(<BrandMark label="Kalethra" />);
    expect(screen.getByRole('img', { name: 'Kalethra' })).toBeInTheDocument();
  });

  it('shows symbol and wordmark as one logo named after the app', () => {
    render(<BrandLogo label="Kalethra" />);
    const logo = screen.getByRole('img', { name: 'Kalethra' });
    expect(logo.querySelector('[data-brand="symbol"]')).not.toBeNull();
    const wordmark = logo.querySelector('[data-brand="wordmark"] path');
    expect(wordmark).toHaveAttribute('d', WORDMARK_PATH);
    expect(wordmark).toHaveAttribute('stroke', 'currentColor');
    // No image request: everything inline.
    expect(logo.querySelector('img, image, use')).toBeNull();
  });
});

describe('brand artwork', () => {
  const vectors = [
    'assets/brand/kalethra-symbol.svg',
    'assets/brand/kalethra-symbol-ivory.svg',
    'assets/brand/kalethra-wordmark.svg',
    'assets/brand/kalethra-logo.svg',
    'assets/brand/kalethra-logo-ivory.svg',
    'assets/brand/kalethra-app-icon.svg',
    'public/favicon.svg',
  ];

  it('is self-contained vector artwork from one source', () => {
    for (const path of vectors) {
      const svg = text(path);
      expect(svg, path).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
      expect(svg, path).not.toMatch(/<script|<image|<use|<style|href=|url\(|<text/i);
      expect(svg.match(/https?:\/\//g), path).toEqual(['http://']);
    }
    // Symbol and logo carry the same symbol the app draws.
    expect(text('assets/brand/kalethra-symbol.svg')).toContain(SYMBOL_PATH);
    expect(text('assets/brand/kalethra-logo.svg')).toContain(SYMBOL_PATH);
    expect(text('assets/brand/kalethra-logo.svg')).toContain(WORDMARK_PATH);
    expect(text('public/favicon.svg')).toContain(SYMBOL_PATH);
    expect(text('index.html')).toContain('href="/favicon.svg"');
  });

  it('is exactly what the generator writes', async () => {
    const api = await node();
    const env = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;
    const out = api.mkdtempSync(api.join(api.tmpdir(), 'kalethra-brand-'));
    try {
      api.execFileSync('node', ['tools/brand/build.mjs'], {
        env: { ...env, OUT_ROOT: out },
        stdio: 'pipe',
      });
      const files = api
        .readdirSync(out, { recursive: true })
        .filter((path) => api.statSync(api.join(out, path)).isFile());
      expect(files.length).toBe(14);
      for (const path of files) {
        expect(text(path), path).toBe(api.readFileSync(api.join(out, path), 'utf8'));
      }
    } finally {
      api.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('platform resources', () => {
  it('Android: adaptive icon with the brand layers, legacy icons in every density', () => {
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      const xml = text(`${RES}/mipmap-anydpi-v26/${name}.xml`);
      expect(xml).toContain('@color/kalethra_icon_background');
      expect(xml).toContain('@drawable/ic_kalethra_foreground');
      expect(xml).toContain('<monochrome android:drawable="@drawable/ic_kalethra_monochrome"/>');
    }
    expect(text(`${RES}/drawable/ic_kalethra_foreground.xml`)).toContain(SYMBOL_PATH);
    for (const [density, k] of [
      ['mdpi', 1],
      ['hdpi', 1.5],
      ['xhdpi', 2],
      ['xxhdpi', 3],
      ['xxxhdpi', 4],
    ] as const) {
      for (const name of ['ic_launcher', 'ic_launcher_round']) {
        expect(png(`${RES}/mipmap-${density}/${name}.png`)).toMatchObject({
          width: 48 * k,
          height: 48 * k,
          colourType: 6,
        });
      }
      expect(png(`${RES}/mipmap-${density}/ic_launcher_foreground.png`)).toMatchObject({
        width: 108 * k,
        colourType: 6,
      });
    }
  });

  it('Android: splash in light and dark, system splash with the symbol', () => {
    const styles = text(`${RES}/values/styles.xml`);
    expect(styles).toContain(
      '<item name="windowSplashScreenBackground">@color/kalethra_splash_background</item>',
    );
    expect(styles).toContain(
      '<item name="windowSplashScreenAnimatedIcon">@drawable/ic_kalethra_splash</item>',
    );
    expect(text(`${RES}/values/kalethra_brand.xml`)).toContain(
      '<color name="kalethra_splash_background">#f3efe6</color>',
    );
    expect(text(`${RES}/values-night/kalethra_brand.xml`)).toContain(
      '<color name="kalethra_splash_background">#101612</color>',
    );
    expect(text(`${RES}/drawable-night/ic_kalethra_splash.xml`)).toContain('#f3efe6');
    // Every light launch image has a dark twin of the same size.
    for (const [light, dark] of [
      ['drawable', 'drawable-night'],
      ['drawable-port-xxxhdpi', 'drawable-port-night-xxxhdpi'],
      ['drawable-land-mdpi', 'drawable-land-night-mdpi'],
    ]) {
      expect(png(`${RES}/${light}/splash.png`)).toEqual(png(`${RES}/${dark}/splash.png`));
    }
  });

  it('iOS: opaque 1024 px app icon and light/dark launch image', () => {
    expect(png(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`)).toEqual({
      width: 1024,
      height: 1024,
      colourType: 2,
    });
    const contents = JSON.parse(text(`${IOS}/Splash.imageset/Contents.json`)) as {
      images: { filename: string; appearances?: { value: string }[] }[];
    };
    expect(contents.images).toHaveLength(6);
    expect(
      contents.images.filter((image) => image.appearances?.[0]?.value === 'dark'),
    ).toHaveLength(3);
    for (const { filename } of contents.images) {
      expect(projectFileExists(`${IOS}/Splash.imageset/${filename}`), filename).toBe(true);
      expect(png(`${IOS}/Splash.imageset/${filename}`)).toMatchObject({ width: 2732 });
    }
  });
});
