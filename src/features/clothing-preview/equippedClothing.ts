import type { ClothingItem, OwnedSkin } from '@/hooks/useSkinStore';
import { isAvatarV1HeadAccessory } from './curatedGarmentAssets';
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

/**
 * Resolve head-bone accessories from the character's own RLS-protected
 * inventory independently of the stage-batch RPC. The stage RPC can time out
 * even while the saved ownership record is correct. The inventory is
 * authoritative for headwear/eyewear once loaded; ordinary rich garments keep
 * their separate stage pipeline.
 *
 * Never show a gifted-but-not-equipped Pumpkin Hat; inventory has to report
 * is_equipped=true for this actual character.
 */
export function mergeEquippedAvatarV1Accessories(
  stageClothing: ResolvedEquippedClothing[],
  owned: OwnedSkin[] | undefined,
  catalogue: ClothingItem[] | undefined,
): ResolvedEquippedClothing[] {
  if (!owned || !catalogue) return stageClothing;
  const byId = new Map(catalogue.filter(isAvatarV1HeadAccessory).map(item => [item.id, item]));
  const equipped = new Map(
    owned.filter(row =>
      row.item_type === 'clothing' && row.is_equipped === true && byId.has(row.item_id)
    ).map(row => [row.item_id, row]),
  );
  const others = stageClothing.filter(row => !isAvatarV1HeadAccessory(row.item));
  // Keep deterministic inventory order; do not rely on a stale stage response
  // after a user equips/removes a hat while the designer is already open.
  const accessories = [...equipped.values()].map(row =>
    resolveEquippedClothingVisual(byId.get(row.item_id)!, row.selected_variant_key, row.customization_config),
  );
  return [...others, ...accessories];
}
