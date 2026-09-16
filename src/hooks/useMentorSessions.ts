import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { applyLearningMultiplier } from "@/utils/skillLearningMultiplier";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getSkillMaxLevel = async (skillSlug: string): Promise<number> => {
  const { data, error } = await (supabase as any).rpc("progression_skill_max_level", {
    p_skill_slug: skillSlug,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 20;
};

const getRequiredSkillXp = async (level: number): Promise<number> => {
  const { data, error } = await (supabase as any).rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  const value = Number(data);
  return Number.isFinite(value) && value > 0 ? value : 100;
};

export function useMentorSessions() {
  const { toast } = useToast();
  const { profile: activeProfile, profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();

  const profile = activeProfile ? {
    id: activeProfile.id,
    cash: activeProfile.cash ?? 0,
    experience: activeProfile.experience ?? 0,
    current_city_id: activeProfile.current_city_id,
  } : null;

  const { data: mentors } = useQuery({
    queryKey: ["education_mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_mentors")
        .select(`
          *,
          city:cities(id, name, country)
        `)
        .eq("is_active", true)
        .order("cost", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: discoveries } = useQuery({
    queryKey: ["master_discoveries", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("player_master_discoveries")
        .select("mentor_id, discovered_at, discovery_method")
        .eq("profile_id", profile.id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: recentSessions } = useQuery({
    queryKey: ["mentor_sessions", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("player_mentor_sessions")
        .select("mentor_id, session_date")
        .eq("profile_id", profile.id)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: skillProgress } = useQuery({
    queryKey: ["skill_progress", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("skill_progress")
        .select("id, skill_slug, current_level, current_xp, required_xp")
        .eq("profile_id", profile.id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const isMentorDiscovered = (_mentorId: string) => true;
  const hasClaimedDiscovery = (mentorId: string) => !!discoveries?.some((d) => d.mentor_id === mentorId);
  const getDiscovery = (mentorId: string) => discoveries?.find((d) => d.mentor_id === mentorId) ?? null;

  const getDayName = (day: number | null) => {
    if (day === null || day === undefined) return 'Any day';
    return DAY_NAMES[day] || 'Unknown';
  };

  const isAvailableToday = (availableDay: number | null) => {
    if (availableDay === null || availableDay === undefined) return true;
    return new Date().getDay() === availableDay;
  };

  const isInMentorCity = (mentorCityId: string | null) => {
    if (!mentorCityId) return true;
    return profile?.current_city_id === mentorCityId;
  };

  const discoverMutation = useMutation({
    mutationFn: async ({ mentorId, method = 'exploration' }: { mentorId: string; method?: string }) => {
      if (!profile) throw new Error("Profile not found");
      const { error } = await supabase.rpc('discover_master', {
        p_profile_id: profile.id,
        p_mentor_id: mentorId,
        p_method: method,
        p_metadata: {}
      });
      if (error) throw error;
      return { mentorId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master_discoveries"] });
      toast({
        title: "Master Discovered!",
        description: "You've found a legendary master. They can now be visited for training.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Discovery Failed", description: error.message, variant: "destructive" });
    },
  });

  const bookSessionMutation = useMutation({
    mutationFn: async (mentorId: string) => {
      if (!profile) throw new Error("Profile not found");

      const mentor = mentors?.find((m) => m.id === mentorId);
      if (!mentor) throw new Error("Master not found");

      if (mentor.city_id && !isInMentorCity(mentor.city_id)) {
        const cityName = mentor.city?.name || 'their city';
        throw new Error(`Travel to ${cityName} to train with this master`);
      }

      if (mentor.available_day !== null && !isAvailableToday(mentor.available_day)) {
        const dayName = getDayName(mentor.available_day);
        throw new Error(`${mentor.name} is only available on ${dayName}s`);
      }

      if (profile.cash < mentor.cost) {
        throw new Error(`Insufficient funds (need $${mentor.cost.toLocaleString()})`);
      }

      const lastSession = recentSessions?.find((s) => s.mentor_id === mentorId);
      if (lastSession) {
        const hoursSinceLastSession = (Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSession < mentor.cooldown_hours) {
          const hoursRemaining = Math.ceil(mentor.cooldown_hours - hoursSinceLastSession);
          throw new Error(`Cooldown: ${hoursRemaining} hours remaining`);
        }
      }

      const { data: tierUnlocked, error: tierError } = await (supabase as any).rpc("skill_tier_unlocked", {
        p_profile_id: profile.id,
        p_slug: mentor.focus_skill,
      });
      if (tierError) throw tierError;
      if (tierUnlocked === false) throw new Error("This skill tier is not unlocked yet");

      const maxLevel = await getSkillMaxLevel(mentor.focus_skill);
      const skill = skillProgress?.find((s) => s.skill_slug === mentor.focus_skill);
      const currentLevel = skill?.current_level || 0;
      const xpEarned = Math.floor(mentor.base_xp * (1 + currentLevel * 0.1));

      const { data: attrs } = await supabase
        .from('player_attributes')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      const baseSkillValue = Math.floor(xpEarned * mentor.skill_gain_ratio);
      const { xp: skillValueGained } = applyLearningMultiplier(baseSkillValue, mentor.focus_skill, attrs);

      if (!userId) throw new Error("Not signed in");

      const { error: sessionError } = await supabase
        .from("player_mentor_sessions")
        .insert({
          user_id: userId,
          profile_id: profile.id,
          mentor_id: mentorId,
          xp_earned: xpEarned,
          skill_value_gained: skillValueGained,
          attribute_gains: mentor.attribute_keys || {},
        });
      if (sessionError) throw sessionError;

      let newLevel = Math.min(Math.max(skill?.current_level || 0, 0), maxLevel);
      let newXp = Math.max(skill?.current_xp || 0, 0);
      let newRequiredXp = Number(skill?.required_xp ?? 0);

      if (newLevel < maxLevel) {
        if (newRequiredXp <= 0) newRequiredXp = await getRequiredSkillXp(newLevel);
        newXp += skillValueGained;
        while (newLevel < maxLevel && newXp >= newRequiredXp) {
          newXp -= newRequiredXp;
          newLevel += 1;
          newRequiredXp = newLevel < maxLevel ? await getRequiredSkillXp(newLevel) : 0;
        }
      }

      if (newLevel >= maxLevel) {
        newLevel = maxLevel;
        newXp = 0;
        newRequiredXp = 0;
      }

      if (skill) {
        const { error: skillError } = await supabase
          .from("skill_progress")
          .update({
            current_xp: newXp,
            current_level: newLevel,
            required_xp: newRequiredXp,
            last_practiced_at: new Date().toISOString(),
          })
          .eq("id", skill.id);
        if (skillError) throw skillError;
      } else {
        let insertXp = skillValueGained;
        let insertLevel = 0;
        let insertRequiredXp = await getRequiredSkillXp(0);

        while (insertLevel < maxLevel && insertXp >= insertRequiredXp) {
          insertXp -= insertRequiredXp;
          insertLevel += 1;
          insertRequiredXp = insertLevel < maxLevel ? await getRequiredSkillXp(insertLevel) : 0;
        }

        if (insertLevel >= maxLevel) {
          insertLevel = maxLevel;
          insertXp = 0;
          insertRequiredXp = 0;
        }

        const { error: skillError } = await supabase.from("skill_progress").insert({
          profile_id: profile.id,
          skill_slug: mentor.focus_skill,
          current_xp: insertXp,
          current_level: insertLevel,
          required_xp: insertRequiredXp,
          last_practiced_at: new Date().toISOString(),
        });
        if (skillError) throw skillError;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          cash: profile.cash - mentor.cost,
          experience: (profile.experience || 0) + xpEarned,
        })
        .eq("id", profile.id);
      if (profileError) throw profileError;

      const { error: ledgerError } = await supabase.from("experience_ledger").insert({
        user_id: userId,
        profile_id: profile.id,
        activity_type: "mentor_session",
        xp_amount: xpEarned,
        skill_slug: mentor.focus_skill,
        metadata: {
          mentor_id: mentorId,
          mentor_name: mentor.name,
          max_level: maxLevel,
        },
      });
      if (ledgerError) throw ledgerError;

      return { xpEarned, skillValueGained, mentor };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["mentor_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["skill_progress"] });
      toast({
        title: "Session Completed!",
        description: `Gained ${data.xpEarned} XP and ${data.skillValueGained} skill points with ${data.mentor.name}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Session Failed", description: error.message, variant: "destructive" });
    },
  });

  const canBookSession = (mentorId: string) => {
    const mentor = mentors?.find((m) => m.id === mentorId);
    if (!mentor) return { canBook: false, reason: "Master not found" };

    if (mentor.city_id && !isInMentorCity(mentor.city_id)) {
      const cityName = mentor.city?.name || 'their city';
      return { canBook: false, reason: `Travel to ${cityName}` };
    }

    if (mentor.available_day !== null && !isAvailableToday(mentor.available_day)) {
      const dayName = getDayName(mentor.available_day);
      return { canBook: false, reason: `Available ${dayName}s` };
    }

    if (profile && profile.cash < mentor.cost) {
      return { canBook: false, reason: `Need $${mentor.cost.toLocaleString()}` };
    }

    const lastSession = recentSessions?.find((s) => s.mentor_id === mentorId);
    if (lastSession) {
      const hoursSinceLastSession = (Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSession < mentor.cooldown_hours) {
        const hoursRemaining = Math.ceil(mentor.cooldown_hours - hoursSinceLastSession);
        return { canBook: false, reason: `${hoursRemaining}h cooldown` };
      }
    }

    return { canBook: true, reason: "" };
  };

  const discoveredCount = discoveries?.length || 0;
  const totalMentors = mentors?.length || 0;

  return {
    mentors,
    profile,
    skillProgress,
    recentSessions,
    discoveries,
    bookSession: bookSessionMutation.mutate,
    isBooking: bookSessionMutation.isPending,
    canBookSession,
    isMentorDiscovered,
    hasClaimedDiscovery,
    getDiscovery,
    isAvailableToday,
    isInMentorCity,
    getDayName,
    discoverMaster: discoverMutation.mutate,
    isDiscovering: discoverMutation.isPending,
    discoveredCount,
    totalMentors,
  };
}
