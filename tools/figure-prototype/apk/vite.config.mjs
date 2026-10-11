/**
 * Phase 1A-APK: builds the prototype viewer (tools/figure-prototype/viewer) as a standalone web
 * bundle for the separate Android test app "Kalethra Figur-Test". Not used by the Kalethra app.
 *
 *   npx vite build --config tools/figure-prototype/apk/vite.config.mjs
 *
 * Output: dist/ (git-ignored) with index.html, the bundled viewer and the prototype GLB at
 * dist/assets/figure/prototype/ – the same absolute path the viewer requests. Everything is local:
 * a Content-Security-Policy in the built page allows only same-origin, data: and blob: sources,
 * so the test app cannot load scripts, models or textures from the network.
 * The viewer sources and the prototype GLB are only read, never changed.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const viewerDir = resolve(root, 'tools/figure-prototype/viewer');
const outDir = resolve(root, 'dist');
const GLB = 'assets/figure/prototype/kalethra-male-prototype.glb';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Offline guard and edge-to-edge insets for the Android WebView – build output only. */
const testAppPage = {
  name: 'figure-test-app-page',
  transformIndexHtml(html) {
    // Each anchor must exist exactly once – a changed viewer page fails the build loudly.
    const swap = (text, from, to) => {
      if (text.split(from).length !== 2)
        throw new Error(`viewer index.html: "${from}" not found once`);
      return text.replace(from, to);
    };
    let page = swap(
      html,
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    );
    page = swap(
      page,
      '<meta charset="utf-8" />',
      `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    );
    return swap(
      page,
      '</head>',
      '  <style>\n      body {\n        padding: env(safe-area-inset-top) env(safe-area-inset-right)\n          env(safe-area-inset-bottom) env(safe-area-inset-left);\n      }\n    </style>\n  </head>',
    );
  },
};

/** Copies the prototype GLB next to the bundle (byte for byte). */
const prototypeGlb = {
  name: 'figure-prototype-glb',
  closeBundle() {
    const target = resolve(outDir, GLB);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(root, GLB), target);
  },
};

export default defineConfig({
  root: viewerDir,
  base: './',
  publicDir: false,
  plugins: [testAppPage, prototypeGlb],
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    outDir,
    emptyOutDir: true,
    target: ['es2022', 'chrome111'],
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
