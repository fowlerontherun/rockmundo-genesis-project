import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useDeleteTwaat = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (twaatId: string) => {
      const { error } = await supabase
        .from("twaats")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", twaatId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-ai-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-trending"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-profile-twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-mentions"] });
      toast({ title: "Twaat deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't delete Twaat",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    deleteTwaat: mutation.mutate,
    isDeleting: mutation.isPending,
  };
};
