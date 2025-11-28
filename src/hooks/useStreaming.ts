import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export const useStreaming = (userId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: releases, isLoading: releasesLoading } = useQuery({
    queryKey: ["streaming-releases", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_releases")
        .select(`
          *,
          song:songs(*),
          platform:streaming_platforms(*)
        `)
        .or(`user_id.eq.${userId},band_id.in.(select band_id from band_members where user_id='${userId}')`)
        .eq("release_type", "streaming")
        .order("release_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: platforms } = useQuery({
    queryKey: ["streaming-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_platforms")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["streaming-analytics", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_analytics_daily")
        .select(`
          *,
          release:song_releases(
            *,
            song:songs(*)
          )
        `)
        .order("date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const releaseToStreaming = useMutation({
    mutationFn: async (params: {
      songId: string;
      platformId: string;
      userId: string;
      releaseId: string;
      bandId?: string;
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
    releaseToStreaming,
    takeDown,
  };
};
