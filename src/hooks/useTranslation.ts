import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, type Language, type TranslationKeys } from '@/i18n';

interface TranslationState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<TranslationState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'rockmundo-language',
    }
  )
);

// Helper to get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): string | undefined => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return undefined;
    }
  }
  
  return typeof result === 'string' ? result : undefined;
};

export const useTranslation = () => {
  const { language } = useLanguageStore();
  
  const currentTranslations = translations[language] || translations.en;
  const fallbackTranslations = translations.en;

  // t function supports both dot notation (e.g., "common.save") and direct keys
  const t = (key: string, fallback?: string): string => {
    // Try current language first
    const value = getNestedValue(currentTranslations, key);
    if (value) return value;
    
    // Try English fallback
    const fallbackValue = getNestedValue(fallbackTranslations, key);
    if (fallbackValue) return fallbackValue;
    
    // Return provided fallback or the key itself
    return fallback || key;
  };

  return { t, language };
};

// Export for backwards compatibility
export type { Language };
