import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CompanyLabel } from "@/types/company";

export const useCompanyLabels = (companyId: string | undefined) => {
  return useQuery<CompanyLabel[]>({
    queryKey: ["company-labels", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("labels")
        .select("id, name, logo_url, company_id, balance, is_bankrupt, headquarters_city, reputation_score")
        .eq("company_id", companyId)
        .order("name");

      if (error) throw error;
      return data as CompanyLabel[];
    },
    enabled: !!companyId,
  });
};

/**
 * Returns labels owned by the current profile that are not yet linked to any company.
 * Surfaced on the holding page so players can quickly attach them.
 */
export const useUnlinkedOwnedLabels = (profileId: string | undefined) => {
  return useQuery<CompanyLabel[]>({
    queryKey: ["unlinked-owned-labels", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("labels")
        .select("id, name, logo_url, company_id, balance, is_bankrupt, headquarters_city, reputation_score")
        .eq("owner_id", profileId)
        .is("company_id", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CompanyLabel[];
    },
    enabled: !!profileId,
  });
};
