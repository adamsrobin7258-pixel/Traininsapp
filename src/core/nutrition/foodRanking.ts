import {
  CONNECTOR_WORDS,
  NEGATION_WORDS,
  RAW_WORDS,
  RETAILER_NAMES,
  retailerBrands,
  synonymsOf,
} from './foodVocabulary';
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

/** What a query asks for: food words and brand or retailer words. */
export interface QueryAnalysis {
  words: string[];
  /** Words that must be found in the food's name. */
  foodWords: string[];
  /** Words recognised as retailer or brand ("lidl", "milbona"). */
  brandWords: string[];
  /** Normalised brand texts that satisfy the brand words (retailer → its own brands). */
  brandTargets: string[];
}

/**
 * Recognises retailer and brand words. `knownBrands`: brands of foods stored on this device
 * (e.g. "Milbona" after a product was saved), so "Milbona" alone finds them.
 */
export function analyzeQuery(query: string, knownBrands: Iterable<string> = []): QueryAnalysis {
  const words = searchWords(query);
  const brands = new Set<string>();
  for (const brand of knownBrands) {
    const normalised = normalizeSearchText(brand);
    if (normalised !== '') brands.add(normalised);
  }
  for (const retailer of RETAILER_NAMES)
    for (const own of retailerBrands(retailer)) brands.add(own);

  const foodWords: string[] = [];
  const brandWords: string[] = [];
  const brandTargets = new Set<string>();
  for (const word of words) {
    if (RETAILER_NAMES.includes(word)) {
      brandWords.push(word);
      brandTargets.add(word);
      for (const own of retailerBrands(word)) brandTargets.add(own);
      continue;
    }
    // A brand word only when it names a brand as a whole word – "milbona", not "milch".
    const matching = [...brands].filter((brand) => brand.split(' ').includes(word));
    if (word.length >= 3 && matching.length > 0 && words.length > 1) {
      brandWords.push(word);
      matching.forEach((brand) => brandTargets.add(brand));
      continue;
    }
    if (word.length >= 3 && matching.length > 0 && words.length === 1) {
      // A single word that is a brand ("Milbona") – but may also be a food ("Pilos"?): both.
      brandWords.push(word);
      matching.forEach((brand) => brandTargets.add(brand));
    }
    foodWords.push(word);
  }
  // "milbona" alone is a brand search: the food words are only an alternative.
  const brandOnly = words.length === 1 && brandWords.length === 1;
  return {
    words,
    foodWords: brandOnly ? [] : foodWords,
    brandWords,
    brandTargets: [...brandTargets],
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
  return best;
}

/** Score of a name for the food words; `null` when a word is missing entirely. */
export function nameScore(name: PreparedName, foodWords: readonly string[]): number | null {
  if (foodWords.length === 0) return 0;
  let sum = 0;
  for (const word of foodWords) {
    const points = nameWordScore(name, word);
    if (points === 0) return null;
    sum += points;
  }
  let score = sum / foodWords.length;
  const phrase = foodWords.join(' ');
  if (name.text === phrase || name.compact === foodWords.join('')) score += 60;
  else if (name.lang === 'de' && name.text.startsWith(`${phrase} `)) score += 15;
  return score;
}

/** Points of the extras a food can have. */
export const BONUS = {
  /** A brand or retailer in the query that the product carries. */
  brand: 40,
  /** A brand or retailer in the query that the product does not carry – it stays listed. */
  otherBrand: -30,
  /** A dish or recipe (BLS X/Y) after the plain food. */
  dish: -40,
  raw: 4,
  /** Created by the user. */
  custom: 8,
  /** A product the user deliberately saved (barcode or online). */
  saved: 6,
  /** Personal use: at most this much – less than the gap between two match levels. */
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
  dish?: boolean;
  /** Own food, saved product and personal use – see `BONUS`, `usageBonus`. */
  bonus?: number;
}

/** A further name (e.g. English in a German app) ranks clearly after the main name. */
const FURTHER_NAME = 0.6;

/** From this score on a result is a clear match ("Passende Lebensmittel"). */
export const STRONG_MATCH = 60;

/**
 * Relevance of a food for an analysed query, or `null` when it does not match. Every food word
 * must appear in a name; brand words only raise or lower a product.
 */
export function relevance(candidate: RankCandidate, query: QueryAnalysis): number | null {
  const brands = candidate.brands ?? [];
  const brandHit =
    query.brandWords.length > 0 &&
    brands.some((brand) =>
      query.brandTargets.some((target) => ` ${brand} `.includes(` ${target} `)),
    );

  let score = -Infinity;
  if (query.foodWords.length === 0) {
    // Only a brand or retailer ("Milbona", "Lidl"): its products, nothing else.
    if (!brandHit) return null;
    score = 50;
  } else {
    for (const [index, name] of candidate.names.entries()) {
      const value = nameScore(name, query.foodWords);
      if (value === null) continue;
      score = Math.max(score, index === 0 ? value : value * FURTHER_NAME);
    }
    if (score === -Infinity) return null;
  }

  let total = score;
  if (query.brandWords.length > 0) total += brandHit ? BONUS.brand : BONUS.otherBrand;
  if (candidate.dish) total += BONUS.dish;
  if (candidate.names[0]?.raw) total += BONUS.raw;
  total += candidate.bonus ?? 0;
  return Math.round(total * 10) / 10;
}

/** Orders ranked foods: higher score, then the shorter (more general) name, then A–Z. */
export function compareRanked(
  a: { score: number; name: string },
  b: { score: number; name: string },
): number {
  return b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name, 'de');
}
