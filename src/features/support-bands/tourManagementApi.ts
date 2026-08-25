import { supabase } from '@/integrations/supabase/client';
import type { GigSupportSlot } from './api';

export type TourSupportAssignment = {
  gig_id: string;
  scheduled_date: string;
  scheduled_end: string | null;
  venue_id: string;
  venue_name: string;
  city_id: string | null;
  city_name: string | null;
  support_slot_id: string | null;
  support_band_id: string | null;
  support_band_name: string | null;
  support_status: 'pending' | 'accepted' | 'completed' | 'cancelled' | null;
  revenue_share: number | null;
  invited_at: string | null;
  responded_at: string | null;
};

export async function getTourSupportAssignments(input: {
  headlinerBandId: string;
  tourId: string;
}): Promise<TourSupportAssignment[]> {
  const { data, error } = await (supabase as any).rpc('get_tour_support_assignments', {
    p_headliner_band_id: input.headlinerBandId,
    p_tour_id: input.tourId,
  });
  if (error) throw error;
  return (data ?? []) as TourSupportAssignment[];
}

export async function cancelConfirmedSupportSlot(input: {
  supportSlotId: string;
  reason?: string | null;
}): Promise<GigSupportSlot> {
  const { data, error } = await (supabase as any).rpc('cancel_confirmed_support_slot', {
    p_support_slot_id: input.supportSlotId,
    p_reason: input.reason ?? null,
  });
  if (error) throw error;
  return data as GigSupportSlot;
}
