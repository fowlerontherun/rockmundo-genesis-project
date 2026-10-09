import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UniversityEnrollment {
  id: string;
  profile_id: string;
  university_id: string;
  course_id: string;
  status: string;
  auto_attend: boolean;
  days_attended: number | null;
  total_xp_earned: number | null;
  university_courses: {
    name: string;
    skill_slug: string;
    xp_per_day_min: number;
    xp_per_day_max: number;
    class_start_hour: number;
    class_end_hour: number;
  } | null;
}

export function useUniversityAttendance(profileId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: enrollment } = useQuery({
    queryKey: ["current_enrollment_full", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          *,
          university_courses (
            name,
            skill_slug,
            xp_per_day_min,
            xp_per_day_max,
            class_start_hour,
            class_end_hour
          )
        `)
        .eq("profile_id", profileId)
        .in("status", ["enrolled", "in_progress"])
        .order("enrolled_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as UniversityEnrollment | null;
    },
    enabled: !!profileId,
  });

  const { data: activityStatus } = useQuery({
    queryKey: ["university_activity_status", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .from("profile_activity_statuses")
        .select("*")
        .eq("profile_id", profileId)
        .eq("status", "active")
        .eq("activity_type", "university_class")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: todayAttendance } = useQuery({
    queryKey: ["today_university_attendance", enrollment?.id],
    queryFn: async () => {
      if (!enrollment?.id) return null;

      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("player_university_attendance")
        .select("*")
        .eq("enrollment_id", enrollment.id)
        .eq("attendance_date", today)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!enrollment?.id,
  });

  const attendClassMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment || !profileId) throw new Error("Missing enrollment data");

      const course = enrollment.university_courses;
      if (!course) throw new Error("Course details not found");

      const { data: award, error } = await supabase.functions.invoke("university-manual-attendance", {
        body: { enrollmentId: enrollment.id },
      });
      if (error) throw error;
      if (!award?.awarded) throw new Error(award?.reason === "already_attended" ? "Already attended today" : "Attendance was not awarded");
      const xpEarned = Number(award.xp);
      if (!Number.isFinite(xpEarned)) throw new Error("Invalid attendance reward");
      return { xpEarned };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["university_activity_status"] });
      queryClient.invalidateQueries({ queryKey: ["today_university_attendance"] });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment"] });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment_full"] });
      queryClient.invalidateQueries({ queryKey: ["skill_progress"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["activity_feed"] });
      queryClient.invalidateQueries({ queryKey: ["university_course_performance"] });
      queryClient.invalidateQueries({ queryKey: ["course_xp_stats_admin"] });
      toast({
        title: "Class Attended! 📚",
        description: `You earned ${data.xpEarned} XP! Your skill is improving.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error attending class",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleAutoAttendMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) throw new Error("No enrollment found");

      const { data, error } = await supabase
        .from("player_university_enrollments")
        .update({ auto_attend: !enrollment.auto_attend })
        .eq("id", enrollment.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["current_enrollment_full"] });
      toast({
        title: data.auto_attend ? "Auto-attend enabled" : "Auto-attend disabled",
        description: data.auto_attend
          ? "We'll automatically mark you present at 10 AM daily."
          : "Automatic attendance has been turned off.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating preference",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [isWithinClassWindow, setIsWithinClassWindow] = useState(false);

  useEffect(() => {
    const evaluateWindow = () => {
      if (!enrollment || !enrollment.university_courses) {
        setIsWithinClassWindow(false);
        return;
      }

      const { class_start_hour, class_end_hour } = enrollment.university_courses;
      const rawStart = Number.isFinite(class_start_hour) ? class_start_hour : 10;
      const rawEnd = Number.isFinite(class_end_hour) ? class_end_hour : 14;
      const startHour = Math.min(Math.max(rawStart, 0), 23);
      const endHour = Math.min(Math.max(rawEnd, startHour + 1), 24);

      const now = new Date();
      const hour = now.getUTCHours();
      setIsWithinClassWindow(hour >= startHour && hour < endHour);
    };

    evaluateWindow();
    const interval = setInterval(evaluateWindow, 60 * 1000);
    return () => clearInterval(interval);
  }, [enrollment?.id, enrollment?.university_courses?.class_start_hour, enrollment?.university_courses?.class_end_hour]);

  const canAttendClass = useMemo(() => {
    if (!enrollment || activityStatus || todayAttendance) return false;
    return isWithinClassWindow;
  }, [enrollment, activityStatus, todayAttendance, isWithinClassWindow]);

  const classStartHour = Math.min(
    Math.max(enrollment?.university_courses?.class_start_hour ?? 10, 0),
    23,
  );
  const classEndHour = Math.min(
    Math.max(enrollment?.university_courses?.class_end_hour ?? 14, classStartHour + 1),
    24,
  );

  return {
    enrollment,
    activityStatus,
    todayAttendance,
    canAttendClass,
    classWindow: {
      start: classStartHour,
      end: classEndHour,
    },
    attendClass: attendClassMutation.mutate,
    isAttending: attendClassMutation.isPending,
    toggleAutoAttend: toggleAutoAttendMutation.mutate,
    isTogglingAuto: toggleAutoAttendMutation.isPending,
  };
}
