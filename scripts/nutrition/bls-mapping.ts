/**
 * Mapping of the official BLS 4.0 table (Max Rubner-Institut) to Kalethra's compact
 * reference data. Pure functions – the CLI (import-bls.ts) does the file handling.
 *
 * Source structure (BLS_4_0_Daten_2025_DE.xlsx): one header row, then one row per food.
 * - BLS code (column header containing "BLS" and "Code", by default column A)
 * - German name ("Lebensmittelbezeichnung", by default column B), English name if present
 * - nutrient columns named "<CODE> <Name> [<unit>/100g]", e.g. "ENERCC Energie (Kilokalorien)
 *   [kcal/100g]". All values refer to 100 g of the edible portion.
 *
 * Missing values: an empty cell means "no value" and is kept as `null` – never 0.
 * Trace / below detection ("TR", "<LOD", "<LOQ") are measured as practically zero → 0.
 */
import type { Cell } from './xlsx.ts';

/** Kalethra field → candidate BLS component codes (first found wins). */
export const BLS_FIELDS = {
  energyKcal: ['ENERCC'],
  proteinG: ['PROT625'],
  carbsG: ['CHO'],
  fatG: ['FAT'],
  fiberG: ['FIBT'],
  sugarG: ['SUGAR'],
  saturatedFatG: ['FASAT'],
} as const;

export type BlsField = keyof typeof BLS_FIELDS;
export const REQUIRED_FIELDS: readonly BlsField[] = ['energyKcal', 'proteinG', 'carbsG', 'fatG'];
const FIELD_ORDER = Object.keys(BLS_FIELDS) as BlsField[];

/** Plausibility per 100 g; values outside are treated as invalid (the food is skipped). */
const LIMITS = { energyKcal: 950, grams: 100, macroSum: 105 } as const;
const ZERO_MARKS = new Set(['TR', '<LOD', '<LOQ', '<LOD OR <LOQ', '<LOD/<LOQ']);
const UNIT_TO_GRAMS: Record<string, number> = { g: 1, mg: 0.001, µg: 0.000001, ug: 0.000001 };

export interface BlsFood {
  code: string;
  name: string;
  nameEn: string | null;
  values: Record<BlsField, number | null>;
}

export interface MappingReport {
  rows: number;
  imported: number;
  skipped: { code: string; name: string; reason: string }[];
  missingColumns: BlsField[];
  /** How many foods lack each optional value (stays "not stated"). */
  missingOptional: Record<BlsField, number>;
}

interface ColumnMap {
  code: number;
  name: number;
  nameEn: number | null;
  fields: Partial<Record<BlsField, { index: number; factor: number }>>;
}

const HEADER = /^(\S+)\s+(.+?)\s*\[\s*(.+?)\s*\/\s*100\s*g\s*\]\s*$/i;

/** Finds the header row and the columns Kalethra needs. */
export function mapColumns(header: readonly Cell[]): ColumnMap {
  const text = header.map((cell) => (typeof cell === 'string' ? cell.trim() : ''));
  const find = (test: RegExp) => text.findIndex((cell) => test.test(cell));
  const code = find(/bls.*code|^code$|^sbls$/i);
  const name = find(/lebensmittelbezeichnung|^bezeichnung$/i);
  const nameEn = find(/food\s*name|english/i);
  const fields: ColumnMap['fields'] = {};
  text.forEach((cell, index) => {
    const match = HEADER.exec(cell);
    if (!match) return;
    const componentCode = (match[1] ?? '').toUpperCase();
    const unit = (match[3] ?? '').toLowerCase();
    for (const field of FIELD_ORDER) {
      if (fields[field]) continue;
      if (!(BLS_FIELDS[field] as readonly string[]).includes(componentCode)) continue;
      const factor = field === 'energyKcal' ? (unit === 'kcal' ? 1 : NaN) : UNIT_TO_GRAMS[unit];
      if (factor === undefined || Number.isNaN(factor)) {
        throw new Error(`Unexpected unit "${unit}" for ${componentCode}`);
      }
      fields[field] = { index, factor };
    }
  });
  return {
    code: code >= 0 ? code : 0,
    name: name >= 0 ? name : 1,
    nameEn: nameEn >= 0 ? nameEn : null,
    fields,
  };
}

/** A cell as a number: `null` = not stated; trace marks = 0. */
export function blsNumber(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string') return null;
  const text = cell.trim();
  if (text === '' || text === '-' || text === '—') return null;
  if (ZERO_MARKS.has(text.toUpperCase())) return 0;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Maps all data rows (after the header) to compact foods; problems are reported, not hidden. */
export function mapBlsRows(rows: readonly Cell[][]): { foods: BlsFood[]; report: MappingReport } {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => typeof cell === 'string' && HEADER.test(cell)),
  );
  if (headerIndex < 0) throw new Error('No BLS header row found (nutrient columns missing)');
  const columns = mapColumns(rows[headerIndex] ?? []);
  const missingColumns = FIELD_ORDER.filter((field) => !columns.fields[field]);
  const missingRequired = REQUIRED_FIELDS.filter((field) => missingColumns.includes(field));
  if (missingRequired.length > 0) {
    throw new Error(`Required BLS columns missing: ${missingRequired.join(', ')}`);
  }

  const report: MappingReport = {
    rows: 0,
    imported: 0,
    skipped: [],
    missingColumns,
    missingOptional: Object.fromEntries(FIELD_ORDER.map((f) => [f, 0])) as Record<BlsField, number>,
  };
  const seen = new Set<string>();
  const foods: BlsFood[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const codeCell = row[columns.code];
    const nameCell = row[columns.name];
    if (codeCell == null && nameCell == null) continue;
    report.rows += 1;
    const code = String(codeCell ?? '').trim();
    const name = typeof nameCell === 'string' ? nameCell.replace(/\s+/g, ' ').trim() : '';
    const skip = (reason: string) => report.skipped.push({ code, name, reason });
    if (!/^[A-Z0-9]{2,12}$/i.test(code)) {
      skip('invalid code');
      continue;
    }
    if (seen.has(code)) {
      skip('duplicate code');
      continue;
    }
    if (name === '') {
      skip('missing name');
      continue;
    }

    const values = Object.fromEntries(
      FIELD_ORDER.map((field) => {
        const column = columns.fields[field];
        const raw = column ? blsNumber(row[column.index] ?? null) : null;
        return [field, raw === null || !column ? null : round(raw * column.factor)];
      }),
    ) as Record<BlsField, number | null>;

    const missing = REQUIRED_FIELDS.filter((field) => values[field] === null);
    if (missing.length > 0) {
      skip(`required value missing: ${missing.join(', ')}`);
      continue;
    }
    const invalid = FIELD_ORDER.filter((field) => {
      const value = values[field];
      if (value === null) return false;
      const max = field === 'energyKcal' ? LIMITS.energyKcal : LIMITS.grams;
      return value < 0 || value > max;
    });
    if (invalid.length > 0) {
      skip(`implausible value: ${invalid.join(', ')}`);
      continue;
    }
    const sum = (values.proteinG ?? 0) + (values.carbsG ?? 0) + (values.fatG ?? 0);
    if (sum > LIMITS.macroSum) {
      skip('protein + carbohydrates + fat above 100 g');
      continue;
    }

    for (const field of FIELD_ORDER) if (values[field] === null) report.missingOptional[field] += 1;
    const nameEnCell = columns.nameEn === null ? null : row[columns.nameEn];
    seen.add(code);
    foods.push({
      code,
      name,
      nameEn: typeof nameEnCell === 'string' && nameEnCell.trim() ? nameEnCell.trim() : null,
      values,
    });
  }
  foods.sort((a, b) => a.code.localeCompare(b.code));
  report.imported = foods.length;
  return { foods, report };
}

/** Compact runtime format: one array per food, fields in `fields` order. */
export const RUNTIME_FIELDS = ['code', 'name', 'nameEn', ...FIELD_ORDER] as const;

export function toRuntimeRows(foods: readonly BlsFood[]): (string | number | null)[][] {
  return foods.map((food) => [
    food.code,
    food.name,
    food.nameEn,
    ...FIELD_ORDER.map((f) => food.values[f]),
  ]);
}
