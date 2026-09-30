import { dictionaries, FALLBACK_LOCALE, SUPPORTED_LOCALES } from './config';
import { createTranslator, detectLocale } from './translator';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result.set(path, value);
    else for (const [k, v] of flatten(value, path)) result.set(k, v);
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const reference = flatten(dictionaries.de);

  it.each(SUPPORTED_LOCALES)('%s has exactly the reference keys', (locale) => {
    expect([...flatten(dictionaries[locale]).keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it.each(SUPPORTED_LOCALES)('%s has no empty texts', (locale) => {
    for (const [key, text] of flatten(dictionaries[locale])) {
      expect(text.trim(), key).not.toBe('');
    }
  });

  it.each(SUPPORTED_LOCALES)('%s uses the same placeholders as the reference', (locale) => {
    for (const [key, text] of flatten(dictionaries[locale])) {
      expect(placeholders(text), key).toEqual(placeholders(reference.get(key) ?? ''));
    }
  });

  it('provides a name for every supported language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(dictionaries.de.languages[locale]).toBeTruthy();
    }
  });
});

describe('createTranslator', () => {
  it('translates keys per language', () => {
    expect(createTranslator('de')('nav.nutrition')).toBe('Ernährung');
    expect(createTranslator('en')('nav.nutrition')).toBe('Nutrition');
  });

  it('interpolates parameters and keeps unknown placeholders', () => {
    const t = createTranslator('en');
    expect(t('dashboard.greetingWithName', { greeting: 'Hi', name: 'Anna' })).toBe('Hi, Anna');
    expect(t('dashboard.greetingWithName', { greeting: 'Hi' })).toBe('Hi, {name}');
  });

  it('returns the key for unknown keys instead of crashing', () => {
    const t = createTranslator('de');
    // @ts-expect-error – deliberately unknown key
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('detectLocale', () => {
  it.each([
    [['de-DE'], 'de'],
    [['de_AT'], 'de'],
    [['EN-gb'], 'en'],
    [['fr-FR', 'de-DE'], 'de'],
    [['fr-FR', 'es'], FALLBACK_LOCALE],
    [[], FALLBACK_LOCALE],
  ])('%j -> %s', (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected);
  });
});
