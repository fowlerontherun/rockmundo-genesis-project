import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, translations, type SupportedLanguage } from '@/i18n';
import { ja } from '@/i18n/ja';
import { zh } from '@/i18n/zh';
import { translateFMLabel, translateFMText } from '@/i18n/fm';
import { fmChatText } from '@/i18n/fmChat';
import { getFMStatusCopy } from '@/i18n/fmStatus';

const nonEnglish: SupportedLanguage[] = ['es', 'zh', 'pt', 'ja', 'de', 'fr', 'tr', 'it'];

describe('FM localisation', () => {
  it('only exposes languages backed by maintained locale files', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es', 'zh', 'pt', 'ja', 'de', 'fr', 'tr', 'it']);
  });

  it('registers the real Japanese and Chinese locale files instead of English fallbacks', () => {
    expect(translations.ja).not.toBe(translations.en);
    expect(translations.zh).not.toBe(translations.en);
    expect(translations.ja.nav.home).toBe(ja.nav.home);
    expect(translations.zh.nav.home).toBe(zh.nav.home);
    expect(translations.ja.nav.home).not.toBe(translations.en.nav.home);
    expect(translations.zh.nav.home).not.toBe(translations.en.nav.home);
  });

  it.each([
    ['es', 'Book Gigs', 'Reservar conciertos'],
    ['zh', 'Book Gigs', '预订演出'],
    ['pt', 'Book Gigs', 'Agendar shows'],
    ['ja', 'Book Gigs', 'ギグを予約'],
    ['de', 'Book Gigs', 'Auftritte buchen'],
    ['fr', 'Book Gigs', 'Réserver des concerts'],
    ['tr', 'Book Gigs', 'Konser Ayarla'],
    ['it', 'Book Gigs', 'Prenota concerti'],
  ] as const)('translates FM-specific navigation in %s', (language, source, expected) => {
    expect(translateFMLabel(language, source)).toBe(expected);
  });

  it.each(nonEnglish)('translates representative labels across all FM modules in %s', (language) => {
    const labels = [
      'Look Back',
      'Avatar Designer',
      'Recording Studio',
      'Support Opportunities',
      'Creative Industries',
      'Finance & reports',
      'PR History',
      'World Parliament',
      'Nightlife & Vice',
      'Debug Panel',
      'City Hall',
    ];

    for (const label of labels) {
      const translated = translateFMLabel(language, label);
      expect(translated.trim()).not.toBe('');
      expect(translated).not.toBe(label);
    }
  });

  it.each(nonEnglish)('localises shell, status and chat copy in %s', (language) => {
    expect(translateFMText(language, 'signOut')).not.toBe('Sign out');
    expect(translateFMText(language, 'manageCity', { city: 'London' })).toContain('London');
    expect(getFMStatusCopy(language).health).not.toBe('Health');
    expect(fmChatText(language, 'sendMessage')).not.toBe('Send message');
  });

  it('keeps unsupported legacy language preferences safe', () => {
    expect(translateFMLabel('hi', 'Book Gigs')).toBe('Book Gigs');
    expect(translateFMText('hi', 'signOut')).toBe('Sign out');
    expect(fmChatText('hi', 'sendMessage')).toBe('Send message');
    expect(getFMStatusCopy('hi').locale).toBe('en-GB');
  });
});
