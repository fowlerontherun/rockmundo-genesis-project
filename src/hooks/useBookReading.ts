import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export const useBookReading = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  const processAttendance = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Select an active player character before recording reading.");
      const { data, error } = await supabase.functions.invoke("book-reading-attendance", {
        body: { manual: true, profileId },
      });
      
      if (error) throw error;
      if (!data || data.success === false) throw new Error(data?.error || "Reading attendance could not be processed.");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["active_reading_session"] });
      queryClient.invalidateQueries({ queryKey: ["my_book_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      const results = Array.isArray(data.results) ? data.results : [];
      const failures = results.filter((r: { error?: string }) => r.error);
      const completed = results.filter((r: { completed?: boolean; error?: string }) => r.completed && !r.error);
      const processed = results.filter((r: { days_read?: number; error?: string }) => r.days_read != null && !r.error);
      if (failures.length) {
        toast({
          title: processed.length ? "Reading Partially Recorded" : "Reading Not Recorded",
          description: failures[0].error || "Please try again.",
          variant: "destructive",
        });
      } else if (completed.length) {
        toast({ title: "Book Reading Complete!", description: "Your book is complete and skill XP has been awarded." });
      } else if (processed.length) {
        toast({ title: "Daily Reading Progress", description: "Today's reading has been recorded." });
      } else if (results.some((r: { reason?: string }) => r.reason === "already_recorded")) {
        toast({ title: "Already Recorded", description: "You have already recorded today's reading. Come back tomorrow." });
      } else {
        toast({
          title: "Reading Not Recorded",
          description: "No active reading session was found for this character. Reopen Education > Books and try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Process Reading",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    processAttendance: processAttendance.mutate,
    isProcessing: processAttendance.isPending,
  };
};
