import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useManualGigStart = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gigId: string) => {
      // Check if gig is already started
      const { data: gig } = await supabase
        .from("gigs")
        .select("status, started_at, scheduled_date")
        .eq("id", gigId)
        .single();

      if (!gig) throw new Error("Gig not found");
      
      if (gig.status === "in_progress") {
        return { success: true, message: "Gig already in progress" };
      }

      // Start the gig
      const { error } = await supabase
        .from("gigs")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .eq("id", gigId);

      if (error) throw error;

      return { success: true, message: "Gig started!" };
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      queryClient.invalidateQueries({ queryKey: ["gig"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start gig",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
