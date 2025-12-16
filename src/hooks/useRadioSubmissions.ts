import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useRadioSubmissions = (bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["radio-submissions", bandId],
    queryFn: async () => {
      let query = supabase
        .from("radio_submissions")
        .select(`
          *,
          song:songs(id, title),
          station:radio_stations(id, name, station_type)
        `)
        .order("submitted_at", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((s: any) => ({
        id: s.id,
        song_title: s.song?.title || "Unknown Song",
        station_name: s.station?.name || "Unknown Station",
        status: s.status,
        submitted_at: s.submitted_at,
        reviewed_at: s.reviewed_at,
        rejection_reason: s.rejection_reason,
      }));
    },
    enabled: !!bandId,
  });

  const submitToRadioMutation = useMutation({
    mutationFn: async ({
      songId,
      stationId,
      bandId,
    }: {
      songId: string;
      stationId: string;
      bandId: string;
    }) => {
      const { error } = await supabase
        .from("radio_submissions")
        .insert({
          song_id: songId,
          station_id: stationId,
          band_id: bandId,
          status: "pending",
          submitted_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radio-submissions"] });
      toast({
        title: "Song submitted!",
        description: "Your song has been submitted for radio review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    submissions: submissions || [],
    isLoading,
    submitToRadio: submitToRadioMutation.mutate,
    isSubmitting: submitToRadioMutation.isPending,
  };
};
