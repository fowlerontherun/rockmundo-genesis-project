import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseClothingLoadout } from "@/utils/wardrobe";
import { useGameData } from "@/hooks/useGameData";

export interface EquippedClothingItem {
  id: string;
  name: string;
  slot: string;
  subcategory: string | null;
  category: string;
  rarity: string | null;
  description: string | null;
  image_url: string | null;
}

export interface UseEquippedClothingResult {
  items: EquippedClothingItem[];
  loadout: ReturnType<typeof parseClothingLoadout>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  itemsBySlot: Record<string, EquippedClothingItem>;
}

export const useEquippedClothing = (): UseEquippedClothingResult => {
  const { profile } = useGameData();
  const [items, setItems] = useState<EquippedClothingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadout = useMemo(() => {
    return parseClothingLoadout(profile?.equipped_clothing ?? null);
  }, [profile?.equipped_clothing]);

  const fetchClothing = useCallback(async () => {
    if (!profile) {
      setItems([]);
      return;
    }

    const equipmentIds = Object.values(loadout);

    if (!equipmentIds.length) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("equipment_items")
        .select("id, name, category, subcategory, rarity, description, image_url")
        .in("id", equipmentIds);

      if (queryError) {
        throw queryError;
      }

      const slotEntries = Object.entries(loadout);
      const mapped = (data ?? []).map((item) => {
        const slotEntry = slotEntries.find(([, equipmentId]) => equipmentId === item.id);
        const slot = (slotEntry?.[0] ?? item.subcategory ?? item.category ?? "clothing").toLowerCase();

        return {
          id: item.id,
          name: item.name,
          slot,
          subcategory: item.subcategory,
          category: item.category,
          rarity: item.rarity,
          description: item.description,
          image_url: item.image_url,
        } satisfies EquippedClothingItem;
      });

      mapped.sort((a, b) => a.slot.localeCompare(b.slot));
      setItems(mapped);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load clothing";
      console.error("Failed to load equipped clothing", caughtError);
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [loadout, profile]);

  useEffect(() => {
    void fetchClothing();
  }, [fetchClothing]);

  const itemsBySlot = useMemo(() => {
    return items.reduce<Record<string, EquippedClothingItem>>((acc, item) => {
      acc[item.slot] = item;
      return acc;
    }, {});
  }, [items]);

  return {
    items,
    loadout,
    loading,
    error,
    refetch: fetchClothing,
    itemsBySlot,
  };
};
