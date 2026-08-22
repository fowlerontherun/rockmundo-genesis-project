import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  parseFestivalSitePlanResult,
  type FestivalSitePlanResult,
} from "@/features/festival-company/domain/festivalSitePlan";
import {
  parseFestivalTicketPlanResult,
  type FestivalTicketPlanDraft,
  type FestivalTicketPlanResult,
} from "@/features/festival-company/domain/festivalTicketPlan";
import {
  parseFestivalArtistProgrammeResult,
  type ArtistIdentity,
  type FestivalApplicationWindow,
  type FestivalArtistProgramme,
  type FestivalArtistProgrammeResult,
} from "@/features/festival-company/domain/festivalArtistProgramme";
import {
  parseFestivalArtistActionResult,
  parseFestivalArtistCandidates,
  type FestivalArtistActionResult,
} from "@/features/festival-company/domain/festivalArtistWorkflows";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProjectionRpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

const projectionRpc = supabase.rpc as unknown as (
  functionName: string,
  args: Record<string, Json>,
) => Promise<ProjectionRpcResult>;

const assertIdentity = (festivalCompanyId: string, festivalEditionId: string) => {
  if (!UUID.test(festivalCompanyId) || !UUID.test(festivalEditionId)) {
    throw new Error("festival_edition_not_found");
  }
};

const toJson = (value: unknown): Json => {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJson(entry)]),
    );
  }
  throw new Error("festival_payload_not_serializable");
};

const normalize = (error: { message?: string }, codes: string[]) =>
  new Error(
    codes.find((code) => error.message?.includes(code)) ??
      "festival_projection_unavailable",
  );

export async function getFestivalEditionSitePlan(
  festivalCompanyId: string,
  festivalEditionId: string,
): Promise<FestivalSitePlanResult> {
  assertIdentity(festivalCompanyId, festivalEditionId);
  const { data, error } = await projectionRpc(
    "get_festival_edition_site_plan",
    {
      p_festival_company_id: festivalCompanyId,
      p_festival_edition_id: festivalEditionId,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_site_plan_forbidden",
      "festival_edition_not_found",
      "festival_configuration_incomplete",
    ]);
  }
  return parseFestivalSitePlanResult(data);
}

export async function getFestivalEditionTicketPlan(
  festivalCompanyId: string,
  festivalEditionId: string,
): Promise<FestivalTicketPlanResult> {
  assertIdentity(festivalCompanyId, festivalEditionId);
  const { data, error } = await projectionRpc(
    "get_festival_edition_ticket_plan",
    {
      p_festival_company_id: festivalCompanyId,
      p_festival_edition_id: festivalEditionId,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_ticket_plan_forbidden",
      "festival_site_plan_incomplete",
      "festival_edition_not_found",
    ]);
  }
  return parseFestivalTicketPlanResult(data);
}

export async function saveFestivalEditionTicketPlan(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  expectedVersion: number;
  draft: FestivalTicketPlanDraft;
  idempotencyKey: string;
  complete?: boolean;
}): Promise<FestivalTicketPlanResult> {
  assertIdentity(input.festivalCompanyId, input.festivalEditionId);
  if (!UUID.test(input.idempotencyKey) || input.expectedVersion < 0) {
    throw new Error("festival_ticket_plan_invalid");
  }
  const { data, error } = await projectionRpc(
    "save_festival_edition_ticket_plan",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_expected_version: input.expectedVersion,
      p_ticket_plan: toJson(input.draft.ticketPlan),
      p_products: toJson(input.draft.products),
      p_release_phases: toJson(input.draft.releasePhases),
      p_capacity_allocations: toJson(input.draft.capacityAllocations),
      p_idempotency_key: input.idempotencyKey,
      p_complete: input.complete ?? false,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_ticket_plan_forbidden",
      "festival_ticket_plan_locked",
      "festival_site_plan_incomplete",
      "festival_ticket_product_required",
      "festival_ticket_plan_invalid",
      "festival_ticket_plan_stale",
      "festival_ticket_plan_idempotency_conflict",
    ]);
  }
  return parseFestivalTicketPlanResult(data);
}

export async function getFestivalEditionArtistProgramme(
  festivalCompanyId: string,
  festivalEditionId: string,
): Promise<FestivalArtistProgrammeResult> {
  assertIdentity(festivalCompanyId, festivalEditionId);
  const { data, error } = await projectionRpc(
    "get_festival_edition_artist_programme",
    {
      p_festival_company_id: festivalCompanyId,
      p_festival_edition_id: festivalEditionId,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_artist_programme_forbidden",
      "festival_ticket_plan_incomplete",
      "festival_edition_not_found",
    ]);
  }
  return parseFestivalArtistProgrammeResult(data);
}

export async function saveFestivalEditionArtistProgramme(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  expectedVersion: number;
  programme: FestivalArtistProgramme;
  applicationWindows: FestivalApplicationWindow[];
  idempotencyKey: string;
  complete?: boolean;
}): Promise<FestivalArtistProgrammeResult> {
  assertIdentity(input.festivalCompanyId, input.festivalEditionId);
  if (!UUID.test(input.idempotencyKey) || input.expectedVersion < 0) {
    throw new Error("festival_artist_programme_invalid");
  }
  const { data, error } = await projectionRpc(
    "save_festival_edition_artist_programme",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_expected_version: input.expectedVersion,
      p_programme: toJson(input.programme),
      p_application_windows: toJson(input.applicationWindows),
      p_idempotency_key: input.idempotencyKey,
      p_complete: input.complete ?? false,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_artist_programme_forbidden",
      "festival_artist_programme_locked",
      "festival_ticket_plan_incomplete",
      "festival_artist_programme_invalid",
      "festival_artist_programme_stale",
      "festival_artist_idempotency_conflict",
    ]);
  }
  return parseFestivalArtistProgrammeResult(data);
}

export async function searchFestivalEditionArtistCandidates(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  query?: string;
  limit?: number;
  offset?: number;
}) {
  assertIdentity(input.festivalCompanyId, input.festivalEditionId);
  const { data, error } = await projectionRpc(
    "search_festival_edition_artist_candidates",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_query: input.query?.trim() || null,
      p_limit: input.limit ?? 25,
      p_offset: input.offset ?? 0,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_artist_action_forbidden",
      "festival_artist_programme_incomplete",
      "festival_edition_not_found",
    ]);
  }
  return parseFestivalArtistCandidates(data);
}

export async function sendFestivalEditionArtistInvitation(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  identity: ArtistIdentity;
  suggestedFeeMinor: number;
  suggestedSetMinutes: number;
  suggestedDates: string[];
  responseDeadline: string;
  message?: string;
  idempotencyKey: string;
}): Promise<FestivalArtistActionResult> {
  assertIdentity(input.festivalCompanyId, input.festivalEditionId);
  if (!UUID.test(input.idempotencyKey)) {
    throw new Error("festival_artist_invitation_invalid");
  }
  const { data, error } = await projectionRpc(
    "send_festival_edition_artist_invitation",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_artist_type: input.identity.type,
      p_artist_profile_id:
        input.identity.type === "solo" ? input.identity.artistProfileId : null,
      p_band_id: input.identity.type === "band" ? input.identity.bandId : null,
      p_suggested_fee_minor: input.suggestedFeeMinor,
      p_suggested_set_minutes: input.suggestedSetMinutes,
      p_suggested_dates: toJson(input.suggestedDates),
      p_response_deadline: input.responseDeadline,
      p_message: input.message ?? null,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_artist_action_forbidden",
      "festival_artist_programme_incomplete",
      "festival_artist_invitation_invalid",
      "festival_artist_invitation_duplicate",
    ]);
  }
  return parseFestivalArtistActionResult(data);
}

export async function createFestivalEditionArtistOffer(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  identity: ArtistIdentity;
  applicationId?: string | null;
  invitationId?: string | null;
  feeMinor: number;
  setMinutes: number;
  preferredDate?: string | null;
  billingPosition?: string;
  responseDeadline: string;
  message?: string;
  idempotencyKey: string;
}): Promise<FestivalArtistActionResult> {
  assertIdentity(input.festivalCompanyId, input.festivalEditionId);
  if (!UUID.test(input.idempotencyKey)) {
    throw new Error("festival_artist_offer_invalid");
  }
  const terms = {
    feeMinor: input.feeMinor,
    setMinutes: input.setMinutes,
    performanceCount: 1,
    preferredDate: input.preferredDate ?? null,
    preferredStageId: null,
    billingPosition: input.billingPosition ?? "support",
    travelSupportMinor: 0,
    accommodationSupportMinor: 0,
    merchShareBasisPoints: 0,
    responseDeadline: input.responseDeadline,
    message: input.message ?? null,
  };
  const { data, error } = await projectionRpc(
    "create_festival_edition_artist_offer",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_application_id: input.applicationId ?? null,
      p_invitation_id: input.invitationId ?? null,
      p_artist_type: input.identity.type,
      p_artist_profile_id:
        input.identity.type === "solo" ? input.identity.artistProfileId : null,
      p_band_id: input.identity.type === "band" ? input.identity.bandId : null,
      p_terms: toJson(terms),
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_artist_action_forbidden",
      "festival_artist_programme_incomplete",
      "festival_artist_offer_invalid",
      "festival_artist_offer_duplicate",
    ]);
  }
  return parseFestivalArtistActionResult(data);
}

export async function sendFestivalEditionArtistOffer(input: {
  festivalCompanyId: string;
  festivalEditionId: string;
  offerId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<FestivalArtistActionResult> {
  assertIdentity(input.festivalCompanyId, input.festivalEditionId);
  if (!UUID.test(input.offerId) || !UUID.test(input.idempotencyKey)) {
    throw new Error("festival_artist_offer_invalid");
  }
  const { data, error } = await projectionRpc(
    "send_festival_edition_artist_offer",
    {
      p_festival_company_id: input.festivalCompanyId,
      p_festival_edition_id: input.festivalEditionId,
      p_offer_id: input.offerId,
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) {
    throw normalize(error, [
      "festival_artist_action_forbidden",
      "festival_artist_programme_incomplete",
      "festival_artist_offer_invalid",
      "festival_artist_offer_stale",
      "festival_artist_offer_invalid_transition",
      "festival_artist_offer_budget_exceeded",
    ]);
  }
  return parseFestivalArtistActionResult(data);
}
