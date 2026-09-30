import { TrainingError } from './errors';

/** Collapses whitespace and enforces 1…max characters for plan, day and exercise names. */
export function requireName(input: string, maxLength: number): string {
  const name = input.replace(/\s+/g, ' ').trim();
  if (name === '' || Array.from(name).length > maxLength) throw new TrainingError('invalid-name');
  return name;
}
