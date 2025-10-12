import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useBookReading = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const processAttendance = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("book-reading-attendance");
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["active_reading_session"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      if (data.results && data.results.length > 0) {
        const completedSessions = data.results.filter((r: any) => r.completed);
        if (completedSessions.length > 0) {
          toast({
            title: "Book Reading Complete!",
            description: `You completed ${completedSessions.length} book(s) and earned skill XP!`,
          });
        } else {
          toast({
            title: "Daily Reading Progress",
            description: `Recorded reading progress for ${data.results.length} book(s).`,
          });
        }
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
