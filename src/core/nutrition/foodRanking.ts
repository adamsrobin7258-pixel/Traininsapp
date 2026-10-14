import {
  decomposeQueryWord,
  kindOfNameWord,
  PLAIN_CUTS,
  kindOfQueryWord,
  KNOWN_BRANDS,
  TAXONOMY_VERSION,
  VARIANT_WORDS,
  type Decomposition,
} from './foodTaxonomy';
import {
  CONNECTOR_WORDS,
  isFalseCompound,
  kindMembersOf,
  NEGATION_WORDS,
  RAW_WORDS,
  RETAILER_NAMES,
  retailerBrands,
  synonymsOf,
} from './foodVocabulary';
import type { ProductQuality } from './productQuality';
import { normalizeSearchText, searchWords } from './search';

/**
 * Relevance of a food for a search (Phase 27). Unlike a plain text match it asks what the name
 * *means*:
 *
 * - The **head** of a name is the food itself, the rest describes it: in "Kalbshirn gebraten
 *   mit Ei" the head is "Kalbshirn gebraten", "Ei" is only an addition. Commas, brackets and
 *   connector words ("mit", "und", "in", …) end the head.
 * - German compounds carry their meaning at the **end**: "Hühnerei" is an egg, "Magerquark" is
 *   quark – but "Eierlikör" is a liqueur. A query word at the end of a name word counts almost
 *   like the word itself, at its start only weakly, somewhere inside barely.
 * - Dishes and recipes (BLS main groups X and Y) rank after the plain food with the same match.
 * - Retailers and brands in the query ("Quark Lidl", "Milbona") are recognised separately and
 *   only raise matching products – they never hide other foods.
 * - Personal use and own foods add a **bounded** bonus (see `usageBonus`), never more than the
 *   gap between two match levels.
 * - Phase 28: every source – own foods, saved products, the BLS and Open Food Facts – is ranked
 *   by this one function. A known kind counts ("Gouda" is a cheese, as is a product in the Open
 *   Food Facts category "cheeses"), and a product that carries the brand *and* the kind asked
 *   for gets an extra bonus. The source itself is at most a small bonus (`RankCandidate.bonus`).
 *
 * Phase 29 – understand first, then filter, then sort:
 *
 * 1. `analyzeQuery` reads the query with the local taxonomy (`foodTaxonomy.ts`): brand or
 *    retailer, kind ("Käse"), variant ("Zero", "Mager|quark"), quantity.
 * 2. `assessMatch` decides per candidate – *before* any sorting – whether it is a **match**
 *    (every requirement met: brand and kind together), a **partial** match (only the brand,
 *    only the kind, or the kind only as a modifier: "Cheeseburger"), a **weak** match (the
 *    word only in an addition, a slip of the pen) or **excluded**. What a product *is* comes
 *    from its name; a category only confirms and never overrules a name ("Burger" in the
 *    category cheeses stays a burger). Every decision carries a diagnosis with its reasons.
 * 3. `compareRanked` sorts lexicographically: decision, then the level of the name match, then
 *    the score. Personal use and the source only move a food within its level – they can
 *    never lift a weaker match above a clearer one.
 *
 * Scores are plain numbers (higher is better) so the ordering stays explainable and testable.
 */

/** A name prepared once for repeated ranking. */
export interface PreparedName {
  /** Normalised words of the whole name. */
  words: string[];
  /** How many of the first words form the head (the food itself). */
  head: number;
  /** Index of the first word after a connector ("mit", "aus", …) – an addition. */
  additionFrom: number;
  /** Index of the first word after a negation ("ohne"), `words.length` when there is none. */
  negatedFrom: number;
  /** Normalised full name and the same without spaces. */
  text: string;
  compact: string;
  /** The name states the plain, raw form ("roh"). */
  raw: boolean;
  /**
   * English names put the food at the *end* of the head ("chicken egg", "egg noodles" are
   * noodles); German compounds carry it inside the word, the head starts with the food.
   */
  lang: 'de' | 'en';
}

/** Splits the raw name at the first comma or bracket before normalising: "Apfel, roh". */
export function prepareName(name: string, lang: 'de' | 'en' = 'de'): PreparedName {
  const text = normalizeSearchText(name);
  const words = text === '' ? [] : text.split(' ');
  const cut = name.search(/[,(;/]/);
  const headText = normalizeSearchText(cut === -1 ? name : name.slice(0, cut));
  const headWords = headText === '' ? [] : headText.split(' ');
  let head = Math.min(headWords.length, words.length);
  const connector = words.findIndex((word, index) => index > 0 && CONNECTOR_WORDS.has(word));
  if (connector !== -1) head = Math.min(head, connector);
  const negation = words.findIndex((word) => NEGATION_WORDS.has(word));
  return {
    words,
    head: Math.max(1, head),
    additionFrom: connector === -1 ? words.length : connector,
    negatedFrom: negation === -1 ? words.length : negation,
    text,
    compact: text.replace(/ /g, ''),
    raw: words.some((word) => RAW_WORDS.has(word)),
    lang,
  };
}

/** One food word of a query, as the taxonomy understands it. */
export interface QueryKind {
  word: string;
  /** Kind of food ("cheese"), `null` when the taxonomy does not know the word. */
  kind: string | null;
  /** Variant inside the word ("mager" in "magerquark"), else `null`. */
  variant: string | null;
}

/** What a query asks for – the requirements a match has to meet (Phase 29). */
export interface QueryAnalysis {
  words: string[];
  /** Words that must be found in the food's name (kind, variant, description). */
  foodWords: string[];
  /** Words recognised as retailer or brand ("lidl", "milbona", "coca", "cola"). */
  brandWords: string[];
  /** Normalised brand texts that satisfy the brand words (retailer → its own brands). */
  brandTargets: string[];
  /** The recognised brands and retailers as phrases ("coca cola", "lidl"). */
  brands: string[];
  /** Retailers among them ("lidl") – also met by the shops a product is sold in. */
  retailers: string[];
  /** Kind and variant of each food word. */
  kinds: QueryKind[];
  /** Variant words ("zero", "light", "mager") – they narrow, they never name the food. */
  variants: string[];
  /** A quantity or package size in the query ("500 g"); never a requirement. */
  quantity: string | null;
  /** Interpretations that are not certain – kept conservative, listed for the diagnosis. */
  notes: string[];
  /** Version of the taxonomy that read the query. */
  taxonomy: number;
}

const QUANTITY = /^(\d+(?:[.,]\d+)?)(g|kg|ml|l|cl)?$/;
const UNITS = new Set(['g', 'kg', 'ml', 'l', 'cl']);

/** Finds a brand phrase ("coca cola") at `index` of the query words; longest first. */
function brandAt(words: readonly string[], index: number, brands: readonly string[]) {
  let best: string | null = null;
  for (const brand of brands) {
    const parts = brand.split(' ');
    if (parts.every((part, offset) => words[index + offset] === part)) {
      if (!best || parts.length > best.split(' ').length) best = brand;
    }
  }
  return best;
}

/**
 * Reads a query: retailer and brand words (well-known brands, the retailers' own brands and
 * the brands of foods on this device or found online – `knownBrands`), a quantity, and the
 * food words with their kind and variant. Deterministic and local; when a word could be
 * brand *or* food, it stays a food word as well (conservative, noted in `notes`).
 */
export function analyzeQuery(query: string, knownBrands: Iterable<string> = []): QueryAnalysis {
  const allWords = searchWords(query);
  const brandSet = new Set<string>(KNOWN_BRANDS);
  for (const brand of knownBrands) {
    const normalised = normalizeSearchText(brand);
    if (normalised !== '') brandSet.add(normalised);
  }
  for (const retailer of RETAILER_NAMES)
    for (const own of retailerBrands(retailer)) brandSet.add(own);
  const brandList = [...brandSet];
  const notes: string[] = [];

  // A quantity ("500 g", "500g", "1,5 l") narrows nothing – it only prefers that size.
  let quantity: string | null = null;
  const words: string[] = [];
  allWords.forEach((word, index) => {
    const match = QUANTITY.exec(word);
    const unit = allWords[index + 1];
    if (match && (match[2] || (unit !== undefined && UNITS.has(unit)))) {
      quantity = `${match[1] ?? ''}${match[2] ?? unit ?? ''}`;
      return;
    }
    if (UNITS.has(word) && index > 0 && QUANTITY.test(allWords[index - 1] ?? '')) return;
    words.push(word);
  });

  const foodWords: string[] = [];
  const brandWords: string[] = [];
  const brandTargets = new Set<string>();
  const brands: string[] = [];
  const retailers: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    if (RETAILER_NAMES.includes(word)) {
      brandWords.push(word);
      brands.push(word);
      retailers.push(word);
      brandTargets.add(word);
      for (const own of retailerBrands(word)) brandTargets.add(own);
      continue;
    }
    // A brand phrase as a whole ("coca cola", "milbona").
    const phrase = word.length >= 3 ? brandAt(words, index, brandList) : null;
    if (phrase) {
      const length = phrase.split(' ').length;
      for (let offset = 0; offset < length; offset += 1)
        brandWords.push(words[index + offset] ?? '');
      brands.push(phrase);
      brandTargets.add(phrase);
      if (words.length === length && kindOfQueryWord(word) !== null) {
        // "Leerdammer" alone: a brand and a cheese – both readings stay.
        notes.push(`"${phrase}" may be a brand or a food`);
        foodWords.push(word);
      }
      index += length - 1;
      continue;
    }
    // Part of a known brand ("cola" of "coca cola") – only in a longer query, and uncertain.
    const partOf = word.length >= 3 ? brandList.filter((b) => b.split(' ').includes(word)) : [];
    if (partOf.length > 0 && words.length > 1 && kindOfQueryWord(word) === null) {
      brandWords.push(word);
      partOf.forEach((brand) => brandTargets.add(brand));
      brands.push(word);
      notes.push(`"${word}" read as part of a brand`);
      continue;
    }
    foodWords.push(word);
  }
  const kinds = foodWords.map((word): QueryKind => {
    const parts = decomposeQueryWord(word);
    return { word, kind: kindOfQueryWord(word), variant: parts?.variant ?? null };
  });
  const variants = [
    ...foodWords.filter((word) => VARIANT_WORDS.has(word)),
    ...kinds.flatMap((kind) => (kind.variant ? [kind.variant] : [])),
  ];
  // Only a brand ("Milbona"): its products – the food words are only an alternative.
  const brandOnly = brandWords.length > 0 && foodWords.length === 0;
  return {
    words,
    foodWords: brandOnly ? [] : foodWords,
    brandWords,
    brandTargets: [...brandTargets],
    brands,
    retailers,
    kinds,
    variants,
    quantity,
    notes,
    taxonomy: TAXONOMY_VERSION,
  };
}

/** Points of a word match, before position and kind (see `wordMatch`). */
const MATCH = {
  exact: 100,
  synonym: 88,
  /** The query word ends a compound: "Hühner|ei", "Mager|quark". */
  compoundEnd: 85,
  /** Spelling slip in a longer word: "Bananne". */
  typo: 40,
  /** The query word starts a word: "Eier|likör" for "Ei". */
  wordStart: 45,
  /** At least 4 letters starting the first word of a name – usually still typing. */
  typingStart: 65,
  /** Somewhere inside a word: "R|ei|s". */
  inside: 12,
  /** A well-known name of the kind asked for: "Gouda" for "Käse" (Phase 28). */
  kind: 78,
} as const;

/**
 * Whether `prefix` can end a word part before a short compound end. "Kartoffelbr|ei" cannot
 * ("br" only ever starts a syllable), so "Kartoffelbrei" is no egg – "Hühner|ei", "Spiegel|ei",
 * "Rühr|ei" are.
 */
function endsWordPart(prefix: string): boolean {
  if (prefix.length < 3) return false;
  const last = prefix.charAt(prefix.length - 1);
  const before = prefix.charAt(prefix.length - 2);
  // "h" stays out: "Rühr|ei" is an egg; "Allerl|ei" and "Kartoffelbr|ei" are not.
  const consonant = (c: string) => /[bcdfgjklmnpqrstvwxz]/.test(c);
  if ((last === 'r' || last === 'l') && consonant(before)) return false;
  return true;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a.charAt(i) === b.charAt(j)) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      // Swapped neighbours ("Banaen") count as one slip.
      if (a.charAt(i + 1) === b.charAt(j) && a.charAt(i) === b.charAt(j + 1)) {
        i += 2;
        j += 2;
        continue;
      }
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Best points of one query word against one name word. */
function wordMatch(nameWord: string, queryWord: string): number {
  let best = 0;
  const consider = (target: string, factor: number) => {
    let points = 0;
    if (nameWord === target) points = MATCH.exact;
    else if (isFalseCompound(target, nameWord)) points = MATCH.inside;
    else if (
      nameWord.endsWith(target) &&
      (target.length >= 4 || endsWordPart(nameWord.slice(0, -target.length)))
    ) {
      points = MATCH.compoundEnd;
    } else if (nameWord.startsWith(target)) points = MATCH.wordStart;
    else if (target.length >= 5 && nameWord.length >= 5 && editDistanceAtMostOne(nameWord, target))
      points = MATCH.typo;
    else if (nameWord.includes(target)) points = MATCH.inside;
    best = Math.max(best, Math.round(points * factor));
  };
  consider(queryWord, 1);
  for (const synonym of synonymsOf(queryWord)) consider(synonym, MATCH.synonym / MATCH.exact);
  // "Gouda" or "Bergkäse"-like compounds of a member for "Käse": a member of the kind, below
  // the kind's own name. Whole word or compound end only – never the start of a word.
  if (
    best < MATCH.kind &&
    kindMembersOf(queryWord).some(
      (member) => nameWord === member || (member.length >= 4 && nameWord.endsWith(member)),
    )
  ) {
    best = MATCH.kind;
  }
  return best;
}

/** Weight of a match by its place in the name. */
const PLACE = {
  /** The word that names the food – first word of a German head ("Lachs roh"). */
  first: 1.1,
  head: 1,
  /** After a comma or bracket: a description or another name ("Skyr, Frischkäse"). */
  descriptor: 0.8,
  /** After "mit", "aus", "und", … – an addition ("Kalbshirn mit Ei"). */
  addition: 0.35,
  /** After "ohne": the food is explicitly *not* in it. */
  negated: 0.05,
} as const;

function placeOf(name: PreparedName, index: number): number {
  if (index >= name.negatedFrom) return PLACE.negated;
  if (index >= name.additionFrom) return PLACE.addition;
  const naming = name.lang === 'en' ? name.head - 1 : 0;
  if (index === naming) return PLACE.first;
  return index < name.head ? PLACE.head : PLACE.descriptor;
}

/** Points of one query word in a whole name (best place wins). */
function nameWordScore(name: PreparedName, queryWord: string): number {
  let best = 0;
  name.words.forEach((word, index) => {
    const points = wordMatch(word, queryWord);
    if (points === 0) return;
    const place = placeOf(name, index);
    // Weak matches (start or inside of a word) get no extra for the first place …
    let weighted = points >= MATCH.compoundEnd ? points * place : points * Math.min(place, 1);
    // … except the start of the name's first word while typing: "hafer" → "Haferflocken",
    // "Hähnchen" → "Hähnchenbrust". Short words ("ei" → "Eierlikör") stay weak.
    if (points === MATCH.wordStart && place === PLACE.first && queryWord.length >= 4) {
      weighted = MATCH.typingStart;
    }
    best = Math.max(best, weighted);
  });
  // "Hafer Flocken" for "haferflocken": the head without spaces – only when no word matched.
  const headCompact = name.words.slice(0, name.head).join('');
  if (best === 0 && queryWord.length >= 6 && headCompact.includes(queryWord)) {
    best = headCompact.startsWith(queryWord) ? MATCH.exact * PLACE.first : MATCH.compoundEnd;
  }
  // "Magerquark" in "Speisequark Magerstufe", "Hähnchenbrust" in "Hähnchen Brustfilet": the
  // kind and the variant both in the name, before any addition.
  const parts = best < MATCH.compoundEnd ? decomposeQueryWord(queryWord) : null;
  if (parts) best = Math.max(best, variantScore(name, parts));
  return best;
}

/** Just clear enough: the food of a plain cut without the cut ("Lachs roh" for "Lachsfilet"). */
const PLAIN_CUT = 62;

function variantScore(name: PreparedName, parts: Decomposition): number {
  const before = name.words.slice(0, Math.min(name.additionFrom, name.negatedFrom));
  const kind = before.some((word) => wordMatch(word, parts.base) >= MATCH.compoundEnd);
  if (!kind) return 0;
  if (before.some((word) => word.startsWith(parts.variant))) return MATCH.compoundEnd;
  return PLAIN_CUTS.has(parts.variant) ? PLAIN_CUT : 0;
}

/**
 * Score of a name for the food words; `null` when a word is missing entirely. `phrase`:
 * whether the whole query is the food words (no brand) – only then does a name that *is* the
 * query get the full-name bonus ("Käse" is no answer to "Milbona Käse"). Categories never
 * count here – what a product is comes from its name (Phase 29, see `assessMatch`).
 */
export function nameScore(
  name: PreparedName,
  foodWords: readonly string[],
  { phrase: wholeQuery = true }: { phrase?: boolean } = {},
): number | null {
  if (foodWords.length === 0) return 0;
  let sum = 0;
  for (const word of foodWords) {
    const points = nameWordScore(name, word);
    if (points === 0) return null;
    sum += points;
  }
  let score = sum / foodWords.length;
  if (!wholeQuery) return score;
  const phrase = foodWords.join(' ');
  if (name.text === phrase || name.compact === foodWords.join('')) score += 60;
  else if (name.lang === 'de' && name.text.startsWith(`${phrase} `)) score += 15;
  return score;
}

/** Points of the extras a food can have. */
export const BONUS = {
  /** The brand or retailer asked for is the product's brand (or a shop it is sold in). */
  brand: 40,
  /**
   * A product without a stated brand whose name starts with the brand ("Milbona Gouda"). Half
   * the brand bonus: the name alone is weaker evidence than the brand field.
   */
  brandInName: 20,
  /** Brand and kind together – the product is what the whole query asks for. */
  brandAndKind: 20,
  /** The package size asked for ("Magerquark 500 g"). */
  quantity: 5,
  /** A dish or recipe (BLS X/Y) after the plain food. */
  dish: -40,
  raw: 4,
  /** Created by the user. */
  custom: 8,
  /** A product the user deliberately saved (barcode or online). */
  saved: 6,
  /** Personal use: at most this much – it never crosses a match level (`compareRanked`). */
  usageMax: 30,
} as const;

/**
 * Bonus for personal use: grows with every use but flattens quickly and stops at
 * `BONUS.usageMax` (1 use ≈ 12, 3 ≈ 24, from 5 on 30). A favourite product therefore rises
 * within its level and past dishes, but never above a better name match.
 */
export function usageBonus(uses: number): number {
  if (!Number.isFinite(uses) || uses <= 0) return 0;
  return Math.min(BONUS.usageMax, Math.round(12 * Math.log2(1 + uses)));
}

/** What the ranking needs to know about one food. */
export interface RankCandidate {
  /** Main (displayed) name first, then further names (e.g. English). */
  names: readonly PreparedName[];
  /** Brand and stores, normalised (`normalizeSearchText`). */
  brands?: readonly string[];
  /** Shops the product is sold in, normalised – they count for a retailer only. */
  stores?: readonly string[];
  /** Categories of a product, normalised ("fresh cheeses") – Open Food Facts only. */
  categories?: readonly string[];
  /** Stated package size ("500 g"). */
  packageSize?: string | null;
  /** Data quality of an online product; C is never shown. */
  quality?: ProductQuality;
  dish?: boolean;
  /** Own food, saved product, personal use and data quality – see `BONUS`, `usageBonus`. */
  bonus?: number;
}

/** A further name (e.g. English in a German app) ranks clearly after the main name. */
const FURTHER_NAME = 0.6;

/** From this name score on, the food words are clearly met (a "Passendes Lebensmittel"). */
export const STRONG_MATCH = 60;

/** Core score of a product whose kind is known only from its category (never a match). */
const CATEGORY_ONLY = 50;

/**
 * Levels of the name match, from the core score (name, dish, raw – no brand, source or use):
 * the whole name ≥ 150, a clear word, synonym or compound ≥ 80, clear enough ≥ 60, else weak.
 * Sorting compares levels before scores, so no bonus crosses a level.
 */
const LEVELS = [60, 80, 150] as const;

function levelOf(core: number): number {
  return LEVELS.filter((threshold) => core >= threshold).length;
}

export type MatchDecision = 'match' | 'partial' | 'weak' | 'excluded';

/** Why a candidate was judged as it was – for tests and debugging, never shown to users. */
export interface MatchDiagnosis {
  brand: {
    asked: string[];
    /** Where the brand was found: brand field, shops (retailer), start of the name. */
    source: 'field' | 'store' | 'name' | null;
    met: boolean | null;
  };
  kind: {
    asked: (string | null)[];
    /** What the name says the product is ("cheese", "other:burger"); `null` when unknown. */
    product: string | null;
    /** The product is another kind than asked ("other:burger" for cheese). */
    conflict: string | null;
    /** The asked kind only appears in the category, not in the name. */
    categoryOnly: boolean;
    met: boolean | null;
  };
  variant: { asked: string[]; met: boolean | null };
  met: string[];
  missing: string[];
  quality: ProductQuality | null;
  decision: MatchDecision;
  reasons: string[];
}

export interface MatchAssessment {
  decision: MatchDecision;
  /** Level of the name match (`LEVELS`). */
  level: number;
  /** Score within the level: name, brand, source, use, quality (higher is better). */
  score: number;
  diagnosis: MatchDiagnosis;
}

/** What the name says the product is: the last word of the head with a known kind. */
function productKindOf(name: PreparedName | undefined): string | null {
  if (!name) return null;
  for (let index = Math.min(name.head, name.words.length) - 1; index >= 0; index -= 1) {
    const kind = kindOfNameWord(name.words[index] ?? '');
    if (kind) return kind;
  }
  return null;
}

/** Plural and compound endings a category may add: "cheeses", "eggs", "speisequark". */
function categoryNames(word: string, target: string): boolean {
  if (word === target) return true;
  if ([`${target}s`, `${target}es`, `${target}n`, `${target}en`].includes(word)) return true;
  return target.length >= 4 && word.endsWith(target);
}

/** Whether a category names the word's kind – only the last word of a category counts. */
function categoryHas(categories: readonly string[], queryWord: string): boolean {
  const targets = [queryWord, ...synonymsOf(queryWord)];
  return categories.some((category) => {
    const last = category.split(' ').pop() ?? '';
    return targets.some((target) => categoryNames(last, target));
  });
}

/**
 * Step A of the search: is this candidate what the query asks for? Requirements are the brand
 * (brand field, shops for a retailer, or – without a brand field – the start of the name) and
 * the food words (in the *name*). Brand and kind must be met together for a match.
 */
export function assessMatch(candidate: RankCandidate, query: QueryAnalysis): MatchAssessment {
  const reasons: string[] = [];
  const met: string[] = [];
  const missing: string[] = [];
  const brands = candidate.brands ?? [];
  const stores = candidate.stores ?? [];
  const first = candidate.names[0];
  const brandAsked = query.brandWords.length > 0;
  // "Coca-Cola" is normalised to "cocacola": compare without spaces as well.
  const has = (list: readonly string[], target: string) =>
    list.some(
      (value) =>
        ` ${value} `.includes(` ${target} `) ||
        value.replace(/ /g, '') === target.replace(/ /g, ''),
    );
  const brandSource: MatchDiagnosis['brand']['source'] = !brandAsked
    ? null
    : query.brandTargets.some((target) => has(brands, target))
      ? 'field'
      : query.retailers.some((retailer) => has(stores, retailer))
        ? 'store'
        : brands.length === 0 &&
            first !== undefined &&
            query.brandTargets.some(
              (target) =>
                first.text.startsWith(`${target} `) || first.words[0] === target.replace(/ /g, ''),
            )
          ? 'name'
          : null;
  const brandMet = brandAsked ? brandSource !== null : null;
  if (brandAsked) {
    (brandMet ? met : missing).push(`brand ${query.brands.join(' / ')}`);
    if (brandSource === 'name') reasons.push('brand only at the start of the name');
    if (!brandMet && brands.length > 0) reasons.push('another brand in the brand field');
  }

  const productKind = productKindOf(first);
  const askedKinds = query.kinds.map((kind) => kind.kind);
  const knownAsked = askedKinds.filter((kind): kind is string => kind !== null);
  const conflict =
    productKind !== null && knownAsked.length > 0 && !knownAsked.includes(productKind)
      ? productKind
      : null;

  let core: number | null;
  let categoryOnly = false;
  if (query.foodWords.length === 0) {
    core = brandMet ? 50 : null;
  } else {
    core = null;
    const phrase = !brandAsked;
    for (const [index, name] of candidate.names.entries()) {
      const value = nameScore(name, query.foodWords, { phrase });
      if (value === null) continue;
      core = Math.max(core ?? -Infinity, index === 0 ? value : value * FURTHER_NAME);
    }
    if (core === null && conflict === null && candidate.categories?.length) {
      // The name lacks a word, the category names it: a hint, never a match.
      const covered = query.foodWords.every(
        (word) =>
          (first !== undefined && nameScore(first, [word]) !== null) ||
          categoryHas(candidate.categories ?? [], word),
      );
      if (covered) {
        core = CATEGORY_ONLY;
        categoryOnly = true;
        reasons.push('kind only from the category');
      }
    }
  }

  let foodMet = false;
  const diagnosis = (decision: MatchDecision): MatchDiagnosis => ({
    brand: { asked: query.brands, source: brandSource, met: brandMet },
    kind: {
      asked: askedKinds,
      product: productKind,
      conflict,
      categoryOnly,
      met: query.foodWords.length === 0 ? null : foodMet,
    },
    variant: { asked: query.variants, met: query.variants.length === 0 ? null : foodMet },
    met,
    missing,
    quality: candidate.quality ?? null,
    decision,
    reasons,
  });

  if (candidate.quality === 'C') {
    reasons.push('data quality C');
    return { decision: 'excluded', level: 0, score: -Infinity, diagnosis: diagnosis('excluded') };
  }
  if (core === null && brandMet === true && query.foodWords.length > 0) {
    // The brand asked for, but not the food: a further result ("Milbona Pudding").
    core = 0;
    reasons.push('only the brand – the food is not in the name');
  }
  if (core === null) {
    reasons.push(
      query.foodWords.length === 0 ? 'brand not met' : 'a word of the query is not in the name',
    );
    if (query.foodWords.length > 0) missing.push(`food ${query.foodWords.join(' ')}`);
    return { decision: 'excluded', level: 0, score: -Infinity, diagnosis: diagnosis('excluded') };
  }

  if (candidate.dish) {
    core += BONUS.dish;
    reasons.push('dish');
  }
  if (first?.raw) core += BONUS.raw;
  foodMet =
    query.foodWords.length === 0 || (core >= STRONG_MATCH && !categoryOnly && conflict === null);
  if (query.foodWords.length > 0) {
    (foodMet ? met : missing).push(`food ${query.foodWords.join(' ')}`);
    if (conflict) reasons.push(`the name is ${conflict}, not ${knownAsked.join('/')}`);
    else if (!foodMet && !categoryOnly) reasons.push('the food words only weakly in the name');
  }

  let decision: MatchDecision;
  if (foodMet && brandMet !== false) decision = 'match';
  else if (foodMet || brandMet === true || core >= STRONG_MATCH || categoryOnly) {
    decision = 'partial';
  } else decision = 'weak';
  // A different product that only carries the asked kind as a modifier, with nothing else
  // asked for met, is not shown at all ("Burger" in the category cheeses).
  if (conflict && categoryOnly && brandMet !== true) decision = 'excluded';

  let score = core;
  if (brandSource === 'field' || brandSource === 'store') score += BONUS.brand;
  if (brandSource === 'name') score += BONUS.brandInName;
  if (decision === 'match' && brandAsked && query.foodWords.length > 0) {
    score += BONUS.brandAndKind;
  }
  const size = normalizeSearchText(candidate.packageSize ?? '').replace(/ /g, '');
  if (query.quantity && size === query.quantity.replace(',', '.').replace(',', '')) {
    score += BONUS.quantity;
  }
  score += candidate.bonus ?? 0;
  reasons.unshift(`decision: ${decision}`);
  return {
    decision,
    level: decision === 'excluded' ? 0 : levelOf(core),
    score: Math.round(score * 10) / 10,
    diagnosis: diagnosis(decision),
  };
}

/** Relevance of a food (`assessMatch`), or `null` when it is excluded. */
export function relevance(candidate: RankCandidate, query: QueryAnalysis): number | null {
  const assessment = assessMatch(candidate, query);
  return assessment.decision === 'excluded' ? null : assessment.score;
}

const DECISION_ORDER: Record<MatchDecision, number> = {
  match: 3,
  partial: 2,
  weak: 1,
  excluded: 0,
};

/**
 * Step B: orders ranked foods lexicographically – decision (match, partial, weak), level of
 * the name match, score, then the shorter (more general) name, then A–Z. Without a decision
 * or level (old callers) only the score counts.
 */
export function compareRanked(
  a: { score: number; name: string; decision?: MatchDecision; level?: number },
  b: { score: number; name: string; decision?: MatchDecision; level?: number },
): number {
  return (
    DECISION_ORDER[b.decision ?? 'match'] - DECISION_ORDER[a.decision ?? 'match'] ||
    (b.level ?? 0) - (a.level ?? 0) ||
    b.score - a.score ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name, 'de')
  );
}
