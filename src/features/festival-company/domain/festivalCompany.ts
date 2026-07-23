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
}

export const festivalFoundingErrorMessages: Record<string, string> = {
  festival_vip_required: "An active VIP subscription is required to found a festival company.",
  insufficient_personal_funds: "You need $2,000,000 in available personal cash to found a festival company.",
  festival_primary_financial_account_required: "Your active character needs a personal cash account before founding a festival company.",
  festival_name_taken: "That festival name is already taken. Choose a different public name.",
  company_limit_reached: "You have reached the company ownership limit.",
  festival_request_in_progress: "A matching festival founding request is still processing. Please retry in a moment.",
  profile_not_eligible: "Your active profile is not eligible to make transactions.",
  active_profile_required: "Choose an active character before founding a festival company.",
  festival_creation_disabled: "Festival company creation is not enabled yet.",
  idempotency_conflict: "This submission key was already used with different details. Please try again.",
  invalid_festival_name: "Enter valid company and festival names.",
};

export const mapFestivalFoundingError = (message?: string): string => {
  const code = Object.keys(festivalFoundingErrorMessages).find((key) => message?.includes(key));
  return code ? festivalFoundingErrorMessages[code] : "Festival company founding failed. Please try again.";
};
