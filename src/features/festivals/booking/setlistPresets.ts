import { supabase } from "@/integrations/supabase/client";

/** Reuse the band's saved setlists as editable festival drafts. RLS limits
 * both reads to setlists the current player may manage. */
export async function listBandFestivalSetlistPresets(bandId: string) {
  const { data: lists, error } = await supabase
    .from("setlists")
    .select("id,name")
    .eq("band_id", bandId)
    .order("name");
  if (error) throw error;
  return lists ?? [];
}

export async function loadBandFestivalSetlistPreset(setlistId: string, bandId: string) {
  const { data: list, error: listError } = await supabase
    .from("setlists")
    .select("id")
    .eq("id", setlistId)
    .eq("band_id", bandId)
    .single();
  if (listError) throw listError;
  if (!list) throw new Error("Saved setlist is unavailable.");

  const { data, error } = await supabase
    .from("setlist_songs")
    .select("song_id,position,is_encore")
    .eq("setlist_id", setlistId)
    .not("song_id", "is", null)
    .order("position");
  if (error) throw error;
  return (data ?? []).filter((item) => item.song_id).map((item) => ({
    song_id: item.song_id!,
    is_encore: item.is_encore ?? false,
  }));
}
