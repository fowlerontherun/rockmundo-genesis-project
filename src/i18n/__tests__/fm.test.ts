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
    ['zh', 'Book Gigs', '安排演出'],
    ['pt', 'Book Gigs', 'Agendar shows'],
    ['ja', 'Book Gigs', 'ライブをブッキング'],
    ['de', 'Book Gigs', 'Auftritte buchen'],
    ['fr', 'Book Gigs', 'Réserver des concerts'],
    ['tr', 'Book Gigs', 'Konser planla'],
    ['it', 'Book Gigs', 'Prenota concerti'],
  ] as const)('translates FM-specific navigation in %s', (language, source, expected) => {
    expect(translateFMLabel(language, source)).toBe(expected);
  });

  it('uses idiomatic language for common music and management actions', () => {
    expect(translateFMLabel('es', 'Sign Sponsors')).toBe('Cerrar patrocinios');
    expect(translateFMLabel('fr', 'Acting')).toBe('Jeu d’acteur');
    expect(translateFMLabel('de', 'Book Work')).toBe('Arbeit einplanen');
    expect(translateFMLabel('ja', 'Book Work')).toBe('仕事を予定する');
    expect(translateFMLabel('zh', 'Post on Twaater')).toBe('在 Twaater 发帖');
    expect(translateFMLabel('pt', 'Pitch to Radio')).toBe('Apresentar música às rádios');
    expect(translateFMLabel('tr', 'Browse Public Companies')).toBe('Şirketlere göz at');
    expect(translateFMLabel('it', 'Browse Public Companies')).toBe('Esplora aziende');
  });

  it('does not translate the company directory as publicly traded or state-owned companies', () => {
    expect(translateFMLabel('es', 'Browse Public Companies')).toBe('Explorar empresas');
    expect(translateFMLabel('zh', 'Browse Public Companies')).toBe('浏览公司');
    expect(translateFMLabel('pt', 'Browse Public Companies')).toBe('Explorar empresas');
    expect(translateFMLabel('ja', 'Browse Public Companies')).toBe('会社一覧を見る');
    expect(translateFMLabel('de', 'Browse Public Companies')).toBe('Unternehmen ansehen');
    expect(translateFMLabel('fr', 'Browse Public Companies')).toBe('Parcourir les entreprises');
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

  it('uses human navigation wording rather than literal technical translations', () => {
    expect(translateFMText('es', 'searchDestinations')).toBe('Buscar páginas y acciones');
    expect(translateFMText('zh', 'primaryModules')).toBe('主菜单');
    expect(translateFMText('ja', 'searchDestinations')).toBe('ページや機能を検索');
    expect(translateFMText('de', 'moduleHub', { module: 'Musik' })).toBe('Musik-Bereich');
    expect(translateFMText('fr', 'forward')).toBe('Avancer');
    expect(translateFMText('tr', 'primaryModules')).toBe('Ana menü');
    expect(translateFMText('it', 'searchDestinations')).toBe('Cerca pagine e funzioni');
  });

  it('keeps unsupported legacy language preferences safe', () => {
    expect(translateFMLabel('hi', 'Book Gigs')).toBe('Book Gigs');
    expect(translateFMText('hi', 'signOut')).toBe('Sign out');
    expect(fmChatText('hi', 'sendMessage')).toBe('Send message');
    expect(getFMStatusCopy('hi').locale).toBe('en-GB');
  });
});
