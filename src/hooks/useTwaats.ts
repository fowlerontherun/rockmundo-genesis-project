import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { Database } from "@/lib/supabase-types";

type Twaat = Database["public"]["Tables"]["twaats"]["Row"];
type TwaatInsert = Database["public"]["Tables"]["twaats"]["Insert"];
type TwaatMetrics = Database["public"]["Tables"]["twaat_metrics"]["Row"];

interface TwaatWithDetails extends Twaat {
  account: {
    id: string;
    handle: string;
    display_name: string;
    verified: boolean;
    owner_type: string;
  };
  metrics: TwaatMetrics;
  quoted_twaat?: any;
}

const twaatDetailsSelect = `
  *,
  account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type, fame_score),
  metrics:twaat_metrics(*),
  quoted_twaat:twaats!twaats_quoted_twaat_id_fkey(
    id,
    body,
    created_at,
    account:twaater_accounts!twaats_account_id_fkey(id, handle, display_name, verified, owner_type)
  )
`;

export const useTwaats = (accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: twaats, isLoading } = useQuery({
    queryKey: ["twaats", accountId],
    queryFn: async () => {
      let query = supabase
        .from("twaats")
        .select(twaatDetailsSelect)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (accountId) query = query.eq("account_id", accountId);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as TwaatWithDetails[];
    },
  });

  const createTwaatMutation = useMutation({
    mutationFn: async (twaatData: TwaatInsert) => {
      const { data: twaat, error: twaatError } = await supabase
        .from("twaats")
        .insert(twaatData)
        .select()
        .single();

      if (twaatError) throw twaatError;

      // Metrics are created by the database trigger. Outcome processing is
      // idempotent server-side, so waiting for this request is safe while a
      // failure here does not roll back the already-published Twaat.
      const { error: outcomeError } = await supabase.functions.invoke("twaater-outcome-engine", {
        body: { twaat_id: twaat.id },
      });
      if (outcomeError) {
        console.warn("Twaater outcome processing will remain pending:", outcomeError);
      }

      return twaat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-ai-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-trending"] });
      toast({
        title: "Twaat posted!",
        description: "Your post is now live.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to post",
        description: error?.message || "We couldn't publish that Twaat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTwaatMutation = useMutation({
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
      toast({
        title: "Twaat deleted",
        description: "Your post has been removed.",
      });
    },
  });

  return {
    twaats,
    isLoading,
    createTwaat: createTwaatMutation.mutate,
    createTwaatAsync: createTwaatMutation.mutateAsync,
    deleteTwaat: deleteTwaatMutation.mutate,
    isPosting: createTwaatMutation.isPending,
    isDeleting: deleteTwaatMutation.isPending,
  };
};

export const useTwaaterFeed = (viewerAccountId?: string) => {
  const { data: feed, isLoading, refetch } = useQuery({
    queryKey: ["twaater-feed", viewerAccountId],
    queryFn: async () => {
      if (!viewerAccountId) {
        const { data, error } = await supabase
          .from("twaats")
          .select(twaatDetailsSelect)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        return data as unknown as TwaatWithDetails[];
      }

      const { data: follows, error: followsError } = await supabase
        .from("twaater_follows")
        .select("followed_account_id")
        .eq("follower_account_id", viewerAccountId);

      if (followsError) throw followsError;

      const followedIds = follows?.map((follow) => follow.followed_account_id) || [];
      if (!followedIds.includes(viewerAccountId)) followedIds.push(viewerAccountId);

      const { data, error } = await supabase
        .from("twaats")
        .select(twaatDetailsSelect)
        .in("account_id", followedIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as unknown as TwaatWithDetails[];
    },
    enabled: true,
  });

  return { feed, isLoading, refetch };
};
