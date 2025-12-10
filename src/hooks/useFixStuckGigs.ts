import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useFixStuckGigs = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gigIds: string[]) => {
      // Get current session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('You must be logged in to perform this action');
      }

      const { data, error } = await supabase.functions.invoke('fix-stuck-gigs', {
        body: { gigIds },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      
      // Check for API-level errors
      if (data?.error) {
        throw new Error(data.error);
      }
      
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
