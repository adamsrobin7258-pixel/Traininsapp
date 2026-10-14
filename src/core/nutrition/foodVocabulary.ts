import { normalizeSearchText } from './search';

/**
 * Small, hand-kept vocabulary for the food search (Phase 27): words that mean the same food,
 * and retailers with their own brands. Everything is compared in normalised form
 * (`normalizeSearchText`: "Hühnerei" = "huhnerei"). The lists stay deliberately short and
 * certain – a wrong synonym would push wrong foods up.
 */

/** Groups of words that name the same food (German and English). */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['ei', 'eier', 'huhnerei', 'egg', 'eggs'],
  ['hahnchen', 'huhnchen', 'huhn', 'chicken', 'geflugel'],
  ['quark', 'topfen', 'speisequark'],
  ['joghurt', 'jogurt', 'yoghurt', 'yogurt'],
  ['lachs', 'salmon'],
  ['banane', 'bananen', 'banana'],
  ['apfel', 'apple'],
  ['kartoffel', 'kartoffeln', 'erdapfel', 'potato'],
  ['tomate', 'tomaten', 'paradeiser', 'tomato'],
  ['hackfleisch', 'gehacktes', 'hack', 'minced meat'],
  ['milch', 'milk'],
  ['kase', 'cheese'],
  ['brot', 'bread'],
  ['reis', 'rice'],
  ['nudeln', 'teigwaren', 'pasta'],
  ['haferflocken', 'oats'],
  ['thunfisch', 'tuna'],
  ['rindfleisch', 'rind', 'beef'],
  ['schweinefleisch', 'schwein', 'pork'],
];

const SYNONYMS = new Map<string, readonly string[]>();
for (const group of SYNONYM_GROUPS) {
  const words = group.map(normalizeSearchText);
  for (const word of words)
    SYNONYMS.set(
      word,
      words.filter((other) => other !== word),
    );
}

/** Other words for the same food; empty when none is known. */
export function synonymsOf(word: string): readonly string[] {
  return SYNONYMS.get(word) ?? [];
}

/**
 * Retailers and the own brands their products carry in food databases (e.g. Lidl's dairy
 * products are labelled "Milbona"). A retailer in the query ("Quark Lidl") is matched against
 * the brand and the stores of a product. Only long-established, well-known own brands.
 */
const RETAILERS: Readonly<Record<string, readonly string[]>> = {
  lidl: ['milbona', 'pilos', 'cien', 'solevita', 'crownfield', 'chef select', 'alesto', 'freeway'],
  aldi: ['milsani', 'moser roth', 'choceur', 'golden bridge', 'gut bio'],
  rewe: ['ja', 'rewe beste wahl', 'rewe bio'],
  edeka: ['gut gunstig', 'edeka bio'],
  kaufland: ['k classic', 'k bio'],
  netto: ['gut gunstig'],
  penny: ['penny'],
  dm: ['dmbio'],
};

/** Normalised retailer names, e.g. "lidl". */
export const RETAILER_NAMES: readonly string[] = Object.keys(RETAILERS);

/** The own brands of a retailer (normalised); empty for an unknown name. */
export function retailerBrands(retailer: string): readonly string[] {
  return RETAILERS[retailer] ?? [];
}

/**
 * Words after which the rest of a name describes an addition, not the food itself:
 * "Kalbshirn gebraten **mit** Ei" is brain, not egg.
 */
export const CONNECTOR_WORDS: ReadonlySet<string> = new Set([
  'mit',
  'und',
  'in',
  'im',
  'auf',
  'an',
  'aus',
  'nach',
  'von',
  'vom',
  'zum',
  'zur',
  'ohne',
  'with',
  'and',
  'on',
  'without',
  'from',
]);

/** A following food word is excluded rather than added ("ohne Ei"). */
export const NEGATION_WORDS: ReadonlySet<string> = new Set(['ohne', 'without']);

/** The plain, unprocessed form of a food ("Hühnerei roh") – a small hint for ties. */
export const RAW_WORDS: ReadonlySet<string> = new Set(['roh', 'raw', 'frisch', 'fresh']);
