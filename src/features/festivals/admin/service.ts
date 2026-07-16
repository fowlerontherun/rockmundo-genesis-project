import { supabase } from "@/integrations/supabase/client";
import { mapCatalogueRow, mapOwnerEdition } from "./mappers";
import type { AdminBrandInput, AdminEditionInput, AdminFestivalCatalogueRow, FestivalLifecycleState, OwnerEditionOption } from "./types";

type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const rpcClient = supabase as unknown as RpcClient;

export async function fetchAdminFestivalCatalogue(): Promise<AdminFestivalCatalogueRow[]> {
  const { data, error } = await rpcClient.rpc("admin_festival_catalogue");
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[] | null) ?? []).map(mapCatalogueRow);
}

export async function createAdminFestivalBrand(input: AdminBrandInput) {
  const { data, error } = await rpcClient.rpc("admin_create_festival_brand", {
    p_name: input.name,
    p_home_city_id: input.homeCityId ?? null,
    p_description: input.description ?? null,
    p_genre_identity: input.genre ?? null,
    p_scale: input.scale ?? null,
    p_brand_type: input.brandType ?? "recurring",
    p_recurring_policy: input.recurringPolicy ?? "annual",
    p_owner_profile_id: input.ownerProfileId ?? null,
    p_public_metadata: input.publicMetadata ?? {},
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function createAdminFestivalEdition(input: AdminEditionInput) {
  const { data, error } = await rpcClient.rpc("create_festival_edition", {
    p_festival_id: input.festivalId,
    p_title: input.title,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_city_id: input.cityId ?? null,
    p_venue_id: null,
    p_expected_attendance: input.expectedAttendance ?? null,
    p_capacity: input.capacity ?? null,
    p_minimum_ticket_price_cents: input.minimumTicketPriceCents ?? null,
    p_maximum_ticket_price_cents: input.maximumTicketPriceCents ?? null,
    p_public_metadata: {},
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function transitionAdminFestivalEdition(editionId: string, targetStatus: FestivalLifecycleState, reason: string, override = false) {
  const { data, error } = await rpcClient.rpc("admin_transition_festival_edition", {
    p_edition_id: editionId,
    p_target_status: targetStatus,
    p_reason: reason,
    p_override: override,
    p_metadata: { source: "admin_festival_workspace" },
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchOwnerFestivalEditions(festivalId: string): Promise<OwnerEditionOption[]> {
  const { data, error } = await rpcClient.rpc("festival_owner_edition_options", { p_festival_id: festivalId });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[] | null) ?? []).map(mapOwnerEdition);
}
