// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  blsNumber,
  mapBlsRows,
  mapColumns,
  toRuntimeRows,
} from '../scripts/nutrition/bls-mapping.ts';
import { readFirstSheet } from '../scripts/nutrition/xlsx.ts';

const fixture = readFileSync(resolve(import.meta.dirname, 'fixtures/bls-synthetic.xlsx'));

describe('BLS import (synthetic fixture in the official table layout)', () => {
  it('reads the worksheet with the header row and empty cells', () => {
    const rows = readFirstSheet(fixture);
    expect(rows[0]?.[0]).toBe('BLS Code');
    expect(rows[0]?.[3]).toBe('ENERCC Energie (Kilokalorien) [kcal/100g]');
    expect(rows[2]?.[8]).toBeNull(); // empty sugar cell
  });

  it('keeps the BLS code and maps the main and optional nutrients', () => {
    const { foods } = mapBlsRows(readFirstSheet(fixture));
    const oats = foods.find((f) => f.code === 'T100001');
    expect(oats).toEqual({
      code: 'T100001',
      name: 'Testhafer, Flocken (synthetisch)',
      nameEn: 'Test oats (synthetic)',
      values: {
        energyKcal: 370,
        proteinG: 13.5,
        carbsG: 58.7,
        fatG: 7,
        fiberG: 10,
        sugarG: 1.2,
        saturatedFatG: 1.3,
      },
    });
  });

  it('keeps missing values missing and reads trace marks as 0', () => {
    const { foods, report } = mapBlsRows(readFirstSheet(fixture));
    const apple = foods.find((f) => f.code === 'T100002');
    expect(apple?.values.sugarG).toBeNull();
    expect(apple?.values.saturatedFatG).toBe(0);
    const milk = foods.find((f) => f.code === 'T100003');
    expect(milk?.values.fiberG).toBeNull();
    expect(milk?.values.proteinG).toBe(3.3); // decimal comma
    expect(report.missingOptional.sugarG).toBe(1);
    expect(report.missingOptional.fiberG).toBe(1);
  });

  it('skips incomplete, implausible, duplicate and code-less rows with a reason', () => {
    const { foods, report } = mapBlsRows(readFirstSheet(fixture));
    expect(foods.map((f) => f.code)).toEqual(['T100001', 'T100002', 'T100003', 'T100006']);
    expect(report.skipped.map((s) => [s.code, s.reason])).toEqual([
      ['T100004', 'required value missing: proteinG'],
      ['T100005', 'implausible value: energyKcal'],
      ['T100001', 'duplicate code'],
      ['', 'invalid code'],
    ]);
    expect(report.rows).toBe(8);
    expect(report.imported).toBe(4);
  });

  it('converts milligrams and rejects unknown units', () => {
    const columns = mapColumns([
      'BLS Code',
      'Lebensmittelbezeichnung',
      'ENERCC Energie [kcal/100g]',
      'FIBT Ballaststoffe [mg/100g]',
    ]);
    expect(columns.fields.fiberG).toEqual({ index: 3, factor: 0.001 });
    expect(() => mapColumns(['BLS Code', 'ENERCC Energie [kJ/100g]'])).toThrow(/Unexpected unit/);
  });

  it('fails loudly when a required column is missing', () => {
    expect(() =>
      mapBlsRows([['BLS Code', 'Lebensmittelbezeichnung', 'ENERCC Energie [kcal/100g]']]),
    ).toThrow(/Required BLS columns missing/);
  });

  it('interprets cells strictly', () => {
    expect(blsNumber(null)).toBeNull();
    expect(blsNumber('')).toBeNull();
    expect(blsNumber('-')).toBeNull();
    expect(blsNumber('TR')).toBe(0);
    expect(blsNumber('<LOD')).toBe(0);
    expect(blsNumber('1,5')).toBe(1.5);
    expect(blsNumber('k. A.')).toBeNull();
  });

  it('writes a compact row per food', () => {
    const { foods } = mapBlsRows(readFirstSheet(fixture));
    expect(toRuntimeRows(foods)[1]).toEqual([
      'T100002',
      'Testapfel, roh (synthetisch)',
      'Test apple (synthetic)',
      54,
      0.3,
      12,
      0.2,
      2.2,
      null,
      0,
    ]);
  });
});
