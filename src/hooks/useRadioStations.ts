import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RadioStation {
  id: string;
  name: string;
  city_id: string | null;
  country: string;
  station_type: string;
  quality_level: number;
  listener_base: number;
  frequency: string;
  accepted_genres: string[];
  accepts_submissions?: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  min_fans_required?: number;
  min_fame_required?: number;
  requires_local_presence?: boolean;
  auto_accept_threshold?: number;
  city?: { name: string; country: string } | null;
}

export interface RadioSubmission {
  id: string;
  station_id: string;
  song_id: string;
  user_id: string;
  band_id: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  station?: RadioStation;
  song?: any;
  band?: any;
}

export const useRadioStations = () => {
  const queryClient = useQueryClient();

  // Fetch all stations with city info
  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["radio-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radio_stations")
        .select("*, city:cities(name, country)")
        .order("listener_base", { ascending: false });

      if (error) throw error;
      return data as RadioStation[];
    },
  });

  // Fetch my submissions
  const { data: mySubmissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ["my-radio-submissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("radio_submissions")
        .select(`
          *,
          station:radio_stations!inner(id, name, station_type, quality_level),
          song:songs!inner(id, title, genre)
        `)
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch submissions for specific station
  const getStationSubmissions = (stationId: string) =>
    useQuery({
      queryKey: ["station-submissions", stationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("radio_submissions")
          .select(`
            *,
            song:songs!inner(id, title, genre),
            band:bands(id, name)
          `)
          .eq("station_id", stationId)
          .eq("status", "accepted")
          .order("submitted_at", { ascending: false });

        if (error) throw error;
        return data as any[];
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
      const { data: existing } = await supabase
        .from("radio_submissions")
        .select("id")
        .eq("station_id", stationId)
        .eq("song_id", songId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        throw new Error("Song already submitted to this station");
      }

      const { data, error } = await supabase
        .from("radio_submissions")
        .insert({
          station_id: stationId,
          song_id: songId,
          user_id: user.id,
          band_id: bandId || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-radio-submissions"] });
      toast.success("Song submitted for review");
    },
    onError: (error: any) => {
      toast.error("Failed to submit song", { description: error.message });
    },
  });


  return {
    stations,
    mySubmissions,
    isLoading: stationsLoading || submissionsLoading,
    getStationSubmissions,
    submitToStation: submitToStation.mutate,
    isSubmitting: submitToStation.isPending,
  };
};
