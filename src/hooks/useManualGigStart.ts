import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useManualGigStart = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gigId: string) => {
      const { data, error } = await (supabase as any).rpc("start_gig_authoritative", {
        p_gig_id: gigId,
      });

      if (error) throw error;

      const alreadyStarted = Boolean((data as { alreadyStarted?: boolean } | null)?.alreadyStarted);
      return {
        success: true,
        message: alreadyStarted ? "Gig already started" : "Gig started!",
      };
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      queryClient.invalidateQueries({ queryKey: ["gig"] });
      queryClient.invalidateQueries({ queryKey: ["gigs"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-gigs"] });
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
