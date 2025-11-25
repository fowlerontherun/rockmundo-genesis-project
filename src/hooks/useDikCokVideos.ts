import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useDikCokVideos = (bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: videos, isLoading } = useQuery({
    queryKey: ["dikcok-videos", bandId],
    queryFn: async () => {
      let query = supabase
        .from("dikcok_videos")
        .select(`
          *,
          band:bands(id, name, genre, logo_url),
          video_type:dikcok_video_types(name, category, difficulty),
          track:songs(id, title)
        `)
        .order("created_at", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: trending } = useQuery({
    queryKey: ["dikcok-trending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_videos")
        .select(`
          *,
          band:bands(id, name, genre),
          video_type:dikcok_video_types(name, category)
        `)
        .order("views", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const createVideoMutation = useMutation({
    mutationFn: async (videoData: {
      band_id: string;
      creator_user_id: string;
      video_type_id: string;
      track_id?: string;
      title: string;
      description?: string;
      trending_tag?: string;
    }) => {
      const { data, error } = await supabase
        .from("dikcok_videos")
        .insert(videoData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-videos"] });
      queryClient.invalidateQueries({ queryKey: ["dikcok-trending"] });
      toast({
        title: "Video created!",
        description: "Your DikCok video is now live.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const incrementViewsMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase.rpc("increment_dikcok_video_views", {
        p_video_id: videoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-videos"] });
    },
  });

  return {
    videos,
    trending,
    isLoading,
    createVideo: createVideoMutation.mutate,
    isCreating: createVideoMutation.isPending,
    incrementViews: incrementViewsMutation.mutate,
  };
};
