import { BlsCatalog, type BlsDataFile } from './blsCatalog';

export { BLS_DATASET_ID, BlsCatalog, parseBlsData, type BlsDataFile } from './blsCatalog';

/** The bundled BLS data, loaded lazily as its own chunk (no network involved). */
export function createBlsCatalog(): BlsCatalog {
  return new BlsCatalog(
    async (): Promise<BlsDataFile> => (await import('./data/bls.json')).default,
  );
}
