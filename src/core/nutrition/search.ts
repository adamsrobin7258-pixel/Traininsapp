/**
 * Food search text handling, shared by the user's foods and the reference catalog.
 *
 * Normalisation makes spelling variants equal: case, accents and umlauts ("Äpfel" = "apfel"),
 * the transcriptions "ae/oe/ue" ("Aepfel" = "Äpfel"), "ß" = "ss" and punctuation
 * ("Apfel, roh" = "apfel roh"). Both the query and the food names go through the same
 * function, so the folding can never hide a match.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
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
}

export function searchKey(...parts: (string | null | undefined)[]): SearchKey {
  const text = normalizeSearchText(parts.filter(Boolean).join(' '));
  return { text, words: text === '' ? [] : text.split(' ') };
}

/**
 * How well a name matches (lower is better), or `null` when it does not match. Every query
 * word must appear in the name (also inside a word: "apfel" finds "Bratapfel").
 * 0 exact name · 1 name starts with the query · 2 every word starts a word · 3 contained.
 */
export function matchScore(key: SearchKey, words: readonly string[]): number | null {
  if (words.length === 0) return 3;
  if (!words.every((word) => key.text.includes(word))) return null;
  const phrase = words.join(' ');
  if (key.text === phrase) return 0;
  if (key.text.startsWith(phrase)) return 1;
  if (words.every((word) => key.words.some((w) => w.startsWith(word)))) return 2;
  return 3;
}

/** Orders matches: better score, then the shorter (more general) name, then alphabetically. */
export function compareMatches(
  a: { score: number; name: string },
  b: { score: number; name: string },
): number {
  return a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name, 'de');
}
