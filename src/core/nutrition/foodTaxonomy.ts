import { normalizeSearchText } from './search';

/**
 * Kalethra's small, offline food taxonomy (Phase 29): what kind of food a word names. The
 * search uses it to understand a query ("Milbona Käse" = brand Milbona AND kind cheese) and to
 * recognise what a product *is* from its name ("Milbona Gouda" is cheese, "Cheeseburger" is a
 * burger). Everything is compared in normalised form (`normalizeSearchText`). The lists stay
 * deliberately short and certain – a wrong entry would put wrong products into "Passende
 * Lebensmittel". Bump `TAXONOMY_VERSION` with every change, so tests and docs can name it.
 */
export const TAXONOMY_VERSION = 1;

interface KindDefinition {
  /** Words that name the kind itself ("käse", "cheese"). */
  terms: readonly string[];
  /**
   * Well-known foods of this kind whose name does not contain a term ("Gouda" is cheese,
   * "Spiegelei" is an egg). Matched as a whole word or as the end of a compound.
   */
  members?: readonly string[];
  /**
   * Compounds that end like a term but are something else: "Leberkäse" is meat loaf, not
   * cheese. A pure substring rule would get these wrong.
   */
  falseFriends?: readonly string[];
}

/** Foods people search for. `id` is internal (diagnosis, tests), never shown. */
const FOOD_KINDS: Readonly<Record<string, KindDefinition>> = {
  cheese: {
    terms: ['käse', 'cheese', 'cheeses'],
    members: [
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
      'gruyère',
      'halloumi',
      'mascarpone',
      'ricotta',
      'gorgonzola',
      'raclette',
      'manchego',
      'pecorino',
    ],
    falseFriends: ['leberkäse', 'fleischkäse', 'schweinskäse', 'kalbskäse'],
  },
  quark: { terms: ['quark', 'topfen', 'speisequark'] },
  yogurt: { terms: ['joghurt', 'jogurt', 'yoghurt', 'yogurt'] },
  skyr: { terms: ['skyr'] },
  milk: { terms: ['milch', 'milk'] },
  plantDrink: {
    terms: ['haferdrink', 'sojadrink', 'mandeldrink', 'reisdrink', 'pflanzendrink'],
  },
  egg: {
    terms: ['ei', 'eier', 'egg', 'eggs'],
    members: ['hühnerei', 'spiegelei', 'rührei', 'eigelb', 'eiklar', 'eiweiß', 'wachtelei'],
  },
  oats: { terms: ['haferflocken', 'oats', 'oat flakes'] },
  rice: { terms: ['reis', 'rice'] },
  pasta: {
    terms: ['nudeln', 'teigwaren', 'pasta', 'noodles'],
    members: [
      'spaghetti',
      'penne',
      'fusilli',
      'farfalle',
      'tagliatelle',
      'makkaroni',
      'rigatoni',
      'spätzle',
    ],
  },
  poultry: {
    terms: ['hähnchen', 'hühnchen', 'huhn', 'chicken', 'geflügel', 'pute', 'truthahn', 'turkey'],
    members: ['hähnchenbrust', 'hähnchenbrustfilet', 'hähnchenschenkel', 'putenbrust'],
  },
  fish: {
    terms: ['fisch', 'fish'],
    members: [
      'lachs',
      'salmon',
      'forelle',
      'kabeljau',
      'seelachs',
      'hering',
      'makrele',
      'sardine',
      'thunfisch',
      'tuna',
    ],
  },
  fruit: {
    terms: ['obst', 'fruit'],
    members: ['banane', 'bananen', 'banana', 'apfel', 'äpfel', 'apple', 'birne', 'orange'],
  },
  bread: { terms: ['brot', 'bread', 'brötchen', 'toast'] },
};

/**
 * Products that are *something else* – dishes, sweets, snacks. Never a search target of their
 * own here; they only tell the search that "Cheeseburger" or "Milbona Pudding" is no cheese.
 */
const OTHER_KINDS: readonly string[] = [
  'burger',
  'pudding',
  'pizza',
  'kuchen',
  'torte',
  'auflauf',
  'lasagne',
  'suppe',
  'eintopf',
  'soße',
  'sauce',
  'dip',
  'riegel',
  'keks',
  'kekse',
  'plätzchen',
  'schokolade',
  'chips',
  'wrap',
  'sandwich',
  'salat',
  'dessert',
  'creme',
  'likör',
  'nuggets',
  'stollen',
  'waffeln',
  'gebäck',
  'snack',
];

/**
 * Words that name a variant of a product: "Zero", "Light", "High Protein" or the "mager" in
 * "Magerquark". They narrow a search, they never name the food itself.
 */
export const VARIANT_WORDS: ReadonlySet<string> = new Set(
  [
    'zero',
    'light',
    'leicht',
    'protein',
    'high',
    'mager',
    'magerstufe',
    'fettarm',
    'laktosefrei',
    'vegan',
    'natur',
    'vollkorn',
    'brust',
    'filet',
    'schenkel',
    'keule',
  ].map(normalizeSearchText),
);

/**
 * False friends of one word only: "Seelachs" is pollock, not salmon – but still a fish, so it
 * cannot be a false friend of the whole kind. "Lachsschinken" is ham.
 */
const WORD_FALSE_FRIENDS: Readonly<Record<string, readonly string[]>> = {
  lachs: ['seelachs', 'lachsschinken'],
};

/** Cuts that do not change the food: a salmon fillet is salmon ("Lachs roh" for "Lachsfilet"). */
export const PLAIN_CUTS: ReadonlySet<string> = new Set(['filet', 'steak']);

/** Prefixes that make a compound a variant of its kind: "Mager|quark", "Vollkorn|nudeln". */
const VARIANT_PREFIXES = ['mager', 'sahne', 'vollkorn', 'vollmilch', 'natur', 'frisch'].map(
  normalizeSearchText,
);
/** Suffixes that name a cut or form: "Hähnchen|brust", "Lachs|filet". */
const VARIANT_SUFFIXES = ['brust', 'brustfilet', 'filet', 'schenkel', 'keule', 'steak'].map(
  normalizeSearchText,
);

/**
 * Well-known brands, so "Barilla Spaghetti" or "Coca Cola Zero" is understood without any
 * product stored on the device. Brands of stored and found products are added at search time.
 */
export const KNOWN_BRANDS: readonly string[] = [
  'coca cola',
  'barilla',
  'ehrmann',
  'müller',
  'alpro',
  'oatly',
  'danone',
  'arla',
  'weihenstephan',
  'landliebe',
  'zott',
  'exquisa',
  'philadelphia',
  'nutella',
  'ferrero',
  'haribo',
  'dr oetker',
  'iglo',
  'frosta',
  'kerrygold',
  'milram',
  'kölln',
  'seitenbacher',
  'pepsi',
  'knorr',
  'maggi',
  'rügenwalder',
  'wiesenhof',
].map(normalizeSearchText);

// ── Prepared lookups ─────────────────────────────────────────────────────────

interface PreparedKind {
  id: string;
  terms: string[];
  members: string[];
  falseFriends: string[];
}

const KINDS: PreparedKind[] = Object.entries(FOOD_KINDS).map(([id, kind]) => ({
  id,
  terms: kind.terms.map(normalizeSearchText),
  members: (kind.members ?? []).map(normalizeSearchText),
  falseFriends: (kind.falseFriends ?? []).map(normalizeSearchText),
}));
const OTHER = OTHER_KINDS.map(normalizeSearchText);

/** Compound ends count from this length on – "ei" alone would match "Brei" and "Allerlei". */
const MIN_COMPOUND_END = 4;

function isFalseFriend(kind: PreparedKind, word: string): boolean {
  return kind.falseFriends.some((friend) => word.endsWith(friend));
}

/** The kind a query word asks for ("käse" → cheese, "gouda" → cheese); `null` if unknown. */
export function kindOfQueryWord(word: string): string | null {
  for (const kind of KINDS) {
    if (kind.terms.includes(word) || kind.members.includes(word)) return kind.id;
  }
  return decomposeQueryWord(word)?.kind ?? null;
}

/**
 * What a single word of a product name says the product *is*: a food kind, another kind of
 * product ("burger", "pudding" – prefixed `other:`), or `null`. Whole words and compound ends
 * count ("Scheiben|käse", "Cheese|burger"); a false friend ("Leberkäse") counts as nothing.
 */
export function kindOfNameWord(word: string): string | null {
  for (const kind of KINDS) {
    if (isFalseFriend(kind, word)) return null;
    if (kind.terms.includes(word) || kind.members.includes(word)) return kind.id;
  }
  for (const other of OTHER) {
    if (word === other || (other.length >= MIN_COMPOUND_END && word.endsWith(other))) {
      return `other:${other}`;
    }
  }
  for (const kind of KINDS) {
    const ends = [...kind.terms, ...kind.members].filter((t) => t.length >= MIN_COMPOUND_END);
    if (ends.some((end) => word.endsWith(end))) return kind.id;
  }
  return null;
}

/** A query word that combines a kind and a variant: "magerquark", "hähnchenbrust". */
export interface Decomposition {
  kind: string;
  /** The word of the kind inside the query word ("quark"). */
  base: string;
  variant: string;
}

export function decomposeQueryWord(word: string): Decomposition | null {
  for (const kind of KINDS) {
    for (const base of [...kind.terms, ...kind.members]) {
      if (base.length < MIN_COMPOUND_END || base === word) continue;
      const prefix = word.endsWith(base) ? word.slice(0, -base.length) : null;
      if (prefix && VARIANT_PREFIXES.includes(prefix)) {
        return { kind: kind.id, base, variant: prefix };
      }
      const suffix = word.startsWith(base) ? word.slice(base.length) : null;
      if (suffix && VARIANT_SUFFIXES.includes(suffix)) {
        return { kind: kind.id, base, variant: suffix };
      }
    }
  }
  return null;
}

/**
 * Well-known members of the kind a query word *names* ("käse" → gouda, edamer, …). A member
 * itself asks for nothing else: "Gouda" never finds Edamer.
 */
export function membersOfTerm(word: string): readonly string[] {
  return KINDS.find((kind) => kind.terms.includes(word))?.members ?? [];
}

/** Whether a name word is a false friend of what a query word asks for ("Leberkäse"). */
export function isFalseFriendOf(queryWord: string, nameWord: string): boolean {
  const own = WORD_FALSE_FRIENDS[normalizeSearchText(queryWord)] ?? [];
  if (own.map(normalizeSearchText).some((friend) => nameWord.includes(friend))) return true;
  const kind = KINDS.find((k) => k.terms.includes(queryWord));
  return kind ? isFalseFriend(kind, nameWord) : false;
}
