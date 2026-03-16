import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

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
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["current_enrollment", profileId],
    queryFn: async () => {
      if (!profileId) return null;

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
        .eq("profile_id", profileId)
        .in("status", ["enrolled", "in_progress"])
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching enrollment:", error);
        return null;
      }

      return data as CurrentEnrollment | null;
    },
    enabled: !!profileId,
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