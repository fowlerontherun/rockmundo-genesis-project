import { supabase } from "@/integrations/supabase/client";
import { supabaseArrayOrFallback } from "@/services/supabaseQuery";

export interface RadioContent {
  id: string;
  content_type: "jingle" | "advert";
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

export const radioContentKeys = {
  active: ["rm-radio-content"] as const,
  all: ["rm-radio-content-all"] as const,
};

export const fetchPlayableRadioContent = async (): Promise<RadioContent[]> => {
  const { data, error } = await supabase
    .from("radio_content")
    .select("*")
    .eq("is_active", true)
    .eq("audio_status", "completed")
    .not("audio_url", "is", null);

  return supabaseArrayOrFallback(data as RadioContent[] | null, error, {
    scope: "radioContentService",
    action: "fetch playable radio content",
  });
};

export const fetchAllRadioContent = async (): Promise<RadioContent[]> => {
  const { data, error } = await supabase
    .from("radio_content")
    .select("*")
    .order("created_at", { ascending: false });

  return supabaseArrayOrFallback(data as RadioContent[] | null, error, {
    scope: "radioContentService",
    action: "fetch all radio content",
  });
};
