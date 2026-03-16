import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface FanCampaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  target_audience: string | null;
  budget: number;
  start_date: string;
  end_date: string;
  status: string;
  reach: number;
  engagement_rate: number;
  new_fans: number;
  cost_per_fan: number | null;
}

export interface FanSegment {
  id: string;
  segment_name: string;
  segment_criteria: any;
  fan_count: number;
  avg_engagement: number;
}

export interface FanInteraction {
  id: string;
  interaction_type: string;
  interaction_data: any;
  sentiment: string | null;
  created_at: string;
}

export const useFanManagement = (profileId?: string) => {
  const { userId } = useActiveProfile();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["fan-campaigns", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("fan_campaigns")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FanCampaign[];
    },
    enabled: !!profileId,
  });

  // Fetch segments
  const { data: segments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: ["fan-segments", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("fan_segments")
        .select("*")
        .eq("user_id", profileId)
        .order("fan_count", { ascending: false });

      if (error) throw error;
      return data as FanSegment[];
    },
    enabled: !!profileId,
  });

  // Fetch interactions
  const { data: interactions = [], isLoading: interactionsLoading } = useQuery({
    queryKey: ["fan-interactions", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("fan_interactions")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as FanInteraction[];
    },
    enabled: !!profileId,
  });

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async (campaign: Partial<FanCampaign>) => {
      if (!profileId) throw new Error("User not authenticated");

      const { data, error } = await (supabase as any)
        .from("fan_campaigns")
        .insert({ ...campaign, user_id: profileId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fan-campaigns", profileId] });
      toast.success("Campaign created successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to create campaign", { description: error.message });
    },
  });

  // Create segment
  const createSegment = useMutation({
    mutationFn: async (segment: Partial<FanSegment>) => {
      if (!profileId) throw new Error("User not authenticated");

      const { data, error } = await (supabase as any)
        .from("fan_segments")
        .insert({ ...segment, user_id: profileId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fan-segments", profileId] });
      toast.success("Segment created successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to create segment", { description: error.message });
    },
  });

  return {
    campaigns,
    segments,
    interactions,
    isLoading: campaignsLoading || segmentsLoading || interactionsLoading,
    createCampaign: createCampaign.mutate,
    createSegment: createSegment.mutate,
    isCreatingCampaign: createCampaign.isPending,
    isCreatingSegment: createSegment.isPending,
  };
};
