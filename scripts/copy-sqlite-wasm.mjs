// Copies the sql.js WebAssembly binary used by jeep-sqlite (the web implementation
// of @capacitor-community/sqlite) into public/assets so it is served in the browser.
// Native Android/iOS builds use the platform SQLite and do not need this file.
//
// IMPORTANT: jeep-sqlite bundles the JavaScript part of sql.js 1.11.0. The WASM binary
// must come from exactly that version, which is why sql.js is pinned in package.json.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = require.resolve('sql.js/dist/sql-wasm.wasm', {
  paths: [resolve(root, 'node_modules/jeep-sqlite')],
});
const targetDir = resolve(root, 'public/assets');

mkdirSync(targetDir, { recursive: true });
const { version } = require(resolve(dirname(source), '..', 'package.json'));
if (version !== '1.11.0') {
  throw new Error(`sql.js ${version} found, but jeep-sqlite requires the 1.11.0 WASM binary.`);
}
copyFileSync(source, resolve(targetDir, 'sql-wasm.wasm'));
console.log('Copied sql-wasm.wasm to public/assets');
