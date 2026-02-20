import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useFestivalSlotOffers = (bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: offers, isLoading } = useQuery({
    queryKey: ["festival-slot-offers", bandId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("festival_slot_offers")
        .select(`
          *,
          festival:game_events(id, title, start_date, end_date),
          band:bands(id, name)
        `)
        .order("created_at", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!bandId,
  });

  const respondToOfferMutation = useMutation({
    mutationFn: async ({ offerId, status }: { offerId: string; status: "accepted" | "rejected" }) => {
      const { error } = await (supabase as any)
        .from("festival_slot_offers")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["festival-slot-offers"] });
      toast({
        title: status === "accepted" ? "Offer accepted!" : "Offer declined",
        description: status === "accepted" 
          ? "You're now booked for this festival slot." 
          : "The festival slot offer has been declined.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to respond",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    offers,
    isLoading,
    respondToOffer: respondToOfferMutation.mutate,
    isResponding: respondToOfferMutation.isPending,
  };
};
