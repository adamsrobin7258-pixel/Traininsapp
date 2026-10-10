/**
 * Applies the surface repair (lib/repair.mjs) to the bundled body assets in place:
 *
 *   node tools/figures/repair.mjs            # both variants
 *   VARIANTS=female node tools/figures/repair.mjs
 *
 * The full build (build.mjs) runs the same step as its last one, so a rebuild from the
 * MakeHuman sources gives the same files. A file that already carries the current repair
 * (`asset.extras.kalethra.repair`) is left as it is.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGlb, repairBody } from './lib/repair.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const variants = (process.env.VARIANTS ?? 'male,female').split(',');
for (const variant of variants) {
  const file = join(ROOT, 'public/figure', variant, `kalethra-${variant}.glb`);
  const { glb, report } = repairBody(readFileSync(file), variant);
  if (report.skipped) {
    console.log(`${variant}: already repaired, unchanged`);
    continue;
  }
  writeFileSync(file, glb);
  // The asset spec records the file and normal map sizes; keep them in step.
  const specFile = join(ROOT, 'assets/figure', variant, 'shape.json');
  const spec = JSON.parse(readFileSync(specFile, 'utf8'));
  spec.bytes = glb.length;
  const { json } = readGlb(glb);
  const image = json.images?.[0];
  if (image && spec.normalMap) spec.normalMap.bytes = json.bufferViews[image.bufferView].byteLength;
  writeFileSync(specFile, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`${variant}: ${JSON.stringify(report)}, ${glb.length} bytes`);
}
