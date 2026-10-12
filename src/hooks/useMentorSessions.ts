import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useMentorSessions() {
  const { toast } = useToast();
  const { profile: activeProfile } = useActiveProfile();
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
          city:cities(id, name, country, timezone)
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

  const isMentorDiscovered = (mentorId: string) => !!discoveries?.some((d) => d.mentor_id === mentorId);
  const hasClaimedDiscovery = (mentorId: string) => !!discoveries?.some((d) => d.mentor_id === mentorId);
  const getDiscovery = (mentorId: string) => discoveries?.find((d) => d.mentor_id === mentorId) ?? null;

  const getDayName = (day: number | null) => {
    if (day === null || day === undefined) return 'Any day';
    return DAY_NAMES[day] || 'Unknown';
  };

  const isAvailableToday = (availableDay: number | null, timezone?: string | null) => {
    if (availableDay === null || availableDay === undefined) return true;
    try {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone || "UTC", weekday: "long",
      }).format(new Date());
      return DAY_NAMES.indexOf(weekday) === availableDay;
    } catch {
      return false; // Unknown mentor timezone: don't book on an unverified day.
    }
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

      if (mentor.available_day !== null && !isAvailableToday(mentor.available_day, mentor.city?.timezone)) {
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

      // Cooldown, discovery, funds, XP, ledger and session record commit together.
      const { data, error } = await (supabase as any).rpc("book_mentor_session_atomic", {
        p_profile_id: profile.id,
        p_mentor_id: mentorId,
      });
      if (error) throw error;
      if (!data?.sessionId) throw new Error("Mentor session was not confirmed.");
      return { xpEarned: Number(data.xpEarned), skillValueGained: Number(data.skillValueGained), mentor };
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

    if (mentor.available_day !== null && !isAvailableToday(mentor.available_day, mentor.city?.timezone)) {
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
