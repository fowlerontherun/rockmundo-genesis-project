import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterFollow = (followerAccountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: followedAccounts } = useQuery({
    queryKey: ["twaater-following", followerAccountId],
    queryFn: async () => {
      if (!followerAccountId) return [];

      const { data, error } = await supabase
        .from("twaater_follows")
        .select("followed_account_id")
        .eq("follower_account_id", followerAccountId);

      if (error) throw error;
      return data.map(f => f.followed_account_id);
    },
    enabled: !!followerAccountId,
  });

  const followMutation = useMutation({
    mutationFn: async ({ followedAccountId }: { followedAccountId: string }) => {
      if (!followerAccountId) throw new Error("No follower account");

      const { error } = await supabase
        .from("twaater_follows")
        .insert({
          follower_account_id: followerAccountId,
          followed_account_id: followedAccountId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-following"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-account"] });
      toast({
        title: "Followed!",
        description: "You'll now see their posts in your feed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Follow failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async ({ followedAccountId }: { followedAccountId: string }) => {
      if (!followerAccountId) throw new Error("No follower account");

      const { error } = await supabase
        .from("twaater_follows")
        .delete()
        .eq("follower_account_id", followerAccountId)
        .eq("followed_account_id", followedAccountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-following"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-account"] });
      toast({
        title: "Unfollowed",
        description: "Removed from your feed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unfollow failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isFollowing = (accountId: string) => {
    return followedAccounts?.includes(accountId) || false;
  };

  return {
    followedAccounts,
    follow: followMutation.mutate,
    unfollow: unfollowMutation.mutate,
    isFollowing,
    isFollowPending: followMutation.isPending || unfollowMutation.isPending,
  };
};
