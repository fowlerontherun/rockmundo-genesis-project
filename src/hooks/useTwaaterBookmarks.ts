import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterBookmarks = (accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ["twaater-bookmarks", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("twaater_bookmarks")
        .select(`
          *,
          twaat:twaats(
            *,
            account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified),
            metrics:twaat_metrics(*)
          )
        `)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const toggleBookmarkMutation = useMutation({
    mutationFn: async ({ twaatId }: { twaatId: string }) => {
      if (!accountId) throw new Error("No account ID");

      // Check if already bookmarked
      const { data: existing } = await supabase
        .from("twaater_bookmarks")
        .select("id")
        .eq("account_id", accountId)
        .eq("twaat_id", twaatId)
        .maybeSingle();

      if (existing) {
        // Remove bookmark
        const { error } = await supabase
          .from("twaater_bookmarks")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        return { action: "removed" };
      } else {
        // Add bookmark
        const { error } = await supabase
          .from("twaater_bookmarks")
          .insert({
            account_id: accountId,
            twaat_id: twaatId,
          });

        if (error) throw error;
        return { action: "added" };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["twaater-bookmarks"] });
      toast({
        title: result.action === "added" ? "Bookmark added" : "Bookmark removed",
      });
    },
  });

  const isBookmarked = (twaatId: string) => {
    return bookmarks?.some(b => b.twaat_id === twaatId) || false;
  };

  return {
    bookmarks,
    isLoading,
    toggleBookmark: toggleBookmarkMutation.mutate,
    isBookmarked,
  };
};