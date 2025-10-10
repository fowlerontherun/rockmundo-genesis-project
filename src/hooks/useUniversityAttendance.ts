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
  university_courses: {
    name: string;
    skill_slug: string;
    xp_per_day_min: number;
    xp_per_day_max: number;
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
            xp_per_day_max
          )
        `)
        .eq("profile_id", profileId)
        .in("status", ["enrolled", "in_progress"])
        .maybeSingle();

      if (error) throw error;
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

      // Calculate XP to award
      const xpEarned = Math.floor(
        Math.random() * (course.xp_per_day_max - course.xp_per_day_min + 1) +
        course.xp_per_day_min
      );

      const today = new Date().toISOString().split("T")[0];

      // Create attendance record
      const { error: attendanceError } = await supabase
        .from("player_university_attendance")
        .insert({
          enrollment_id: enrollment.id,
          attendance_date: today,
          xp_earned: xpEarned,
          was_locked_out: false,
        });

      if (attendanceError) throw attendanceError;

      // Update enrollment
      const { error: updateError } = await supabase
        .from("player_university_enrollments")
        .update({
          status: "in_progress",
          days_attended: (enrollment as any).days_attended + 1,
          total_xp_earned: (enrollment as any).total_xp_earned + xpEarned,
        })
        .eq("id", enrollment.id);

      if (updateError) throw updateError;

      // Create activity status
      const now = new Date();
      const endTime = new Date(now);
      endTime.setHours(14, 0, 0, 0); // Class ends at 2 PM

      const { error: statusError } = await supabase
        .from("profile_activity_statuses")
        .insert({
          profile_id: profileId,
          activity_type: "university_class",
          status: "active",
          started_at: now.toISOString(),
          ends_at: endTime.toISOString(),
          metadata: {
            enrollment_id: enrollment.id,
            course_name: course.name,
            xp_earned: xpEarned,
          },
        });

      if (statusError) throw statusError;

      return { xpEarned };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["university_activity_status"] });
      queryClient.invalidateQueries({ queryKey: ["today_university_attendance"] });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment"] });
      queryClient.invalidateQueries({ queryKey: ["current_enrollment_full"] });
      toast({
        title: "Attending Class!",
        description: `You're now in class. You'll earn ${data.xpEarned} XP when class ends at 2 PM.`,
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

  const canAttendClass = () => {
    if (!enrollment || activityStatus || todayAttendance) return false;

    const now = new Date();
    const currentHour = now.getHours();

    // Can attend between 9:45 AM and 2 PM
    return currentHour >= 9 && currentHour < 14;
  };

  return {
    enrollment,
    activityStatus,
    todayAttendance,
    canAttendClass: canAttendClass(),
    attendClass: attendClassMutation.mutate,
    isAttending: attendClassMutation.isPending,
    toggleAutoAttend: toggleAutoAttendMutation.mutate,
    isTogglingAuto: toggleAutoAttendMutation.isPending,
  };
}
