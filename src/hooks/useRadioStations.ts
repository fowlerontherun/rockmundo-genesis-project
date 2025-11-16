import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RadioStation {
  id: string;
  station_name: string;
  city_id: string | null;
  frequency: string | null;
  genre_focus: string | null;
  listener_count: number;
  reputation: number;
  hourly_rate: number;
  created_at: string;
}

export interface RadioAirplay {
  id: string;
  station_id: string;
  song_id: string;
  band_id: string | null;
  play_count: number;
  last_played_at: string | null;
  peak_position: number | null;
  weeks_on_rotation: number;
  listener_response: number;
  station?: RadioStation;
  song?: any;
  band?: any;
}

export const useRadioStations = () => {
  const queryClient = useQueryClient();

  // Fetch all stations
  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["radio-stations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("radio_stations")
        .select("*")
        .order("listener_count", { ascending: false });

      if (error) throw error;
      return data as RadioStation[];
    },
  });

  // Fetch top airplay across all stations
  const { data: topAirplay = [], isLoading: airplayLoading } = useQuery({
    queryKey: ["top-radio-airplay"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("radio_airplay")
        .select(`
          *,
          station:radio_stations(station_name, frequency),
          song:songs(title, genre),
          band:bands(name)
        `)
        .order("play_count", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as RadioAirplay[];
    },
  });

  // Fetch airplay for specific station
  const getStationAirplay = (stationId: string) =>
    useQuery({
      queryKey: ["station-airplay", stationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("radio_airplay" as any)
          .select(`
            *,
            song:songs(title, genre, mood),
            band:bands(name)
          `)
          .eq("station_id", stationId)
          .order("play_count", { ascending: false });

        if (error) throw error;
        return data as any as RadioAirplay[];
      },
      enabled: !!stationId,
    });

  // Submit song to radio station
  const submitToStation = useMutation({
    mutationFn: async ({
      stationId,
      songId,
      bandId,
    }: {
      stationId: string;
      songId: string;
      bandId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if already submitted
      const { data: existing } = await (supabase as any)
        .from("radio_airplay")
        .select("id")
        .eq("station_id", stationId)
        .eq("song_id", songId)
        .maybeSingle();

      if (existing) {
        throw new Error("Song already submitted to this station");
      }

      const { data, error } = await (supabase as any)
        .from("radio_airplay")
        .insert({
          station_id: stationId,
          song_id: songId,
          band_id: bandId || null,
          play_count: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-radio-airplay"] });
      toast.success("Song submitted to radio station");
    },
    onError: (error: any) => {
      toast.error("Failed to submit song", { description: error.message });
    },
  });

  // Log radio play
  const logRadioPlay = useMutation({
    mutationFn: async ({
      airplayId,
      stationId,
      estimatedListeners,
      timeSlot,
    }: {
      airplayId: string;
      stationId: string;
      estimatedListeners: number;
      timeSlot: string;
    }) => {
      const { error: logError } = await (supabase as any).from("radio_play_logs").insert({
        airplay_id: airplayId,
        station_id: stationId,
        estimated_listeners: estimatedListeners,
        time_slot: timeSlot,
      });

      if (logError) throw logError;

      // Increment play count
      const { data: airplay } = await (supabase as any)
        .from("radio_airplay")
        .select("play_count")
        .eq("id", airplayId)
        .single();

      if (airplay) {
        await (supabase as any)
          .from("radio_airplay")
          .update({
            play_count: (airplay as any).play_count + 1,
            last_played_at: new Date().toISOString(),
          })
          .eq("id", airplayId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-radio-airplay"] });
    },
  });

  return {
    stations,
    topAirplay,
    isLoading: stationsLoading || airplayLoading,
    getStationAirplay,
    submitToStation: submitToStation.mutate,
    logRadioPlay: logRadioPlay.mutate,
    isSubmitting: submitToStation.isPending,
  };
};
