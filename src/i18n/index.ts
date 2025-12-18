import { en, type TranslationKeys } from './en';
import { es } from './es';
import { tr } from './tr';
import { de } from './de';
import { fr } from './fr';
import { pt } from './pt';
import { it } from './it';

export type Language = 'en' | 'es' | 'zh' | 'hi' | 'ar' | 'pt' | 'bn' | 'ru' | 'ja' | 'pa' | 'de' | 'jv' | 'ko' | 'fr' | 'te' | 'mr' | 'tr' | 'ta' | 'vi' | 'it';

// For languages not yet fully translated, we fall back to English
export const translations: Record<Language, TranslationKeys> = {
  en,
  es,
  tr, // Turkish - fully translated
  de: de as TranslationKeys, // German - core translations
  fr: fr as TranslationKeys, // French - core translations
  pt: pt as TranslationKeys, // Portuguese - core translations
  it: it as TranslationKeys, // Italian - core translations
  // Other languages fall back to English for now
  zh: en,
  hi: en,
  ar: en,
  bn: en,
  ru: en,
  ja: en,
  pa: en,
  jv: en,
  ko: en,
  te: en,
  mr: en,
  ta: en,
  vi: en,
};

export type { TranslationKeys };
