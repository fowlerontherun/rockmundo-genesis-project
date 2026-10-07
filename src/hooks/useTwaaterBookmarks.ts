import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { hydrateTwaaterFeedExtras } from "@/hooks/useTwaats";

export const useTwaaterBookmarks = (accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookmarks, isLoading, error, refetch } = useQuery({
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

      const rows = (data || []).filter((bookmark: any) => {
        const twaat = bookmark.twaat;
        return twaat && !twaat.deleted_at && !twaat.scheduled_for && twaat.visibility === "public";
      });
      const twaats = rows.map((bookmark: any) => bookmark.twaat);
      const hydrated = await hydrateTwaaterFeedExtras(twaats);
      const hydratedById = new Map(hydrated.map((twaat: any) => [twaat.id, twaat]));

      return rows
        .filter((bookmark: any) => Boolean(bookmark.twaat))
        .map((bookmark: any) => ({
          ...bookmark,
          twaat: hydratedById.get(bookmark.twaat.id) || bookmark.twaat,
        }));
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
    error,
    refetch,
    toggleBookmark: toggleBookmarkMutation.mutate,
    isBookmarked,
  };
};

export const useTwaaterBookmarkState = (accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookmarkedTwaatIds = [] } = useQuery({
    queryKey: ["twaater-bookmark-ids", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("twaater_bookmarks")
        .select("twaat_id")
        .eq("account_id", accountId);

      if (error) throw error;
      return (data || []).map((bookmark) => bookmark.twaat_id);
    },
    enabled: !!accountId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const bookmarkedIds = new Set(bookmarkedTwaatIds);

  const toggleBookmarkMutation = useMutation({
    mutationFn: async ({ twaatId }: { twaatId: string }) => {
      if (!accountId) throw new Error("No account ID");

      if (bookmarkedIds.has(twaatId)) {
        const { error } = await supabase
          .from("twaater_bookmarks")
          .delete()
          .eq("account_id", accountId)
          .eq("twaat_id", twaatId);

        if (error) throw error;
        return { action: "removed" as const };
      }

      const { error } = await supabase
        .from("twaater_bookmarks")
        .insert({
          account_id: accountId,
          twaat_id: twaatId,
        });

      if (error) throw error;
      return { action: "added" as const };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["twaater-bookmark-ids", accountId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-bookmarks", accountId] });
      toast({
        title: result.action === "added" ? "Bookmark added" : "Bookmark removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bookmark action failed",
        description: error?.message || "We couldn't update that bookmark.",
        variant: "destructive",
      });
    },
  });

  return {
    isBookmarked: (twaatId: string) => bookmarkedIds.has(twaatId),
    toggleBookmark: toggleBookmarkMutation.mutate,
    isBookmarkPending: toggleBookmarkMutation.isPending,
  };
};
