import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  FestivalEdition,
  FestivalEditionStatus,
  FestivalLegacyMapping,
  FestivalLegacySource,
} from "./types";

const editionsTable = () => supabase.from("festival_editions");
const mappingsTable = () => supabase.from("festival_legacy_mappings");

export async function listFestivalEditions(
  festivalId: string,
): Promise<FestivalEdition[]> {
  const { data, error } = await editionsTable()
    .select("*")
    .eq("festival_id", festivalId)
    .order("edition_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FestivalEdition[];
}

export async function getFestivalEdition(
  editionId: string,
): Promise<FestivalEdition | null> {
  const { data, error } = await editionsTable()
    .select("*")
    .eq("id", editionId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FestivalEdition | null;
}

export async function createFestivalEdition(input: {
  festivalId: string;
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  cityId?: string | null;
  venueId?: string | null;
  expectedAttendance?: number | null;
  capacity?: number | null;
  minimumTicketPriceCents?: number | null;
  maximumTicketPriceCents?: number | null;
  publicMetadata?: Json;
}): Promise<FestivalEdition> {
  const { data, error } = await supabase.rpc("create_festival_edition", {
    p_festival_id: input.festivalId,
    p_title: input.title ?? null,
    p_start_at: input.startAt ?? null,
    p_end_at: input.endAt ?? null,
    p_city_id: input.cityId ?? null,
    p_venue_id: input.venueId ?? null,
    p_expected_attendance: input.expectedAttendance ?? null,
    p_capacity: input.capacity ?? null,
    p_minimum_ticket_price_cents: input.minimumTicketPriceCents ?? null,
    p_maximum_ticket_price_cents: input.maximumTicketPriceCents ?? null,
    p_public_metadata: input.publicMetadata ?? {},
  });
  if (error) throw error;
  return data as unknown as FestivalEdition;
}

export async function updateFestivalEditionPlanning(
  editionId: string,
  input: Partial<{
    title: string | null;
    description: string | null;
    startAt: string | null;
    endAt: string | null;
    cityId: string | null;
    venueId: string | null;
    expectedAttendance: number | null;
    capacity: number | null;
    minimumTicketPriceCents: number | null;
    maximumTicketPriceCents: number | null;
    publicMetadata: Json;
  }>,
): Promise<FestivalEdition> {
  const { data, error } = await supabase.rpc(
    "update_festival_edition_planning",
    {
      p_edition_id: editionId,
      p_title: input.title ?? null,
      p_description: input.description ?? null,
      p_start_at: input.startAt ?? null,
      p_end_at: input.endAt ?? null,
      p_city_id: input.cityId ?? null,
      p_venue_id: input.venueId ?? null,
      p_expected_attendance: input.expectedAttendance ?? null,
      p_capacity: input.capacity ?? null,
      p_minimum_ticket_price_cents: input.minimumTicketPriceCents ?? null,
      p_maximum_ticket_price_cents: input.maximumTicketPriceCents ?? null,
      p_public_metadata: input.publicMetadata ?? null,
    },
  );
  if (error) throw error;
  return data as unknown as FestivalEdition;
}

export async function transitionFestivalEdition(input: {
  editionId: string;
  targetStatus: FestivalEditionStatus;
  reason?: string | null;
  metadata?: Json;
  idempotencyKey?: string | null;
}): Promise<FestivalEdition> {
  const { data, error } = await supabase.rpc("transition_festival_edition", {
    p_edition_id: input.editionId,
    p_target_status: input.targetStatus,
    p_reason: input.reason ?? null,
    p_metadata: input.metadata ?? {},
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) throw error;
  return data as unknown as FestivalEdition;
}

export async function resolveEditionFromLegacyIdentifier(
  legacySource: FestivalLegacySource,
  legacyId: string,
): Promise<FestivalLegacyMapping | null> {
  const { data, error } = await mappingsTable()
    .select("*")
    .eq("legacy_source", legacySource)
    .eq("legacy_id", legacyId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FestivalLegacyMapping | null;
}
