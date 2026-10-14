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

/**
 * Kinds of food and well-known names of that kind that do not contain the word itself
 * (Phase 28): "Milbona Gouda" is a cheese although "Käse" is not in its name. Only clear,
 * common members – the name of the kind itself always ranks higher (see `foodRanking.ts`).
 */
const KIND_GROUPS: Readonly<Record<string, readonly string[]>> = {
  kase: [
    'gouda',
    'edamer',
    'emmentaler',
    'mozzarella',
    'camembert',
    'brie',
    'feta',
    'parmesan',
    'cheddar',
    'tilsiter',
    'leerdammer',
    'maasdamer',
    'appenzeller',
    'gruyere',
    'halloumi',
    'mascarpone',
    'ricotta',
    'gorgonzola',
    'raclette',
    'manchego',
    'pecorino',
  ],
  nudeln: ['spaghetti', 'penne', 'fusilli', 'farfalle', 'tagliatelle', 'makkaroni', 'rigatoni'],
  wurst: ['salami', 'mortadella', 'cervelat', 'lyoner'],
  fisch: ['lachs', 'forelle', 'kabeljau', 'seelachs', 'hering', 'makrele', 'sardine'],
};

const KINDS = new Map<string, readonly string[]>();
for (const [kind, members] of Object.entries(KIND_GROUPS)) {
  const normalised = members.map(normalizeSearchText);
  KINDS.set(kind, normalised);
  for (const synonym of synonymsOf(kind)) KINDS.set(synonym, normalised);
}

/** Names of the kind a query word asks for ("kase" → "gouda", …); empty when none is known. */
export function kindMembersOf(word: string): readonly string[] {
  return KINDS.get(word) ?? [];
}

/**
 * Compounds that end with a food word but are something else: "Leberkäse" and "Fleischkäse"
 * are meat loaf, not cheese; "Eierlikör" is already caught by the compound rule (Phase 28).
 */
const FALSE_COMPOUNDS: Readonly<Record<string, readonly string[]>> = {
  kase: ['leberkase', 'fleischkase', 'schweinskase', 'kalbskase'],
};

/** Whether a name word only *looks* like a compound of the query word ("Leberkäse" ≠ Käse). */
export function isFalseCompound(word: string, nameWord: string): boolean {
  return (FALSE_COMPOUNDS[word] ?? []).some((compound) => nameWord.endsWith(compound));
}

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
