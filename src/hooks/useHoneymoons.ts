import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export const HONEYMOON_TIERS = [
  { value: "budget", label: "Budget", baseCost: 200_000, days: 3 },
  { value: "standard", label: "Standard", baseCost: 1_000_000, days: 7 },
  { value: "luxury", label: "Luxury", baseCost: 5_000_000, days: 10 },
  { value: "world_tour", label: "World tour", baseCost: 25_000_000, days: 14 },
] as const;

export interface Honeymoon {
  id: string;
  marriage_id: string;
  destination_name: string | null;
  package_tier: string;
  duration_days: number;
  cost_cents: number;
  starts_at: string;
  ends_at: string;
  status: string;
  bond_gained: number;
  health_gained: number;
  fame_gained: number;
}

export function useHoneymoon(marriageId: string | undefined) {
  return useQuery({
    queryKey: ["honeymoon", marriageId],
    enabled: !!marriageId,
    queryFn: async (): Promise<Honeymoon | null> => {
      if (!marriageId) return null;
      const { data, error } = await supabase
        .from(asAny("honeymoons"))
        .select("*")
        .eq("marriage_id", marriageId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Honeymoon | null;
    },
  });
}

export function usePlanHoneymoon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      marriageId: string;
      tier: string;
      destinationName?: string;
      startsAt: string;
    }) => {
      const cfg = HONEYMOON_TIERS.find((t) => t.value === params.tier) ?? HONEYMOON_TIERS[1];
      const start = new Date(params.startsAt);
      const end = new Date(start.getTime() + cfg.days * 24 * 3600 * 1000);
      const { data, error } = await supabase
        .from(asAny("honeymoons"))
        .insert(asAny({
          marriage_id: params.marriageId,
          package_tier: params.tier,
          duration_days: cfg.days,
          cost_cents: cfg.baseCost,
          destination_name: params.destinationName ?? null,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          status: "planned",
        }))
        .select().single();
      if (error) throw error;
      await supabase.from(asAny("marriages")).update(asAny({ honeymoon_id: (data as any).id })).eq("id", params.marriageId);
      return data;
    },
    onSuccess: () => {
      toast.success("Honeymoon booked! 🏝️");
      qc.invalidateQueries({ queryKey: ["honeymoon"] });
      qc.invalidateQueries({ queryKey: ["marriage-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
