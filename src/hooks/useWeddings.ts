import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export interface Wedding {
  id: string;
  marriage_id: string;
  venue_city_id: string | null;
  venue_name: string | null;
  tier: string;
  guest_count: number;
  cost_cents: number;
  theme: string | null;
  ceremony_at: string;
  status: string;
  actual_attendance: number;
  fame_gained: number;
  media_buzz: number;
  photos_jsonb: unknown;
  vows_a: string | null;
  vows_b: string | null;
  metadata: Record<string, unknown>;
}

export const WEDDING_TIERS = [
  { value: "courthouse", label: "Courthouse", baseCost: 50_000, baseFame: 5 },
  { value: "small", label: "Small ceremony", baseCost: 500_000, baseFame: 15 },
  { value: "medium", label: "Medium ceremony", baseCost: 2_500_000, baseFame: 40 },
  { value: "grand", label: "Grand wedding", baseCost: 10_000_000, baseFame: 120 },
  { value: "legendary", label: "Legendary celebrity wedding", baseCost: 50_000_000, baseFame: 400 },
] as const;

export function calcWeddingCostCents(tier: string, guestCount: number) {
  const cfg = WEDDING_TIERS.find((t) => t.value === tier) ?? WEDDING_TIERS[1];
  const perGuest = Math.round(cfg.baseCost * 0.001);
  return cfg.baseCost + perGuest * Math.max(0, guestCount);
}

export function useWedding(marriageId: string | undefined) {
  return useQuery({
    queryKey: ["wedding", marriageId],
    enabled: !!marriageId,
    queryFn: async (): Promise<Wedding | null> => {
      if (!marriageId) return null;
      const { data, error } = await supabase
        .from(asAny("weddings"))
        .select("*")
        .eq("marriage_id", marriageId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Wedding | null;
    },
  });
}

export function usePlanWedding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      marriageId: string;
      tier: string;
      guestCount: number;
      theme?: string;
      venueName?: string;
      ceremonyAt: string;
    }) => {
      const cost = calcWeddingCostCents(params.tier, params.guestCount);
      const { data, error } = await supabase
        .from(asAny("weddings"))
        .insert(asAny({
          marriage_id: params.marriageId,
          tier: params.tier,
          guest_count: params.guestCount,
          cost_cents: cost,
          theme: params.theme ?? null,
          venue_name: params.venueName ?? null,
          ceremony_at: params.ceremonyAt,
          status: "planned",
        }))
        .select()
        .single();
      if (error) throw error;
      await supabase.from(asAny("marriages")).update(asAny({ wedding_id: (data as any).id })).eq("id", params.marriageId);
      return data;
    },
    onSuccess: () => {
      toast.success("Wedding planned! 💒");
      qc.invalidateQueries({ queryKey: ["wedding"] });
      qc.invalidateQueries({ queryKey: ["marriage-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTriggerWedding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weddingId: string) => {
      const { data, error } = await supabase.functions.invoke("complete-wedding", { body: { wedding_id: weddingId } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Ceremony complete! 💒✨");
      qc.invalidateQueries({ queryKey: ["wedding"] });
      qc.invalidateQueries({ queryKey: ["marriage-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
