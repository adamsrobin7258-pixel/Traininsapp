/**
 * Kalethra brand – renders the platform raster images from the same artwork as `build.mjs`
 * (`geometry.mjs`), in exactly the sizes the platforms already use:
 *
 *   Android  mipmap-*\/ic_launcher(_round|_foreground).png   legacy and adaptive layers
 *            drawable(-port|-land)(-night)(-*dpi)/splash.png  launch background (light / dark)
 *   iOS      AppIcon.appiconset/AppIcon-512@2x.png            1024 px, opaque (no alpha)
 *            Splash.imageset/splash-2732x2732*.png            light and dark appearance
 *
 *   node tools/brand/render.mjs
 *
 * Needs the Playwright Chromium of the project (SVG → PNG) and Python 3 with Pillow (flattening
 * to RGB, PNG optimisation). Run `build.mjs` first; this script does not change any vector file.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SYMBOL_PATH, SYMBOL_SIZE } from './geometry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RES = join(ROOT, 'android/app/src/main/res');
const IOS = join(ROOT, 'ios/App/App/Assets.xcassets');

const FOREST = '#466a4c';
const IVORY = '#f3efe6';
const NIGHT = '#101612';

/**
 * One image: `size` [w, h], background (or none), the symbol at `symbol` px height centred,
 * optional shape of the background ('square' | 'rounded' | 'circle').
 */
function page({ size: [w, h], background, colour, symbol, shape = 'square' }) {
  const s = symbol / SYMBOL_SIZE;
  const x = (w - symbol) / 2;
  const y = (h - symbol) / 2;
  const radius = shape === 'circle' ? w / 2 : shape === 'rounded' ? w * 0.22 : 0;
  const back = background
    ? `<rect width="${w}" height="${h}" rx="${radius}" fill="${background}"/>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
${back}<g transform="translate(${x} ${y}) scale(${s})"><path fill="${colour}" d="${SYMBOL_PATH}"/></g>
</svg></body></html>`;
}

const jobs = [];
const add = (file, options, opaque) => jobs.push({ file, options, opaque });

// Android launcher (legacy square/round and the adaptive foreground layer).
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, k] of Object.entries(densities)) {
  const icon = 48 * k;
  add(`${RES}/mipmap-${name}/ic_launcher.png`, {
    size: [icon, icon],
    background: FOREST,
    colour: IVORY,
    symbol: icon * 0.62,
    shape: 'rounded',
  });
  add(`${RES}/mipmap-${name}/ic_launcher_round.png`, {
    size: [icon, icon],
    background: FOREST,
    colour: IVORY,
    symbol: icon * 0.58,
    shape: 'circle',
  });
  // 108 dp layer, symbol as in the vector foreground (60 of 108).
  add(`${RES}/mipmap-${name}/ic_launcher_foreground.png`, {
    size: [108 * k, 108 * k],
    background: null,
    colour: IVORY,
    symbol: 60 * k,
  });
}

// Android launch background (before Android 12, and behind the web view while it starts).
const splash = (w, h) => Math.round(Math.min(w, h) * 0.2);
const splashSizes = {
  '': [480, 320],
  'port-mdpi': [320, 480],
  'port-hdpi': [480, 800],
  'port-xhdpi': [720, 1280],
  'port-xxhdpi': [960, 1600],
  'port-xxxhdpi': [1280, 1920],
  'land-mdpi': [480, 320],
  'land-hdpi': [800, 480],
  'land-xhdpi': [1280, 720],
  'land-xxhdpi': [1600, 960],
  'land-xxxhdpi': [1920, 1280],
};
for (const [qualifier, [w, h]] of Object.entries(splashSizes)) {
  const [orientation, density] = qualifier ? qualifier.split('-') : [];
  const folder = (night) =>
    ['drawable', orientation, night ? 'night' : null, density].filter(Boolean).join('-');
  for (const night of [false, true]) {
    add(
      `${RES}/${folder(night)}/splash.png`,
      {
        size: [w, h],
        background: night ? NIGHT : IVORY,
        colour: night ? IVORY : FOREST,
        symbol: splash(w, h),
      },
      true,
    );
  }
}

// iOS: app icon (opaque, full bleed – iOS applies its own mask) and launch image.
add(
  `${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`,
  { size: [1024, 1024], background: FOREST, colour: IVORY, symbol: 600 },
  true,
);
for (const [suffix, night] of [
  ['', false],
  ['-1', false],
  ['-2', false],
  ['-dark', true],
  ['-dark-1', true],
  ['-dark-2', true],
]) {
  add(
    `${IOS}/Splash.imageset/splash-2732x2732${suffix}.png`,
    {
      size: [2732, 2732],
      background: night ? NIGHT : IVORY,
      colour: night ? IVORY : FOREST,
      symbol: 280,
    },
    true,
  );
}

const work = mkdtempSync(join(tmpdir(), 'kalethra-brand-'));
const browser = await chromium.launch();
try {
  const manifest = [];
  for (const [index, { file, options, opaque }] of jobs.entries()) {
    const [w, h] = options.size;
    const tab = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await tab.setContent(page(options));
    const raw = join(work, `${String(index)}.png`);
    await tab.screenshot({ path: raw, omitBackground: !opaque });
    await tab.close();
    mkdirSync(dirname(file), { recursive: true });
    manifest.push({ raw, file, opaque: Boolean(opaque) });
  }
  // Flatten opaque images to RGB (iOS rejects icons with alpha) and optimise every PNG.
  const script = join(work, 'finish.py');
  writeFileSync(
    script,
    [
      'import json, sys',
      'from PIL import Image',
      'for job in json.load(open(sys.argv[1])):',
      '    image = Image.open(job["raw"])',
      '    image = image.convert("RGB" if job["opaque"] else "RGBA")',
      '    image.save(job["file"], optimize=True)',
    ].join('\n'),
  );
  const list = join(work, 'jobs.json');
  writeFileSync(list, JSON.stringify(manifest));
  execFileSync('python3', [script, list], { stdio: 'inherit' });
  console.log(`rendered ${String(manifest.length)} images`);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
