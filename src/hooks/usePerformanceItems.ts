import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerformanceItem {
  id: string;
  name: string;
  description: string | null;
  item_category: 'stage_action' | 'crowd_interaction' | 'special_effect' | 'improvisation' | 'storytelling';
  required_skill: string | null;
  required_genre: string | null;
  min_skill_level: number;
  base_impact_min: number;
  base_impact_max: number;
  duration_seconds: number;
  energy_cost: number;
  crowd_appeal: number;
}

export const usePerformanceItems = () => {
  return useQuery({
    queryKey: ['performance-items-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_items_catalog')
        .select('*')
        .order('item_category')
        .order('name');
      
      if (error) throw error;
      return data as PerformanceItem[];
    },
  });
};

export const useFilteredPerformanceItems = (userSkills: Record<string, number>, userGenres: string[]) => {
  const { data: allItems, ...query } = usePerformanceItems();
  
  // Return ALL items - no filtering by skills or genres
  // Users can select any performance item for their setlist
  return {
    ...query,
    data: allItems,
    allItems
  };
};
