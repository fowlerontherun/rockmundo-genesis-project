import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { NegotiatedTerms } from "@/components/festivals/FestivalContractNegotiationDialog";

export const useFestivalNegotiation = (bandId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: negotiations, isLoading } = useQuery({
    queryKey: ["festival-negotiations", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_offer_negotiations")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!bandId,
  });

  const negotiateMutation = useMutation({
    mutationFn: async (terms: NegotiatedTerms & { bandId: string }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      const totalPerksValue =
        (terms.requestBackstage ? 200 : 0) +
        (terms.requestHotel ? 500 : 0) +
        (terms.requestTransport ? 300 : 0) +
        (terms.requestSoundcheck ? 100 : 0);

      // Calculate acceptance probability
      let probability = 70;
      const paymentRatio = terms.counterPayment / 1000; // rough base
      if (paymentRatio > 1.2) probability -= 15;
      if (terms.merchCutPercent > 10) probability -= 10;
      if (terms.requestHotel) probability -= 8;
      if (terms.requestTransport) probability -= 5;
      probability = Math.max(15, Math.min(95, probability));

      // Simulate acceptance based on probability
      const roll = Math.random() * 100;
      const accepted = roll < probability;

      const { error } = await (supabase as any)
        .from("festival_offer_negotiations")
        .insert({
          offer_id: terms.offerId,
          band_id: terms.bandId,
          counter_payment: terms.counterPayment,
          merch_cut_percent: terms.merchCutPercent,
          request_backstage: terms.requestBackstage,
          request_hotel: terms.requestHotel,
          request_transport: terms.requestTransport,
          request_soundcheck: terms.requestSoundcheck,
          total_value: terms.counterPayment + totalPerksValue,
          acceptance_probability: probability,
          status: accepted ? "accepted" : "rejected",
          admin_response_note: accepted
            ? "Your terms have been accepted by the festival organizers!"
            : "The festival organizers couldn't meet your demands. Try a more modest counter-offer.",
          negotiated_by_user_id: user.id,
        });

      if (error) throw error;

      // If accepted, also update the original offer status
      if (accepted) {
        await (supabase as any)
          .from("festival_slot_offers")
          .update({
            status: "accepted",
            responded_at: new Date().toISOString(),
            guaranteed_payment: terms.counterPayment,
          })
          .eq("id", terms.offerId);
      }

      return { accepted, probability };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["festival-negotiations"] });
      queryClient.invalidateQueries({ queryKey: ["festival-slot-offers"] });
      toast({
        title: result.accepted ? "🎉 Counter-offer accepted!" : "Counter-offer rejected",
        description: result.accepted
          ? "The festival agreed to your terms! You're booked."
          : "They couldn't meet your demands. Try negotiating with lower terms.",
        variant: result.accepted ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Negotiation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    negotiations,
    isLoading,
    negotiate: negotiateMutation.mutate,
    isNegotiating: negotiateMutation.isPending,
    lastResult: negotiateMutation.data,
  };
};
