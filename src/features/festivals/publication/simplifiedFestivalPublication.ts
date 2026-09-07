import { supabase } from "@/integrations/supabase/client";
import {
  parseFestivalLaunch,
  parsePublicFestival,
  type FestivalLaunch,
  type FestivalLaunchStatus,
  type FestivalPublicEdition,
} from "@/features/festival-company/domain/festivalLaunch";

interface PublishSimplifiedFestivalInput {
  festivalCompanyId: string;
  festivalEditionId: string;
  expectedEditionVersion: number;
  idempotencyKey: string;
}

export interface SimplifiedFestivalPublication {
  launch: FestivalLaunch;
  publicFestival: FestivalPublicEdition;
  idempotent: boolean;
}

export interface SimplifiedFestivalPublicationStatus {
  launchStatus: FestivalLaunchStatus;
  launchVersion: number;
  publicSlug: string | null;
  blockingIssues: Array<{ code: string; message: string }>;
}

type PublicationRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const publicationRpc = supabase.rpc.bind(supabase) as unknown as PublicationRpc;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const launchStatuses = new Set<FestivalLaunchStatus>([
  "not_ready",
  "ready_for_launch_preparation",
  "launch_review",
  "launched",
  "tickets_on_sale",
  "sales_paused",
  "sales_closed",
  "cancelled_before_event",
]);

export async function getSimplifiedFestivalPublicationStatus(
  festivalCompanyId: string,
): Promise<SimplifiedFestivalPublicationStatus> {
  const { data, error } = await publicationRpc("get_festival_launch_plan", {
    p_festival_company_id: festivalCompanyId,
  });
  if (error) throw new Error(error.message ?? "festival_publication_status_unavailable");
  if (!isRecord(data) || !isRecord(data.launch) || !Array.isArray(data.blockingIssues)) {
    throw new Error("malformed_festival_publication_status");
  }

  const status = data.launch.launchStatus;
  const launchVersion = data.launch.launchVersion;
  const publicSlug = data.launch.publicSlug;
  if (
    typeof status !== "string" ||
    !launchStatuses.has(status as FestivalLaunchStatus) ||
    !Number.isInteger(launchVersion) ||
    Number(launchVersion) < 0 ||
    (publicSlug !== null && typeof publicSlug !== "string")
  ) {
    throw new Error("malformed_festival_publication_status");
  }

  const blockingIssues = data.blockingIssues.flatMap((issue) => {
    if (!isRecord(issue) || typeof issue.code !== "string" || typeof issue.message !== "string") {
      return [];
    }
    return [{ code: issue.code, message: issue.message }];
  });

  return {
    launchStatus: status as FestivalLaunchStatus,
    launchVersion: Number(launchVersion),
    publicSlug: publicSlug as string | null,
    blockingIssues,
  };
}

export async function publishSimplifiedFestival(
  input: PublishSimplifiedFestivalInput,
): Promise<SimplifiedFestivalPublication> {
  const { data, error } = await publicationRpc("publish_simplified_festival", {
    p_festival_company_id: input.festivalCompanyId,
    p_festival_edition_id: input.festivalEditionId,
    p_expected_edition_version: input.expectedEditionVersion,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    const message = error.message ?? "festival_publication_failed";
    if (message.includes("festival_launch_snapshot_stale")) {
      throw new Error("festival_launch_snapshot_stale");
    }
    if (message.includes("festival_launch_not_ready")) {
      throw new Error("festival_launch_not_ready");
    }
    throw new Error(message);
  }

  if (!isRecord(data) || typeof data.idempotent !== "boolean") {
    throw new Error("malformed_festival_publication_result");
  }

  return {
    launch: parseFestivalLaunch(data.launch),
    publicFestival: parsePublicFestival(data.publicFestival),
    idempotent: data.idempotent,
  };
}
