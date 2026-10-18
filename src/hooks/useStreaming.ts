import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { logGameActivity } from "./useGameActivityLog";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getOwnedStreamingReleases, getStreamingAnalyticsForReleases } from "@/lib/streaming/ownedStreaming";

export const useStreaming = (userId: string) => {
  const { toast } = useToast();
  const { profileId, userId: activeUserId } = useActiveProfile();
  const canLoad = !!profileId && !!userId && activeUserId === userId;
  const queryClient = useQueryClient();

  const { data: releases, isLoading: releasesLoading, isError: releasesError, error: releasesErrorDetail, refetch: refetchReleases } = useQuery({
    queryKey: ["streaming-releases", userId, profileId],
    queryFn: async () => getOwnedStreamingReleases(userId, profileId!, `
      *,
      song:songs(*),
      platform:streaming_platforms(*)
    `),
    enabled: canLoad,
  });

  const { data: platforms } = useQuery({
    queryKey: ["streaming-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .eq("is_active", true)
        .order("platform_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["streaming-analytics", userId, profileId],
    queryFn: async () => {
      const ownedReleases = await getOwnedStreamingReleases(userId, profileId!, "id");
      const ids = ownedReleases.map((r) => r.id as string);
      if (!ids.length) return [];
      const ownedAnalytics = await getStreamingAnalyticsForReleases(
        ids,
        `*, release:song_releases(*, song:songs(*))`,
        100,
      );
      return ownedAnalytics
        .sort((a, b) => (b.analytics_date as string).localeCompare(a.analytics_date as string))
        .slice(0, 100);
    },
    enabled: canLoad,
  });

  const releaseToStreaming = useMutation({
    mutationFn: async (params: {
      songId: string;
      platformId: string;
      userId: string;
      releaseId: string;
      bandId?: string;
      songTitle?: string;
      platformName?: string;
    }) => {
      const { data, error } = await supabase
        .from("song_releases")
        .insert({
          song_id: params.songId,
          platform_id: params.platformId,
          user_id: params.userId,
          band_id: params.bandId,
          release_id: params.releaseId,
          release_type: "streaming",
          release_date: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Log streaming distribution
      await logGameActivity({
        userId: params.userId,
        bandId: params.bandId,
        activityType: 'streaming_distribution',
        activityCategory: 'release',
        description: `Distributed "${params.songTitle || 'song'}" to ${params.platformName || 'streaming platform'}`,
        metadata: {
          song_id: params.songId,
          platform_id: params.platformId,
          release_id: params.releaseId,
          song_release_id: data.id,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streaming-releases"] });
      toast({
        title: "Released to streaming",
        description: "Your song is now live on the platform!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Release failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const takeDown = useMutation({
    mutationFn: async (releaseId: string) => {
      const { error } = await supabase
        .from("song_releases")
        .update({ is_active: false })
        .eq("id", releaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streaming-releases"] });
      toast({
        title: "Song taken down",
        description: "Your song has been removed from streaming.",
      });
    },
  });

  return {
    releases,
    platforms,
    analytics,
    releasesLoading,
    releasesError,
    releasesErrorDetail,
    refetchReleases,
    releaseToStreaming,
    takeDown,
  };
};
