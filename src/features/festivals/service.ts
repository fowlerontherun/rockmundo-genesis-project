import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  FestivalEdition,
  FestivalEditionStatus,
  FestivalLegacyMapping,
  FestivalLegacySource,
} from "./types";

const selectAll = "*" as string;
const ownerEditionsTable = () => (supabase as any).from("festival_editions");
const publicEditionsTable = () => (supabase as any).from("public_festival_editions");
const mappingsTable = () => (supabase as any).from("festival_legacy_mappings");

export async function listFestivalEditionsForOwner(
  festivalId: string,
): Promise<FestivalEdition[]> {
  const { data, error } = await ownerEditionsTable()
    .select(selectAll)
    .eq("festival_id", festivalId)
    .order("edition_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FestivalEdition[];
}

export async function getFestivalEditionForOwner(
  editionId: string,
): Promise<FestivalEdition | null> {
  const { data, error } = await ownerEditionsTable()
    .select(selectAll)
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
  idempotencyKey?: string | null;
}): Promise<FestivalEdition> {
  const { data, error } = await (supabase as any).rpc("create_festival_edition", {
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
    p_idempotency_key: input.idempotencyKey ?? null,
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
  const { data, error } = await (supabase as any).rpc(
    "update_festival_edition_planning",
    {
      p_edition_id: editionId,
      p_patch: {
        ...(Object.prototype.hasOwnProperty.call(input, "title") ? { title: input.title } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "description") ? { description: input.description } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "startAt") ? { start_at: input.startAt } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "endAt") ? { end_at: input.endAt } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "cityId") ? { city_id: input.cityId } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "venueId") ? { venue_id: input.venueId } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "expectedAttendance") ? { expected_attendance: input.expectedAttendance } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "capacity") ? { capacity: input.capacity } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "minimumTicketPriceCents") ? { minimum_ticket_price_cents: input.minimumTicketPriceCents } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "maximumTicketPriceCents") ? { maximum_ticket_price_cents: input.maximumTicketPriceCents } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, "publicMetadata") ? { public_metadata: input.publicMetadata } : {}),
      },
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
  const { data, error } = await (supabase as any).rpc("transition_festival_edition", {
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
    .select(selectAll)
    .eq("legacy_source", legacySource)
    .eq("legacy_id", legacyId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FestivalLegacyMapping | null;
}


export const listFestivalEditions = listFestivalEditionsForOwner;
export const getFestivalEdition = getFestivalEditionForOwner;

export async function listPublicFestivalEditions(): Promise<FestivalEdition[]> {
  const { data, error } = await publicEditionsTable()
    .select(selectAll)
    .order("start_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FestivalEdition[];
}

export async function getPublicFestivalEdition(
  editionId: string,
): Promise<FestivalEdition | null> {
  const { data, error } = await publicEditionsTable()
    .select(selectAll)
    .eq("id", editionId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FestivalEdition | null;
}
