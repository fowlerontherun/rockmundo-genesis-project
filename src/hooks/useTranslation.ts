import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isSupportedLanguage, translations, type Language } from '@/i18n';

interface TranslationState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<TranslationState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language: isSupportedLanguage(language) ? language : 'en' }),
    }),
    {
      name: 'rockmundo-language',
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<TranslationState>;
        const persistedLanguage = typeof state.language === 'string' ? state.language : 'en';
        return {
          ...state,
          language: isSupportedLanguage(persistedLanguage) ? persistedLanguage : 'en',
        } as TranslationState;
      },
    }
  )
);

// Helper to get nested value from object using dot notation
const getNestedValue = (obj: unknown, path: string): string | undefined => {
  const keys = path.split('.');
  let result: unknown = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof result === 'string' ? result : undefined;
};

export const useTranslation = () => {
  const { language } = useLanguageStore();
  const resolvedLanguage: Language = isSupportedLanguage(language) ? language : 'en';

  const currentTranslations = translations[resolvedLanguage] || translations.en;
  const fallbackTranslations = translations.en;

  // t supports dot notation (for example "common.save") and gracefully
  // falls back to the maintained English source when a locale is incomplete.
  const t = (key: string, fallback?: string): string => {
    const value = getNestedValue(currentTranslations, key);
    if (value) return value;

    const fallbackValue = getNestedValue(fallbackTranslations, key);
    if (fallbackValue) return fallbackValue;

    return fallback || key;
  };

  return { t, language: resolvedLanguage };
};

// Export for backwards compatibility
export type { Language };
