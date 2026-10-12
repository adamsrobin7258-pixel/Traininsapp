import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };

/**
 * Files in `public/` that stay in the repository but are not shipped with the app. Vite copies
 * `public/` as a whole into the build; these paths are removed from the output again, so they
 * reach neither the web build nor the Android/iOS package (`cap sync` copies `dist/`).
 *
 * - `figure/`: the former 3D bodies (GLB). Since the 2D muscle maps (Phase 21/23) nothing in the
 *   app loads them; they are kept for the prototypes, the tools in `tools/figures/` and their
 *   tests. Licence notes: assets/figure/male/source/ATTRIBUTION.md.
 */
const NOT_SHIPPED = ['figure'];

function excludeFromBuild(paths: readonly string[]): Plugin {
  let outDir = '';
  return {
    name: 'kalethra:exclude-from-build',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // After the bundle is written – the public files are copied before that.
    async closeBundle() {
      for (const path of paths) await rm(resolve(outDir, path), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), excludeFromBuild(NOT_SHIPPED)],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: ['es2022', 'chrome111', 'safari16'],
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
