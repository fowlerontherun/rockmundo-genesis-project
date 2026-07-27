import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

export interface BotbEvent {
  id: string;
  city_id: string;
  scheduled_date: string;
  status: "upcoming" | "completed" | "cancelled";
  max_entries: number;
  winner_band_id: string | null;
  winner_rating: number | null;
  resolved_at: string | null;
  city?: { id: string; name: string; country: string } | null;
  winner_band?: { id: string; name: string } | null;
  entry_count?: number;
}

export interface BotbEntry {
  id: string;
  event_id: string;
  band_id: string;
  profile_id: string | null;
  song_1_id: string | null;
  song_2_id: string | null;
  overall_rating: number | null;
  placement: number | null;
  is_winner: boolean;
  fame_gained: number;
  fans_gained: number;
  cash_awarded: number;
  band?: { id: string; name: string } | null;
  song_1?: { id: string; title: string } | null;
  song_2?: { id: string; title: string } | null;
  event?: BotbEvent | null;
}

const EVENT_SELECT = `
  *,
  city:cities(id, name, country),
  winner_band:bands!botb_events_winner_band_id_fkey(id, name),
  botb_entries(id)
`;

function withCounts(rows: any[]): BotbEvent[] {
  return (rows || []).map((row) => ({
    ...row,
    entry_count: Array.isArray(row.botb_entries) ? row.botb_entries.length : 0,
  }));
}

export function useBotbUpcoming(cityId?: string) {
  return useQuery({
    queryKey: ["botb-upcoming", cityId ?? "all"],
    queryFn: async () => {
      let query = db
        .from("botb_events")
        .select(EVENT_SELECT)
        .eq("status", "upcoming")
        .order("scheduled_date", { ascending: true })
        .limit(200);

      if (cityId) query = query.eq("city_id", cityId);

      const { data, error } = await query;
      if (error) throw error;
      return withCounts(data);
    },
  });
}

export function useBotbHistory(cityId?: string) {
  return useQuery({
    queryKey: ["botb-history", cityId ?? "all"],
    queryFn: async () => {
      let query = db
        .from("botb_events")
        .select(EVENT_SELECT)
        .eq("status", "completed")
        .order("scheduled_date", { ascending: false })
        .limit(100);

      if (cityId) query = query.eq("city_id", cityId);

      const { data, error } = await query;
      if (error) throw error;
      return withCounts(data);
    },
  });
}

export function useBotbEventEntries(eventId: string | null) {
  return useQuery({
    queryKey: ["botb-event-entries", eventId],
    queryFn: async () => {
      if (!eventId) return [] as BotbEntry[];
      const { data, error } = await db
        .from("botb_entries")
        .select(`*, band:bands(id, name)`)
        .eq("event_id", eventId)
        .order("placement", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as BotbEntry[];
    },
    enabled: !!eventId,
  });
}

export function useMyBandBotbEntries(bandId?: string | null) {
  return useQuery({
    queryKey: ["botb-my-entries", bandId ?? null],
    queryFn: async () => {
      if (!bandId) return [] as BotbEntry[];
      const { data, error } = await db
        .from("botb_entries")
        .select(
          `*,
           band:bands(id, name),
           song_1:songs!botb_entries_song_1_id_fkey(id, title),
           song_2:songs!botb_entries_song_2_id_fkey(id, title),
           event:botb_events(*, city:cities(id, name, country))`
        )
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BotbEntry[];
    },
    enabled: !!bandId,
  });
}

export function useBotbEligibility(eventId: string | null, bandId?: string | null) {
  return useQuery({
    queryKey: ["botb-eligibility", eventId, bandId ?? null],
    queryFn: async () => {
      if (!eventId || !bandId) return null;
      const { data, error } = await db.rpc("botb_check_eligibility", {
        p_event_id: eventId,
        p_band_id: bandId,
      });
      if (error) throw error;
      return data as { eligible: boolean; reason: string | null };
    },
    enabled: !!eventId && !!bandId,
  });
}

export function useEnterBotb() {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      bandId,
      song1Id,
      song2Id,
    }: {
      eventId: string;
      bandId: string;
      song1Id: string;
      song2Id: string;
    }) => {
      const { data, error } = await db.rpc("enter_battle_of_the_bands", {
        p_event_id: eventId,
        p_band_id: bandId,
        p_profile_id: profileId ?? null,
        p_song_1_id: song1Id,
        p_song_2_id: song2Id,
      });
      if (error) throw new Error(cleanError(error.message));
      return data;
    },
    onSuccess: () => {
      toast({
        title: "You're in!",
        description: "Your band is entered into the Battle of the Bands.",
      });
      queryClient.invalidateQueries({ queryKey: ["botb-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["botb-my-entries"] });
      queryClient.invalidateQueries({ queryKey: ["botb-eligibility"] });
    },
    onError: (error: Error) => {
      toast({ title: "Entry failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useWithdrawBotbEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await db.from("botb_entries").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Withdrawn", description: "Your band has been removed from that battle." });
      queryClient.invalidateQueries({ queryKey: ["botb-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["botb-my-entries"] });
    },
    onError: (error: Error) => {
      toast({ title: "Withdraw failed", description: error.message, variant: "destructive" });
    },
  });
}

function cleanError(message: string): string {
  if (!message) return "Something went wrong";
  if (message.includes("BOTB_INELIGIBLE:")) return message.split("BOTB_INELIGIBLE:")[1].trim();
  if (message.includes("BOTB_NOT_BAND_MEMBER")) return "You must be a member of this band";
  if (message.includes("BOTB_SONG_NOT_OWNED")) return "Those songs don't belong to your band";
  if (message.includes("BOTB_INVALID_SONGS")) return "Pick two different songs";
  if (message.includes("BOTB_UNAUTHENTICATED")) return "You must be signed in";
  return message;
}
