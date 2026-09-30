import { de } from './locales/de';
import { en } from './locales/en';
import type { TranslationSchema } from './types';

/**
 * Registry of supported languages. To add a language, add a dictionary in ./locales
 * and register it here – nothing else needs to change.
 */
export const dictionaries = { de, en } satisfies Record<string, TranslationSchema>;

export type Locale = keyof typeof dictionaries;

export const SUPPORTED_LOCALES = Object.keys(dictionaries) as Locale[];

/** Used when none of the device languages is supported. */
export const FALLBACK_LOCALE: Locale = 'en';
