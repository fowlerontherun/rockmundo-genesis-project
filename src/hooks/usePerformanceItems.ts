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
  
  console.log('[useFilteredPerformanceItems] Filtering items with:', {
    totalItems: allItems?.length || 0,
    userSkills,
    userGenres
  });
  
  const availableItems = allItems?.filter(item => {
    // Check skill requirement
    if (item.required_skill) {
      const userSkillLevel = userSkills[item.required_skill] || 0;
      const hasSkill = userSkillLevel >= item.min_skill_level;
      
      console.log('[useFilteredPerformanceItems] Skill filter:', {
        itemName: item.name,
        requiredSkill: item.required_skill,
        userSkillLevel,
        minRequired: item.min_skill_level,
        passed: hasSkill
      });
      
      if (!hasSkill) {
        return false;
      }
    }
    
    // Check genre requirement (if any)
    if (item.required_genre) {
      const hasGenre = userGenres.includes(item.required_genre);
      
      console.log('[useFilteredPerformanceItems] Genre filter:', {
        itemName: item.name,
        requiredGenre: item.required_genre,
        userGenres,
        passed: hasGenre
      });
      
      if (!hasGenre) {
        return false;
      }
    }
    
    console.log('[useFilteredPerformanceItems] Item passed all filters:', item.name);
    return true;
  });
  
  console.log('[useFilteredPerformanceItems] Filter results:', {
    totalItems: allItems?.length || 0,
    availableItems: availableItems?.length || 0,
    lockedItems: (allItems?.length || 0) - (availableItems?.length || 0)
  });
  
  return {
    ...query,
    data: availableItems,
    allItems
  };
};
