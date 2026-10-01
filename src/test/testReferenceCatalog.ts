import { BlsCatalog, type BlsDataFile } from '@/core/nutrition/bls';

/**
 * Synthetic stand-in for the bundled BLS data – invented test values in the layout of the
 * generated file, never real BLS records. Lets tests search reference foods without the
 * (large) real dataset.
 */
export const TEST_BLS_DATA: BlsDataFile = {
  meta: {
    dataset: 'BLS',
    version: '4.0',
    publisher: 'Max Rubner-Institut',
    license: 'kostenfrei nutzbar laut MRI (Dokumentation BLS 4.0, Kap. 9.3), Quellenangabe',
    attribution: 'Testdaten im BLS-Format (synthetisch)',
    importedAt: '2026-10-01',
    count: 6,
  },
  fields: [
    'code',
    'name',
    'nameEn',
    'energyKcal',
    'proteinG',
    'carbsG',
    'fatG',
    'fiberG',
    'sugarG',
    'saturatedFatG',
  ],
  foods: [
    ['T100001', 'Apfel, roh', 'Apple, raw', 52, 0.3, 11.4, 0.2, 2, 10.3, 0],
    ['T100002', 'Bratäpfel, gegart', 'Baked apples', 80, 0.4, 17, 0.3, 2.4, null, null],
    ['T100003', 'Hähnchenbrust, roh', 'Chicken breast, raw', 110, 23, 0, 1.5, 0, 0, 0.4],
    ['T100004', 'Haferflocken', 'Oat flakes', 370, 13.5, 58.7, 7, 10, 1.2, 1.3],
    ['T100005', 'Möhre, roh', 'Carrot, raw', 36, 0.9, 7.6, 0.2, 3.6, 4.7, 0],
    ['T100006', 'Weißkohl, gegart', null, 25, 1.4, 3.4, 0.2, 2.9, 3, null],
  ],
};

export function createTestReferenceCatalog(data: BlsDataFile = TEST_BLS_DATA): BlsCatalog {
  return new BlsCatalog(() => Promise.resolve(data));
}
