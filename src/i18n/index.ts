import { en, type TranslationKeys } from './en';
import { es } from './es';

export type Language = 'en' | 'es' | 'zh' | 'hi' | 'ar' | 'pt' | 'bn' | 'ru' | 'ja' | 'pa' | 'de' | 'jv' | 'ko' | 'fr' | 'te' | 'mr' | 'tr' | 'ta' | 'vi' | 'it';

// For languages not yet fully translated, we fall back to English
export const translations: Record<Language, TranslationKeys> = {
  en,
  es,
  // Other languages fall back to English for now
  zh: en,
  hi: en,
  ar: en,
  pt: en,
  bn: en,
  ru: en,
  ja: en,
  pa: en,
  de: en,
  jv: en,
  ko: en,
  fr: en,
  te: en,
  mr: en,
  tr: en,
  ta: en,
  vi: en,
  it: en,
};

export type { TranslationKeys };
