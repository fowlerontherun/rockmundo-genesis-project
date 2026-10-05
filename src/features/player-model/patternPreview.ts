import type { ClothingPattern } from './appearance';

/** A lightweight wardrobe swatch; the avatar remains the authoritative fit preview. */
export function patternPreview(pattern: ClothingPattern | undefined, primary: string, secondary: string) {
  switch (pattern) {
    case 'stripes': return `repeating-linear-gradient(0deg, ${primary} 0 12px, ${secondary} 12px 20px)`;
    case 'checks': return `repeating-conic-gradient(${primary} 0% 25%, ${secondary} 0% 50%) 0 / 24px 24px`;
    case 'dots': return `radial-gradient(circle, ${secondary} 3px, transparent 4px) 0 / 18px 18px, ${primary}`;
    case 'two-tone': return `linear-gradient(180deg, ${primary} 50%, ${secondary} 50%)`;
    default: return primary;
  }
}
