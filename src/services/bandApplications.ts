import { supabase } from "@/integrations/supabase/client";

export interface BandApplicationResult {
  id: string;
  band_id: string;
  applicant_profile_id: string;
  instrument_role: string;
  vocal_role: string | null;
  message: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
}

export type BandApplicationDecision = "approve" | "reject";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string | undefined | null, message: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error(message);
  }
  return normalized;
}

export function normalizeBandApplicationResponseInput(applicationId: string, decision: BandApplicationDecision) {
  const normalizedApplicationId = assertUuid(applicationId, "Choose a valid band application.");
  if (decision !== "approve" && decision !== "reject") {
    throw new Error("Choose approve or reject for this band application.");
  }
  return { applicationId: normalizedApplicationId, decision };
}

export async function respondBandApplication(applicationId: string, decision: BandApplicationDecision): Promise<BandApplicationResult> {
  const normalized = normalizeBandApplicationResponseInput(applicationId, decision);
  const { data, error } = await (supabase.rpc as any)("respond_band_application", {
    application_id: normalized.applicationId,
    decision: normalized.decision,
  });

  if (error) {
    throw new Error(error.message || "Failed to respond to band application.");
  }
  if (!data) {
    throw new Error("Band application response could not be saved.");
  }
  return data as BandApplicationResult;
}
