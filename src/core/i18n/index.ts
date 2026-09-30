export { dictionaries, FALLBACK_LOCALE, SUPPORTED_LOCALES, type Locale } from './config';
export { createTranslator, detectLocale, isSupportedLocale } from './translator';
export { I18nProvider, useI18n } from './I18nProvider';
export type { TranslateFn, TranslationKey, TranslationParams, TranslationSchema } from './types';
