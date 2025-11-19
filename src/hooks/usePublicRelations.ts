import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export interface PRCampaign {
  id: string;
  band_id: string;
  campaign_type: string;
  campaign_name: string;
  budget: number;
  start_date: string;
  end_date: string;
  status: string;
  reach: number;
  engagement_rate: number;
  media_impressions: number;
  created_at: string;
}

export interface MediaAppearance {
  id: string;
  band_id: string;
  media_type: string;
  program_name: string;
  network: string;
  air_date: string;
  audience_reach: number;
  sentiment: string;
  highlight: string;
  created_at: string;
}

export interface MediaOffer {
  id: string;
  band_id: string;
  media_type: string;
  program_name: string;
  network: string;
  proposed_date: string;
  status: string;
  compensation: number;
  created_at: string;
}

export const usePublicRelations = (bandId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // TODO: Enrich PR analytics by piping performance metrics into Supabase and surfacing engagement rollups alongside each campaign.
  // TODO: Add AI-assisted pitch drafting that pre-fills campaign proposals and offer responses with on-brand messaging suggestions.

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["pr-campaigns", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await (supabase as any)
        .from("pr_campaigns")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  const { data: appearances = [], isLoading: appearancesLoading } = useQuery({
    queryKey: ["media-appearances", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await (supabase as any)
        .from("media_appearances")
        .select("*")
        .eq("band_id", bandId)
        .order("air_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["media-offers", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await supabase
        .from("media_offers")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!bandId,
  });

  const createCampaign = useMutation({
    mutationFn: async (campaignData: {
      campaign_type: string;
      campaign_name: string;
      budget: number;
      start_date: string;
      end_date: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("pr_campaigns")
        .insert([{ ...campaignData, band_id: bandId }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pr-campaigns", bandId] });
      toast({
        title: "Campaign Created",
        description: "PR campaign has been launched successfully",
      });
    },
  });

  const respondToOffer = useMutation({
    mutationFn: async ({ offerId, accept }: { offerId: string; accept: boolean }) => {
      const { error } = await (supabase as any)
        .from("media_offers")
        .update({ status: accept ? "accepted" : "declined" })
        .eq("id", offerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-offers", bandId] });
      toast({
        title: "Response Recorded",
        description: "Your response to the media offer has been recorded",
      });
    },
  });

  return {
    campaigns,
    campaignsLoading,
    appearances,
    appearancesLoading,
    offers,
    offersLoading,
    createCampaign: createCampaign.mutate,
    respondToOffer: respondToOffer.mutate,
  };
};
