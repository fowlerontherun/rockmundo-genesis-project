export type FestivalSetupStatus = "setup" | "active" | "paused" | "retired";
export type FestivalCompanyStatus = "active" | "suspended" | "bankrupt" | "dissolved";

export interface FestivalCompanySetupState {
  festivalCompanyId: string;
  companyId: string;
  publicName: string;
  legalCompanyName: string;
  companyBalance: number;
  setupStatus: FestivalSetupStatus;
  setupCompleted: boolean;
  ownerProfileId: string;
  ownerDisplayName: string;
  foundedAt: string;
  companyStatus: FestivalCompanyStatus;
  isBankrupt: boolean;
  configurationComplete: boolean;
  firstEditionExists: boolean;
}

export const festivalSetupErrorMessages: Record<string, string> = {
  festival_company_not_found: "Festival setup is unavailable.",
  festival_company_access_denied: "Festival setup is unavailable.",
  active_profile_required: "Choose an active character before opening festival setup.",
  festival_creation_disabled: "Festival setup is disabled while the festival rollout is paused.",
};

export const mapFestivalSetupError = (message?: string): string => {
  const code = Object.keys(festivalSetupErrorMessages).find((key) => message?.includes(key));
  return code ? festivalSetupErrorMessages[code] : "Festival setup is unavailable.";
};
