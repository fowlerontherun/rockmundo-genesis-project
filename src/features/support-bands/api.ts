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

export type GigSupportSlot = {
  id: string;
  gig_id: string;
  support_band_id: string;
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'completed';
  revenue_share: number;
  request_id?: string | null;
  response_note?: string | null;
  invited_at: string;
  responded_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TourSupportCandidate = {
  support_band_id: string;
  support_band_name: string;
  fame: number;
  popularity: number;
  eligible_shows: number;
  total_shows: number;
  full_tour_match: boolean;
};

export type TourSupportShowCandidate = {
  gig_id: string;
  scheduled_date: string;
  city_id: string;
  venue_id: string;
  support_band_id: string;
  support_band_name: string;
  fame: number;
  popularity: number;
  travel_feasible: boolean;
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

export async function findTourSupportCandidates(input: {
  headlinerBandId: string;
  tourId: string;
}): Promise<TourSupportCandidate[]> {
  const { data, error } = await (supabase as any).rpc('find_tour_support_candidates', {
    p_headliner_band_id: input.headlinerBandId,
    p_tour_id: input.tourId,
  });

  if (error) throw error;
  return (data ?? []) as TourSupportCandidate[];
}

export async function findTourSupportShowCandidates(input: {
  headlinerBandId: string;
  tourId: string;
}): Promise<TourSupportShowCandidate[]> {
  const { data, error } = await (supabase as any).rpc('find_tour_support_show_candidates', {
    p_headliner_band_id: input.headlinerBandId,
    p_tour_id: input.tourId,
  });

  if (error) throw error;
  return (data ?? []) as TourSupportShowCandidate[];
}

export async function createGigSupportOffer(input: {
  gigId: string;
  supportBandId: string;
  requestId?: string;
}): Promise<GigSupportSlot> {
  const { data, error } = await (supabase as any).rpc('create_gig_support_offer', {
    p_gig_id: input.gigId,
    p_support_band_id: input.supportBandId,
    p_request_id: input.requestId ?? crypto.randomUUID(),
  });

  if (error) throw error;
  return data as GigSupportSlot;
}

export async function respondToGigSupportOffer(input: {
  supportSlotId: string;
  action: 'accept' | 'decline';
  responseNote?: string | null;
}): Promise<GigSupportSlot> {
  const { data, error } = await (supabase as any).rpc('respond_to_gig_support_offer', {
    p_support_slot_id: input.supportSlotId,
    p_action: input.action,
    p_response_note: input.responseNote ?? null,
  });

  if (error) throw error;
  return data as GigSupportSlot;
}

export async function cancelGigSupportOffer(supportSlotId: string): Promise<GigSupportSlot> {
  const { data, error } = await (supabase as any).rpc('cancel_gig_support_offer', {
    p_support_slot_id: supportSlotId,
  });

  if (error) throw error;
  return data as GigSupportSlot;
}

export async function listGigSupportSlots(gigId: string): Promise<GigSupportSlot[]> {
  const { data, error } = await (supabase as any)
    .from('gig_support_slots')
    .select('*')
    .eq('gig_id', gigId)
    .order('invited_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GigSupportSlot[];
}

export async function listBandSupportOffers(bandId: string): Promise<GigSupportSlot[]> {
  const { data, error } = await (supabase as any)
    .from('gig_support_slots')
    .select('*')
    .eq('support_band_id', bandId)
    .order('invited_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GigSupportSlot[];
}
