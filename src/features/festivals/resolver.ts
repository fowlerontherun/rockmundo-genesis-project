import { supabase } from "@/integrations/supabase/client";

export type FestivalResolutionStatus = "resolved" | "not_found" | "legacy_only" | "ambiguous" | "unavailable";
export type FestivalIdentifierKind = "festival_company" | "public_slug" | "legacy_festival";
export interface FestivalIdentifierResolution {
  status: FestivalResolutionStatus;
  festivalCompanyId?: string;
  publicSlug?: string;
  companyId?: string;
  editionId?: string;
  editionYear?: number;
  provenance?: "canonical_slug" | "canonical_uuid" | "legacy_mapping";
  legacyRecord?: { id: string; name: string; completedAt?: string };
  errorCode?: string;
}

const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{data: unknown; error: {message?: string} | null}>;
const parse = (value: unknown): FestivalIdentifierResolution => {
  if (!value || typeof value !== "object") return { status: "unavailable" };
  const result = value as FestivalIdentifierResolution;
  return ["resolved", "not_found", "legacy_only", "ambiguous", "unavailable"].includes(result.status) ? result : { status: "unavailable" };
};

export async function resolvePublicFestivalIdentifier(identifier: string, expectedKind: FestivalIdentifierKind, editionIdentifier?: string): Promise<FestivalIdentifierResolution> {
  const { data, error } = await rpc("resolve_public_festival_identifier", { p_identifier: identifier, p_expected_identifier_kind: expectedKind, p_edition_identifier: editionIdentifier ?? null });
  return error ? { status: "unavailable" } : parse(data);
}

export async function resolveOwnerFestivalIdentifier(identifier: string, editionIdentifier?: string): Promise<FestivalIdentifierResolution> {
  const { data, error } = await rpc("resolve_owner_festival_identifier", { p_identifier: identifier, p_edition_identifier: editionIdentifier ?? null });
  if (error) throw new Error(error.message ?? "FESTIVAL_EDITION_ACCESS_DENIED");
  return parse(data);
}
