import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { festivalBookingKeys } from "./bookingTypes";

type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

const rpc = supabase.rpc as unknown as (
  functionName: string,
  args?: Record<string, Json>,
) => Promise<RpcResult>;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const asRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row),
      )
    : [];

export interface FestivalCollaborationCandidate {
  profileId: string;
  displayName: string;
  username: string | null;
}

export interface FestivalCollaboration {
  collaborationId: string;
  contractId: string;
  profileId: string;
  displayName: string;
  username: string | null;
  role: "guest" | "featured";
  status: "invited" | "accepted" | "declined" | "cancelled";
  obligations: Record<string, unknown>;
  acceptedObligations: Record<string, unknown> | null;
  version: number;
  invitedAt: string | null;
  respondedAt: string | null;
  canRespond: boolean;
}

export interface MyFestivalCollaborationObligation {
  collaborationId: string;
  contractId: string;
  editionId: string;
  bandId: string;
  bandName: string;
  role: "guest" | "featured";
  status: FestivalCollaboration["status"];
  obligations: Record<string, unknown>;
  acceptedObligations: Record<string, unknown> | null;
  version: number;
  invitedAt: string | null;
  respondedAt: string | null;
}

export interface FestivalRivalryCandidate {
  rivalContractId: string;
  rivalBandId: string;
  rivalBandName: string;
}

export interface FestivalRivalryObjective {
  rivalryId: string;
  editionId: string;
  challengerContractId: string;
  challengerBandId: string;
  challengerBandName: string;
  rivalContractId: string;
  rivalBandId: string;
  rivalBandName: string;
  status: "pending_rival" | "active" | "declined" | "cancelled" | "resolved";
  version: number;
  resolutionResult: "challenger_win" | "rival_win" | "tie" | null;
  resolutionEvidence: Record<string, unknown>;
  canRespond: boolean;
}

export interface FestivalFanVoteCandidate {
  candidateId: string;
  applicationId: string;
  bandId: string;
  bandName: string;
  voteCount: number;
  status?: string | null;
  eligibility?: Record<string, unknown> | null;
}

export interface FestivalFanVoteWindow {
  windowId: string;
  editionId: string;
  stageSlotId: string;
  title: string;
  status?: string | null;
  opensAt: string;
  closesAt: string;
  candidates: FestivalFanVoteCandidate[];
  voterCandidateId: string | null;
}

function requireString(row: Record<string, unknown>, key: string): string {
  const value = asString(row[key]);
  if (!value) throw new Error(`malformed_festival_b7_${key}`);
  return value;
}

function mapCandidate(row: Record<string, unknown>): FestivalCollaborationCandidate {
  return {
    profileId: requireString(row, "profile_id"),
    displayName: requireString(row, "display_name"),
    username: asString(row.username),
  };
}

function mapCollaboration(row: Record<string, unknown>): FestivalCollaboration {
  const role = requireString(row, "role");
  const status = requireString(row, "status");
  return {
    collaborationId: requireString(row, "collaboration_id"),
    contractId: requireString(row, "contract_id"),
    profileId: requireString(row, "profile_id"),
    displayName: requireString(row, "display_name"),
    username: asString(row.username),
    role: role === "featured" ? "featured" : "guest",
    status: status as FestivalCollaboration["status"],
    obligations: asObject(row.obligations),
    acceptedObligations:
      row.accepted_obligations === null
        ? null
        : asObject(row.accepted_obligations),
    version: asNumber(row.version) ?? 1,
    invitedAt: asString(row.invited_at),
    respondedAt: asString(row.responded_at),
    canRespond: row.can_respond === true,
  };
}

function mapMyObligation(
  row: Record<string, unknown>,
): MyFestivalCollaborationObligation {
  const status = requireString(row, "status");
  const role = requireString(row, "role");
  return {
    collaborationId: requireString(row, "collaboration_id"),
    contractId: requireString(row, "contract_id"),
    editionId: requireString(row, "edition_id"),
    bandId: requireString(row, "band_id"),
    bandName: requireString(row, "band_name"),
    role: role === "featured" ? "featured" : "guest",
    status: status as FestivalCollaboration["status"],
    obligations: asObject(row.obligations),
    acceptedObligations:
      row.accepted_obligations === null
        ? null
        : asObject(row.accepted_obligations),
    version: asNumber(row.version) ?? 1,
    invitedAt: asString(row.invited_at),
    respondedAt: asString(row.responded_at),
  };
}

function mapRivalryCandidate(
  row: Record<string, unknown>,
): FestivalRivalryCandidate {
  return {
    rivalContractId: requireString(row, "rival_contract_id"),
    rivalBandId: requireString(row, "rival_band_id"),
    rivalBandName: requireString(row, "rival_band_name"),
  };
}

function mapRivalry(row: Record<string, unknown>): FestivalRivalryObjective {
  return {
    rivalryId: requireString(row, "rivalry_id"),
    editionId: requireString(row, "edition_id"),
    challengerContractId: requireString(row, "challenger_contract_id"),
    challengerBandId: requireString(row, "challenger_band_id"),
    challengerBandName: requireString(row, "challenger_band_name"),
    rivalContractId: requireString(row, "rival_contract_id"),
    rivalBandId: requireString(row, "rival_band_id"),
    rivalBandName: requireString(row, "rival_band_name"),
    status: requireString(row, "status") as FestivalRivalryObjective["status"],
    version: asNumber(row.version) ?? 1,
    resolutionResult: asString(
      row.resolution_result,
    ) as FestivalRivalryObjective["resolutionResult"],
    resolutionEvidence: asObject(row.resolution_evidence),
    canRespond: row.can_respond === true,
  };
}

function mapFanCandidate(value: unknown): FestivalFanVoteCandidate | null {
  const row = asObject(value);
  const candidateId = asString(row.candidate_id);
  const applicationId = asString(row.application_id);
  const bandId = asString(row.band_id);
  const bandName = asString(row.band_name);
  if (!candidateId || !applicationId || !bandId || !bandName) return null;
  return {
    candidateId,
    applicationId,
    bandId,
    bandName,
    voteCount: asNumber(row.vote_count) ?? asNumber(row.votes) ?? 0,
    status: asString(row.status),
    eligibility:
      row.eligibility && typeof row.eligibility === "object"
        ? asObject(row.eligibility)
        : null,
  };
}

function mapFanWindow(row: Record<string, unknown>): FestivalFanVoteWindow {
  const rawCandidates = Array.isArray(row.candidates) ? row.candidates : [];
  return {
    windowId: requireString(row, "window_id"),
    editionId: requireString(row, "edition_id"),
    stageSlotId: requireString(row, "stage_slot_id"),
    title: requireString(row, "title"),
    status: asString(row.status),
    opensAt: requireString(row, "opens_at"),
    closesAt: requireString(row, "closes_at"),
    candidates: rawCandidates
      .map(mapFanCandidate)
      .filter((candidate): candidate is FestivalFanVoteCandidate => Boolean(candidate)),
    voterCandidateId: asString(row.voter_candidate_id),
  };
}

async function callRows(
  functionName: string,
  args?: Record<string, Json>,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await rpc(functionName, args);
  if (error) throw new Error(error.message ?? `${functionName}_failed`);
  return asRows(data);
}

export async function listFestivalCollaborationCandidates(
  contractId: string,
  search?: string,
): Promise<FestivalCollaborationCandidate[]> {
  const rows = await callRows("festival_collaboration_candidates", {
    p_contract_id: contractId,
    p_search: search ?? null,
  });
  return rows.map(mapCandidate);
}

export async function listFestivalContractCollaborators(
  contractId: string,
): Promise<FestivalCollaboration[]> {
  const rows = await callRows("list_festival_contract_collaborators", {
    p_contract_id: contractId,
  });
  return rows.map(mapCollaboration);
}

export async function listMyFestivalCollaborationObligations(): Promise<
  MyFestivalCollaborationObligation[]
> {
  const rows = await callRows("list_my_festival_collaboration_obligations");
  return rows.map(mapMyObligation);
}

export async function inviteFestivalCollaborator(input: {
  contractId: string;
  profileId: string;
  role: "guest" | "featured";
  obligations: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("invite_festival_performance_collaborator", {
    p_contract_id: input.contractId,
    p_profile_id: input.profileId,
    p_role: input.role,
    p_obligations: input.obligations as Json,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_collaboration_invite_failed");
  return data;
}

export async function respondFestivalCollaborator(input: {
  collaborationId: string;
  expectedVersion: number;
  response: "accepted" | "declined";
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("respond_festival_performance_collaborator", {
    p_collaboration_id: input.collaborationId,
    p_expected_version: input.expectedVersion,
    p_response: input.response,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_collaboration_response_failed");
  return data;
}

export async function listFestivalRivalryCandidates(
  contractId: string,
): Promise<FestivalRivalryCandidate[]> {
  const rows = await callRows("festival_rivalry_candidates", {
    p_contract_id: contractId,
  });
  return rows.map(mapRivalryCandidate);
}

export async function listFestivalRivalries(
  contractId: string,
): Promise<FestivalRivalryObjective[]> {
  const rows = await callRows("list_festival_rivalry_objectives", {
    p_contract_id: contractId,
  });
  return rows.map(mapRivalry);
}

export async function createFestivalRivalry(input: {
  challengerContractId: string;
  rivalContractId: string;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("create_festival_rivalry_objective", {
    p_challenger_contract_id: input.challengerContractId,
    p_rival_contract_id: input.rivalContractId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_rivalry_create_failed");
  return data;
}

export async function respondFestivalRivalry(input: {
  rivalryId: string;
  expectedVersion: number;
  response: "accepted" | "declined";
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("respond_festival_rivalry_objective", {
    p_rivalry_id: input.rivalryId,
    p_expected_version: input.expectedVersion,
    p_response: input.response,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_rivalry_response_failed");
  return data;
}

export async function listOpenFestivalFanVotes(
  editionId?: string,
): Promise<FestivalFanVoteWindow[]> {
  const rows = await callRows("list_open_festival_fan_vote_windows", {
    p_edition_id: editionId ?? null,
  });
  return rows.map(mapFanWindow);
}

export async function listOrganiserFestivalFanVotes(
  editionId: string,
): Promise<FestivalFanVoteWindow[]> {
  const rows = await callRows("list_organiser_festival_fan_vote_windows", {
    p_edition_id: editionId,
  });
  return rows.map(mapFanWindow);
}

export async function createFestivalFanVoteWindow(input: {
  editionId: string;
  stageSlotId: string;
  title: string;
  opensAt: string;
  closesAt: string;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("create_festival_fan_vote_window", {
    p_edition_id: input.editionId,
    p_stage_slot_id: input.stageSlotId,
    p_title: input.title,
    p_opens_at: input.opensAt,
    p_closes_at: input.closesAt,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_fan_vote_window_failed");
  return data;
}

export async function addFestivalFanVoteCandidate(input: {
  windowId: string;
  applicationId: string;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("add_festival_fan_vote_candidate", {
    p_window_id: input.windowId,
    p_application_id: input.applicationId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_fan_vote_candidate_failed");
  return data;
}

export async function castFestivalFanVote(input: {
  windowId: string;
  candidateId: string;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("cast_festival_fan_vote", {
    p_window_id: input.windowId,
    p_candidate_id: input.candidateId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(error.message ?? "festival_fan_vote_failed");
  return data;
}

export function useFestivalCollaborationCandidates(
  contractId?: string,
  search?: string,
) {
  return useQuery({
    queryKey: [
      ...festivalBookingKeys.root,
      "collaboration-candidates",
      contractId ?? "none",
      search ?? "",
    ],
    queryFn: () => listFestivalCollaborationCandidates(contractId!, search),
    enabled: Boolean(contractId),
  });
}

export function useFestivalContractCollaborators(contractId?: string) {
  return useQuery({
    queryKey: [
      ...festivalBookingKeys.root,
      "collaborators",
      contractId ?? "none",
    ],
    queryFn: () => listFestivalContractCollaborators(contractId!),
    enabled: Boolean(contractId),
  });
}

export function useMyFestivalCollaborationObligations() {
  return useQuery({
    queryKey: [...festivalBookingKeys.root, "my-collaboration-obligations"],
    queryFn: listMyFestivalCollaborationObligations,
  });
}

export function useFestivalCollaborationActions(contractId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root });
  return {
    invite: useMutation({ mutationFn: inviteFestivalCollaborator, onSuccess: invalidate }),
    respond: useMutation({ mutationFn: respondFestivalCollaborator, onSuccess: invalidate }),
  };
}

export function useFestivalRivalryCandidates(contractId?: string) {
  return useQuery({
    queryKey: [...festivalBookingKeys.root, "rivalry-candidates", contractId ?? "none"],
    queryFn: () => listFestivalRivalryCandidates(contractId!),
    enabled: Boolean(contractId),
  });
}

export function useFestivalRivalries(contractId?: string) {
  return useQuery({
    queryKey: [...festivalBookingKeys.root, "rivalries", contractId ?? "none"],
    queryFn: () => listFestivalRivalries(contractId!),
    enabled: Boolean(contractId),
  });
}

export function useFestivalRivalryActions() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root });
  return {
    create: useMutation({ mutationFn: createFestivalRivalry, onSuccess: invalidate }),
    respond: useMutation({ mutationFn: respondFestivalRivalry, onSuccess: invalidate }),
  };
}

export function useOpenFestivalFanVotes(editionId?: string) {
  return useQuery({
    queryKey: [...festivalBookingKeys.root, "fan-votes", editionId ?? "all"],
    queryFn: () => listOpenFestivalFanVotes(editionId),
  });
}

export function useOrganiserFestivalFanVotes(editionId?: string) {
  return useQuery({
    queryKey: [
      ...festivalBookingKeys.organiserWorkspace(editionId),
      "fan-votes",
    ],
    queryFn: () => listOrganiserFestivalFanVotes(editionId!),
    enabled: Boolean(editionId),
  });
}

export function useFestivalFanVoteActions() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root });
  return {
    createWindow: useMutation({
      mutationFn: createFestivalFanVoteWindow,
      onSuccess: invalidate,
    }),
    addCandidate: useMutation({
      mutationFn: addFestivalFanVoteCandidate,
      onSuccess: invalidate,
    }),
    castVote: useMutation({ mutationFn: castFestivalFanVote, onSuccess: invalidate }),
  };
}

export function useFestivalBookingRealtime(scope: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel(`festival-booking-${scope}`);
    const tables = [
      "festival_artist_invitations",
      "festival_contract_setlists",
      "festival_contracts",
      "festival_stage_slots",
      "festival_performance_collaborations",
      "festival_rivalry_objectives",
      "festival_fan_vote_windows",
      "festival_fan_vote_candidates",
    ];

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          void queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root });
        },
      );
    }

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, scope]);
}
