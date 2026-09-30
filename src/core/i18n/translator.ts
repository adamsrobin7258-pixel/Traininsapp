import { dictionaries, FALLBACK_LOCALE, SUPPORTED_LOCALES, type Locale } from './config';
import type { TranslateFn, TranslationKey, TranslationSchema } from './types';

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(value);
}

/**
 * Picks the first supported language from the device's preferred languages
 * (e.g. navigator.languages: ["de-AT", "en-US"] -> "de").
 */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split(/[-_]/)[0] ?? '';
    if (isSupportedLocale(language)) return language;
  }
  return FALLBACK_LOCALE;
}

function lookup(dictionary: TranslationSchema, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function createTranslator(locale: Locale): TranslateFn {
  const dictionary = dictionaries[locale];
  return (key: TranslationKey, params) => {
    const template = lookup(dictionary, key) ?? lookup(dictionaries[FALLBACK_LOCALE], key) ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
