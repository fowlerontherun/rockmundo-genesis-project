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
  type FestivalApplicationWindow,
  type FestivalArtistProgramme,
  type FestivalArtistProgrammeResult,
} from "@/features/festival-company/domain/festivalArtistProgramme";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const { data, error } = await (supabase as any).rpc(
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
  const { data, error } = await (supabase as any).rpc(
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
  const { data, error } = await (supabase as any).rpc(
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
  const { data, error } = await (supabase as any).rpc(
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
  const { data, error } = await (supabase as any).rpc(
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
