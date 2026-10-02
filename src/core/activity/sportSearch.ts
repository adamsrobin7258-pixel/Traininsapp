import { bestScore, compareMatches, searchKey, searchWords } from '@/shared/lib/search';
import { SPORTS, sportName, type SportDefinition } from './catalog';

/**
 * Sports matching a query in both languages (displayed name first), best match first. Without
 * a query: the catalog order, which groups the sports by category.
 */
export function searchSports(query: string, locale: string): SportDefinition[] {
  const words = searchWords(query);
  if (words.length === 0) return [...SPORTS];
  const matches: { sport: SportDefinition; name: string; score: number }[] = [];
  for (const sport of SPORTS) {
    const name = sportName(sport, locale);
    const other = locale.startsWith('de') ? sport.nameEn : sport.nameDe;
    const score = bestScore([searchKey(name), searchKey(other)], words);
    if (score !== null) matches.push({ sport, name, score });
  }
  return matches.sort(compareMatches).map((match) => match.sport);
}
