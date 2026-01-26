import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { startOfDay, subDays, format } from "date-fns";

export interface ActiveBookReading {
  id: string;
  book_id: string;
  days_read: number;
  total_skill_xp_earned: number;
  started_at: string;
  auto_read: boolean;
  skill_books: {
    id: string;
    title: string;
    author: string;
    skill_slug: string;
    base_reading_days: number;
    skill_percentage_gain: number;
  } | null;
}

export interface ActiveEnrollment {
  id: string;
  university_id: string;
  course_id: string;
  status: string;
  days_attended: number;
  total_xp_earned: number;
  enrolled_at: string;
  scheduled_end_date: string | null;
  auto_attend: boolean;
  university_courses: {
    id: string;
    name: string;
    skill_slug: string;
    base_duration_days: number;
  } | null;
  universities: {
    id: string;
    name: string;
    city: string | null;
  } | null;
}

export interface CompletedEnrollment {
  id: string;
  university_id: string;
  course_id: string;
  status: string;
  days_attended: number;
  total_xp_earned: number;
  enrolled_at: string;
  actual_completion_date: string | null;
  university_courses: {
    id: string;
    name: string;
    skill_slug: string;
  } | null;
  universities: {
    id: string;
    name: string;
    city: string | null;
  } | null;
}

export interface YesterdayProgress {
  universityAttendance: {
    enrollment_id: string;
    xp_earned: number;
    was_remote: boolean;
    connection_failed: boolean;
    course_name: string | null;
    university_name: string | null;
  }[];
  bookReading: {
    session_id: string;
    xp_earned: number;
    book_title: string | null;
  }[];
  totalXp: number;
}

export const useEducationSummary = () => {
  const { user } = useAuth();

  // Get profile
  const { data: profile } = useQuery({
    queryKey: ["education-summary-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, current_city_id, cities:current_city_id(id, name)")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Active book reading sessions
  const { data: activeBooks, isLoading: booksLoading } = useQuery({
    queryKey: ["education-summary-active-books", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .select(`
          id,
          book_id,
          days_read,
          total_skill_xp_earned,
          started_at,
          auto_read,
          skill_books (
            id,
            title,
            author,
            skill_slug,
            base_reading_days,
            skill_percentage_gain
          )
        `)
        .eq("profile_id", profile!.id)
        .eq("status", "reading")
        .order("started_at", { ascending: false });

      if (error) throw error;
      return data as ActiveBookReading[];
    },
    enabled: !!profile?.id,
  });

  // Active university enrollments
  const { data: activeEnrollments, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["education-summary-active-enrollments", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          id,
          university_id,
          course_id,
          status,
          days_attended,
          total_xp_earned,
          enrolled_at,
          scheduled_end_date,
          auto_attend,
          university_courses (
            id,
            name,
            skill_slug,
            base_duration_days
          ),
          universities (
            id,
            name,
            city
          )
        `)
        .eq("profile_id", profile!.id)
        .in("status", ["enrolled", "in_progress"])
        .order("enrolled_at", { ascending: false });

      if (error) throw error;
      return data as ActiveEnrollment[];
    },
    enabled: !!profile?.id,
  });

  // Completed university enrollments (last 10)
  const { data: completedEnrollments, isLoading: completedLoading } = useQuery({
    queryKey: ["education-summary-completed-enrollments", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          id,
          university_id,
          course_id,
          status,
          days_attended,
          total_xp_earned,
          enrolled_at,
          actual_completion_date,
          university_courses (
            id,
            name,
            skill_slug
          ),
          universities (
            id,
            name,
            city
          )
        `)
        .eq("profile_id", profile!.id)
        .eq("status", "completed")
        .order("actual_completion_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as CompletedEnrollment[];
    },
    enabled: !!profile?.id,
  });

  // Yesterday's education progress
  const { data: yesterdayProgress, isLoading: progressLoading } = useQuery({
    queryKey: ["education-summary-yesterday", profile?.id],
    queryFn: async () => {
      const yesterday = format(subDays(startOfDay(new Date()), 1), "yyyy-MM-dd");
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      
      // University attendance yesterday
      const { data: uniAttendance, error: uniError } = await supabase
        .from("player_university_attendance")
        .select(`
          id,
          enrollment_id,
          xp_earned,
          was_remote,
          connection_failed,
          player_university_enrollments!inner (
            profile_id,
            university_courses (name),
            universities (name)
          )
        `)
        .eq("attendance_date", yesterday)
        .eq("player_university_enrollments.profile_id", profile!.id);

      if (uniError) throw uniError;

      // Book reading attendance yesterday (check experience_ledger)
      const { data: bookProgress, error: bookError } = await supabase
        .from("experience_ledger")
        .select(`
          id,
          xp_amount,
          metadata,
          skill_slug
        `)
        .eq("profile_id", profile!.id)
        .eq("activity_type", "book_reading")
        .gte("created_at", `${yesterday}T00:00:00`)
        .lt("created_at", `${today}T00:00:00`);

      if (bookError) throw bookError;

      const universityAttendance = (uniAttendance || []).map((a: any) => ({
        enrollment_id: a.enrollment_id,
        xp_earned: a.xp_earned,
        was_remote: a.was_remote || false,
        connection_failed: a.connection_failed || false,
        course_name: a.player_university_enrollments?.university_courses?.name || null,
        university_name: a.player_university_enrollments?.universities?.name || null,
      }));

      const bookReading = (bookProgress || []).map((b: any) => ({
        session_id: b.id,
        xp_earned: b.xp_amount,
        book_title: b.metadata?.book_title || b.skill_slug || null,
      }));

      const totalXp = 
        universityAttendance.reduce((sum, a) => sum + (a.xp_earned || 0), 0) +
        bookReading.reduce((sum, b) => sum + (b.xp_earned || 0), 0);

      return {
        universityAttendance,
        bookReading,
        totalXp,
      } as YesterdayProgress;
    },
    enabled: !!profile?.id,
  });

  // Skill progress for enrolled courses
  const { data: skillProgress } = useQuery({
    queryKey: ["education-summary-skills", profile?.id, activeEnrollments],
    queryFn: async () => {
      if (!activeEnrollments?.length) return {};
      
      const skillSlugs = activeEnrollments
        .map(e => e.university_courses?.skill_slug)
        .filter(Boolean) as string[];

      if (!skillSlugs.length) return {};

      const { data, error } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level, current_xp, required_xp")
        .eq("profile_id", profile!.id)
        .in("skill_slug", skillSlugs);

      if (error) throw error;

      const progressMap: Record<string, { level: number; xp: number; required: number }> = {};
      for (const sp of data || []) {
        progressMap[sp.skill_slug] = {
          level: sp.current_level,
          xp: sp.current_xp,
          required: sp.required_xp,
        };
      }
      return progressMap;
    },
    enabled: !!profile?.id && !!activeEnrollments?.length,
  });

  const currentCityName = (profile?.cities as any)?.name || null;

  return {
    profile,
    currentCityName,
    activeBooks: activeBooks || [],
    activeEnrollments: activeEnrollments || [],
    completedEnrollments: completedEnrollments || [],
    yesterdayProgress: yesterdayProgress || { universityAttendance: [], bookReading: [], totalXp: 0 },
    skillProgress: skillProgress || {},
    isLoading: booksLoading || enrollmentsLoading || completedLoading || progressLoading,
  };
};
