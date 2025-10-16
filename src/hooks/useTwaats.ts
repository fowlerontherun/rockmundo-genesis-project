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
}

export const useTwaats = (accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: twaats, isLoading } = useQuery({
    queryKey: ["twaats", accountId],
    queryFn: async () => {
      let query = supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts(id, handle, display_name, verified, owner_type),
          metrics:twaat_metrics(*)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as TwaatWithDetails[];
    },
  });

  const createTwaatMutation = useMutation({
    mutationFn: async (twaatData: TwaatInsert) => {
      console.log('Creating twaat with data:', twaatData);
      
      // Create the twaat
      const { data: twaat, error: twaatError } = await supabase
        .from("twaats")
        .insert(twaatData)
        .select()
        .single();

      if (twaatError) {
        console.error('Twaat creation error:', twaatError);
        throw twaatError;
      }
      
      console.log('Twaat created successfully:', twaat);

      // Metrics are auto-created by database trigger
      
      // Call outcome engine (async, don't await)
      supabase.functions.invoke("twaater-outcome-engine", {
        body: { twaat_id: twaat.id },
      });

      return twaat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      toast({
        title: "Twaat posted!",
        description: "Your post is now live. Check back for engagement metrics.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to post",
        description: error.message,
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
    deleteTwaat: deleteTwaatMutation.mutate,
    isPosting: createTwaatMutation.isPending,
    isDeleting: deleteTwaatMutation.isPending,
  };
};

export const useTwaaterFeed = (viewerAccountId?: string) => {
  const { data: feed, isLoading } = useQuery({
    queryKey: ["twaater-feed", viewerAccountId],
    queryFn: async () => {
      if (!viewerAccountId) {
        // Public feed
        const { data, error } = await supabase
          .from("twaats")
          .select(`
            *,
            account:twaater_accounts(id, handle, display_name, verified, owner_type, fame_score),
            metrics:twaat_metrics(*)
          `)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        return data as unknown as TwaatWithDetails[];
      }

      // Personalized feed based on follows
      const { data: follows } = await supabase
        .from("twaater_follows")
        .select("followed_account_id")
        .eq("follower_account_id", viewerAccountId);

      const followedIds = follows?.map(f => f.followed_account_id) || [];
      followedIds.push(viewerAccountId); // Include own posts

      const { data, error } = await supabase
        .from("twaats")
        .select(`
          *,
          account:twaater_accounts(id, handle, display_name, verified, owner_type, fame_score),
          metrics:twaat_metrics(*)
        `)
        .in("account_id", followedIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as unknown as TwaatWithDetails[];
    },
    enabled: true,
  });

  return { feed, isLoading };
};
