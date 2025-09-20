import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ProfileRow = Tables<"profiles">;

type PlayerEquipmentRow = Tables<"player_equipment">;

export type ClothingLoadout = Record<string, string>;

export interface WardrobeDefaultPiece {
  slot: string;
  name: string;
}

export const DEFAULT_OUTFIT: WardrobeDefaultPiece[] = [
  { slot: "footwear", name: "White Trainers" },
  { slot: "bottoms", name: "Black Jeans" },
  { slot: "top", name: "Rockmundo Logo Tee" }
];

export const parseClothingLoadout = (
  value: ProfileRow["equipment_loadout"] | null | undefined,
): ClothingLoadout => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  return entries.reduce<ClothingLoadout>((acc, [slot, equipmentId]) => {
    acc[slot.toLowerCase()] = equipmentId;
    return acc;
  }, {});
};

export const resolveClothingSlot = (category?: string | null, subcategory?: string | null) => {
  if (!category) {
    return "misc";
  }

  if (category.toLowerCase() !== "clothing") {
    return category.toLowerCase();
  }

  if (subcategory) {
    return subcategory.toLowerCase();
  }

  return "clothing";
};

export const formatClothingSlot = (slot: string) => {
  const normalized = slot.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const setClothingLoadoutValue = (
  loadout: ClothingLoadout,
  slot: string,
  equipmentId: string | null
) => {
  const next = { ...loadout };

  if (equipmentId) {
    next[slot] = equipmentId;
  } else {
    delete next[slot];
  }

  return next;
};

export const ensureDefaultWardrobe = async (
  profileId: string,
  userId: string,
  existingLoadout?: ClothingLoadout
): Promise<ClothingLoadout | null> => {
  const currentLoadout = existingLoadout ? { ...existingLoadout } : {};
  const missingPieces = DEFAULT_OUTFIT.filter(piece => !currentLoadout[piece.slot]);

  if (!missingPieces.length) {
    return null;
  }

  const itemNames = DEFAULT_OUTFIT.map(piece => piece.name);
  const { data: equipmentItems, error: equipmentError } = await supabase
    .from("equipment_items")
    .select("id, name, category, subcategory")
    .in("name", itemNames);

  if (equipmentError) {
    throw equipmentError;
  }

  const itemsByName = new Map((equipmentItems ?? []).map(item => [item.name, item]));

  const equipmentIds = (equipmentItems ?? []).map(item => item.id);
  const { data: playerEquipment, error: playerEquipmentError } = await supabase
    .from("player_equipment")
    .select("id, equipment_id, equipped")
    .eq("user_id", userId)
    .in("equipment_id", equipmentIds.length ? equipmentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (playerEquipmentError) {
    throw playerEquipmentError;
  }

  const equipmentById = new Map((playerEquipment ?? []).map(item => [item.equipment_id, item]));
  let hasUpdates = false;

  for (const piece of DEFAULT_OUTFIT) {
    if (currentLoadout[piece.slot]) {
      continue;
    }

    const equipment = itemsByName.get(piece.name);

    if (!equipment) {
      continue;
    }

    const existing = equipmentById.get(equipment.id);

    if (!existing) {
      await supabase.from("player_equipment").insert({
        user_id: userId,
        equipment_id: equipment.id,
        equipped: true,
        condition: 100
      } satisfies Partial<PlayerEquipmentRow>);
      hasUpdates = true;
    } else if (!existing.equipped) {
      await supabase
        .from("player_equipment")
        .update({ equipped: true })
        .eq("id", existing.id);
      hasUpdates = true;
    }

    currentLoadout[piece.slot] = equipment.id;
  }

  if (!hasUpdates) {
    // If we only filled the loadout object without touching equipment rows, we still
    // consider the loadout to be updated when new slots were added.
    const originalKeys = Object.keys(existingLoadout ?? {});
    const currentKeys = Object.keys(currentLoadout);
    const addedSlot = currentKeys.some(slot => !originalKeys.includes(slot));

    if (!addedSlot) {
      return null;
    }
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({ equipment_loadout: currentLoadout as ProfileRow["equipment_loadout"] })
    .eq("id", profileId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  return currentLoadout;
};
