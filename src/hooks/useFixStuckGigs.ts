import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useFixStuckGigs = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gigIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('fix-stuck-gigs', {
        body: { gigIds }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Gigs Fixed",
        description: `Successfully processed ${data.results.length} gig(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to fix gigs",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
