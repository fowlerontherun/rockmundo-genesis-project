import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { type EquipmentItemRecord } from "@/types/gear";

export interface PlayerEquipmentWithItem {
  id: string;
  equipment_id: string;
  condition: number | null;
  is_equipped: boolean | null;
  created_at: string | null;
  equipment?: EquipmentItemRecord | null;
}

export const usePlayerEquipment = () => {
  const { user } = useAuth();

  return useQuery<PlayerEquipmentWithItem[]>({
    queryKey: ["player-equipment", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from("player_equipment")
        .select(
          `id, equipment_id, condition, is_equipped, created_at,
           equipment:equipment_items!equipment_id (
             id,
             name,
             category,
             gear_category_id,
             gear_category:gear_categories (id, slug, label, description, icon, sort_order),
             subcategory,
             price_cash,
             price_fame,
             rarity,
             description,
             stat_boosts,
             stock,
             is_stock_tracked,
             auto_restock
           )`
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data as PlayerEquipmentWithItem[] | null) ?? [];
    },
    enabled: !!user?.id,
  });
};
