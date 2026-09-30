import type { de } from './locales/de';

/** Replaces every string literal leaf with `string`, keeping the key structure. */
type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type TranslationSchema = Widen<typeof de>;

/** All dot-separated paths that point to a string, e.g. "nav.training". */
type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Paths<TranslationSchema>;

export type TranslationParams = Readonly<Record<string, string | number>>;

export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;
