import type { ClothingItem } from '@/hooks/useSkinStore';
import { clothingPreviewVariants, type ClothingPreviewVariant } from './clothingPreview';
import {
  applyClothingZoneColours,
  clothingVariantByKey,
  playerEditableClothingZones,
  sanitizeClothingZoneColours,
  type ClothingZoneColours,
} from './clothingCustomization';

export interface ResolvedEquippedClothing {
  item: ClothingItem;
  variant?: ClothingPreviewVariant;
}

export function resolveEquippedClothingVisual(
  item: ClothingItem,
  selectedVariantKey?: string | null,
  zoneColours?: ClothingZoneColours | null,
): ResolvedEquippedClothing {
  const safeColours = sanitizeClothingZoneColours(item, zoneColours || {});
  const customizedItem = applyClothingZoneColours(item, safeColours);
  const baseVariant = clothingVariantByKey(item, selectedVariantKey) || clothingPreviewVariants(item)[0];
  if (!baseVariant) return { item: customizedItem };

  const editableZones = playerEditableClothingZones(item);
  const primaryZone = editableZones.find(zone => String(zone.id) === 'main') || editableZones[0];
  const secondaryZone = editableZones.find(zone => String(zone.id) === 'trim') || editableZones[1];
  const primaryOverride = primaryZone ? safeColours[String(primaryZone.id)] : undefined;
  const secondaryOverride = secondaryZone ? safeColours[String(secondaryZone.id)] : undefined;

  return {
    item: customizedItem,
    variant: {
      ...baseVariant,
      ...(primaryOverride ? { color: primaryOverride } : {}),
      ...(secondaryOverride ? { secondaryColor: secondaryOverride } : {}),
    },
  };
}
