import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { fetchFriendshipsForProfile, fetchProfilesByIds } from "@/integrations/supabase/friends";
import type { Database } from "@/lib/supabase-types";

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

const TIER_CONFIG: Record<TeachingTier, {
  minSkillLevel: number;
  studentXpRange: [number, number];
  teacherXpRange: [number, number];
  maxStudents: number;
}> = {
  basic: { minSkillLevel: 5, studentXpRange: [50, 80], teacherXpRange: [30, 40], maxStudents: 1 },
  professional: { minSkillLevel: 3, studentXpRange: [70, 100], teacherXpRange: [40, 50], maxStudents: 1 },
  mastery: { minSkillLevel: 1, studentXpRange: [90, 120], teacherXpRange: [50, 60], maxStudents: 2 },
};

export const useTeaching = () => {
  const { profile } = useGameData();
  const { progress } = useSkillSystem();
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, { id: string; username: string; display_name: string | null }>>({});

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

  const canTeach = useCallback(
    (skillSlug: string): boolean => {
      if (!teachingTier) return false;
      const config = TIER_CONFIG[teachingTier];
      const skillRecord = progress.find((p) => p.skill_slug === skillSlug);
      return (skillRecord?.current_level ?? 0) >= config.minSkillLevel;
    },
    [teachingTier, progress],
  );

  const getTeachableSkills = useCallback(() => {
    if (!teachingTier) return [];
    const config = TIER_CONFIG[teachingTier];
    return progress
      .filter((p) => (p.current_level ?? 0) >= config.minSkillLevel && !p.skill_slug.startsWith("teaching_"))
      .map((p) => p.skill_slug);
  }, [teachingTier, progress]);

  const calculateXp = useCallback(
    (tier: TeachingTier) => {
      const config = TIER_CONFIG[tier];
      const studentXp = Math.floor(Math.random() * (config.studentXpRange[1] - config.studentXpRange[0] + 1)) + config.studentXpRange[0];
      const teacherXp = Math.floor(Math.random() * (config.teacherXpRange[1] - config.teacherXpRange[0] + 1)) + config.teacherXpRange[0];
      return { studentXp, teacherXp };
    },
    [],
  );

  const refreshSessions = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("player_teaching_sessions")
      .select("*")
      .or(`teacher_profile_id.eq.${profile.id},student_profile_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSessions(data as TeachingSession[]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const loadFriendProfiles = useCallback(async () => {
    if (!profile) return;
    try {
      const friendships = await fetchFriendshipsForProfile(profile.id);
      const accepted = friendships.filter((f) => f.status === "accepted");
      const friendIds = accepted.map((f) =>
        f.requestor_id === profile.id ? f.addressee_id : f.requestor_id,
      );
      if (friendIds.length > 0) {
        const profiles = await fetchProfilesByIds(friendIds);
        setFriendProfiles(profiles as any);
      }
    } catch {
      // silently fail
    }
  }, [profile]);

  useEffect(() => {
    void loadFriendProfiles();
  }, [loadFriendProfiles]);

  const startTeachingSession = useCallback(
    async (studentProfileId: string, skillSlug: string, durationDays: number) => {
      if (!profile || !teachingTier) return null;

      const { studentXp, teacherXp } = calculateXp(teachingTier);
      const totalStudentXp = studentXp * durationDays;
      const totalTeacherXp = teacherXp * durationDays;

      const { data, error } = await supabase
        .from("player_teaching_sessions")
        .insert({
          teacher_profile_id: profile.id,
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
        return null;
      }

      await refreshSessions();
      return data as TeachingSession;
    },
    [profile, teachingTier, calculateXp, refreshSessions],
  );

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "in_progress" || s.status === "scheduled"),
    [sessions],
  );

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed"),
    [sessions],
  );

  return {
    teachingTier,
    canTeach,
    getTeachableSkills,
    startTeachingSession,
    activeSessions,
    completedSessions,
    sessions,
    loading,
    refreshSessions,
    friendProfiles,
    tierConfig: teachingTier ? TIER_CONFIG[teachingTier] : null,
  };
};
