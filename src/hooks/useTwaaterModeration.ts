import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useTwaaterModeration = (viewerAccountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Report a twaat
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
      const { error } = await supabase.from("twaat_reports" as any).insert({
        twaat_id: twaatId,
        reporter_account_id: reporterAccountId,
        report_reason: reason,
        report_details: details,
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
      if (error.message.includes("duplicate")) {
        toast({
          title: "Already reported",
          description: "You've already reported this post.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to report",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      toast({
        title: "User blocked",
        description: "You won't see posts from this account anymore.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to block user",
        description: error.message,
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
      queryClient.invalidateQueries({ queryKey: ["blocked-accounts"] });
      toast({
        title: "User unblocked",
        description: "You can now see posts from this account again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unblock user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get blocked accounts
  const { data: blockedAccounts } = useQuery({
    queryKey: ["blocked-accounts", viewerAccountId],
    queryFn: async () => {
      if (!viewerAccountId) return [];

      const { data, error } = await supabase
        .from("twaater_blocks" as any)
        .select(
          `
          *,
          blocked_account:twaater_accounts!twaater_blocks_blocked_account_id_fkey(id, handle, display_name)
        `
        )
        .eq("blocker_account_id", viewerAccountId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!viewerAccountId,
  });

  // Check if an account is blocked
  const isAccountBlocked = (accountId: string) => {
    return blockedAccounts?.some((block: any) => block.blocked_account_id === accountId);
  };

  return {
    reportTwaat: reportTwaatMutation.mutate,
    blockAccount: blockAccountMutation.mutate,
    unblockAccount: unblockAccountMutation.mutate,
    isReporting: reportTwaatMutation.isPending,
    isBlocking: blockAccountMutation.isPending,
    isUnblocking: unblockAccountMutation.isPending,
    blockedAccounts,
    isAccountBlocked,
  };
};
