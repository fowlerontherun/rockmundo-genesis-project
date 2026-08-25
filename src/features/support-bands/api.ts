import { supabase } from '@/integrations/supabase/client';

export type SupportPreferences = {
  band_id: string;
  enabled: boolean;
  single_gigs_enabled: boolean;
  tour_enabled: boolean;
  travel_enabled: boolean;
  max_travel_minutes: number | null;
  minimum_headliner_fame: number;
  minimum_venue_capacity: number;
  preferred_genres: string[];
  created_at?: string;
  updated_at?: string;
};

export type SupportAvailability = {
  id: string;
  band_id: string;
  city_id: string;
  available_from: string;
  available_until: string;
  status: 'active' | 'temporarily_unavailable' | 'expired' | 'disabled';
  created_at?: string;
  updated_at?: string;
};

export type AvailableSupportBand = {
  band_id: string;
  band_name: string;
  fame: number;
  popularity: number;
  availability_id: string;
  available_from: string;
  available_until: string;
};

export async function getSupportPreferences(bandId: string): Promise<SupportPreferences | null> {
  const { data, error } = await (supabase as any)
    .from('band_support_preferences')
    .select('*')
    .eq('band_id', bandId)
    .maybeSingle();

  if (error) throw error;
  return data as SupportPreferences | null;
}

export async function saveSupportPreferences(
  bandId: string,
  input: Omit<SupportPreferences, 'band_id' | 'created_at' | 'updated_at'>,
): Promise<SupportPreferences> {
  const { data, error } = await (supabase as any).rpc('set_band_support_preferences', {
    p_band_id: bandId,
    p_enabled: input.enabled,
    p_single_gigs_enabled: input.single_gigs_enabled,
    p_tour_enabled: input.tour_enabled,
    p_travel_enabled: input.travel_enabled,
    p_max_travel_minutes: input.max_travel_minutes,
    p_minimum_headliner_fame: input.minimum_headliner_fame,
    p_minimum_venue_capacity: input.minimum_venue_capacity,
    p_preferred_genres: input.preferred_genres,
  });

  if (error) throw error;
  return data as SupportPreferences;
}

export async function listSupportAvailability(bandId: string): Promise<SupportAvailability[]> {
  const { data, error } = await (supabase as any)
    .from('band_support_availability')
    .select('*')
    .eq('band_id', bandId)
    .order('available_from', { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupportAvailability[];
}

export async function addSupportAvailability(input: {
  bandId: string;
  cityId: string;
  availableFrom: string;
  availableUntil: string;
}): Promise<SupportAvailability> {
  const { data, error } = await (supabase as any).rpc('add_band_support_availability', {
    p_band_id: input.bandId,
    p_city_id: input.cityId,
    p_available_from: input.availableFrom,
    p_available_until: input.availableUntil,
  });

  if (error) throw error;
  return data as SupportAvailability;
}

export async function setSupportAvailabilityStatus(
  availabilityId: string,
  status: SupportAvailability['status'],
): Promise<void> {
  const { error } = await (supabase as any)
    .from('band_support_availability')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', availabilityId);

  if (error) throw error;
}

export async function removeSupportAvailability(availabilityId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('band_support_availability')
    .delete()
    .eq('id', availabilityId);

  if (error) throw error;
}

export async function findAvailableSupportBands(input: {
  headlinerBandId: string;
  cityId: string;
  start: string;
  end: string;
  forTour?: boolean;
  venueCapacity?: number;
}): Promise<AvailableSupportBand[]> {
  const { data, error } = await (supabase as any).rpc('find_available_support_bands', {
    p_headliner_band_id: input.headlinerBandId,
    p_city_id: input.cityId,
    p_start: input.start,
    p_end: input.end,
    p_for_tour: input.forTour ?? false,
    p_venue_capacity: input.venueCapacity ?? 0,
  });

  if (error) throw error;
  return (data ?? []) as AvailableSupportBand[];
}
