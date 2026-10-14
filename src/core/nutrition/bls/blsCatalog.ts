import { NutritionError } from '../errors';
import { areValidNutrients, type Nutrients } from '../nutrients';
import { blsCategory } from '../category';
import {
  analyzeQuery,
  compareRanked,
  prepareName,
  relevance,
  type PreparedName,
  type QueryAnalysis,
} from '../foodRanking';
import type {
  RankedReference,
  ReferenceCatalog,
  ReferenceDatasetInfo,
  ReferenceFood,
} from '../reference';

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
  /** German name and, when the dataset has it, the English one – prepared for ranking. */
  de: PreparedName;
  en: PreparedName | null;
  /** BLS main groups X and Y: dishes and recipes, ranked after the plain food. */
  dish: boolean;
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
      de: prepareName(name, 'de'),
      en: food.nameEn ? prepareName(food.nameEn, 'en') : null,
      dish: blsCategory(code) === 'dishes',
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
    return (await this.rank(analyzeQuery(query), limit)).map((match) => match.reference);
  }

  /**
   * Relevance ranking over all entries (Phase 27, `foodRanking.ts`): the meaning of the name
   * counts, not just any text match. The BLS has no brands – a brand-only query finds nothing
   * here, a query with a retailer ("Quark Lidl") still finds the plain food.
   */
  async rank(
    query: QueryAnalysis,
    limit: number,
    { lang = 'de' }: { lang?: 'de' | 'en' } = {},
  ): Promise<RankedReference[]> {
    if (query.words.length === 0) return [];
    const matches: { score: number; name: string; reference: ReferenceFood }[] = [];
    for (const entry of (await this.data()).entries) {
      const names =
        lang === 'en' && entry.en
          ? [entry.en, entry.de]
          : entry.en
            ? [entry.de, entry.en]
            : [entry.de];
      const score = relevance({ names, dish: entry.dish }, query);
      if (score !== null) matches.push({ score, name: entry.food.name, reference: entry.food });
    }
    return matches
      .sort(compareRanked)
      .slice(0, limit)
      .map(({ reference, score }) => ({ reference, score }));
  }

  async get(code: string): Promise<ReferenceFood | null> {
    return (await this.data()).byCode.get(code) ?? null;
  }
}
