import { NutritionError } from './errors';

/** Trims and collapses whitespace; rejects empty or too long names. */
export function requireName(input: string, maxLength: number): string {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > maxLength) throw new NutritionError('invalid-name');
  return name;
}

/** Optional text: trimmed, empty → null, too long → error. */
export function optionalText(input: string | null | undefined, maxLength: number): string | null {
  const text = input?.trim() ?? '';
  if (text.length > maxLength) throw new NutritionError('invalid-value');
  return text.length > 0 ? text : null;
}
