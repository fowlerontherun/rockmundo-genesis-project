import { en, type TranslationKeys } from './en';
import { es } from './es';
import { tr } from './tr';
import { de } from './de';
import { fr } from './fr';
import { pt } from './pt';
import { it } from './it';
import { ja } from './ja';
import { zh } from './zh';

export type Language = 'en' | 'es' | 'zh' | 'hi' | 'ar' | 'pt' | 'bn' | 'ru' | 'ja' | 'pa' | 'de' | 'jv' | 'ko' | 'fr' | 'te' | 'mr' | 'tr' | 'ta' | 'vi' | 'it';
export type SupportedLanguage = 'en' | 'es' | 'zh' | 'pt' | 'ja' | 'de' | 'fr' | 'tr' | 'it';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'pt', 'ja', 'de', 'fr', 'tr', 'it'] as const satisfies readonly SupportedLanguage[];

export const isSupportedLanguage = (language: string): language is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(language);

// Keep the wider Language union for backwards compatibility with previously
// persisted preferences. Only locales backed by real translation files are
// exposed in the language switcher.
export const translations: Record<Language, TranslationKeys> = {
  en,
  es: es as unknown as TranslationKeys,
  tr: tr as unknown as TranslationKeys,
  de: de as unknown as TranslationKeys,
  fr: fr as unknown as TranslationKeys,
  pt: pt as unknown as TranslationKeys,
  it: it as unknown as TranslationKeys,
  ja: ja as unknown as TranslationKeys,
  zh: zh as unknown as TranslationKeys,
  // Legacy language codes that do not yet have a maintained locale file fall
  // back to English rather than pretending to be translated.
  hi: en,
  ar: en,
  bn: en,
  ru: en,
  pa: en,
  jv: en,
  ko: en,
  te: en,
  mr: en,
  ta: en,
  vi: en,
};

export type { TranslationKeys };
