import type { ClothingItem } from "@/hooks/useSkinStore";
import { resolveEquippedClothingVisual } from "@/features/clothing-preview/equippedClothing";
import { appearanceFromLegacy, resolveAppearance } from "@/features/player-model/appearance";
import type { GigPlayerModelsData, LegacyStageAppearanceRow } from "@/features/player-model/usePlayerModel";

export interface RawGigVisualSnapshot {
  version: 1;
  performers: Array<{
    profile_id: string;
    visual_snapshot: {
      version?: number;
      appearance?: unknown;
      legacy?: unknown;
      clothing?: unknown;
    };
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objectRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

/** Resolve only saved, trusted per-gig visuals. Never fetch current wardrobe. */
export function resolveStoredGigStageVisuals(value: unknown): GigPlayerModelsData | null {
  if (!objectRecord(value) || value.version !== 1 || !Array.isArray(value.performers)) return null;
  if (value.performers.length === 0 || value.performers.length > 50) return null;
  const appearances: GigPlayerModelsData["appearances"] = {};
  const richClothing: GigPlayerModelsData["richClothing"] = {};
  const seen = new Set<string>();

  for (const row of value.performers) {
    if (!objectRecord(row) || typeof row.profile_id !== "string" || !UUID.test(row.profile_id)
        || seen.has(row.profile_id) || !objectRecord(row.visual_snapshot)) return null;
    seen.add(row.profile_id);
    const data = row.visual_snapshot;
    if (data.version !== 1) return null;
    if (objectRecord(data.appearance)) {
      appearances[row.profile_id] = resolveAppearance(data.appearance, row.profile_id);
    } else if (objectRecord(data.legacy)) {
      appearances[row.profile_id] = appearanceFromLegacy(
        { ...data.legacy, profile_id: row.profile_id } as LegacyStageAppearanceRow,
        row.profile_id,
      );
    } else {
      appearances[row.profile_id] = resolveAppearance(null, row.profile_id);
    }

    if (!Array.isArray(data.clothing) || data.clothing.length > 100) return null;
    richClothing[row.profile_id] = [];
    for (const raw of data.clothing) {
      if (!objectRecord(raw) || !objectRecord(raw.item) || typeof raw.item.id !== "string"
          || !UUID.test(raw.item.id)) return null;
      const selectedVariantKey = typeof raw.selectedVariantKey === "string" ? raw.selectedVariantKey : null;
      const customizationConfig = objectRecord(raw.customizationConfig)
        ? Object.fromEntries(Object.entries(raw.customizationConfig).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ))
        : {};
      richClothing[row.profile_id].push(resolveEquippedClothingVisual(
        raw.item as unknown as ClothingItem, selectedVariantKey, customizationConfig,
      ));
    }
  }
  return { appearances, richClothing };
}
