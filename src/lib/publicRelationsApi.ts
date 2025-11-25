import { supabase } from "@/integrations/supabase/client";

export type CampaignPayload = {
  campaign_type: string;
  campaign_name: string;
  budget: number;
  start_date: string;
  end_date: string;
};

export type PublicRelationsClient = typeof supabase;

const createError = (message: string) => new Error(message);

export const createPublicRelationsApi = (client: PublicRelationsClient = supabase) => {
  const fetchCampaigns = async (bandId: string) => {
    const { data, error } = await client
      .from("pr_campaigns")
      .select("*")
      .eq("band_id", bandId)
      .order("created_at", { ascending: false });

    if (error) throw createError(error.message);
    return data ?? [];
  };

  const fetchMediaAppearances = async (bandId: string) => {
    const { data, error } = await client
      .from("media_appearances")
      .select("*")
      .eq("band_id", bandId)
      .order("air_date", { ascending: false });

    if (error) throw createError(error.message);
    return data ?? [];
  };

  const fetchMediaOffers = async (bandId: string) => {
    const { data, error } = await client
      .from("media_offers")
      .select("*")
      .eq("band_id", bandId)
      .order("created_at", { ascending: false });

    if (error) throw createError(error.message);
    return data ?? [];
  };

  const createCampaign = async (bandId: string, payload: CampaignPayload) => {
    const { data, error } = await client
      .from("pr_campaigns")
      .insert([{ ...payload, band_id: bandId }])
      .select()
      .single();

    if (error) throw createError(error.message);
    return data;
  };

  const respondToOffer = async (offerId: string, accept: boolean) => {
    const { error } = await client
      .from("media_offers")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", offerId);

    if (error) throw createError(error.message);
    return { offerId, status: accept ? "accepted" : "declined" } as const;
  };

  return {
    fetchCampaigns,
    fetchMediaAppearances,
    fetchMediaOffers,
    createCampaign,
    respondToOffer,
  };
};

export const publicRelationsApi = createPublicRelationsApi();
