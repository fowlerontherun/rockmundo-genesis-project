import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDikCokVideoTypes = () => {
  const { data: videoTypes, isLoading } = useQuery({
    queryKey: ["dikcok-video-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_video_types")
        .select("*")
        .order("difficulty", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  return { videoTypes, isLoading };
};
