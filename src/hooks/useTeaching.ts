import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { fetchFriendshipsForProfile, fetchProfilesByIds } from "@/integrations/supabase/friends";

export interface TeachingSession {
  id: string;
  teacher_profile_id: string;
  student_profile_id: string;
  skill_slug: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  teacher_xp_earned: number;
  student_xp_earned: number;
  session_duration_days: number;
  created_at: string;
}

export type TeachingTier = "basic" | "professional" | "mastery";

const TEACHING_SLUGS: Record<TeachingTier, string> = {
  basic: "teaching_basic_teaching",
  professional: "teaching_professional_teaching",
  mastery: "teaching_mastery_teaching",
};

export const TIER_CONFIG: Record<TeachingTier, {
  minSkillLevel: number;
  studentXpRange: [number, number];
  teacherXpRange: [number, number];
  maxStudents: number;
  label: string;
}> = {
  basic: { minSkillLevel: 5, studentXpRange: [50, 80], teacherXpRange: [30, 40], maxStudents: 1, label: "Basic" },
  professional: { minSkillLevel: 3, studentXpRange: [70, 100], teacherXpRange: [40, 50], maxStudents: 1, label: "Professional" },
  mastery: { minSkillLevel: 1, studentXpRange: [90, 120], teacherXpRange: [50, 60], maxStudents: 2, label: "Mastery" },
};

export interface StartSessionValidation {
  valid: boolean;
  error: string | null;
}

export const useTeaching = () => {
  const { profile } = useGameData();
  const { progress } = useSkillSystem();
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, { id: string; username: string; display_name: string | null }>>({});
  const [acceptedFriendIds, setAcceptedFriendIds] = useState<Set<string>>(new Set());

  // Determine highest unlocked teaching tier
  const getTeachingTier = useCallback((): TeachingTier | null => {
    for (const tier of ["mastery", "professional", "basic"] as TeachingTier[]) {
      const slug = TEACHING_SLUGS[tier];
      const record = progress.find((p) => p.skill_slug === slug);
      if (record && (record.current_level ?? 0) > 0) {
        return tier;
      }
    }
    return null;
  }, [progress]);

  const teachingTier = useMemo(() => getTeachingTier(), [getTeachingTier]);

  // Check if a specific skill can be taught
  const canTeach = useCallback(
    (skillSlug: string): boolean => {
      if (!teachingTier) return false;
      const config = TIER_CONFIG[teachingTier];
      const skillRecord = progress.find((p) => p.skill_slug === skillSlug);
      return (skillRecord?.current_level ?? 0) >= config.minSkillLevel;
    },
    [teachingTier, progress],
  );

  // Get skill level for a given slug
  const getSkillLevel = useCallback(
    (skillSlug: string): number => {
      const record = progress.find((p) => p.skill_slug === skillSlug);
      return record?.current_level ?? 0;
    },
    [progress],
  );

  // Get all skills the teacher can teach
  const getTeachableSkills = useCallback(() => {
    if (!teachingTier) return [];
    const config = TIER_CONFIG[teachingTier];
    return progress
      .filter((p) => (p.current_level ?? 0) >= config.minSkillLevel && !p.skill_slug.startsWith("teaching_"))
      .map((p) => ({
        slug: p.skill_slug,
        level: p.current_level ?? 0,
      }))
      .sort((a, b) => b.level - a.level);
  }, [teachingTier, progress]);

  // Calculate deterministic XP based on teacher skill level (not random)
  const calculateXp = useCallback(
    (tier: TeachingTier, teacherSkillLevel: number) => {
      const config = TIER_CONFIG[tier];
      // Scale XP within range based on teacher's skill level (higher skill = more XP)
      const levelFactor = Math.min(1, teacherSkillLevel / 20);
      const studentXp = Math.round(
        config.studentXpRange[0] + (config.studentXpRange[1] - config.studentXpRange[0]) * levelFactor
      );
      const teacherXp = Math.round(
        config.teacherXpRange[0] + (config.teacherXpRange[1] - config.teacherXpRange[0]) * levelFactor
      );
      return { studentXpPerDay: studentXp, teacherXpPerDay: teacherXp };
    },
    [],
  );

  // Load sessions
  const refreshSessions = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("player_teaching_sessions")
        .select("*")
        .or(`teacher_profile_id.eq.${profile.id},student_profile_id.eq.${profile.id}`)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSessions(data as TeachingSession[]);
      }
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // Load friend profiles
  const loadFriendProfiles = useCallback(async () => {
    if (!profile) return;
    setFriendsLoading(true);
    try {
      const friendships = await fetchFriendshipsForProfile(profile.id);
      const accepted = friendships.filter((f) => f.status === "accepted");
      const friendIds = accepted.map((f) =>
        f.requestor_id === profile.id ? f.addressee_id : f.requestor_id,
      );
      setAcceptedFriendIds(new Set(friendIds));
      if (friendIds.length > 0) {
        const profiles = await fetchProfilesByIds(friendIds);
        setFriendProfiles(profiles as any);
      }
    } catch {
      // silently fail
    } finally {
      setFriendsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadFriendProfiles();
  }, [loadFriendProfiles]);

  // Count currently active sessions as teacher
  const activeTeachingCount = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.teacher_profile_id === profile?.id &&
          (s.status === "in_progress" || s.status === "scheduled"),
      ).length,
    [sessions, profile],
  );

  // Validate before starting a session
  const validateSession = useCallback(
    (studentProfileId: string, skillSlug: string): StartSessionValidation => {
      if (!profile) return { valid: false, error: "No active profile" };
      if (!teachingTier) return { valid: false, error: "Teaching skill not unlocked" };

      // Self-teaching prevention
      if (studentProfileId === profile.id) {
        return { valid: false, error: "You can't teach yourself" };
      }

      // Friendship validation
      if (!acceptedFriendIds.has(studentProfileId)) {
        return { valid: false, error: "You can only teach accepted friends" };
      }

      // Skill level check
      if (!canTeach(skillSlug)) {
        const config = TIER_CONFIG[teachingTier];
        return { valid: false, error: `Your skill level must be ${config.minSkillLevel}+ to teach this` };
      }

      // Max students check
      const config = TIER_CONFIG[teachingTier];
      if (activeTeachingCount >= config.maxStudents) {
        return { valid: false, error: `Maximum ${config.maxStudents} active student${config.maxStudents > 1 ? "s" : ""} at your tier` };
      }

      // Duplicate session prevention (same skill + same student while active)
      const duplicate = sessions.find(
        (s) =>
          s.teacher_profile_id === profile.id &&
          s.student_profile_id === studentProfileId &&
          s.skill_slug === skillSlug &&
          (s.status === "in_progress" || s.status === "scheduled"),
      );
      if (duplicate) {
        return { valid: false, error: "You're already teaching this skill to this friend" };
      }

      return { valid: true, error: null };
    },
    [profile, teachingTier, canTeach, acceptedFriendIds, activeTeachingCount, sessions],
  );

  // Start a new teaching session
  const startTeachingSession = useCallback(
    async (studentProfileId: string, skillSlug: string, durationDays: number): Promise<{ session: TeachingSession | null; error: string | null }> => {
      const validation = validateSession(studentProfileId, skillSlug);
      if (!validation.valid) {
        return { session: null, error: validation.error };
      }

      const teacherLevel = getSkillLevel(skillSlug);
      const { studentXpPerDay, teacherXpPerDay } = calculateXp(teachingTier!, teacherLevel);
      const totalStudentXp = studentXpPerDay * durationDays;
      const totalTeacherXp = teacherXpPerDay * durationDays;

      const { data, error } = await supabase
        .from("player_teaching_sessions")
        .insert({
          teacher_profile_id: profile!.id,
          student_profile_id: studentProfileId,
          skill_slug: skillSlug,
          status: "in_progress",
          started_at: new Date().toISOString(),
          student_xp_earned: totalStudentXp,
          teacher_xp_earned: totalTeacherXp,
          session_duration_days: durationDays,
        } as any)
        .select("*")
        .single();

      if (error) {
        console.error("Failed to start teaching session", error);
        return { session: null, error: error.message };
      }

      await refreshSessions();
      return { session: data as TeachingSession, error: null };
    },
    [profile, teachingTier, validateSession, getSkillLevel, calculateXp, refreshSessions],
  );

  // Cancel an active session
  const cancelSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!profile) return false;

      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return false;

      // Only teacher or student can cancel, and only if active
      const isTeacher = session.teacher_profile_id === profile.id;
      const isStudent = session.student_profile_id === profile.id;
      if (!isTeacher && !isStudent) return false;
      if (session.status !== "in_progress" && session.status !== "scheduled") return false;

      const { error } = await supabase
        .from("player_teaching_sessions")
        .update({ status: "cancelled", completed_at: new Date().toISOString() } as any)
        .eq("id", sessionId);

      if (error) {
        console.error("Failed to cancel teaching session", error);
        return false;
      }

      await refreshSessions();
      return true;
    },
    [profile, sessions, refreshSessions],
  );

  // Check and auto-complete expired sessions
  const completeExpiredSessions = useCallback(async () => {
    if (!profile) return;

    const now = new Date();
    const expiredSessions = sessions.filter((s) => {
      if (s.status !== "in_progress" || !s.started_at) return false;
      const startDate = new Date(s.started_at);
      const endDate = new Date(startDate.getTime() + s.session_duration_days * 24 * 60 * 60 * 1000);
      return now >= endDate;
    });

    if (expiredSessions.length === 0) return;

    for (const session of expiredSessions) {
      await supabase
        .from("player_teaching_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() } as any)
        .eq("id", session.id);
    }

    if (expiredSessions.length > 0) {
      await refreshSessions();
    }
  }, [profile, sessions, refreshSessions]);

  // Auto-complete expired sessions on load
  useEffect(() => {
    if (sessions.length > 0) {
      void completeExpiredSessions();
    }
  }, [sessions.length]); // Only on session count change, not on sessions ref

  // Calculate session progress (0-100%)
  const getSessionProgress = useCallback((session: TeachingSession): number => {
    if (session.status === "completed") return 100;
    if (session.status === "cancelled") return 0;
    if (!session.started_at) return 0;

    const start = new Date(session.started_at).getTime();
    const end = start + session.session_duration_days * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (now >= end) return 100;
    return Math.min(100, Math.round(((now - start) / (end - start)) * 100));
  }, []);

  // Get time remaining for a session
  const getTimeRemaining = useCallback((session: TeachingSession): string => {
    if (!session.started_at || session.status !== "in_progress") return "";
    const start = new Date(session.started_at).getTime();
    const end = start + session.session_duration_days * 24 * 60 * 60 * 1000;
    const remaining = end - Date.now();

    if (remaining <= 0) return "Completing...";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) return `${days}d ${remainingHours}h remaining`;
    return `${remainingHours}h remaining`;
  }, []);

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "in_progress" || s.status === "scheduled"),
    [sessions],
  );

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed"),
    [sessions],
  );

  const cancelledSessions = useMemo(
    () => sessions.filter((s) => s.status === "cancelled"),
    [sessions],
  );

  return {
    teachingTier,
    canTeach,
    getTeachableSkills,
    getSkillLevel,
    calculateXp,
    validateSession,
    startTeachingSession,
    cancelSession,
    activeSessions,
    completedSessions,
    cancelledSessions,
    sessions,
    loading,
    friendsLoading,
    refreshSessions,
    friendProfiles,
    activeTeachingCount,
    tierConfig: teachingTier ? TIER_CONFIG[teachingTier] : null,
    getSessionProgress,
    getTimeRemaining,
  };
};
