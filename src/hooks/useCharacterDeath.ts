import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface DeadCharacter {
  id: string;
  profile_id: string;
  character_name: string;
  avatar_url: string | null;
  cause_of_death: string;
  died_at: string;
  total_fame: number;
  total_cash_at_death: number;
  final_skills: Record<string, number>;
  generation_number: number;
  resurrection_lives: number;
}

export function useCharacterDeath() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query dead profiles directly from profiles table (more reliable than hall_of_immortals)
  const deadCharactersQuery = useQuery({
    queryKey: ["dead-characters", user?.id],
    queryFn: async (): Promise<DeadCharacter[]> => {
      if (!user?.id) return [];

      // Get dead profiles directly - these always exist even if hall_of_immortals entry is missing
      const { data: deadProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, died_at, fame, cash, level, generation_number, resurrection_lives")
        .eq("user_id", user.id)
        .not("died_at", "is", null)
        .order("died_at", { ascending: false }) as any;

      if (profileError) throw profileError;
      if (!deadProfiles || deadProfiles.length === 0) return [];

      // Try to get memorial data from hall_of_immortals for richer info
      const { data: memorials } = await supabase
        .from("hall_of_immortals")
        .select("profile_id, character_name, cause_of_death, total_fame, total_cash_at_death, final_skills")
        .eq("user_id", user.id);

      const memorialMap = new Map(
        (memorials ?? []).map((m) => [m.profile_id, m])
      );

      return deadProfiles.map((p) => {
        const memorial = memorialMap.get(p.id);
        return {
          id: p.id,
          profile_id: p.id,
          character_name: memorial?.character_name ?? p.display_name ?? p.username ?? "Unknown",
          avatar_url: p.avatar_url,
          cause_of_death: memorial?.cause_of_death ?? "Inactivity",
          died_at: p.died_at!,
          total_fame: memorial?.total_fame ?? p.fame ?? 0,
          total_cash_at_death: memorial?.total_cash_at_death ?? p.cash ?? 0,
          final_skills: (memorial?.final_skills as Record<string, number>) ?? {},
          generation_number: p.generation_number ?? 1,
          resurrection_lives: (p as any).resurrection_lives ?? 0,
        };
      });
    },
    enabled: !!user?.id,
  });

  // Check if user has any living active profiles
  const hasLivingCharacter = useQuery({
    queryKey: ["has-living-character", user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;

      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("died_at", null)
        .eq("is_active", true);

      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id,
  });

  // Create child character inheriting 10% skills, 50% cash
  const createChildCharacter = useMutation({
    mutationFn: async (parentProfileId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const parent = deadCharactersQuery.data?.find((d) => d.profile_id === parentProfileId);
      if (!parent) throw new Error("Parent character not found");

      const inheritedCash = Math.floor(parent.total_cash_at_death * 0.5);
      const inheritedSkills: Record<string, number> = {};
      for (const [skill, val] of Object.entries(parent.final_skills || {})) {
        const inherited = Math.floor(val * 0.1);
        if (inherited > 0) inheritedSkills[skill] = inherited;
      }

      // Get next slot number
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const slotNumber = (count ?? 0) + 1;

      // Deactivate all other profiles
      await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Create new profile
      const { data: newProfile, error } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          username: `child-of-${parent.character_name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}`,
          display_name: null,
          avatar_url: null,
          bio: null,
          cash: inheritedCash,
          fame: 0,
          level: 1,
          health: 100,
          energy: 100,
          experience: 0,
          age: 16,
          is_active: true,
          slot_number: slotNumber,
          generation_number: (parent.generation_number || 1) + 1,
          parent_profile_id: parent.profile_id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Insert inherited skills
      const skillInserts = Object.entries(inheritedSkills).map(([slug, level]) => ({
        profile_id: newProfile.id,
        skill_slug: slug,
        current_level: level,
        current_xp: 0,
        required_xp: 100,
      }));

      if (skillInserts.length > 0) {
        await supabase.from("skill_progress").insert(skillInserts);
      }

      return newProfile.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["has-living-character"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const resurrectCharacter = useMutation({
    mutationFn: async (profileId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase.rpc("resurrect_character" as any, {
        p_profile_id: profileId,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["has-living-character"] });
      queryClient.invalidateQueries({ queryKey: ["dead-characters"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Create fresh random character (no inheritance)
  const createFreshCharacter = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const slotNumber = (count ?? 0) + 1;

      await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("user_id", user.id);

      const { error } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          username: `player-${user.id.slice(0, 8)}-${slotNumber}`,
          display_name: null,
          avatar_url: null,
          bio: null,
          cash: 10000,
          fame: 0,
          level: 1,
          health: 100,
          energy: 100,
          experience: 0,
          age: 16,
          is_active: true,
          slot_number: slotNumber,
          generation_number: 1,
        })
        .select("id")
        .single();

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["has-living-character"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Update last_login_at on the active profile
  const updateLastLogin = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      await supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_active", true);
    },
  });

  return {
    deadCharacters: deadCharactersQuery.data ?? [],
    deadCharactersLoading: deadCharactersQuery.isLoading,
    hasLivingCharacter: hasLivingCharacter.data ?? true,
    hasLivingCharacterLoading: hasLivingCharacter.isLoading,
    createChildCharacter,
    resurrectCharacter,
    createFreshCharacter,
    updateLastLogin,
  };
}
