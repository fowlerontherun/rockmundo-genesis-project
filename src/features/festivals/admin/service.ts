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

export async function createFestivalEditionStage(input: import("./types").StageInput) {
  const { data, error } = await rpcClient.rpc("create_festival_edition_stage", {
    p_edition_id: input.editionId,
    p_name: input.name,
    p_type: input.type ?? "main",
    p_capacity: input.capacity ?? 0,
    p_genre_focus: input.genreFocus ?? null,
    p_stage_size: input.stageSize ?? null,
    p_sound_capability: input.soundCapability ?? null,
    p_lighting_capability: input.lightingCapability ?? null,
    p_backstage_capability: input.backstageCapability ?? null,
    p_weather_protection: input.weatherProtection ?? null,
    p_changeover_duration: input.changeoverDuration ?? 30,
    p_curfew: input.curfew ?? null,
    p_technical_metadata: input.technicalMetadata ?? {},
    p_public_metadata: input.publicMetadata ?? {},
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function generateFestivalStageSlots(input: import("./types").SlotGenerationInput) {
  const { data, error } = await rpcClient.rpc("generate_festival_stage_slots", {
    p_stage_id: input.stageId,
    p_date: input.date,
    p_opening_time: input.openingTime,
    p_curfew: input.curfew,
    p_slot_templates: input.templates,
    p_changeover_duration: input.changeoverDuration ?? 30,
    p_soundcheck_policy: input.soundcheckPolicy ?? {},
    p_idempotency_key: input.idempotencyKey,
    p_apply: input.apply ?? false,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function hireFestivalEditionStaff(input: import("./types").StaffHireInput) {
  const { data, error } = await rpcClient.rpc("hire_festival_edition_staff", {
    p_edition_id: input.editionId,
    p_candidate_id: input.candidateId,
    p_role: input.role,
    p_wage_cents: input.wageCents,
    p_assignment_scope: input.assignmentScope ?? {},
    p_shift_start_at: input.shiftStartAt ?? null,
    p_shift_end_at: input.shiftEndAt ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function applyForFestivalEditionPermit(editionId: string, requirementCode: string, idempotencyKey: string) {
  const { data, error } = await rpcClient.rpc("apply_for_festival_edition_permit", { p_edition_id: editionId, p_requirement_code: requirementCode, p_idempotency_key: idempotencyKey });
  if (error) throw new Error(error.message);
  return data;
}

export async function quoteFestivalEditionInsurance(editionId: string, provider = "RockMundo Mutual", coverageType = "standard") {
  const { data, error } = await rpcClient.rpc("quote_festival_edition_insurance", { p_edition_id: editionId, p_provider: provider, p_coverage_type: coverageType });
  if (error) throw new Error(error.message);
  return data;
}

export async function purchaseFestivalEditionInsurance(quoteId: string, idempotencyKey: string) {
  const { data, error } = await rpcClient.rpc("purchase_festival_edition_insurance", { p_quote_id: quoteId, p_idempotency_key: idempotencyKey });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchFestivalEditionFinanceSummary(editionId: string) {
  const { data, error } = await rpcClient.rpc("festival_edition_finance_summary", { p_edition_id: editionId });
  if (error) throw new Error(error.message);
  return data;
}

export async function previewCopyFestivalEdition(sourceEditionId: string, targetEditionId?: string | null) {
  const { data, error } = await rpcClient.rpc("preview_copy_festival_edition", { p_source_edition_id: sourceEditionId, p_target_edition_id: targetEditionId ?? null });
  if (error) throw new Error(error.message);
  return data;
}
