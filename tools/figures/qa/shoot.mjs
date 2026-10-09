/**
 * Renders QA shots of a body asset with the app's three.js code (headless Chromium).
 *   node tools/figures/qa/shoot.mjs <out-dir> <shots.json>
 * shots.json: [{ "name": "front", "query": "clip=rest&az=0" }, …]. Needs a running
 * `npx vite --port 5179` in the project.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [out, list] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const shots = JSON.parse(readFileSync(list, 'utf8'));
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
for (const shot of shots) {
  await page.goto(`http://localhost:5179/tools/figures/qa/index.html?${shot.query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.locator('canvas').screenshot({ path: `${out}/${shot.name}.png` });
  console.log('shot', shot.name);
}
await browser.close();
