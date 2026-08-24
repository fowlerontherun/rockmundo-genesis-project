import { supabase } from "@/integrations/supabase/client";

export type FestivalArtistScheduleQueue = {
  editionId: string;
  bookings: Array<{
    id: string;
    artistType: string;
    bandId: string | null;
    bandName: string | null;
    status: string;
    setMinutes: number;
    billingPosition: string;
    agreedFeeMinor: number;
    currencyCode: string;
    preferredDate: string | null;
    preferredStageId: string | null;
    supported: boolean;
    unsupportedReason: string | null;
  }>;
  slots: Array<{
    id: string;
    stageId: string;
    stageName: string;
    dayNumber: number;
    slotNumber: number;
    slotType: string;
    startAt: string;
    endAt: string;
  }>;
};

export type FestivalEditionAuditEvent = {
  id: string;
  actor_profile_id?: string | null;
  actor_name?: string | null;
  authority?: string | null;
  operation?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  reason?: string | null;
  before_snapshot?: unknown;
  after_snapshot?: unknown;
  created_at?: string | null;
};

export async function fetchFestivalArtistScheduleQueue(editionId: string): Promise<FestivalArtistScheduleQueue> {
  const { data, error } = await (supabase as any).rpc("get_festival_artist_booking_schedule_queue", { p_edition_id: editionId });
  if (error) throw error;
  return {
    editionId: String(data?.editionId ?? editionId),
    bookings: Array.isArray(data?.bookings) ? data.bookings : [],
    slots: Array.isArray(data?.slots) ? data.slots : [],
  };
}

export async function finaliseFestivalArtistBookingSlot(input: { bookingId: string; stageSlotId: string; idempotencyKey: string }) {
  const { data, error } = await (supabase as any).rpc("finalise_festival_artist_booking_slot", {
    p_artist_booking_id: input.bookingId,
    p_stage_slot_id: input.stageSlotId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data as { bookingId: string; contractId: string; stageSlotId: string; replayed: boolean };
}

export async function fetchFestivalEditionAuditLog(editionId: string): Promise<FestivalEditionAuditEvent[]> {
  const { data, error } = await (supabase as any).rpc("get_festival_edition_audit_log", { p_edition_id: editionId, p_limit: 200 });
  if (error) throw error;
  return Array.isArray(data?.events) ? data.events : [];
}
