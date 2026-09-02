import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface MayorUniversity {
  id: string;
  city_id: string;
  name: string;
  prestige: number;
  quality_of_learning: number;
  academic_cost_modifier: number;
  mayor_fee_modifier: number;
  course_cost_modifier: number;
  quality_investment_total: number;
  last_quality_upgrade_at: string | null;
  fee_updated_at: string | null;
  course_count: number;
}

const UNIVERSITY_ERROR_MESSAGES: Record<string, string> = {
  university_management_auth_required: "You must be logged in to manage universities.",
  university_management_profile_forbidden: "That character does not belong to your account.",
  university_management_not_found: "That university could not be found.",
  university_management_mayor_required: "Only the current mayor can manage universities in this city.",
  university_management_fee_out_of_range: "Course fees can be set between 80% and 120% of the university's academic baseline.",
  university_management_fee_step_invalid: "Course fee changes must use 5% steps.",
  university_management_quality_max: "This university has already reached maximum teaching quality.",
  university_management_insufficient_treasury: "The city treasury does not have enough available funds for this upgrade.",
};

function universityError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? "Unknown error");
  const code = Object.keys(UNIVERSITY_ERROR_MESSAGES).find((key) => raw.includes(key));
  return new Error(code ? UNIVERSITY_ERROR_MESSAGES[code] : raw);
}

export function getUniversityQualityUpgradeCost(quality: number) {
  const normalized = Math.max(0, Math.min(100, Math.round(quality)));
  if (normalized >= 100) return null;
  return Math.round(5000 + normalized * normalized * 3);
}

export function useMayorUniversities(cityId: string | undefined) {
  return useQuery({
    queryKey: ["mayor-universities", cityId],
    queryFn: async () => {
      if (!cityId) return [];

      const { data, error } = await (supabase as any)
        .from("universities")
        .select(`
          id,
          city_id,
          name,
          prestige,
          quality_of_learning,
          academic_cost_modifier,
          mayor_fee_modifier,
          course_cost_modifier,
          quality_investment_total,
          last_quality_upgrade_at,
          fee_updated_at,
          university_courses(count)
        `)
        .eq("city_id", cityId)
        .order("prestige", { ascending: false })
        .order("quality_of_learning", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        city_id: row.city_id,
        name: row.name,
        prestige: Number(row.prestige ?? 50),
        quality_of_learning: Number(row.quality_of_learning ?? 50),
        academic_cost_modifier: Number(row.academic_cost_modifier ?? 1),
        mayor_fee_modifier: Number(row.mayor_fee_modifier ?? 1),
        course_cost_modifier: Number(row.course_cost_modifier ?? 1),
        quality_investment_total: Number(row.quality_investment_total ?? 0),
        last_quality_upgrade_at: row.last_quality_upgrade_at ?? null,
        fee_updated_at: row.fee_updated_at ?? null,
        course_count: Number(row.university_courses?.[0]?.count ?? 0),
      })) as MayorUniversity[];
    },
    enabled: !!cityId,
  });
}

export function useSetUniversityCourseFees() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cityId,
      universityId,
      feeModifier,
    }: {
      cityId: string;
      universityId: string;
      feeModifier: number;
    }) => {
      if (!profileId) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any).rpc("set_university_course_fee", {
        p_university_id: universityId,
        p_profile_id: profileId,
        p_fee_modifier: feeModifier,
      });

      if (error) throw universityError(error);
      return { cityId, universityId, data };
    },
    onSuccess: ({ cityId, universityId }) => {
      queryClient.invalidateQueries({ queryKey: ["mayor-universities", cityId] });
      queryClient.invalidateQueries({ queryKey: ["university", universityId] });
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
      toast.success("University course fees updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpgradeUniversityQuality() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cityId,
      universityId,
    }: {
      cityId: string;
      universityId: string;
    }) => {
      if (!profileId) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any).rpc("upgrade_university_quality", {
        p_university_id: universityId,
        p_profile_id: profileId,
      });

      if (error) throw universityError(error);
      return { cityId, universityId, data };
    },
    onSuccess: ({ cityId, universityId }) => {
      queryClient.invalidateQueries({ queryKey: ["mayor-universities", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] });
      queryClient.invalidateQueries({ queryKey: ["university", universityId] });
      queryClient.invalidateQueries({ queryKey: ["university_courses", universityId] });
      queryClient.invalidateQueries({ queryKey: ["universities"] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
      toast.success("University teaching quality improved by 1 point.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
