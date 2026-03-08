/**
 * Font style definitions for text tattoos
 */

export interface TattooFontStyle {
  id: string;
  label: string;
  description: string;
  priceMultiplier: number;
  css: React.CSSProperties;
}

export const TATTOO_FONTS: TattooFontStyle[] = [
  {
    id: 'gothic',
    label: '🦇 Gothic',
    description: 'Dark, pointed serifs',
    priceMultiplier: 1.0,
    css: { fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0.15em', fontWeight: 700 },
  },
  {
    id: 'script',
    label: '✒️ Elegant Script',
    description: 'Flowing cursive',
    priceMultiplier: 1.2,
    css: { fontFamily: '"Brush Script MT", "Segoe Script", cursive', fontStyle: 'italic', fontWeight: 400 },
  },
  {
    id: 'typewriter',
    label: '⌨️ Typewriter',
    description: 'Monospace, worn look',
    priceMultiplier: 0.8,
    css: { fontFamily: '"Courier New", Courier, monospace', fontWeight: 400, letterSpacing: '0.05em' },
  },
  {
    id: 'bold_caps',
    label: '🔠 Bold Caps',
    description: 'Blocky uppercase',
    priceMultiplier: 1.0,
    css: { fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase' as const, fontWeight: 900 },
  },
  {
    id: 'minimal',
    label: '— Minimal',
    description: 'Thin, clean lines',
    priceMultiplier: 0.9,
    css: { fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 200, letterSpacing: '0.2em' },
  },
  {
    id: 'graffiti',
    label: '🎨 Graffiti',
    description: 'Street art style',
    priceMultiplier: 1.3,
    css: { fontFamily: '"Comic Sans MS", "Marker Felt", cursive', fontWeight: 700, letterSpacing: '0.08em', fontStyle: 'italic' },
  },
  {
    id: 'old_english',
    label: '📜 Old English',
    description: 'Blackletter calligraphy',
    priceMultiplier: 1.4,
    css: { fontFamily: '"Old English Text MT", "Playfair Display", Georgia, serif', fontWeight: 700, letterSpacing: '0.1em' },
  },
  {
    id: 'japanese_brush',
    label: '🖌️ Brush Stroke',
    description: 'Calligraphic brush',
    priceMultiplier: 1.5,
    css: { fontFamily: '"MS Mincho", "Hiragino Mincho Pro", serif', fontWeight: 700, letterSpacing: '0.25em' },
  },
];

export function getFontById(id: string): TattooFontStyle | undefined {
  return TATTOO_FONTS.find(f => f.id === id);
}

export function getFontCss(fontId: string): React.CSSProperties {
  return getFontById(fontId)?.css || {};
}
