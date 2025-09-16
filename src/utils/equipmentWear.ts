import { supabase } from "@/integrations/supabase/client";

export type WearEventType = "gig" | "tour" | "rehearsal";

export interface WearUpdateEntry {
  itemId: string;
  itemName: string;
  category?: string | null;
  previousCondition: number;
  newCondition: number;
  change: number;
}

export interface WearSummary {
  userId: string;
  eventType: WearEventType;
  timestamp: number;
  updates: WearUpdateEntry[];
}

export const RECENT_WEAR_STORAGE_KEY = "rockmundo_recent_wear";

const WEAR_CONFIG: Record<WearEventType, { equipped: { min: number; max: number }; unequipped: { min: number; max: number } }> = {
  gig: {
    equipped: { min: 5, max: 12 },
    unequipped: { min: 1, max: 4 },
  },
  tour: {
    equipped: { min: 8, max: 16 },
    unequipped: { min: 2, max: 6 },
  },
  rehearsal: {
    equipped: { min: 3, max: 7 },
    unequipped: { min: 1, max: 3 },
  },
};

interface EquipmentRecord {
  id: string;
  condition: number | null;
  equipped: boolean | null;
  is_equipped: boolean | null;
  equipment?: {
    name?: string | null;
    category?: string | null;
  } | null;
}

const getRandomInt = (min: number, max: number) => {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
};

const persistWearSummary = (summary: WearSummary) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(RECENT_WEAR_STORAGE_KEY, JSON.stringify(summary));
  } catch (error) {
    console.warn("Failed to persist wear summary", error);
  }
};

export const applyEquipmentWear = async (
  userId: string | undefined,
  eventType: WearEventType,
): Promise<WearSummary | null> => {
  if (!userId) return null;

  const wearSettings = WEAR_CONFIG[eventType];

  const { data, error } = await supabase
    .from("player_equipment")
    .select(`
      id,
      condition,
      equipped,
      is_equipped,
      equipment:equipment_items!player_equipment_equipment_id_fkey (name, category)
    `)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load equipment for wear application", error);
    throw error;
  }

  const equipmentList = (data || []) as EquipmentRecord[];

  if (!equipmentList.length) {
    return null;
  }

  const updates: WearUpdateEntry[] = [];

  for (const item of equipmentList) {
    const isEquipped = Boolean(item.equipped ?? item.is_equipped);
    const config = isEquipped ? wearSettings.equipped : wearSettings.unequipped;
    const currentCondition = typeof item.condition === "number" ? item.condition : 100;

    if (currentCondition <= 0) {
      continue;
    }

    const wearAmount = Math.min(currentCondition, getRandomInt(config.min, config.max));

    if (wearAmount <= 0) {
      continue;
    }

    const newCondition = Math.max(0, Math.round(currentCondition - wearAmount));

    if (newCondition === currentCondition) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("player_equipment")
      .update({ condition: newCondition })
      .eq("id", item.id);

    if (updateError) {
      console.error("Failed to update equipment condition", updateError);
      throw updateError;
    }

    updates.push({
      itemId: item.id,
      itemName: item.equipment?.name ?? "Equipment",
      category: item.equipment?.category,
      previousCondition: currentCondition,
      newCondition,
      change: currentCondition - newCondition,
    });
  }

  if (!updates.length) {
    return null;
  }

  const summary: WearSummary = {
    userId,
    eventType,
    timestamp: Date.now(),
    updates,
  };

  persistWearSummary(summary);

  return summary;
};
