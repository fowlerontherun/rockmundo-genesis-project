import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicRelationsApi } from "@/lib/publicRelationsApi";
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

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["pr-campaigns", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      return publicRelationsApi.fetchCampaigns(bandId);
    },
    enabled: !!bandId,
  });

  const { data: appearances = [], isLoading: appearancesLoading } = useQuery({
    queryKey: ["media-appearances", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      return publicRelationsApi.fetchMediaAppearances(bandId);
    },
    enabled: !!bandId,
  });

  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["media-offers", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      return publicRelationsApi.fetchMediaOffers(bandId) as Promise<any[]>;
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
      return publicRelationsApi.createCampaign(bandId!, campaignData);
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
      return publicRelationsApi.respondToOffer(offerId, accept);
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
