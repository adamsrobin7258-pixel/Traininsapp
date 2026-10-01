/**
 * Reproducible import of the official BLS 4.0 data (Max Rubner-Institut, CC BY 4.0).
 *
 *   node scripts/nutrition/import-bls.ts [path/to/BLS_4_0_Daten_2025_DE.xlsx]
 *
 * Default source: data/bls/source/BLS_4_0_Daten_2025_DE.xlsx (not committed – download it from
 * https://blsdb.de/download). Writes the compact runtime data
 * src/core/nutrition/bls/data/bls.json and the report data/bls/IMPORT_REPORT.md.
 * The same source file always produces the same output (apart from the import date).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapBlsRows, RUNTIME_FIELDS, toRuntimeRows } from './bls-mapping.ts';
import { readFirstSheet } from './xlsx.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourcePath = resolve(
  process.argv[2] ?? resolve(root, 'data/bls/source/BLS_4_0_Daten_2025_DE.xlsx'),
);
const outputPath = resolve(root, 'src/core/nutrition/bls/data/bls.json');
const reportPath = resolve(root, 'data/bls/IMPORT_REPORT.md');

const file = readFileSync(sourcePath);
const sha256 = createHash('sha256').update(file).digest('hex');
const { foods, report } = mapBlsRows(readFirstSheet(file));
const importedAt = new Date().toISOString().slice(0, 10);

const meta = {
  dataset: 'BLS',
  version: '4.0',
  publisher: 'Max Rubner-Institut',
  license: 'CC BY 4.0',
  attribution:
    'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. Lizenz: CC BY 4.0.',
  sourceFile: basename(sourcePath),
  sha256,
  importedAt,
  count: foods.length,
  per: '100 g essbarer Anteil',
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify({ meta, fields: RUNTIME_FIELDS, foods: toRuntimeRows(foods) })}\n`,
);

const skippedByReason = new Map<string, number>();
for (const item of report.skipped) {
  const key = item.reason.replace(/:.*/, '');
  skippedByReason.set(key, (skippedByReason.get(key) ?? 0) + 1);
}
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(
  reportPath,
  [
    '# BLS-Import – Bericht',
    '',
    `- Quelle: \`${meta.sourceFile}\` (SHA-256 \`${sha256}\`)`,
    `- Importiert am: ${importedAt}`,
    `- Datenzeilen: ${String(report.rows)}, übernommen: ${String(report.imported)}, übersprungen: ${String(report.skipped.length)}`,
    `- Fehlende Spalten: ${report.missingColumns.length ? report.missingColumns.join(', ') : 'keine'}`,
    '',
    '## Nicht angegebene optionale Werte (bleiben „nicht angegeben“, nie 0)',
    '',
    ...Object.entries(report.missingOptional).map(
      ([field, count]) => `- ${field}: ${String(count)}`,
    ),
    '',
    '## Übersprungene Datensätze nach Grund',
    '',
    ...[...skippedByReason].map(([reason, count]) => `- ${reason}: ${String(count)}`),
    '',
    '## Übersprungene Datensätze',
    '',
    ...report.skipped.slice(0, 500).map((s) => `- ${s.code} ${s.name}: ${s.reason}`),
    '',
  ].join('\n'),
);

console.log(
  `BLS ${meta.version}: ${String(report.imported)} foods written to ${outputPath} (${String(report.skipped.length)} skipped).`,
);
