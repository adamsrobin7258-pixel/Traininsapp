import type { MatchAssessment, QueryAnalysis } from './foodRanking';
import type { Nutrients } from './nutrients';

/**
 * Reference food data shipped with the app (e.g. the BLS). It is part of the installation:
 * searching it never needs a connection and never sends anything anywhere.
 */
export interface ReferenceFood {
  /** Dataset id, e.g. "bls". */
  dataset: string;
  /** Identifier in the dataset (BLS code). */
  code: string;
  version: string;
  name: string;
  /** English name, when the dataset has one. */
  nameEn: string | null;
  /** Per 100 g edible portion. Detail values may be unknown (`null`, never 0). */
  nutrients: Nutrients;
}

/** Facts for the attribution ("Datenquellen"). */
export interface ReferenceDatasetInfo {
  id: string;
  name: string;
  version: string;
  publisher: string;
  license: string;
  attribution: string;
  /** Date of the import (YYYY-MM-DD). */
  importedAt: string;
  count: number;
}

export interface ReferenceCatalog {
  readonly id: string;
  /** `null` when no data is bundled (e.g. a build without imported dataset). */
  info(): Promise<ReferenceDatasetInfo | null>;
  /** Best matches first; an empty query returns []. */
  search(query: string, limit: number): Promise<ReferenceFood[]>;
  /**
   * The `limit` most relevant foods for an analysed query with their relevance (see
   * `foodRanking.ts`). `lang` decides which name counts as the main one.
   */
  rank(
    query: QueryAnalysis,
    limit: number,
    options?: { lang?: 'de' | 'en' },
  ): Promise<RankedReference[]>;
  get(code: string): Promise<ReferenceFood | null>;
}

/** A reference food with its relevance for a search (higher is better). */
export interface RankedReference {
  reference: ReferenceFood;
  score: number;
  /** The decision behind the score (Phase 29): match, partial or weak, with its diagnosis. */
  match: MatchAssessment;
}
