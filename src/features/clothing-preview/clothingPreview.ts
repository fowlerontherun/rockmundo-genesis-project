import { STARTER_ITEMS, appearanceFromLegacy, type EquipmentSlot, type PlayerAppearance, type Style } from '@/features/player-model/appearance';
import type { AvatarConfig } from '@/hooks/usePlayerAvatar';
import type { ClothingDetailLayer, ClothingItem } from '@/hooks/useSkinStore';

export interface ClothingPreviewVariant {
  id: string;
  label: string;
  color: string;
  secondaryColor?: string;
  material?: string;
  pattern?: string;
}

const validColor = (value: unknown, fallback = '#20232b') =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;

const recordValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const firstString = (...values: unknown[]): string | undefined => {
  const match = values.find(value => typeof value === 'string' && value.trim().length > 0);
  return typeof match === 'string' ? match : undefined;
};

function proxyStyle(item: ClothingItem): Style {
  const garment = recordValue(item.garment_config);
  const material = recordValue(item.material_config);
  const wear = recordValue(item.wear_config);
  const details: ClothingDetailLayer[] = Array.isArray(item.detail_layers) ? item.detail_layers : [];
  const text = [
    item.category,
    garment.silhouette,
    garment.cut,
    material.fabric,
    wear.condition,
    ...details.map(detail => detail.type),
  ].join(' ').toLowerCase();
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
  const matrix = Array.isArray(item.variant_matrix) ? item.variant_matrix : [];
  const material = recordValue(item.material_config);
  const pattern = recordValue(item.pattern_config);
  const primary = validColor(firstString(material.primaryColor, material.primary_color));
  const secondary = validColor(firstString(material.secondaryColor, material.secondary_color), '#d8ad49');

  const fromMatrix = matrix.map((variant, index) => {
    const variantRecord = variant as unknown as Record<string, unknown>;
    const label = firstString(variant.name, variant.label) ?? `Variant ${index + 1}`;
    return {
      id: firstString(variant.id, variant.key, variant.name, variant.label) ?? `variant-${index}`,
      label,
      color: validColor(
        firstString(variant.primaryColor, variantRecord.color, variantRecord.primary_color),
        primary,
      ),
      secondaryColor: validColor(
        firstString(variant.secondaryColor, variantRecord.secondary_color),
        secondary,
      ),
      material: firstString(variant.material, material.fabric),
      pattern: firstString(variant.pattern, pattern.type),
    };
  });
  if (fromMatrix.length) return fromMatrix;

  const colors = Array.isArray(item.color_variants)
    ? item.color_variants.filter((color: unknown): color is string => typeof color === 'string')
    : [];
  if (colors.length) {
    return colors.map((color, index) => ({
      id: `color-${index}`,
      label: `Colour ${index + 1}`,
      color: validColor(color),
      secondaryColor: secondary,
      material: firstString(material.fabric),
      pattern: firstString(pattern.type),
    }));
  }

  return [{
    id: 'default',
    label: 'Default',
    color: primary,
    secondaryColor: secondary,
    material: firstString(material.fabric),
    pattern: firstString(pattern.type),
  }];
}

export function buildClothingPreviewAppearance(
  avatar: AvatarConfig | null | undefined,
  item: ClothingItem,
  variant?: ClothingPreviewVariant,
): PlayerAppearance {
  const seed = avatar?.profile_id || item.id;
  const appearance = appearanceFromLegacy((avatar || null) as unknown as Record<string, unknown> | null, seed);
  const slot = proxySlot(item);
  if (!slot) return appearance;

  const style = proxyStyle(item);
  const starter = STARTER_ITEMS[slot].find(candidate => candidate.style === style) || STARTER_ITEMS[slot][0];
  const material = recordValue(item.material_config);
  const firstLegacyColour = Array.isArray(item.color_variants) ? item.color_variants[0] : undefined;

  appearance.equipment[slot] = {
    itemId: starter.id,
    color: validColor(
      variant?.color,
      validColor(firstString(material.primaryColor, material.primary_color, firstLegacyColour)),
    ),
  };
  appearance.head.style = style;
  return appearance;
}

export function previewFidelity(item: ClothingItem) {
  return proxySlot(item) ? 'procedural-proxy' as const : 'avatar-only' as const;
}
