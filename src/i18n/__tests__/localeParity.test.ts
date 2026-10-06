import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, translations, type SupportedLanguage } from '@/i18n';
import { playerControls } from '@/i18n/playerControls';

const nonEnglish = SUPPORTED_LANGUAGES.filter(
  (language): language is Exclude<SupportedLanguage, 'en'> => language !== 'en',
);

const collectStringPaths = (value: unknown, prefix = ''): string[] => {
  if (typeof value === 'string') return prefix ? [prefix] : [];
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectStringPaths(child, prefix ? `${prefix}.${key}` : key),
  );
};

const skillXpKeys = [
  'skills.spendSkillXp',
  'skills.availableSkillXp',
  'skills.amountToSpend',
  'skills.nextLevel',
  'skills.max',
  'skills.confirmSpend',
  'skills.xpToNextLevel',
  'skills.xpToMaximum',
  'skills.levelsGained',
  'skills.insufficientSkillXp',
  'skills.maximumLevelReached',
  'skills.skillIsLocked',
  'skills.spendSuccessful',
  'skills.walletAfterSpending',
] as const;

const getNestedString = (value: unknown, path: string): string | undefined => {
  let current: unknown = value;

  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
};

describe('locale parity', () => {
  it.each(SUPPORTED_LANGUAGES)('%s has complete, non-empty mobile and character copy', (language) => {
    expect(Object.keys(playerControls[language])).toEqual(Object.keys(playerControls.en));
    expect(Object.values(playerControls[language]).every((value) => typeof value === 'string' && value.trim().length > 0)).toBe(true);
    if (language !== 'en') {
      expect(playerControls[language].switchCharacter).not.toBe(playerControls.en.switchCharacter);
      expect(playerControls[language].bookActivity).not.toBe(playerControls.en.bookActivity);
    }
  });
  const englishPaths = collectStringPaths(translations.en).sort();

  it.each(nonEnglish)('%s contains every maintained English translation key', (language) => {
    const localePaths = new Set(collectStringPaths(translations[language]));
    const missing = englishPaths.filter((path) => !localePaths.has(path));

    expect(missing).toEqual([]);
  });

  it.each(nonEnglish)('%s translates the Skill XP spending flow instead of falling back to English', (language) => {
    for (const key of skillXpKeys) {
      const english = getNestedString(translations.en, key);
      const localized = getNestedString(translations[language], key);

      expect(localized, `${language} is missing ${key}`).toBeTruthy();
      expect(localized, `${language} still uses English for ${key}`).not.toBe(english);
    }
  });
});
