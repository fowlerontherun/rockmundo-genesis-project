import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockProfile,
  fetchSocialSafetyStatus,
  muteProfile,
  reportSocialTarget,
  unblockProfile,
  unmuteProfile,
  type ReportSocialTargetInput,
} from "../services/socialSafety";

export const socialSafetyStatusQueryKey = (viewerProfileId: string | null, targetProfileId: string | null) => [
  "social-safety-status",
  viewerProfileId,
  targetProfileId,
];

interface SafetyActionInput {
  note?: string;
}

export function useSocialSafety(viewerProfileId: string | null, targetProfileId: string | null) {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: socialSafetyStatusQueryKey(viewerProfileId, targetProfileId),
    queryFn: () => fetchSocialSafetyStatus(viewerProfileId!, targetProfileId!),
    enabled: Boolean(viewerProfileId && targetProfileId && viewerProfileId !== targetProfileId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: socialSafetyStatusQueryKey(viewerProfileId, targetProfileId) });

  const blockMutation = useMutation({
    mutationFn: ({ note }: SafetyActionInput = {}) => blockProfile(targetProfileId!, note),
    onSuccess: invalidate,
  });
  const unblockMutation = useMutation({
    mutationFn: () => unblockProfile(targetProfileId!),
    onSuccess: invalidate,
  });
  const muteMutation = useMutation({
    mutationFn: ({ note }: SafetyActionInput = {}) => muteProfile(targetProfileId!, note),
    onSuccess: invalidate,
  });
  const unmuteMutation = useMutation({
    mutationFn: () => unmuteProfile(targetProfileId!),
    onSuccess: invalidate,
  });
  const reportMutation = useMutation({ mutationFn: (input: ReportSocialTargetInput) => reportSocialTarget(input) });

  return {
    ...statusQuery,
    blockProfile: blockMutation.mutateAsync,
    unblockProfile: unblockMutation.mutateAsync,
    muteProfile: muteMutation.mutateAsync,
    unmuteProfile: unmuteMutation.mutateAsync,
    reportSocialTarget: reportMutation.mutateAsync,
    isBlocking: blockMutation.isPending,
    isUnblocking: unblockMutation.isPending,
    isMuting: muteMutation.isPending,
    isUnmuting: unmuteMutation.isPending,
    isReporting: reportMutation.isPending,
  };
}
