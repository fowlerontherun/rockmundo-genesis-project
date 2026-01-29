import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { MAX_SKILL_LEVEL } from "@/data/skillConstants";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useMentorSessions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash, experience, current_city_id")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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

  // Helper to check if a mentor is discovered
  const isMentorDiscovered = (mentorId: string) => {
    return discoveries?.some(d => d.mentor_id === mentorId) ?? false;
  };

  // Helper to get day name
  const getDayName = (day: number | null) => {
    if (day === null || day === undefined) return 'Any day';
    return DAY_NAMES[day] || 'Unknown';
  };

  // Helper to check if today is the mentor's available day
  const isAvailableToday = (availableDay: number | null) => {
    if (availableDay === null || availableDay === undefined) return true;
    const today = new Date().getDay();
    return today === availableDay;
  };

  // Helper to check if player is in the mentor's city
  const isInMentorCity = (mentorCityId: string | null) => {
    if (!mentorCityId) return true; // No city restriction
    return profile?.current_city_id === mentorCityId;
  };

  // Discover a mentor
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
      toast({
        title: "Discovery Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bookSessionMutation = useMutation({
    mutationFn: async (mentorId: string) => {
      if (!user || !profile) throw new Error("User not authenticated");

      const mentor = mentors?.find((m) => m.id === mentorId);
      if (!mentor) throw new Error("Master not found");

      // Check discovery
      if (!isMentorDiscovered(mentorId)) {
        throw new Error("You haven't discovered this master yet");
      }

      // Check if player is in the mentor's city
      if (mentor.city_id && !isInMentorCity(mentor.city_id)) {
        const cityName = mentor.city?.name || 'their city';
        throw new Error(`Travel to ${cityName} to train with this master`);
      }

      // Check if today is the correct day
      if (mentor.available_day !== null && !isAvailableToday(mentor.available_day)) {
        const dayName = getDayName(mentor.available_day);
        throw new Error(`${mentor.name} is only available on ${dayName}s`);
      }

      // Check if user has enough cash
      if (profile.cash < mentor.cost) {
        throw new Error(`Insufficient funds (need $${mentor.cost.toLocaleString()})`);
      }

      // Check cooldown
      const lastSession = recentSessions?.find((s) => s.mentor_id === mentorId);
      if (lastSession) {
        const hoursSinceLastSession =
          (Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSession < mentor.cooldown_hours) {
          const hoursRemaining = Math.ceil(mentor.cooldown_hours - hoursSinceLastSession);
          throw new Error(`Cooldown: ${hoursRemaining} hours remaining`);
        }
      }

      // Calculate XP and skill gains
      const skill = skillProgress?.find((s) => s.skill_slug === mentor.focus_skill);
      const currentLevel = skill?.current_level || 0;
      const xpEarned = Math.floor(mentor.base_xp * (1 + currentLevel * 0.1));
      const skillValueGained = Math.floor(xpEarned * mentor.skill_gain_ratio);

      // Create session
      const { error: sessionError } = await supabase
        .from("player_mentor_sessions")
        .insert({
          user_id: user.id,
          profile_id: profile.id,
          mentor_id: mentorId,
          xp_earned: xpEarned,
          skill_value_gained: skillValueGained,
          attribute_gains: mentor.attribute_keys || {},
        });

      if (sessionError) throw sessionError;

      // Update skill progress with proper multi-level handling
      let newXp = (skill?.current_xp || 0) + skillValueGained;
      let newLevel = Math.min(skill?.current_level || 0, MAX_SKILL_LEVEL);
      let newRequiredXp = skill?.required_xp || 100;

      // Handle multiple level-ups
      while (newLevel < MAX_SKILL_LEVEL && newXp >= newRequiredXp) {
        newXp -= newRequiredXp;
        newLevel += 1;
        newRequiredXp = Math.floor(newRequiredXp * 1.5);
      }

      if (newLevel >= MAX_SKILL_LEVEL) {
        newLevel = MAX_SKILL_LEVEL;
        newXp = Math.min(newXp, skill?.current_xp || newXp);
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
        // For new skills, check if we level up from 0
        newXp = skillValueGained;
        newLevel = 0;
        newRequiredXp = 100;
        
        while (newLevel < MAX_SKILL_LEVEL && newXp >= newRequiredXp) {
          newXp -= newRequiredXp;
          newLevel += 1;
          newRequiredXp = Math.floor(newRequiredXp * 1.5);
        }

        if (newLevel >= MAX_SKILL_LEVEL) {
          newLevel = MAX_SKILL_LEVEL;
          newXp = Math.min(newXp, newRequiredXp);
        }
        
        const { error: skillError } = await supabase.from("skill_progress").insert({
          profile_id: profile.id,
          skill_slug: mentor.focus_skill,
          current_xp: newXp,
          current_level: newLevel,
          required_xp: newRequiredXp,
          last_practiced_at: new Date().toISOString(),
        });

        if (skillError) throw skillError;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          cash: profile.cash - mentor.cost,
          experience: (profile.experience || 0) + xpEarned,
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // Log to experience ledger
      const { error: ledgerError } = await supabase.from("experience_ledger").insert({
        user_id: user.id,
        profile_id: profile.id,
        activity_type: "mentor_session",
        xp_amount: xpEarned,
        skill_slug: mentor.focus_skill,
        metadata: {
          mentor_id: mentorId,
          mentor_name: mentor.name,
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
      toast({
        title: "Session Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canBookSession = (mentorId: string) => {
    const mentor = mentors?.find((m) => m.id === mentorId);
    if (!mentor) return { canBook: false, reason: "Master not found" };

    // Check discovery first
    if (!isMentorDiscovered(mentorId)) {
      return { canBook: false, reason: "Not discovered" };
    }

    // Check city requirement
    if (mentor.city_id && !isInMentorCity(mentor.city_id)) {
      const cityName = mentor.city?.name || 'their city';
      return { canBook: false, reason: `Travel to ${cityName}` };
    }

    // Check day requirement
    if (mentor.available_day !== null && !isAvailableToday(mentor.available_day)) {
      const dayName = getDayName(mentor.available_day);
      return { canBook: false, reason: `Available ${dayName}s` };
    }

    // Check funds
    if (profile && profile.cash < mentor.cost) {
      return { canBook: false, reason: `Need $${mentor.cost.toLocaleString()}` };
    }

    // Check cooldown
    const lastSession = recentSessions?.find((s) => s.mentor_id === mentorId);
    if (lastSession) {
      const hoursSinceLastSession =
        (Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSession < mentor.cooldown_hours) {
        const hoursRemaining = Math.ceil(mentor.cooldown_hours - hoursSinceLastSession);
        return { canBook: false, reason: `${hoursRemaining}h cooldown` };
      }
    }

    return { canBook: true, reason: "" };
  };

  // Stats
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
    isAvailableToday,
    isInMentorCity,
    getDayName,
    discoverMaster: discoverMutation.mutate,
    isDiscovering: discoverMutation.isPending,
    discoveredCount,
    totalMentors,
  };
}
