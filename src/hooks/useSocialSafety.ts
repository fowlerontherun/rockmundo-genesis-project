import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { blockPlayer, getSocialPermissions, listBlockedPlayers, listMyReports, submitPlayerReport, unblockPlayer, type BlockReasonCategory, type ReportCategory } from "@/services/socialSafety";

export function useSocialPermission(targetProfileId?: string | null) {
  return useQuery({ queryKey: ["social-permission", targetProfileId], queryFn: () => getSocialPermissions(targetProfileId!), enabled: !!targetProfileId });
}

export function useBlockedPlayers(search = "") {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["blocked-players", search], queryFn: () => listBlockedPlayers(search) });
  const unblock = useMutation({ mutationFn: (targetProfileId: string) => unblockPlayer(targetProfileId), onSuccess: () => { toast.success("Player unblocked"); queryClient.invalidateQueries({ queryKey: ["blocked-players"] }); queryClient.invalidateQueries({ queryKey: ["social-permission"] }); queryClient.invalidateQueries({ queryKey: ["player-discovery"] }); }, onError: (e: Error) => toast.error(e.message) });
  return { ...query, unblock };
}

export function usePlayerBlockActions(targetProfileId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["social-permission"] });
    queryClient.invalidateQueries({ queryKey: ["player-connection"] });
    queryClient.invalidateQueries({ queryKey: ["friendships"] });
    queryClient.invalidateQueries({ queryKey: ["friend-request-counts"] });
    queryClient.invalidateQueries({ queryKey: ["player-discovery"] });
    queryClient.invalidateQueries({ queryKey: ["blocked-players"] });
  };
  const block = useMutation({ mutationFn: (input?: { reasonCategory?: BlockReasonCategory | null; privateNote?: string | null }) => blockPlayer(targetProfileId!, input?.reasonCategory, input?.privateNote), onSuccess: () => { toast.success("Player blocked. They were not notified."); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  const unblock = useMutation({ mutationFn: () => unblockPlayer(targetProfileId!), onSuccess: () => { toast.success("Player unblocked"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  return { block, unblock };
}

export function useReportPlayer() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { targetProfileId: string; category: ReportCategory; description: string; contentType?: string; contentId?: string | null; subcategory?: string | null; blockAfterReport?: boolean; evidence?: Record<string, unknown>; }) => submitPlayerReport(input), onSuccess: () => { toast.success("Your report has been submitted for review."); queryClient.invalidateQueries({ queryKey: ["my-player-reports"] }); queryClient.invalidateQueries({ queryKey: ["blocked-players"] }); }, onError: (e: Error) => toast.error(e.message) });
}

export function useMyReports() {
  return useQuery({ queryKey: ["my-player-reports"], queryFn: listMyReports });
}
