import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useTwaaterReport = () => {
  const { toast } = useToast();

  const reportTwaatMutation = useMutation({
    mutationFn: async ({
      twaatId,
      reporterAccountId,
      reason,
      details,
    }: {
      twaatId: string;
      reporterAccountId: string;
      reason: "spam" | "harassment" | "inappropriate" | "misinformation" | "other";
      details?: string;
    }) => {
      const categoryMap = {
        spam: "spam",
        harassment: "harassment",
        inappropriate: "other",
        misinformation: "other",
        other: "other",
      } as const;
      const description = details?.trim() || `Reported Twaater post for ${reason.replace(/_/g, " ")}.`;
      const { error } = await (supabase as any).rpc("report_social_target", {
        reported_profile_id: null,
        target_type: "twaater_post",
        target_id: twaatId,
        category: categoryMap[reason],
        reason: description,
        context: {
          surface: "twaater",
          twaater_reason: reason,
          reporter_account_id: reporterAccountId,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you for helping keep Twaater safe. We'll review this report.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to report",
        description: error?.message || "We couldn't submit that report.",
        variant: "destructive",
      });
    },
  });

  return {
    reportTwaat: reportTwaatMutation.mutate,
    isReporting: reportTwaatMutation.isPending,
  };
};

export const useTwaaterModeration = (viewerAccountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Block an account
  const blockAccountMutation = useMutation({
    mutationFn: async ({
      blockerAccountId,
      blockedAccountId,
    }: {
      blockerAccountId: string;
      blockedAccountId: string;
    }) => {
      const { error } = await supabase.from("twaater_blocks" as any).insert({
        blocker_account_id: blockerAccountId,
        blocked_account_id: blockedAccountId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-accounts", viewerAccountId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-ai-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-explore-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      toast({
        title: "Account blocked",
        description: "You won't see posts from this Twaater account anymore.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to block account",
        description: error?.message || "We couldn't block this account.",
        variant: "destructive",
      });
    },
  });

  // Unblock an account
  const unblockAccountMutation = useMutation({
    mutationFn: async ({
      blockerAccountId,
      blockedAccountId,
    }: {
      blockerAccountId: string;
      blockedAccountId: string;
    }) => {
      const { error } = await supabase
        .from("twaater_blocks" as any)
        .delete()
        .eq("blocker_account_id", blockerAccountId)
        .eq("blocked_account_id", blockedAccountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-accounts", viewerAccountId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-ai-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-explore-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      toast({
        title: "Account unblocked",
        description: "You can now see posts from this Twaater account again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unblock account",
        description: error?.message || "We couldn't unblock this account.",
        variant: "destructive",
      });
    },
  });

  const { data: blockedAccounts } = useQuery({
    queryKey: ["blocked-accounts", viewerAccountId],
    queryFn: async () => {
      if (!viewerAccountId) return [];

      const { data, error } = await supabase
        .from("twaater_blocks" as any)
        .select(`
          *,
          blocked_account:twaater_accounts!twaater_blocks_blocked_account_id_fkey(id, handle, display_name)
        `)
        .eq("blocker_account_id", viewerAccountId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!viewerAccountId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isAccountBlocked = (accountId: string) =>
    blockedAccounts?.some((block: any) => block.blocked_account_id === accountId) || false;

  return {
    blockAccount: blockAccountMutation.mutate,
    unblockAccount: unblockAccountMutation.mutate,
    isBlocking: blockAccountMutation.isPending,
    isUnblocking: unblockAccountMutation.isPending,
    blockedAccounts,
    isAccountBlocked,
  };
};

