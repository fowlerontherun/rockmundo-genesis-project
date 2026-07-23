import type { FestivalCompanyCapabilities } from "./festivalCapabilities";

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
  capabilities: FestivalCompanyCapabilities;
}

export const festivalSetupErrorMessages: Record<string, string> = {
  festival_company_not_found: "Festival setup is unavailable.",
  festival_company_access_denied: "Festival setup is unavailable.",
  active_profile_required: "Choose an active character before opening festival setup.",
  festival_creation_disabled: "Festival company creation is paused, but management may still be available.",
  festival_system_disabled: "The replacement festival system is currently unavailable.",
  festival_management_disabled: "Festival company management is currently unavailable.",
};

export const mapFestivalSetupError = (message?: string): string => {
  const code = Object.keys(festivalSetupErrorMessages).find((key) => message?.includes(key));
  return code ? festivalSetupErrorMessages[code] : "Festival setup is unavailable.";
};
