import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface PlayerEquipmentWithItem {
  id: string;
  equipment_id: string;
  condition: number | null;
  is_equipped: boolean | null;
  created_at: string | null;
  equipment?: {
    id: string;
    name: string;
    category: string;
    subcategory: string | null;
    price: number;
    rarity: string | null;
    description: string | null;
    stat_boosts: Record<string, number> | null;
    stock: number | null;
  } | null;
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
           equipment:equipment_items!equipment_id (id, name, category, subcategory, price, rarity, description, stat_boosts, stock)`
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
