import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RiderCatalogItem {
  id: string;
  category: 'technical' | 'hospitality' | 'backstage';
  subcategory: string;
  name: string;
  description: string | null;
  base_cost: number;
  performance_impact: number;
  morale_impact: number;
  priority: 'essential' | 'important' | 'nice_to_have' | 'optional';
  min_fame_required: number;
  is_premium: boolean;
  icon: string | null;
}

export interface BandRider {
  id: string;
  band_id: string;
  name: string;
  description: string | null;
  tier: 'basic' | 'standard' | 'professional' | 'star' | 'legendary';
  is_default: boolean;
  total_cost_estimate: number;
  created_at: string;
  updated_at: string;
}

export interface BandRiderItem {
  id: string;
  rider_id: string;
  catalog_item_id: string;
  quantity: number;
  priority: 'essential' | 'important' | 'nice_to_have' | 'optional';
  custom_notes: string | null;
  catalog_item?: RiderCatalogItem;
}

export interface VenueRiderCapability {
  id: string;
  venue_id: string;
  catalog_item_id: string;
  is_available: boolean;
  quality_level: number;
  cost_modifier: number;
  notes: string | null;
  catalog_item?: RiderCatalogItem;
}

export interface GigRiderFulfillment {
  id: string;
  gig_id: string;
  rider_id: string | null;
  fulfillment_percentage: number;
  technical_fulfillment: number;
  hospitality_fulfillment: number;
  backstage_fulfillment: number;
  performance_modifier: number;
  morale_modifier: number;
  total_rider_cost: number;
  negotiation_notes: string | null;
  items_fulfilled: any[];
  items_missing: any[];
  items_substituted: any[];
}

export const RIDER_TIERS = [
  { id: 'basic', name: 'Basic', description: 'Essentials only - water, basic sound', maxItems: 10, costMultiplier: 1.0 },
  { id: 'standard', name: 'Standard', description: 'Professional setup with comfort items', maxItems: 20, costMultiplier: 1.0 },
  { id: 'professional', name: 'Professional', description: 'Full production with catering', maxItems: 35, costMultiplier: 1.0 },
  { id: 'star', name: 'Star', description: 'Premium everything with personal touches', maxItems: 50, costMultiplier: 1.2 },
  { id: 'legendary', name: 'Legendary', description: 'No expense spared - the full experience', maxItems: 100, costMultiplier: 1.5 },
];

export function useBandRiders(bandId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rider catalog
  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['rider-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rider_item_catalog')
        .select('*')
        .order('category', { ascending: true })
        .order('subcategory', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as RiderCatalogItem[];
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  // Fetch band's riders
  const { data: riders, isLoading: ridersLoading } = useQuery({
    queryKey: ['band-riders', bandId],
    queryFn: async () => {
      if (!bandId) return [];
      
      const { data, error } = await supabase
        .from('band_riders')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BandRider[];
    },
    enabled: !!bandId,
  });

  // Fetch items for a specific rider
  const fetchRiderItems = async (riderId: string): Promise<BandRiderItem[]> => {
    const { data, error } = await supabase
      .from('band_rider_items')
      .select(`
        *,
        catalog_item:rider_item_catalog(*)
      `)
      .eq('rider_id', riderId);

    if (error) throw error;
    return data as BandRiderItem[];
  };

  // Create a new rider
  const createRider = useMutation({
    mutationFn: async (rider: Omit<BandRider, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('band_riders')
        .insert(rider)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['band-riders', bandId] });
      toast({ title: 'Rider created', description: 'Your new rider template has been saved.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to create rider.', variant: 'destructive' });
      console.error('Create rider error:', error);
    },
  });

  // Update a rider
  const updateRider = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BandRider> & { id: string }) => {
      const { data, error } = await supabase
        .from('band_riders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['band-riders', bandId] });
    },
  });

  // Delete a rider
  const deleteRider = useMutation({
    mutationFn: async (riderId: string) => {
      const { error } = await supabase
        .from('band_riders')
        .delete()
        .eq('id', riderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['band-riders', bandId] });
      toast({ title: 'Rider deleted' });
    },
  });

  // Add item to rider
  const addRiderItem = useMutation({
    mutationFn: async (item: Omit<BandRiderItem, 'id' | 'catalog_item'>) => {
      const { data, error } = await supabase
        .from('band_rider_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-items'] });
    },
  });

  // Update rider item
  const updateRiderItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BandRiderItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('band_rider_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-items'] });
    },
  });

  // Remove item from rider
  const removeRiderItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('band_rider_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider-items'] });
    },
  });

  // Set default rider
  const setDefaultRider = useMutation({
    mutationFn: async (riderId: string) => {
      // First, unset all defaults for this band
      await supabase
        .from('band_riders')
        .update({ is_default: false })
        .eq('band_id', bandId!);

      // Then set the new default
      const { error } = await supabase
        .from('band_riders')
        .update({ is_default: true })
        .eq('id', riderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['band-riders', bandId] });
      toast({ title: 'Default rider updated' });
    },
  });

  return {
    catalog,
    catalogLoading,
    riders,
    ridersLoading,
    fetchRiderItems,
    createRider,
    updateRider,
    deleteRider,
    addRiderItem,
    updateRiderItem,
    removeRiderItem,
    setDefaultRider,
    isLoading: catalogLoading || ridersLoading,
  };
}

// Hook for checking venue compatibility with a rider
export function useVenueRiderCompatibility(venueId: string | null, riderId: string | null) {
  return useQuery({
    queryKey: ['venue-rider-compatibility', venueId, riderId],
    queryFn: async () => {
      if (!venueId || !riderId) return null;

      // Get rider items
      const { data: riderItems, error: riderError } = await supabase
        .from('band_rider_items')
        .select(`
          *,
          catalog_item:rider_item_catalog(*)
        `)
        .eq('rider_id', riderId);

      if (riderError) throw riderError;

      // Get venue capabilities
      const { data: venueCapabilities, error: venueError } = await supabase
        .from('venue_rider_capabilities')
        .select(`
          *,
          catalog_item:rider_item_catalog(*)
        `)
        .eq('venue_id', venueId);

      if (venueError) throw venueError;

      const capabilityMap = new Map(
        (venueCapabilities || []).map(cap => [cap.catalog_item_id, cap])
      );

      let fulfilled: any[] = [];
      let missing: any[] = [];
      let partial: any[] = [];
      let totalCost = 0;
      let technicalScore = 0;
      let hospitalityScore = 0;
      let backstageScore = 0;
      let technicalTotal = 0;
      let hospitalityTotal = 0;
      let backstageTotal = 0;

      for (const item of (riderItems || [])) {
        const capability = capabilityMap.get(item.catalog_item_id);
        const catalogItem = item.catalog_item as RiderCatalogItem;
        const itemCost = catalogItem.base_cost * item.quantity * (capability?.cost_modifier || 1);

        const weight = item.priority === 'essential' ? 3 : 
                      item.priority === 'important' ? 2 : 
                      item.priority === 'nice_to_have' ? 1 : 0.5;

        if (catalogItem.category === 'technical') {
          technicalTotal += weight;
        } else if (catalogItem.category === 'hospitality') {
          hospitalityTotal += weight;
        } else {
          backstageTotal += weight;
        }

        if (capability?.is_available) {
          fulfilled.push({ ...item, capability, cost: itemCost });
          totalCost += itemCost;

          const qualityFactor = (capability.quality_level || 50) / 100;
          if (catalogItem.category === 'technical') {
            technicalScore += weight * qualityFactor;
          } else if (catalogItem.category === 'hospitality') {
            hospitalityScore += weight * qualityFactor;
          } else {
            backstageScore += weight * qualityFactor;
          }
        } else if (capability && !capability.is_available) {
          partial.push({ ...item, reason: 'Not available at this venue' });
        } else {
          missing.push({ ...item, reason: 'Venue does not provide this item' });
        }
      }

      const technicalPct = technicalTotal > 0 ? Math.round((technicalScore / technicalTotal) * 100) : 100;
      const hospitalityPct = hospitalityTotal > 0 ? Math.round((hospitalityScore / hospitalityTotal) * 100) : 100;
      const backstagePct = backstageTotal > 0 ? Math.round((backstageScore / backstageTotal) * 100) : 100;
      const overallPct = Math.round((technicalPct + hospitalityPct + backstagePct) / 3);

      // Calculate performance modifier based on fulfillment
      const performanceModifier = 0.8 + (overallPct / 100) * 0.4; // Range: 0.8 - 1.2
      const moraleModifier = 0.7 + (hospitalityPct / 100) * 0.6; // Range: 0.7 - 1.3

      return {
        fulfilled,
        missing,
        partial,
        totalCost,
        fulfillmentPercentage: overallPct,
        technicalFulfillment: technicalPct,
        hospitalityFulfillment: hospitalityPct,
        backstageFulfillment: backstagePct,
        performanceModifier,
        moraleModifier,
      };
    },
    enabled: !!venueId && !!riderId,
  });
}

// Hook for getting grouped catalog items
export function useGroupedRiderCatalog() {
  const { data: catalog } = useQuery({
    queryKey: ['rider-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rider_item_catalog')
        .select('*')
        .order('category', { ascending: true })
        .order('subcategory', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as RiderCatalogItem[];
    },
    staleTime: 1000 * 60 * 30,
  });

  const grouped = catalog?.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {};
    }
    if (!acc[item.category][item.subcategory]) {
      acc[item.category][item.subcategory] = [];
    }
    acc[item.category][item.subcategory].push(item);
    return acc;
  }, {} as Record<string, Record<string, RiderCatalogItem[]>>);

  return { catalog, grouped };
}
