import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "@/hooks/use-toast";

interface TravelStatus {
  is_traveling: boolean;
  travel_arrives_at: string | null;
  current_city_id: string | null;
  current_city_name: string | null;
  destination_city_name: string | null;
  departure_time: string | null;
  transport_type: string | null;
  travel_id: string | null;
}

export function useTravelStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: travelStatus, isLoading } = useQuery({
    queryKey: ["travel-status", user?.id],
    queryFn: async (): Promise<TravelStatus | null> => {
      if (!user) return null;

      // Get profile with travel status
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          is_traveling,
          travel_arrives_at,
          current_city_id,
          cities:current_city_id(name)
        `)
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) return null;

      // If traveling, get active travel details
      let travelDetails = null;
      if (profile.is_traveling) {
        const { data: activeTravel } = await supabase
          .from("player_travel_history")
          .select(`
            id,
            departure_time,
            arrival_time,
            transport_type,
            to_city:to_city_id(name),
            from_city:from_city_id(name)
          `)
          .eq("user_id", user.id)
          .eq("status", "in_progress")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        travelDetails = activeTravel;
      }

      return {
        is_traveling: profile.is_traveling || false,
        travel_arrives_at: profile.travel_arrives_at,
        current_city_id: profile.current_city_id,
        current_city_name: (profile.cities as any)?.name || null,
        destination_city_name: travelDetails?.to_city?.name || null,
        departure_time: travelDetails?.departure_time || null,
        transport_type: travelDetails?.transport_type || null,
        travel_id: travelDetails?.id || null,
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const cancelTravelMutation = useMutation({
    mutationFn: async (travelId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get the travel record to calculate refund
      const { data: travel, error: travelError } = await supabase
        .from("player_travel_history")
        .select("cost_paid")
        .eq("id", travelId)
        .eq("user_id", user.id)
        .single();

      if (travelError) throw travelError;

      const refundAmount = Math.floor((travel?.cost_paid || 0) * 0.5);

      // Update travel status
      const { error: updateError } = await supabase
        .from("player_travel_history")
        .update({ status: "cancelled" })
        .eq("id", travelId);

      if (updateError) throw updateError;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          is_traveling: false,
          travel_arrives_at: null,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Refund player by fetching current cash and adding refund
      if (refundAmount > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("user_id", user.id)
          .single();

        await supabase
          .from("profiles")
          .update({ cash: (profile?.cash || 0) + refundAmount })
          .eq("user_id", user.id);
      }

      return { refundAmount };
    },
    onSuccess: ({ refundAmount }) => {
      toast({
        title: "Travel Cancelled",
        description: `You received a $${refundAmount} refund.`,
      });
      queryClient.invalidateQueries({ queryKey: ["travel-status"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel travel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    travelStatus,
    isLoading,
    isTraveling: travelStatus?.is_traveling || false,
    cancelTravel: cancelTravelMutation.mutate,
    isCancelling: cancelTravelMutation.isPending,
  };
}
