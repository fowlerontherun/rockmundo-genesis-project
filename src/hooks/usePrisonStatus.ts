import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export function usePrisonStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: imprisonment, isLoading } = useQuery({
    queryKey: ["imprisonment", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("player_imprisonments")
        .select("*, prisons(name, has_music_program, rehabilitation_rating)")
        .eq("user_id", user.id)
        .eq("status", "imprisoned")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: criminalRecord } = useQuery({
    queryKey: ["criminal-record", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_criminal_record")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: pendingEvents } = useQuery({
    queryKey: ["prison-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_prison_events")
        .select("*, prison_events(*)")
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!imprisonment,
  });

  const { data: communityService } = useQuery({
    queryKey: ["community-service", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("community_service_assignments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const payBailMutation = useMutation({
    mutationFn: async (payerUserId?: string) => {
      if (!imprisonment) throw new Error("No active imprisonment");
      const session = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("pay-bail", {
        body: {
          imprisonment_id: imprisonment.id,
          payer_user_id: payerUserId || user?.id,
        },
        headers: { Authorization: `Bearer ${session.data.session?.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imprisonment"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const chooseEventMutation = useMutation({
    mutationFn: async ({ eventId, choice }: { eventId: string; choice: "a" | "b" }) => {
      const session = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("choose-prison-event", {
        body: { player_event_id: eventId, choice },
        headers: { Authorization: `Bearer ${session.data.session?.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prison-events"] });
      queryClient.invalidateQueries({ queryKey: ["imprisonment"] });
    },
  });

  const bailAmount = imprisonment?.bail_amount || 0;
  const daysRemaining = imprisonment?.remaining_sentence_days || 0;
  const behaviorScore = imprisonment?.behavior_score || 50;

  return {
    imprisonment,
    isImprisoned: !!imprisonment,
    isLoading,
    criminalRecord,
    pendingEvents,
    communityService,
    bailAmount,
    daysRemaining,
    behaviorScore,
    payBail: payBailMutation.mutate,
    isPayingBail: payBailMutation.isPending,
    chooseEvent: chooseEventMutation.mutate,
    isChoosingEvent: chooseEventMutation.isPending,
  };
}
