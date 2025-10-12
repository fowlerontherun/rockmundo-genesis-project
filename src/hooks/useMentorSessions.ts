import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-context";

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
        .select("id, cash, experience")
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
        .select("*")
        .eq("is_active", true)
        .order("difficulty", { ascending: true });
      if (error) throw error;
      return data;
    },
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

  const bookSessionMutation = useMutation({
    mutationFn: async (mentorId: string) => {
      if (!user || !profile) throw new Error("User not authenticated");

      const mentor = mentors?.find((m) => m.id === mentorId);
      if (!mentor) throw new Error("Mentor not found");

      // Check if user has enough cash
      if (profile.cash < mentor.cost) {
        throw new Error("Insufficient funds");
      }

      // Check skill requirement
      const skill = skillProgress?.find((s) => s.skill_slug === mentor.focus_skill);
      const currentLevel = skill?.current_level || 0;
      if (currentLevel < mentor.required_skill_value) {
        throw new Error(`Requires ${mentor.focus_skill} level ${mentor.required_skill_value}`);
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

      // Update skill progress
      const newXp = (skill?.current_xp || 0) + skillValueGained;
      let newLevel = skill?.current_level || 0;
      let newRequiredXp = skill?.required_xp || 100;

      if (newXp >= newRequiredXp) {
        newLevel += 1;
        newRequiredXp = Math.floor(newRequiredXp * 1.5);
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
        const { error: skillError } = await supabase.from("skill_progress").insert({
          profile_id: profile.id,
          skill_slug: mentor.focus_skill,
          current_xp: skillValueGained,
          current_level: 0,
          required_xp: 100,
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
    if (!mentor) return { canBook: false, reason: "Mentor not found" };

    if (profile && profile.cash < mentor.cost) {
      return { canBook: false, reason: `Insufficient funds (need $${mentor.cost})` };
    }

    const skill = skillProgress?.find((s) => s.skill_slug === mentor.focus_skill);
    const currentLevel = skill?.current_level || 0;
    if (currentLevel < mentor.required_skill_value) {
      return {
        canBook: false,
        reason: `Requires ${mentor.focus_skill} level ${mentor.required_skill_value}`,
      };
    }

    const lastSession = recentSessions?.find((s) => s.mentor_id === mentorId);
    if (lastSession) {
      const hoursSinceLastSession =
        (Date.now() - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSession < mentor.cooldown_hours) {
        const hoursRemaining = Math.ceil(mentor.cooldown_hours - hoursSinceLastSession);
        return { canBook: false, reason: `Cooldown: ${hoursRemaining}h remaining` };
      }
    }

    return { canBook: true, reason: "" };
  };

  return {
    mentors,
    profile,
    skillProgress,
    recentSessions,
    bookSession: bookSessionMutation.mutate,
    isBooking: bookSessionMutation.isPending,
    canBookSession,
  };
}
