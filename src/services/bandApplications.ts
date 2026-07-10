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

export const BAND_APPLICATION_MESSAGE_MAX_LENGTH = 500;
export const BAND_APPLICATION_ROLES = [
  "Guitar",
  "Bass",
  "Drums",
  "Vocals",
  "Keyboard",
  "Rhythm Guitar",
  "Lead Guitar",
  "Saxophone",
  "Trumpet",
  "Violin",
  "Other",
] as const;

export type BandApplicationRole = (typeof BAND_APPLICATION_ROLES)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HTML_PATTERN = /<[^>]*>/;

function assertUuid(value: string | undefined | null, message: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error(message);
  }
  return normalized;
}

export function normalizeBandApplicationSubmissionInput(bandId: string | undefined | null, requestedRole: string, message: string) {
  const normalizedBandId = assertUuid(bandId, "Choose a valid band before applying.");
  const normalizedRole = requestedRole.trim() || "Guitar";
  if (!BAND_APPLICATION_ROLES.includes(normalizedRole as BandApplicationRole)) {
    throw new Error("Choose a valid instrument role.");
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > BAND_APPLICATION_MESSAGE_MAX_LENGTH) {
    throw new Error(`Band application messages must be ${BAND_APPLICATION_MESSAGE_MAX_LENGTH} characters or fewer.`);
  }
  if (HTML_PATTERN.test(trimmedMessage)) {
    throw new Error("Band application messages must be plain text.");
  }
  return { bandId: normalizedBandId, requestedRole: normalizedRole, message: trimmedMessage };
}

export async function submitBandApplication(bandId: string, requestedRole: string, message: string): Promise<BandApplicationResult> {
  const normalized = normalizeBandApplicationSubmissionInput(bandId, requestedRole, message);
  const { data, error } = await (supabase.rpc as any)("submit_band_application", {
    band_id: normalized.bandId,
    requested_role: normalized.requestedRole,
    message: normalized.message,
  });

  if (error) {
    throw new Error(error.message || "Failed to submit band application.");
  }
  if (!data) {
    throw new Error("Band application could not be submitted.");
  }
  return data as BandApplicationResult;
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
