import { NutritionError } from '../errors';
import { areValidNutrients, type Nutrients } from '../nutrients';
import type { ReferenceCatalog, ReferenceDatasetInfo, ReferenceFood } from '../reference';
import { bestScore, compareMatches, searchKey, searchWords, type SearchKey } from '../search';

export const BLS_DATASET_ID = 'bls';

/** Layout of the generated file (scripts/nutrition/import-bls.ts writes it). */
export interface BlsDataFile {
  meta: {
    dataset: string;
    version: string;
    publisher: string;
    license: string;
    attribution: string;
    importedAt: string;
    count: number;
  } | null;
  fields: string[];
  foods: (string | number | null)[][];
}

const FIELDS = [
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
] as const;

interface Entry {
  food: ReferenceFood;
  /** German name, plus the English one when the dataset has it. */
  keys: SearchKey[];
}

interface Loaded {
  info: ReferenceDatasetInfo | null;
  entries: Entry[];
  byCode: Map<string, ReferenceFood>;
}

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** Checks and converts the generated data; a damaged file fails loudly instead of silently. */
export function parseBlsData(data: BlsDataFile): Loaded {
  if (data.fields.join() !== FIELDS.join()) throw new NutritionError('invalid-value');
  const version = data.meta?.version ?? '';
  const entries: Entry[] = [];
  const byCode = new Map<string, ReferenceFood>();
  for (const row of data.foods) {
    const [code, name, nameEn] = row;
    const [kcal, protein, carbs, fat, fiber, sugar, saturated] = row.slice(3).map(num);
    if (typeof code !== 'string' || typeof name !== 'string') continue;
    if (kcal == null || protein == null || carbs == null || fat == null) continue;
    const nutrients: Nutrients = {
      energyKcal: kcal,
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
      fiberG: fiber ?? null,
      sugarG: sugar ?? null,
      saturatedFatG: saturated ?? null,
    };
    if (!areValidNutrients(nutrients)) continue;
    const food: ReferenceFood = {
      dataset: BLS_DATASET_ID,
      code,
      version,
      name,
      nameEn: typeof nameEn === 'string' ? nameEn : null,
      nutrients,
    };
    byCode.set(code, food);
    entries.push({
      food,
      keys: food.nameEn ? [searchKey(name), searchKey(food.nameEn)] : [searchKey(name)],
    });
  }
  const info: ReferenceDatasetInfo | null =
    data.meta && entries.length > 0
      ? {
          id: BLS_DATASET_ID,
          name: data.meta.dataset,
          version,
          publisher: data.meta.publisher,
          license: data.meta.license,
          attribution: data.meta.attribution,
          importedAt: data.meta.importedAt,
          count: entries.length,
        }
      : null;
  return { info, entries, byCode };
}

/**
 * The Bundeslebensmittelschlüssel as offline catalog. The data is loaded on first use (it is a
 * separate chunk of the app, not downloaded) and searched in memory: the names are normalised
 * once, a search only compares prepared strings.
 */
export class BlsCatalog implements ReferenceCatalog {
  readonly id = BLS_DATASET_ID;
  private loading: Promise<Loaded> | null = null;

  constructor(private readonly load: () => Promise<BlsDataFile>) {}

  private data(): Promise<Loaded> {
    // A failed load (e.g. a chunk that could not be read) is retried on the next use.
    this.loading ??= this.load()
      .then(parseBlsData)
      .catch((error: unknown) => {
        this.loading = null;
        throw error;
      });
    return this.loading;
  }

  async info(): Promise<ReferenceDatasetInfo | null> {
    return (await this.data()).info;
  }

  async search(query: string, limit: number): Promise<ReferenceFood[]> {
    const words = searchWords(query);
    if (words.length === 0) return [];
    const matches: { score: number; name: string; food: ReferenceFood }[] = [];
    for (const { food, keys } of (await this.data()).entries) {
      const score = bestScore(keys, words);
      if (score !== null) matches.push({ score, name: food.name, food });
    }
    return matches
      .sort(compareMatches)
      .slice(0, limit)
      .map((m) => m.food);
  }

  async get(code: string): Promise<ReferenceFood | null> {
    return (await this.data()).byCode.get(code) ?? null;
  }
}
