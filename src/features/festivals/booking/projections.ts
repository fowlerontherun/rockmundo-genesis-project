import { supabase } from "@/integrations/supabase/client";
import type {
  FestivalApplicationEligibility,
  FestivalBookingSlotProjection,
  FestivalInvitationCandidate,
  FestivalRepertoireSong,
  FestivalSetlistPreflight,
  RepresentedBandOption,
} from "./domainTypes";
import type { FestivalSetlistItemInput } from "./bookingTypes";

type JsonRecord = Record<string, unknown>;
const asArray = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? (value as JsonRecord[]) : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const bool = (value: unknown): boolean => value === true;
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function mapFestivalRepresentedBand(
  row: JsonRecord,
): RepresentedBandOption {
  const id = text(row.band_id) ?? text(row.id);
  if (!id)
    throw new Error("Malformed represented band projection: missing band id");
  return {
    id,
    name: text(row.band_name) ?? text(row.name) ?? id,
    role: text(row.member_role) ?? text(row.role) ?? "member",
    canApply: bool(row.can_apply),
    existingApplicationStatus: text(
      row.existing_application_status,
    ) as RepresentedBandOption["existingApplicationStatus"],
    conflictStatus: bool(row.can_apply) ? "clear" : "blocked",
    eligibilityBlockers: strings(row.reasons),
  };
}

export function mapFestivalApplicationEligibility(
  row: JsonRecord,
): FestivalApplicationEligibility {
  const outcome = text(row.outcome);
  if (outcome !== "allowed" && outcome !== "warning" && outcome !== "blocked")
    throw new Error("Malformed eligibility projection: invalid outcome");
  return {
    outcome,
    canApply: bool(row.can_apply),
    authorityAllowed: bool(row.authority_allowed),
    editionStatusAllowed: bool(row.edition_status_allowed),
    applicationWindowOpen: bool(row.application_window_open),
    existingApplicationId: text(row.existing_application_id),
    existingApplicationStatus: text(
      row.existing_application_status,
    ) as FestivalApplicationEligibility["existingApplicationStatus"],
    existingContractId: text(row.existing_contract_id),
    hardConflicts: strings(row.hard_conflicts),
    advisoryConflicts: strings(row.advisory_conflicts),
    requestedDurationLimits:
      (row.requested_duration_limits as FestivalApplicationEligibility["requestedDurationLimits"]) ??
      null,
    currencyCode: text(row.currency_code),
    availableSlotTypes: strings(row.available_slot_types),
    applicationDeadline: text(row.application_deadline),
    reasons: strings(row.reasons),
    warnings: strings(row.warnings),
  };
}

export function mapFestivalBookingSlot(
  row: JsonRecord,
): FestivalBookingSlotProjection {
  const slotId = text(row.slot_id);
  if (!slotId) throw new Error("Malformed slot projection: missing slot id");
  return {
    slotId,
    stageId: text(row.stage_id),
    stageName: text(row.stage_name),
    startAt: text(row.start_at),
    endAt: text(row.end_at),
    slotType: text(row.slot_type),
    durationMinutes: num(row.duration_minutes),
    headlineEligible: bool(row.headline_eligible),
    reservationState: text(row.reservation_state),
    reservationExpiresAt: text(row.reservation_expires_at),
    currentBandId: text(row.current_band_id),
    currentBandName: text(row.current_band_name),
    technicalCapacitySummary: text(row.technical_capacity_summary),
    available: bool(row.available),
    unavailableReason: text(row.unavailable_reason),
  };
}

export function mapFestivalInvitationCandidate(
  row: JsonRecord,
): FestivalInvitationCandidate {
  const bandId = text(row.band_id);
  if (!bandId)
    throw new Error("Malformed invitation candidate: missing band id");
  return {
    bandId,
    bandName: text(row.band_name) ?? bandId,
    primaryGenres: strings(row.primary_genres),
    fame: num(row.fame),
    liveRating: num(row.live_rating),
    memberCount: num(row.member_count) ?? 0,
    bookingStatus: text(row.current_festival_booking_status),
    scheduleWarningSummary: text(row.schedule_warning_summary),
    previousFestivalHistorySummary: text(row.previous_festival_history_summary),
    applicationStatus: text(
      row.application_status,
    ) as FestivalInvitationCandidate["applicationStatus"],
    activeContractStatus: text(
      row.active_contract_status,
    ) as FestivalInvitationCandidate["activeContractStatus"],
    invitationEligible: bool(row.invitation_eligible),
    unavailableReason: text(row.unavailable_reason),
  };
}

export function mapFestivalRepertoire(row: JsonRecord): FestivalRepertoireSong {
  const songId = text(row.song_id);
  if (!songId)
    throw new Error("Malformed repertoire projection: missing song id");
  return {
    songId,
    title: text(row.title) ?? songId,
    durationSeconds: num(row.duration_seconds),
    genre: text(row.genre),
    writers: strings(row.writers),
    ownershipRelationship: text(row.ownership_relationship),
    performanceRightsStatus: text(row.performance_rights_status),
    recordedReleasedStatus: text(row.recorded_released_status),
    familiarity: num(row.familiarity),
    readiness: num(row.readiness),
    currentlyUsedInSetlist: bool(row.currently_used_in_setlist),
    unavailableReason: text(row.unavailable_reason),
  };
}

export function mapFestivalSetlistPreflight(
  row: JsonRecord,
): FestivalSetlistPreflight {
  const outcome = text(row.outcome);
  if (outcome !== "allowed" && outcome !== "warning" && outcome !== "blocked")
    throw new Error("Malformed setlist preflight: invalid outcome");
  return {
    totalDurationSeconds: num(row.total_duration_seconds) ?? 0,
    contractedMaximumSeconds: num(row.contracted_maximum_seconds) ?? 0,
    minimumRecommendedSeconds: num(row.minimum_recommended_seconds) ?? 0,
    invalidSongs: strings(row.invalid_songs),
    duplicateSongs: strings(row.duplicate_songs),
    unavailableSongs: strings(row.unavailable_songs),
    guestPerformerIssues: strings(row.guest_performer_issues),
    readinessWarnings: strings(row.readiness_warnings),
    versionConflict:
      (row.version_conflict as FestivalSetlistPreflight["versionConflict"]) ?? {
        conflict: false,
      },
    outcome,
    blockingReasons: strings(row.blocking_reasons),
    warnings: strings(row.warnings),
  };
}

async function rpcRows(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<JsonRecord[]> {
  const { data, error } = await supabase.rpc(
    functionName as never,
    args as never,
  );
  if (error) throw error;
  return asArray(data);
}

async function rpcObject(
  functionName: string,
  args?: Record<string, unknown>,
): Promise<JsonRecord> {
  const { data, error } = await supabase.rpc(
    functionName as never,
    args as never,
  );
  if (error) throw error;
  return (data ?? {}) as JsonRecord;
}

export async function listFestivalRepresentedBands() {
  return (await rpcRows("festival_represented_bands")).map(
    mapFestivalRepresentedBand,
  );
}

export async function getFestivalApplicationEligibility(
  editionId: string,
  bandId: string,
) {
  return mapFestivalApplicationEligibility(
    await rpcObject("festival_application_eligibility", {
      p_edition_id: editionId,
      p_band_id: bandId,
    }),
  );
}

export async function listFestivalInvitationCandidates(
  editionId: string,
  search?: string,
) {
  return (
    await rpcRows("festival_invitation_candidates", {
      p_edition_id: editionId,
      p_search: search ?? null,
    })
  ).map(mapFestivalInvitationCandidate);
}

export async function listFestivalBookingSlots(editionId: string) {
  return (
    await rpcRows("festival_booking_slots", { p_edition_id: editionId })
  ).map(mapFestivalBookingSlot);
}

export async function listFestivalContractRepertoire(contractId: string) {
  return (
    await rpcRows("festival_contract_repertoire", { p_contract_id: contractId })
  ).map(mapFestivalRepertoire);
}

export async function preflightFestivalSetlist(
  contractId: string,
  items: FestivalSetlistItemInput[],
) {
  return mapFestivalSetlistPreflight(
    await rpcObject("festival_setlist_preflight", {
      p_contract_id: contractId,
      p_items: items,
    }),
  );
}
