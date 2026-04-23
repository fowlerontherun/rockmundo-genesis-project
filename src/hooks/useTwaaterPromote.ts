import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const PROMOTE_TIERS = [
  { hours: 1, cost: 250, label: "1 hour" },
  { hours: 6, cost: 1200, label: "6 hours" },
  { hours: 24, cost: 4000, label: "24 hours" },
] as const;

export const useTwaaterPromote = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ twaatId, hours }: { twaatId: string; hours: 1 | 6 | 24 }) => {
      const { data, error } = await supabase.rpc("promote_twaat" as any, {
        p_twaat_id: twaatId,
        p_hours: hours,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Twaat promoted",
        description: `Boosted for $${data?.cost?.toLocaleString?.() ?? "?"} until ${
          data?.promoted_until ? new Date(data.promoted_until).toLocaleString() : "later"
        }.`,
      });
      qc.invalidateQueries({ queryKey: ["twaats"] });
      qc.invalidateQueries({ queryKey: ["twaater-feed"] });
      qc.invalidateQueries({ queryKey: ["twaater-trending"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: any) => {
      const code = err?.message || "";
      const friendly =
        code.includes("insufficient_funds") ? "You don't have enough cash." :
        code.includes("not_owner") ? "You can only promote your own twaats." :
        code.includes("invalid_duration") ? "Invalid promotion duration." :
        "Failed to promote twaat.";
      toast({ title: "Promote failed", description: friendly, variant: "destructive" });
    },
  });
};
