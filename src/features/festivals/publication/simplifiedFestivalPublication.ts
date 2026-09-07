import { supabase } from "@/integrations/supabase/client";
import {
  parseFestivalLaunch,
  parsePublicFestival,
  type FestivalLaunch,
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

type PublicationRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const publicationRpc = supabase.rpc.bind(supabase) as unknown as PublicationRpc;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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
