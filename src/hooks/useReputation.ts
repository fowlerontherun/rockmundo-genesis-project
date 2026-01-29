// Reputation Hook - Manages player's reputation across 4 axes

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import {
  fetchPlayerReputation,
  createPlayerReputation,
  updatePlayerReputation,
  fetchReputationEvents,
  type ReputationChange,
} from "@/lib/api/roleplaying";
import type {
  PlayerReputation,
  ReputationEvent,
  ReputationAxis,
} from "@/types/roleplaying";

export const usePlayerReputation = () => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: ["player-reputation", profileId],
    queryFn: () => fetchPlayerReputation(profileId!),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateReputation = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: (initialModifiers?: {
      authenticity?: number;
      attitude?: number;
      reliability?: number;
      creativity?: number;
    }) => {
      if (!profileId) throw new Error("No profile ID");
      return createPlayerReputation(profileId, initialModifiers);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["player-reputation", profileId], data);
    },
  });
};

export interface UpdateReputationInput {
  changes: ReputationChange[];
  eventType: string;
  eventSource: string;
  sourceId?: string;
}

export const useUpdateReputation = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: (input: UpdateReputationInput) => {
      if (!profileId) throw new Error("No profile ID");
      return updatePlayerReputation(
        profileId,
        input.changes,
        input.eventType,
        input.eventSource,
        input.sourceId
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["player-reputation", profileId], data);
      queryClient.invalidateQueries({ queryKey: ["reputation-events", profileId] });
    },
  });
};

export const useReputationEvents = (limit = 20) => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: ["reputation-events", profileId, limit],
    queryFn: () => fetchReputationEvents(profileId!, limit),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Get reputation label based on score
 */
export const getReputationLabel = (
  axis: ReputationAxis,
  score: number
): { label: string; intensity: 'extreme' | 'strong' | 'moderate' | 'slight' | 'neutral' } => {
  const labels: Record<ReputationAxis, { low: string; high: string }> = {
    authenticity: { low: 'Sell-out', high: 'Authentic' },
    attitude: { low: 'Diva', high: 'Humble' },
    reliability: { low: 'Flaky', high: 'Dependable' },
    creativity: { low: 'Formulaic', high: 'Innovative' },
  };

  const absScore = Math.abs(score);
  let intensity: 'extreme' | 'strong' | 'moderate' | 'slight' | 'neutral';
  
  if (absScore >= 75) intensity = 'extreme';
  else if (absScore >= 50) intensity = 'strong';
  else if (absScore >= 25) intensity = 'moderate';
  else if (absScore >= 10) intensity = 'slight';
  else intensity = 'neutral';

  const label = score >= 0 ? labels[axis].high : labels[axis].low;

  return { label, intensity };
};

/**
 * Get color for reputation score
 */
export const getReputationColor = (score: number): string => {
  if (score >= 50) return 'text-green-500';
  if (score >= 25) return 'text-green-400';
  if (score >= 0) return 'text-muted-foreground';
  if (score >= -25) return 'text-orange-400';
  if (score >= -50) return 'text-orange-500';
  return 'text-red-500';
};

/**
 * Format reputation score for display
 */
export const formatReputationScore = (score: number): string => {
  if (score > 0) return `+${score}`;
  return score.toString();
};

/**
 * Hook to easily update reputation with common actions
 */
export const useReputationActions = () => {
  const updateReputation = useUpdateReputation();

  const recordAction = (
    actionType: string,
    changes: ReputationChange[],
    sourceId?: string
  ) => {
    return updateReputation.mutateAsync({
      changes,
      eventType: actionType,
      eventSource: 'player_action',
      sourceId,
    });
  };

  // Pre-defined common reputation actions
  const actions = {
    acceptCorporateSponsorship: (sourceId?: string) =>
      recordAction('corporate_sponsorship', [
        { axis: 'authenticity', change: -10, reason: 'Accepted corporate sponsorship' },
      ], sourceId),

    playBenefitShow: (sourceId?: string) =>
      recordAction('benefit_show', [
        { axis: 'authenticity', change: 5, reason: 'Played benefit show' },
        { axis: 'attitude', change: 5, reason: 'Played benefit show' },
        { axis: 'reliability', change: 2, reason: 'Played benefit show' },
      ], sourceId),

    demandHigherRider: (sourceId?: string) =>
      recordAction('demanding_rider', [
        { axis: 'attitude', change: -8, reason: 'Demanded higher rider' },
      ], sourceId),

    cancelGigLastMinute: (sourceId?: string) =>
      recordAction('gig_cancellation', [
        { axis: 'reliability', change: -15, reason: 'Cancelled gig last minute' },
      ], sourceId),

    releaseExperimentalAlbum: (sourceId?: string) =>
      recordAction('experimental_release', [
        { axis: 'creativity', change: 10, reason: 'Released experimental album' },
      ], sourceId),

    coverPopHit: (sourceId?: string) =>
      recordAction('cover_pop_hit', [
        { axis: 'authenticity', change: -5, reason: 'Covered pop hit' },
        { axis: 'creativity', change: -5, reason: 'Covered pop hit' },
      ], sourceId),

    showUpEarlyToSoundcheck: (sourceId?: string) =>
      recordAction('early_soundcheck', [
        { axis: 'attitude', change: 3, reason: 'Showed up early to soundcheck' },
        { axis: 'reliability', change: 5, reason: 'Showed up early to soundcheck' },
      ], sourceId),

    changeGenreForSales: (sourceId?: string) =>
      recordAction('genre_change_commercial', [
        { axis: 'authenticity', change: -8, reason: 'Changed genre for commercial appeal' },
        { axis: 'creativity', change: -8, reason: 'Changed genre for commercial appeal' },
      ], sourceId),

    completeGigSuccessfully: (sourceId?: string) =>
      recordAction('successful_gig', [
        { axis: 'reliability', change: 2, reason: 'Completed gig successfully' },
      ], sourceId),

    missDeadline: (sourceId?: string) =>
      recordAction('missed_deadline', [
        { axis: 'reliability', change: -5, reason: 'Missed deadline' },
      ], sourceId),

    helpFellowArtist: (sourceId?: string) =>
      recordAction('helped_artist', [
        { axis: 'attitude', change: 5, reason: 'Helped fellow artist' },
        { axis: 'authenticity', change: 2, reason: 'Helped fellow artist' },
      ], sourceId),

    rejectBadDeal: (sourceId?: string) =>
      recordAction('rejected_bad_deal', [
        { axis: 'authenticity', change: 5, reason: 'Rejected exploitative deal' },
      ], sourceId),

    createOriginalSong: (sourceId?: string) =>
      recordAction('original_song', [
        { axis: 'creativity', change: 3, reason: 'Created original song' },
        { axis: 'authenticity', change: 1, reason: 'Created original song' },
      ], sourceId),
  };

  return {
    recordAction,
    actions,
    isPending: updateReputation.isPending,
  };
};
