import { STARTER_ITEMS, appearanceFromLegacy, type EquipmentSlot, type PlayerAppearance, type Style } from '@/features/player-model/appearance';
import type { AvatarConfig } from '@/hooks/usePlayerAvatar';
import type { ClothingItem } from '@/hooks/useSkinStore';

export interface ClothingPreviewVariant {
  id: string;
  label: string;
  color: string;
  material?: string;
  pattern?: string;
}

const validColor = (value: unknown, fallback = '#20232b') => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;

function proxyStyle(item: ClothingItem): Style {
  const garment = (item.garment_config || {}) as Record<string, any>;
  const material = (item.material_config || {}) as Record<string, any>;
  const wear = (item.wear_config || {}) as Record<string, any>;
  const details = Array.isArray(item.detail_layers) ? item.detail_layers as any[] : [];
  const text = [item.category, garment.silhouette, garment.cut, material.fabric, wear.condition, ...details.map(d => d.type)].join(' ').toLowerCase();
  if (/suit|tailor|formal|blazer|silk|satin|pinstripe/.test(text)) return 'suit';
  if (/punk|leather|vinyl|latex|distress|stud|patch|tartan|plaid|mohawk/.test(text)) return 'punk';
  return 'casual';
}

function proxySlot(item: ClothingItem): EquipmentSlot | null {
  const slot = item.wearable_slot || item.category;
  if (['top','outerwear','dress','shirt','t-shirt','tank-top','hoodie','sweater','jacket','coat','vest'].includes(String(slot))) return 'top';
  if (['bottom','pants','jeans','shorts','skirt'].includes(String(slot))) return 'bottom';
  if (['footwear','shoes','boots','trainers'].includes(String(slot))) return 'footwear';
  return null;
}

export function clothingPreviewVariants(item: ClothingItem): ClothingPreviewVariant[] {
  const matrix = Array.isArray(item.variant_matrix) ? item.variant_matrix as any[] : [];
  const material = (item.material_config || {}) as Record<string, any>;
  const pattern = (item.pattern_config || {}) as Record<string, any>;
  const fromMatrix = matrix.map((variant, index) => {
    const label = String(variant.name || variant.label || `Variant ${index + 1}`);
    return {
      id: String(variant.id || variant.key || variant.name || variant.label || index),
      label,
      color: validColor(variant.primaryColor || variant.color || variant.primary_color, validColor(material.primaryColor || material.primary_color)),
      material: variant.material || material.fabric,
      pattern: variant.pattern || pattern.type,
    };
  });
  if (fromMatrix.length) return fromMatrix;
  const colors = Array.isArray(item.color_variants) ? item.color_variants as string[] : [];
  if (colors.length) return colors.map((color, index) => ({ id: `color-${index}`, label: `Colour ${index + 1}`, color: validColor(color), material: material.fabric, pattern: pattern.type }));
  return [{ id: 'default', label: 'Default', color: validColor(material.primaryColor || material.primary_color), material: material.fabric, pattern: pattern.type }];
}

export function buildClothingPreviewAppearance(avatar: AvatarConfig | null | undefined, item: ClothingItem, variant?: ClothingPreviewVariant): PlayerAppearance {
  const seed = avatar?.profile_id || item.id;
  const appearance = appearanceFromLegacy((avatar || null) as unknown as Record<string, unknown> | null, seed);
  const slot = proxySlot(item);
  if (!slot) return appearance;
  const style = proxyStyle(item);
  const starter = STARTER_ITEMS[slot].find(candidate => candidate.style === style) || STARTER_ITEMS[slot][0];
  appearance.equipment[slot] = {
    itemId: starter.id as any,
    color: validColor(variant?.color, validColor((item.material_config as any)?.primaryColor || (item.material_config as any)?.primary_color || (item.color_variants as any)?.[0])),
  };
  appearance.head.style = style;
  return appearance;
}

export function previewFidelity(item: ClothingItem) {
  return proxySlot(item) ? 'procedural-proxy' as const : 'avatar-only' as const;
}
