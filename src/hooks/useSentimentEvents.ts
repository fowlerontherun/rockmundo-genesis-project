import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SentimentEvent {
  id: string;
  band_id: string;
  event_type: string;
  sentiment_change: number;
  media_intensity_change: number;
  media_fatigue_change: number;
  sentiment_after: number;
  source: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const useSentimentEvents = (bandId: string | null, limit = 20) => {
  return useQuery({
    queryKey: ["sentiment-events", bandId, limit],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await (supabase as any)
        .from("band_sentiment_events")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as SentimentEvent[];
    },
    enabled: !!bandId,
  });
};
