import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

interface CurrentEnrollment {
  id: string;
  course_id: string;
  university_id: string;
  status: string;
  scheduled_end_date: string;
  university_courses: {
    name: string;
    university_id: string;
  };
  universities: {
    name: string;
  };
}

export function useCurrentEnrollment() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["current_enrollment", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return null;

      const { data, error } = await supabase
        .from("player_university_enrollments")
        .select(`
          id,
          course_id,
          university_id,
          status,
          scheduled_end_date,
          university_courses (
            name,
            university_id
          ),
          universities (
            name
          )
        `)
        .eq("profile_id", profile.id)
        .in("status", ["enrolled", "in_progress"])
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching enrollment:", error);
        return null;
      }

      return data as CurrentEnrollment | null;
    },
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute to check time
  });
}

export function useIsInClass() {
  const { data: enrollment, isLoading } = useCurrentEnrollment();

  return {
    isInClass: !!enrollment,
    enrollment,
    isLoading,
  };
}
