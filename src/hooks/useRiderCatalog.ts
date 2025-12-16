import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RiderItem {
  id: string;
  name: string;
  category: "technical" | "hospitality" | "backstage";
  base_cost: number;
  description?: string;
  tier_required?: string;
}

export const useRiderCatalog = () => {
  const { data: items, isLoading } = useQuery({
    queryKey: ["rider-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_item_catalog")
        .select("*")
        .order("category")
        .order("name");

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category as "technical" | "hospitality" | "backstage",
        base_cost: item.base_cost || 0,
        description: item.description,
        tier_required: item.tier_required,
      })) as RiderItem[];
    },
  });

  return {
    items: items || [],
    isLoading,
  };
};
