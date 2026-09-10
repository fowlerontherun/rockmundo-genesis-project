import type { ClothingItem } from '@/hooks/useSkinStore';
import { clothingPreviewVariants, type ClothingPreviewVariant } from './clothingPreview';

export type ClothingZoneColours = Record<string, string>;

export interface OwnedClothingCustomization {
  selectedVariantKey?: string | null;
  zoneColours?: ClothingZoneColours | null;
}

const validColour = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export function playerEditableClothingZones(item: ClothingItem) {
  const zones = Array.isArray(item.customization_zones) ? item.customization_zones : [];
  return zones.filter(zone => zone && (zone.playerEditable === true || (zone as any).player_editable === true));
}

export function sanitizeClothingZoneColours(item: ClothingItem, colours: unknown): ClothingZoneColours {
  if (!colours || typeof colours !== 'object' || Array.isArray(colours)) return {};
  const editable = new Set(playerEditableClothingZones(item).map(zone => String(zone.id)));
  return Object.fromEntries(
    Object.entries(colours as Record<string, unknown>)
      .filter(([zoneId, colour]) => editable.has(zoneId) && validColour(colour))
      .map(([zoneId, colour]) => [zoneId, String(colour).toLowerCase()]),
  );
}

export function clothingVariantByKey(item: ClothingItem, key?: string | null): ClothingPreviewVariant | undefined {
  if (!key) return undefined;
  return clothingPreviewVariants(item).find(variant => variant.id === key || variant.label === key);
}

export function defaultClothingZoneColours(item: ClothingItem): ClothingZoneColours {
  return Object.fromEntries(
    playerEditableClothingZones(item)
      .filter(zone => validColour(zone.color))
      .map(zone => [String(zone.id), String(zone.color).toLowerCase()]),
  );
}

export function applyClothingZoneColours(item: ClothingItem, colours: ClothingZoneColours): ClothingItem {
  const safe = sanitizeClothingZoneColours(item, colours);
  if (!Object.keys(safe).length) return item;

  const zones = (Array.isArray(item.customization_zones) ? item.customization_zones : []).map(zone => (
    safe[String(zone.id)] ? { ...zone, color: safe[String(zone.id)] } : zone
  ));

  const details = (Array.isArray(item.detail_layers) ? item.detail_layers : []).map(detail => {
    const override = safe[String(detail.zone || '')];
    return override ? { ...detail, color: override } : detail;
  });

  const material = { ...(item.material_config || {}) } as Record<string, any>;
  const editableZones = playerEditableClothingZones(item);
  const primaryZone = editableZones.find(zone => zone.id === 'main') || editableZones[0];
  const secondaryZone = editableZones.find(zone => zone.id === 'trim') || editableZones[1];
  if (primaryZone && safe[String(primaryZone.id)]) {
    material.primaryColor = safe[String(primaryZone.id)];
    material.primary_color = safe[String(primaryZone.id)];
  }
  if (secondaryZone && safe[String(secondaryZone.id)]) {
    material.secondaryColor = safe[String(secondaryZone.id)];
    material.secondary_color = safe[String(secondaryZone.id)];
  }

  return {
    ...item,
    customization_zones: zones,
    detail_layers: details,
    material_config: material,
  };
}

export function buildCustomizedClothingItem(item: ClothingItem, customization?: OwnedClothingCustomization | null) {
  return applyClothingZoneColours(item, customization?.zoneColours || {});
}
