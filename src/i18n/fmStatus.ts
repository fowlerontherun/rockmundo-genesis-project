import type { Language, SupportedLanguage } from './index';

const COPY: Record<SupportedLanguage, { cash: string; fame: string; health: string; energy: string; locale: string }> = {
  en: { cash: 'Cash', fame: 'Fame', health: 'Health', energy: 'Energy', locale: 'en-GB' },
  es: { cash: 'Efectivo', fame: 'Fama', health: 'Salud', energy: 'Energía', locale: 'es-ES' },
  zh: { cash: '现金', fame: '名望', health: '健康', energy: '精力', locale: 'zh-CN' },
  pt: { cash: 'Dinheiro', fame: 'Fama', health: 'Saúde', energy: 'Energia', locale: 'pt-BR' },
  ja: { cash: '所持金', fame: '名声', health: '健康', energy: 'エネルギー', locale: 'ja-JP' },
  de: { cash: 'Bargeld', fame: 'Ruhm', health: 'Gesundheit', energy: 'Energie', locale: 'de-DE' },
  fr: { cash: 'Argent', fame: 'Notoriété', health: 'Santé', energy: 'Énergie', locale: 'fr-FR' },
  tr: { cash: 'Nakit', fame: 'Şöhret', health: 'Sağlık', energy: 'Enerji', locale: 'tr-TR' },
  it: { cash: 'Denaro', fame: 'Fama', health: 'Salute', energy: 'Energia', locale: 'it-IT' },
};

const resolveLanguage = (language: Language): SupportedLanguage => language in COPY ? language as SupportedLanguage : 'en';

export const getFMStatusCopy = (language: Language) => COPY[resolveLanguage(language)];
