import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CharityCampaign = Database["public"]["Tables"]["community_charity_campaigns"]["Row"];
export type CharityImpactMetric = Database["public"]["Tables"]["community_charity_impact_metrics"]["Row"];
export type CharityDonation = Database["public"]["Tables"]["community_charity_donations"]["Row"];

export type CharityCampaignWithDetails = CharityCampaign & {
  metrics: CharityImpactMetric[];
  donations: CharityDonation[];
};

type CharityCampaignQueryRow = CharityCampaign & {
  metrics: CharityImpactMetric[] | null;
  donations: CharityDonation[] | null;
};

const fetchCharityCampaigns = async (): Promise<CharityCampaignWithDetails[]> => {
  const { data, error } = await supabase
    .from("community_charity_campaigns")
    .select<CharityCampaignQueryRow[]>(`
      *,
      metrics:community_charity_impact_metrics(*),
      donations:community_charity_donations(*)
    `)
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Failed to load charity campaigns", error);
    throw error;
  }

  return (data ?? []).map((campaign) => ({
    ...campaign,
    metrics: campaign.metrics ?? [],
    donations: campaign.donations ?? [],
  }));
};

export const useCharityCampaignData = () =>
  useQuery({
    queryKey: ["community-charity-campaigns"],
    queryFn: fetchCharityCampaigns,
    staleTime: 1000 * 60 * 5,
  });
