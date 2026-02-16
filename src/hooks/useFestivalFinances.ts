import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FestivalFinances {
  id: string;
  festival_id: string;
  ticket_revenue: number;
  sponsorship_income: number;
  security_cost: number;
  stage_costs: number;
  band_payouts_total: number;
  festival_tax_rate: number;
  festival_tax_amount: number;
  total_profit: number;
  budget: number;
  created_at: string;
  updated_at: string;
}

export interface FestivalQualityRating {
  id: string;
  festival_id: string;
  comfort_rating: number;
  food_rating: number;
  safety_rating: number;
  lineup_rating: number;
  overall_rating: number;
  created_at: string;
  updated_at: string;
}

export const useFestivalFinances = (festivalId: string | undefined) => {
  return useQuery<FestivalFinances | null>({
    queryKey: ["festival-finances", festivalId],
    queryFn: async () => {
      if (!festivalId) return null;
      const { data, error } = await (supabase as any)
        .from("festival_finances")
        .select("*")
        .eq("festival_id", festivalId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!festivalId,
  });
};

export const useFestivalQuality = (festivalId: string | undefined) => {
  return useQuery<FestivalQualityRating | null>({
    queryKey: ["festival-quality", festivalId],
    queryFn: async () => {
      if (!festivalId) return null;
      const { data, error } = await (supabase as any)
        .from("festival_quality_ratings")
        .select("*")
        .eq("festival_id", festivalId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!festivalId,
  });
};

export const useCreateFestivalFinances = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (finances: Omit<FestivalFinances, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("festival_finances")
        .upsert(finances, { onConflict: "festival_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["festival-finances", variables.festival_id] });
      toast.success("Festival finances updated!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useUpdateFestivalQuality = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quality: Omit<FestivalQualityRating, "id" | "created_at" | "updated_at">) => {
      const overall = (quality.comfort_rating + quality.food_rating + quality.safety_rating + quality.lineup_rating) / 4;
      const { data, error } = await (supabase as any)
        .from("festival_quality_ratings")
        .upsert({ ...quality, overall_rating: overall }, { onConflict: "festival_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["festival-quality", variables.festival_id] });
      toast.success("Quality ratings updated!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

/**
 * Calculate festival budget from inputs
 */
export function calculateFestivalBudget(params: {
  ticketPrice: number;
  projectedAttendance: number;
  sponsorshipIncome: number;
  securityCost: number;
  stageCosts: number;
  taxRate?: number;
}): { budget: number; taxAmount: number; totalRevenue: number } {
  const taxRate = params.taxRate ?? 0.15;
  const ticketRevenue = params.ticketPrice * params.projectedAttendance;
  const totalRevenue = ticketRevenue + params.sponsorshipIncome;
  const taxAmount = totalRevenue * taxRate;
  const budget = totalRevenue - taxAmount - params.securityCost - params.stageCosts;
  return { budget: Math.max(0, budget), taxAmount, totalRevenue };
}
