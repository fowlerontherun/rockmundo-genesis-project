import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BrandPartner {
  id: string;
  name: string;
  logo_url: string | null;
  brand_tier: 'indie' | 'mainstream' | 'premium' | 'luxury';
  description: string | null;
  min_fame_required: number;
  min_fans_required: number;
  base_upfront_payment: number;
  royalty_percentage: number;
  quality_boost: string;
  sales_boost_pct: number;
  product_types: string[];
  is_active: boolean;
}

export interface CollaborationOffer {
  id: string;
  band_id: string;
  brand_id: string;
  product_type: string;
  upfront_payment: number;
  royalty_per_sale: number;
  limited_quantity: number | null;
  offer_message: string | null;
  expires_at: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  brand?: BrandPartner;
}

export interface ActiveCollaboration {
  id: string;
  brand_id: string;
  band_id: string;
  merchandise_id: string | null;
  product_type: string;
  quality_tier: string;
  sales_boost_pct: number;
  total_units_sold: number;
  total_royalties_earned: number;
  is_active: boolean;
  started_at: string;
  brand?: BrandPartner;
}

export const BRAND_TIER_COLORS: Record<string, string> = {
  indie: 'text-green-500',
  mainstream: 'text-blue-500',
  premium: 'text-purple-500',
  luxury: 'text-yellow-500',
};

export const BRAND_TIER_LABELS: Record<string, string> = {
  indie: 'Indie',
  mainstream: 'Mainstream',
  premium: 'Premium',
  luxury: 'Luxury',
};

export const useBrandPartners = () => {
  return useQuery({
    queryKey: ['merch-brand-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merch_brand_partners')
        .select('*')
        .eq('is_active', true)
        .order('min_fame_required', { ascending: true });

      if (error) throw error;
      return data as BrandPartner[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCollaborationOffers = (bandId: string | null) => {
  return useQuery({
    queryKey: ['merch-collaboration-offers', bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from('merch_collaboration_offers')
        .select(`
          *,
          brand:merch_brand_partners(*)
        `)
        .eq('band_id', bandId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CollaborationOffer[];
    },
    enabled: !!bandId,
  });
};

export const useActiveCollaborations = (bandId: string | null) => {
  return useQuery({
    queryKey: ['merch-active-collaborations', bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from('merch_collaborations')
        .select(`
          *,
          brand:merch_brand_partners(*)
        `)
        .eq('band_id', bandId)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data as ActiveCollaboration[];
    },
    enabled: !!bandId,
  });
};

export const useRespondToOffer = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      offerId, 
      bandId,
      accept, 
      brand,
      productType,
      qualityTier,
      salesBoost
    }: { 
      offerId: string; 
      bandId: string;
      accept: boolean;
      brand?: BrandPartner;
      productType?: string;
      qualityTier?: string;
      salesBoost?: number;
    }) => {
      // Update offer status
      const { error: offerError } = await supabase
        .from('merch_collaboration_offers')
        .update({ 
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (offerError) throw offerError;

      // If accepted, create active collaboration
      if (accept && brand) {
        const { error: collabError } = await supabase
          .from('merch_collaborations')
          .insert({
            offer_id: offerId,
            brand_id: brand.id,
            band_id: bandId,
            product_type: productType || 'tshirt',
            quality_tier: qualityTier || brand.quality_boost,
            sales_boost_pct: salesBoost || brand.sales_boost_pct,
          });

        if (collabError) throw collabError;
      }

      return { accept };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['merch-collaboration-offers'] });
      queryClient.invalidateQueries({ queryKey: ['merch-active-collaborations'] });
      
      toast({
        title: result.accept ? "Collaboration Accepted!" : "Offer Declined",
        description: result.accept 
          ? "You can now create co-branded merchandise with this partner."
          : "The offer has been declined.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to respond",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
