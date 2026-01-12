import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RadioContent {
  id: string;
  content_type: 'jingle' | 'advert';
  title: string;
  script: string;
  audio_url: string | null;
  audio_status: string;
  voice_id: string | null;
  category: string | null;
  brand_name: string | null;
  humor_style: string | null;
  duration_seconds: number | null;
  play_weight: number;
  is_active: boolean;
  created_at: string;
}

export const useRadioContent = () => {
  return useQuery({
    queryKey: ["rm-radio-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_content")
        .select("*")
        .eq("is_active", true)
        .eq("audio_status", "completed")
        .not("audio_url", "is", null);

      if (error) {
        console.error("[useRadioContent] Error fetching radio content:", error);
        return [];
      }

      return (data || []) as RadioContent[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useAllRadioContent = () => {
  return useQuery({
    queryKey: ["rm-radio-content-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_content")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[useAllRadioContent] Error fetching radio content:", error);
        return [];
      }

      return (data || []) as RadioContent[];
    },
    staleTime: 30 * 1000, // 30 seconds for admin
  });
};

// Get weighted random content
export const getRandomContent = (content: RadioContent[]): RadioContent | null => {
  if (content.length === 0) return null;

  // Build weighted array
  const weightedArray: RadioContent[] = [];
  for (const item of content) {
    const weight = item.play_weight || 1;
    for (let i = 0; i < weight; i++) {
      weightedArray.push(item);
    }
  }

  return weightedArray[Math.floor(Math.random() * weightedArray.length)];
};
