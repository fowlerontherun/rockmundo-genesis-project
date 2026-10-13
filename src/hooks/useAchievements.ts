import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  icon_key?: string | null;
  category: string | null;
  rarity: string | null;
  tier?: string | null;
  slug?: string | null;
  achievement_type?: string | null;
  is_hidden?: boolean | null;
  hidden_hint?: string | null;
  points?: number | null;
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

export const useAchievements = (profileId?: string) => {
  const { data: allAchievements = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .or("is_hidden.eq.false,is_hidden.is.null")
        .order("category", { ascending: true });

      if (error) throw error;
      return data as Achievement[];
    },
    staleTime: 600_000,
  });

  const { data: playerAchievements = [], isLoading: isLoadingPlayer } = useQuery({
    queryKey: ["player-achievements", profileId],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("player_achievements")
        .select(`
          *,
          achievement:achievement_id(*)
        `)
        .eq("profile_id", profileId)
        .order("unlocked_at", { ascending: false });

      if (error) throw error;
      return data as any as PlayerAchievement[];
    },
    enabled: !!profileId,
  });

  const unlockedIds = new Set(playerAchievements.map(pa => pa.achievement_id));
  const unlocked = playerAchievements.map(pa => pa.achievement).filter(Boolean) as Achievement[];
  const revealedHidden = unlocked.filter(a => a.is_hidden && !allAchievements.some(publicItem => publicItem.id === a.id));
  const visibleAchievements = [...allAchievements, ...revealedHidden];
  const locked = visibleAchievements.filter(a => !unlockedIds.has(a.id));

  const progressByCategory = visibleAchievements.reduce((acc, achievement) => {
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
    allAchievements: visibleAchievements,
    playerAchievements,
    unlockedAchievements: unlocked,
    lockedAchievements: locked,
    progressByCategory,
    isLoading: isLoadingAll || (!!profileId && isLoadingPlayer),
    totalAchievements: visibleAchievements.length,
    totalUnlocked: unlocked.length,
    completionPercentage: visibleAchievements.length > 0 
      ? Math.round((unlocked.length / visibleAchievements.length) * 100) 
      : 0,
  };
};
