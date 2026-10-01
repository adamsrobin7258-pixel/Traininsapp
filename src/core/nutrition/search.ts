/**
 * Food search text handling, shared by the user's foods and the reference catalog.
 *
 * Normalisation makes spelling variants equal: case, accents and umlauts ("Äpfel" = "apfel"),
 * the transcriptions "ae/oe/ue" ("Aepfel" = "Äpfel"), "ß" = "ss", punctuation
 * ("Apfel, roh" = "apfel roh") and hyphens between letters ("Joghurt-Dip" = "joghurtdip"). Both the query and the food names go through the same
 * function, so the folding can never hide a match.
 */
export function normalizeSearchText(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/ae/g, 'a')
      .replace(/oe/g, 'o')
      .replace(/ue/g, 'u')
      // Hyphenated words are compounds: "Joghurt-Dip" ranks like "Joghurtdip".
      .replace(/(\p{L})[-‐‑](?=\p{L})/gu, '$1')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  );
}

/** Normalised query words; empty for a blank query. */
export function searchWords(query: string): string[] {
  const text = normalizeSearchText(query);
  return text === '' ? [] : text.split(' ');
}

/** A name prepared once for repeated searching. */
export interface SearchKey {
  text: string;
  words: string[];
  /** Without spaces: "Hafer Flocken" is found as "haferflocken". */
  compact: string;
}

export function searchKey(...parts: (string | null | undefined)[]): SearchKey {
  const text = normalizeSearchText(parts.filter(Boolean).join(' '));
  return { text, words: text === '' ? [] : text.split(' '), compact: text.replace(/ /g, '') };
}

/**
 * How well a name matches (lower is better), or `null` when it does not match. Every query
 * word must appear in the name, also inside a word ("apfel" finds "Bratäpfel"); a query
 * without spaces also finds names written with spaces ("haferflocken" → "Hafer Flocken").
 *
 * 0 exact name · 1 name starts with the query as whole word(s) ("Apfel roh") · 2 every word
 * is a whole word · 3 name starts with the query ("Apfelmus") · 4 every word starts a word ·
 * 5 contained. Basic foods ("Milch …") thus come before compounds ("Milchschokolade").
 */
export function matchScore(key: SearchKey, words: readonly string[]): number | null {
  if (words.length === 0) return 5;
  const phrase = words.join(' ');
  const compactPhrase = words.join('');
  const contained = words.every((word) => key.text.includes(word));
  if (!contained && !key.compact.includes(compactPhrase)) return null;
  if (key.text === phrase || key.compact === compactPhrase) return 0;
  if (key.text.startsWith(`${phrase} `)) return 1;
  if (contained && words.every((word) => key.words.includes(word))) return 2;
  if (key.text.startsWith(phrase) || key.compact.startsWith(compactPhrase)) return 3;
  if (contained && words.every((word) => key.words.some((w) => w.startsWith(word)))) return 4;
  return 5;
}

/** Every match tier of a further name ranks after all tiers of the main name. */
const SECONDARY_NAME_OFFSET = 6;

/**
 * Best score over a food's names, the main (displayed) name first, e.g. German then English.
 * Matches on a further name rank after every match on the main name, so "butter" lists
 * "Butter gesalzen" before "Joghurtbutter" (English "Butter with yogurt"). `null` if none match.
 */
export function bestScore(keys: readonly SearchKey[], words: readonly string[]): number | null {
  let best: number | null = null;
  keys.forEach((key, index) => {
    const score = matchScore(key, words);
    if (score === null) return;
    const ranked = score + index * SECONDARY_NAME_OFFSET;
    if (best === null || ranked < best) best = ranked;
  });
  return best;
}

/** Orders matches: better score, then the shorter (more general) name, then alphabetically. */
export function compareMatches(
  a: { score: number; name: string },
  b: { score: number; name: string },
): number {
  return a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name, 'de');
}
