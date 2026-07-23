export const FESTIVAL_FOUNDING_COST = 2_000_000;

export interface FoundFestivalCompanyInput {
  companyName: string;
  publicName: string;
  description?: string;
  idempotencyKey: string;
}

export interface FoundFestivalCompanyResult {
  companyId: string;
  festivalCompanyId: string;
  personalCash: number;
  foundingCost: number;
  idempotent: boolean;
  personalFinancialTransactionId?: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isFiniteNonNegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;

export const parseFoundFestivalCompanyResult = (value: unknown): FoundFestivalCompanyResult => {
  if (!value || typeof value !== "object") throw new Error("malformed_festival_founding_result");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.companyId !== "string" || !uuidPattern.test(candidate.companyId)) throw new Error("malformed_festival_founding_result");
  if (typeof candidate.festivalCompanyId !== "string" || !uuidPattern.test(candidate.festivalCompanyId)) throw new Error("malformed_festival_founding_result");
  if (!isFiniteNonNegative(candidate.personalCash) || !isFiniteNonNegative(candidate.foundingCost) || candidate.foundingCost !== FESTIVAL_FOUNDING_COST) throw new Error("malformed_festival_founding_result");
  if (typeof candidate.idempotent !== "boolean") throw new Error("malformed_festival_founding_result");
  if (candidate.personalFinancialTransactionId !== undefined && (typeof candidate.personalFinancialTransactionId !== "string" || !uuidPattern.test(candidate.personalFinancialTransactionId))) throw new Error("malformed_festival_founding_result");
  return { companyId: candidate.companyId, festivalCompanyId: candidate.festivalCompanyId, personalCash: candidate.personalCash, foundingCost: candidate.foundingCost, idempotent: candidate.idempotent, personalFinancialTransactionId: candidate.personalFinancialTransactionId };
};

export const festivalFoundingErrorMessages: Record<string, string> = {
  festival_vip_required: "An active VIP subscription is required to found a festival company.",
  insufficient_personal_funds: "You need $2,000,000 in personal cash to found a festival company.",
  festival_name_taken: "That festival name is already taken. Choose a different public name.",
  company_limit_reached: "You have reached the company ownership limit.",
  festival_request_in_progress: "A matching festival founding request is still processing. Please retry in a moment.",
  profile_not_eligible: "Your active profile is not eligible to make transactions.",
  active_profile_required: "Choose an active character before founding a festival company.",
  festival_creation_disabled: "Festival company creation is not enabled yet.",
  idempotency_conflict: "This submission key was already used with different details. Please try again.",
  invalid_festival_name: "Enter valid company and festival names.",
  malformed_festival_founding_result: "Festival company founding returned an invalid response. Please retry.",
};

export const mapFestivalFoundingError = (message?: string): string => {
  const code = Object.keys(festivalFoundingErrorMessages).find((key) => message?.includes(key));
  return code ? festivalFoundingErrorMessages[code] : "Festival company founding failed. Please try again.";
};
