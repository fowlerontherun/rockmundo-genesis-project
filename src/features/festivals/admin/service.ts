import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { mapCatalogueRow, mapOwnerEdition } from "./mappers";
import type { AdminBrandInput, AdminEditionInput, AdminFestivalCatalogueRow, FestivalLifecycleState, OwnerEditionOption } from "./types";

type RpcName = keyof import("@/integrations/supabase/types").Database["public"]["Functions"];

type DomainErrorCode =
  | "FESTIVAL_RPC_FAILED"
  | "FESTIVAL_RESPONSE_INVALID"
  | "FESTIVAL_PERMISSION_DENIED"
  | "FESTIVAL_EDITION_NOT_FOUND"
  | "FESTIVAL_MIGRATION_REQUIRED";

export class FestivalAdminServiceError extends Error {
  constructor(message: string, public readonly code: DomainErrorCode, public readonly cause?: unknown) { super(`${code}: ${message}`); this.name = "FestivalAdminServiceError"; }
}

const rpc = async <T>(fn: RpcName, args?: Record<string, unknown>, schema?: z.ZodType<T>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw mapFestivalError(error);
  if (!schema) return data as T;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new FestivalAdminServiceError("The festival server returned a malformed response.", "FESTIVAL_RESPONSE_INVALID", parsed.error);
  return parsed.data;
};

export function mapFestivalError(error: { message?: string; code?: string; details?: string; hint?: string }) {
  const message = error.message ?? "Festival operation failed.";
  if (/permission|not authorised|not authorized|rls/i.test(message)) return new FestivalAdminServiceError("You do not have permission to perform this festival operation.", "FESTIVAL_PERMISSION_DENIED", error);
  if (/not found|missing/i.test(message)) return new FestivalAdminServiceError("This festival edition could not be loaded.", "FESTIVAL_EDITION_NOT_FOUND", error);
  if (/legacy|migration|hybrid|currency|mixed/i.test(message)) return new FestivalAdminServiceError("This festival record needs admin migration or data repair before it can be managed.", "FESTIVAL_MIGRATION_REQUIRED", error);
  return new FestivalAdminServiceError(message, "FESTIVAL_RPC_FAILED", error);
}

const nullableString = z.string().nullable();
const catalogueRowSchema = z.object({ festival_id: z.string(), brand_name: z.string().nullable().optional(), owner_name: nullableString.optional(), city_name: nullableString.optional(), current_edition_id: nullableString.optional(), current_edition_title: nullableString.optional(), next_edition_id: nullableString.optional(), completed_edition_id: nullableString.optional(), edition_count: z.coerce.number().optional(), lifecycle_state: z.string().nullable().optional(), stage_count: z.coerce.number().optional(), active_contract_count: z.coerce.number().optional(), performance_session_count: z.coerce.number().optional(), outcome_count: z.coerce.number().optional(), attendance: z.coerce.number().nullable().optional(), currency_code: z.string().nullable().optional(), projected_finance_cents: z.coerce.number().nullable().optional(), actual_finance_cents: z.coerce.number().nullable().optional(), legacy_mappings: z.coerce.number().optional(), operational_readiness: z.string().nullable().optional(), data_health_warnings: z.unknown().optional() }).passthrough();
const ownerEditionSchema = z.object({ id: z.string(), festival_id: z.string(), title: z.string().nullable().optional(), edition_number: z.coerce.number(), status: z.string(), start_at: nullableString.optional(), end_at: nullableString.optional(), city_name: nullableString.optional(), currency_code: z.string().nullable().optional() }).passthrough();
const jsonRecord = z.record(z.unknown());
const nonNullJson = z.unknown().refine((value) => value !== null && value !== undefined, "RPC returned no result");

export async function fetchAdminFestivalCatalogue(): Promise<AdminFestivalCatalogueRow[]> {
  const data = await rpc("admin_festival_catalogue" as RpcName, undefined, z.array(catalogueRowSchema));
  return data.map(mapCatalogueRow);
}

export async function createAdminFestivalBrand(input: AdminBrandInput) {
  return rpc("admin_create_festival_brand" as RpcName, { p_name: input.name, p_home_city_id: input.homeCityId ?? null, p_description: input.description ?? null, p_genre_identity: input.genre ?? null, p_scale: input.scale ?? null, p_brand_type: input.brandType ?? "recurring", p_recurring_policy: input.recurringPolicy ?? "annual", p_owner_profile_id: input.ownerProfileId ?? null, p_public_metadata: input.publicMetadata ?? {}, p_idempotency_key: input.idempotencyKey }, nonNullJson);
}

export async function createAdminFestivalEdition(input: AdminEditionInput) {
  return rpc("create_festival_edition" as RpcName, { p_festival_id: input.festivalId, p_title: input.title, p_start_at: input.startAt, p_end_at: input.endAt, p_city_id: input.cityId ?? null, p_venue_id: null, p_expected_attendance: input.expectedAttendance ?? null, p_capacity: input.capacity ?? null, p_minimum_ticket_price_cents: input.minimumTicketPriceCents ?? null, p_maximum_ticket_price_cents: input.maximumTicketPriceCents ?? null, p_public_metadata: {}, p_idempotency_key: input.idempotencyKey }, nonNullJson);
}

export async function transitionAdminFestivalEdition(editionId: string, targetStatus: FestivalLifecycleState, reason: string, override = false) {
  return rpc("admin_transition_festival_edition" as RpcName, { p_edition_id: editionId, p_target_status: targetStatus, p_reason: reason, p_override: override, p_metadata: { source: "admin_festival_workspace" }, p_idempotency_key: crypto.randomUUID() }, nonNullJson);
}

export async function fetchOwnerFestivalEditions(festivalId: string): Promise<OwnerEditionOption[]> {
  const data = await rpc("festival_owner_edition_options" as RpcName, { p_festival_id: festivalId }, z.array(ownerEditionSchema));
  return data.map(mapOwnerEdition);
}

export async function createFestivalEditionStage(input: import("./types").StageInput) { return rpc("create_festival_edition_stage" as RpcName, { p_edition_id: input.editionId, p_name: input.name, p_type: input.type ?? "main", p_capacity: input.capacity ?? 0, p_genre_focus: input.genreFocus ?? null, p_stage_size: input.stageSize ?? null, p_sound_capability: input.soundCapability ?? null, p_lighting_capability: input.lightingCapability ?? null, p_backstage_capability: input.backstageCapability ?? null, p_weather_protection: input.weatherProtection ?? null, p_changeover_duration: input.changeoverDuration ?? 30, p_curfew: input.curfew ?? null, p_technical_metadata: input.technicalMetadata ?? {}, p_public_metadata: input.publicMetadata ?? {}, p_idempotency_key: input.idempotencyKey }, nonNullJson); }
export async function generateFestivalStageSlots(input: import("./types").SlotGenerationInput) { return rpc("generate_festival_stage_slots" as RpcName, { p_stage_id: input.stageId, p_date: input.date, p_opening_time: input.openingTime, p_curfew: input.curfew, p_slot_templates: input.templates, p_changeover_duration: input.changeoverDuration ?? 30, p_soundcheck_policy: input.soundcheckPolicy ?? {}, p_idempotency_key: input.idempotencyKey, p_apply: input.apply ?? false }, jsonRecord); }
export async function hireFestivalEditionStaff(input: import("./types").StaffHireInput) { return rpc("hire_festival_edition_staff" as RpcName, { p_edition_id: input.editionId, p_candidate_id: input.candidateId, p_role: input.role, p_wage_cents: input.wageCents, p_assignment_scope: input.assignmentScope ?? {}, p_shift_start_at: input.shiftStartAt ?? null, p_shift_end_at: input.shiftEndAt ?? null, p_idempotency_key: input.idempotencyKey }, nonNullJson); }
export async function applyForFestivalEditionPermit(editionId: string, requirementCode: string, idempotencyKey: string) { return rpc("apply_for_festival_edition_permit" as RpcName, { p_edition_id: editionId, p_requirement_code: requirementCode, p_idempotency_key: idempotencyKey }, nonNullJson); }
export async function quoteFestivalEditionInsurance(editionId: string, provider = "RockMundo Mutual", coverageType = "standard") { return rpc("quote_festival_edition_insurance" as RpcName, { p_edition_id: editionId, p_provider: provider, p_coverage_type: coverageType }, jsonRecord); }
export async function purchaseFestivalEditionInsurance(quoteId: string, idempotencyKey: string) { return rpc("purchase_festival_edition_insurance" as RpcName, { p_quote_id: quoteId, p_idempotency_key: idempotencyKey }, nonNullJson); }
export async function fetchFestivalEditionFinanceSummary(editionId: string) { return rpc("festival_edition_finance_summary" as RpcName, { p_edition_id: editionId }, jsonRecord); }
export async function previewCopyFestivalEdition(sourceEditionId: string, targetEditionId?: string | null) { return rpc("preview_copy_festival_edition" as RpcName, { p_source_edition_id: sourceEditionId, p_target_edition_id: targetEditionId ?? null }, jsonRecord); }

const callMaybeRpc = async <T>(fn: string, args?: Record<string, unknown>, fallback?: () => Promise<T>): Promise<T> => {
  try { return await rpc(fn as RpcName, args, jsonRecord as z.ZodType<T>); } catch (error) { if (fallback) { try { return await fallback(); } catch { /* graceful */ return ({} as T); } } throw error; }
};

export async function fetchFestivalEditionOperations(editionId: string) {
  return callMaybeRpc("festival_edition_operations_summary", { p_edition_id: editionId }, async () => {
    const client = supabase as any;
    const [stages, slots, staff, permits, insurance] = await Promise.all([
      client.from("festival_stages").select("*").eq("edition_id", editionId),
      client.from("festival_stage_slots").select("*").eq("edition_id", editionId),
      client.from("festival_staff").select("*").eq("edition_id", editionId),
      client.from("festival_permits").select("*").eq("edition_id", editionId),
      client.from("festival_insurance_policies").select("*").eq("edition_id", editionId),
    ]);
    const firstError = [stages, slots, staff, permits, insurance].find((r) => r.error)?.error;
    if (firstError) throw mapFestivalError(firstError);
    return { stages: stages.data ?? [], slots: slots.data ?? [], staff: staff.data ?? [], candidates: [], permit_requirements: permits.data ?? [], insurance_quotes: [], insurance_policies: insurance.data ?? [], permissions: {}, lifecycle: {} };
  });
}

export async function fetchFestivalAdminDataHealth() { return callMaybeRpc("admin_festival_data_health", {}, async () => { try { const { data } = await (supabase as any).from("festival_migration_issues").select("*").order("created_at", { ascending: false }).limit(100); return { issues: data ?? [] }; } catch { return { issues: [] }; } }); }
export async function fetchFestivalLegacyRecords() { return callMaybeRpc("admin_festival_legacy_records", {}, async () => { try { const { data } = await (supabase as any).from("festival_legacy_mappings").select("*").order("created_at", { ascending: false }).limit(100); return { records: data ?? [] }; } catch { return { records: [] }; } }); }
export async function fetchFestivalAuditEvents(filters: Record<string, string>) { return callMaybeRpc("admin_festival_audit_events", { p_filters: filters }, async () => { try { const { data } = await (supabase as any).from("festival_admin_audit_events").select("*").order("created_at", { ascending: false }).limit(100); return { events: data ?? [] }; } catch { return { events: [] }; } }); }
export async function repairFestivalDataHealthIssue(input: { issueId: string; action: string; reason?: string }) { return callMaybeRpc("repair_festival_data_health_issue", { p_issue_id: input.issueId, p_action: input.action, p_reason: input.reason ?? null }, async () => ({ unavailable: true, message: "Data-health repair RPC is unavailable in this environment." })); }
export async function previewLegacyFestivalMigration(mappingId: string) { return callMaybeRpc("preview_festival_legacy_migration", { p_mapping_id: mappingId }, async () => ({ unavailable: true, preview_hash: null, message: "Legacy migration preview RPC is unavailable in this environment." })); }
export async function applyLegacyFestivalMigration(mappingId: string) { return callMaybeRpc("apply_festival_legacy_migration", { p_mapping_id: mappingId, p_idempotency_key: `legacy:${mappingId}` }, async () => ({ unavailable: true, message: "Legacy migration apply RPC is unavailable in this environment." })); }
export async function reviewFestivalEditionPermit(input: { permitId: string; action: string; reason?: string }) { return callMaybeRpc("admin_review_festival_edition_permit", { p_permit_id: input.permitId, p_action: input.action, p_reason: input.reason ?? null, p_idempotency_key: `permit-review:${input.permitId}:${input.action}` }, async () => ({ unavailable: true, message: "Permit review RPC is unavailable in this environment." })); }
