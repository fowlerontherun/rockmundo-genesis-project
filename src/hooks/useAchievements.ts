import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  rarity: string | null;
  requirements: Record<string, any> | null;
  rewards: Record<string, any> | null;
  created_at: string | null;
}

export interface PlayerAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export const useAchievements = (userId?: string) => {
  const { data: allAchievements = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;
      return data as Achievement[];
    },
    staleTime: 600_000,
  });

  const { data: playerAchievements = [], isLoading: isLoadingPlayer } = useQuery({
    queryKey: ["player-achievements", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("player_achievements")
        .select(`
          *,
          achievement:achievement_id(*)
        `)
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false });

      if (error) throw error;
      return data as any as PlayerAchievement[];
    },
    enabled: !!userId,
  });

  const unlockedIds = new Set(playerAchievements.map(pa => pa.achievement_id));
  const locked = allAchievements.filter(a => !unlockedIds.has(a.id));
  const unlocked = playerAchievements.map(pa => pa.achievement).filter(Boolean) as Achievement[];

  const progressByCategory = allAchievements.reduce((acc, achievement) => {
    const category = achievement.category || "Other";
    if (!acc[category]) {
      acc[category] = { total: 0, unlocked: 0 };
    }
    acc[category].total++;
    if (unlockedIds.has(achievement.id)) {
      acc[category].unlocked++;
    }
    return acc;
  }, {} as Record<string, { total: number; unlocked: number }>);

  return {
    allAchievements,
    playerAchievements,
    unlockedAchievements: unlocked,
    lockedAchievements: locked,
    progressByCategory,
    isLoading: isLoadingAll || isLoadingPlayer,
    totalAchievements: allAchievements.length,
    totalUnlocked: unlocked.length,
    completionPercentage: allAchievements.length > 0 
      ? Math.round((unlocked.length / allAchievements.length) * 100) 
      : 0,
  };
};
