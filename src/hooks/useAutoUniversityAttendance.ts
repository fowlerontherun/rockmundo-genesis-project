import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoUniversityAttendance = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkAttendance = async () => {
      try {
        const { data: activeEnrollments, error } = await supabase
          .from('player_university_enrollments')
          .select('id, university_courses(name)')
          .eq('user_id', userId)
          .eq('status', 'enrolled')
          .not('next_class_at', 'is', null)
          .lte('next_class_at', new Date().toISOString());

        if (error) throw error;

        if (activeEnrollments && activeEnrollments.length > 0) {
          await supabase.functions.invoke('university-attendance');
          
          queryClient.invalidateQueries({ queryKey: ["university-enrollments"] });
          queryClient.invalidateQueries({ queryKey: ["player-skills"] });

          toast({
            title: "Class Attended!",
            description: `You've completed ${activeEnrollments.length} class session(s). Progress updated!`,
          });
        }
      } catch (error) {
        console.error('Error checking university attendance:', error);
      }
    };

    checkAttendance();
    const interval = setInterval(checkAttendance, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
