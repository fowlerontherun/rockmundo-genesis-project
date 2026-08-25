import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { festivalBookingKeys } from "./bookingTypes";

export type FestivalDirectInvitationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "interested"
  | "declined"
  | "expired"
  | "converted_to_offer"
  | "cancelled";

export interface FestivalDirectInvitation {
  invitationId: string;
  festivalCompanyId: string;
  festivalEditionId: string;
  artistType: "solo" | "band";
  artistProfileId: string | null;
  bandId: string | null;
  status: FestivalDirectInvitationStatus;
  version: number;
  message: string | null;
  suggestedFeeMinor: number | null;
  suggestedSetMinutes: number | null;
  suggestedDates: string[];
  suggestedStageTypes: string[];
  expiresAt: string | null;
  createdAt: string;
  canRespond: boolean;
}

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

const rpc = supabase.rpc as unknown as (
  functionName: string,
  args: Record<string, Json>,
) => Promise<RpcResult>;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const statuses = new Set<FestivalDirectInvitationStatus>([
  "draft",
  "sent",
  "viewed",
  "interested",
  "declined",
  "expired",
  "converted_to_offer",
  "cancelled",
]);

export function mapFestivalDirectInvitation(
  value: unknown,
): FestivalDirectInvitation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("malformed_festival_direct_invitation");
  }
  const row = value as Record<string, unknown>;
  const invitationId = asString(row.invitation_id);
  const festivalCompanyId = asString(row.festival_company_id);
  const festivalEditionId = asString(row.festival_edition_id);
  const artistType = asString(row.artist_type);
  const status = asString(row.status) as FestivalDirectInvitationStatus | null;
  const version = asNumber(row.version);
  const createdAt = asString(row.created_at);

  if (
    !invitationId ||
    !festivalCompanyId ||
    !festivalEditionId ||
    (artistType !== "solo" && artistType !== "band") ||
    !status ||
    !statuses.has(status) ||
    version === null ||
    !createdAt
  ) {
    throw new Error("malformed_festival_direct_invitation");
  }

  return {
    invitationId,
    festivalCompanyId,
    festivalEditionId,
    artistType,
    artistProfileId: asString(row.artist_profile_id),
    bandId: asString(row.band_id),
    status,
    version,
    message: asString(row.message),
    suggestedFeeMinor: asNumber(row.suggested_fee_minor),
    suggestedSetMinutes: asNumber(row.suggested_set_minutes),
    suggestedDates: asStrings(row.suggested_dates),
    suggestedStageTypes: asStrings(row.suggested_stage_types),
    expiresAt: asString(row.expires_at),
    createdAt,
    canRespond: row.can_respond === true,
  };
}

export async function listMyFestivalDirectInvitations(
  bandId?: string,
): Promise<FestivalDirectInvitation[]> {
  const { data, error } = await rpc("list_my_festival_artist_invitations", {
    p_band_id: bandId ?? null,
  });
  if (error) {
    throw new Error(
      error.message?.includes("festival_artist_action_forbidden")
        ? "festival_artist_action_forbidden"
        : "festival_direct_invitations_unavailable",
    );
  }
  return Array.isArray(data) ? data.map(mapFestivalDirectInvitation) : [];
}

export async function respondToFestivalDirectInvitation(input: {
  invitationId: string;
  expectedVersion: number;
  response: "interested" | "declined";
  idempotencyKey: string;
}) {
  const { data, error } = await rpc(
    "respond_to_festival_edition_artist_invitation",
    {
      p_invitation_id: input.invitationId,
      p_expected_version: input.expectedVersion,
      p_response: input.response,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) {
    const known = [
      "festival_artist_action_forbidden",
      "festival_artist_invitation_invalid",
      "festival_artist_invitation_invalid_transition",
      "festival_artist_offer_stale",
      "festival_artist_idempotency_conflict",
    ].find((code) => error.message?.includes(code));
    throw new Error(known ?? "festival_direct_invitation_response_failed");
  }
  return data;
}

export function useFestivalDirectInvitations(bandId?: string) {
  return useQuery({
    queryKey: [...festivalBookingKeys.root, "direct-invitations", bandId ?? "all"],
    queryFn: () => listMyFestivalDirectInvitations(bandId),
  });
}

export function useFestivalDirectInvitationActions(bandId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: [...festivalBookingKeys.root, "direct-invitations"],
    });
    queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root });
  };
  return {
    respond: useMutation({
      mutationFn: respondToFestivalDirectInvitation,
      onSuccess: invalidate,
    }),
  };
}
