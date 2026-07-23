import { disabledFestivalCompanyCapabilities, type FestivalCompanyCapabilities } from "./festivalCapabilities";

export interface FestivalCompanyFoundingEligibility extends FestivalCompanyCapabilities {
  ownedCompanyCount: number;
  canFoundCompany: boolean;
  companyLimitReason: string;
  vipEligible: boolean;
  authoritativePersonalBalance: number;
  authoritativePersonalBalanceMinor: number;
  foundingCost: number;
  foundingCostMinor: number;
  canAfford: boolean;
}

export const disabledFestivalCompanyEligibility: FestivalCompanyFoundingEligibility = {
  ...disabledFestivalCompanyCapabilities,
  ownedCompanyCount: 0,
  canFoundCompany: false,
  companyLimitReason: "capabilities_unavailable",
  vipEligible: false,
  authoritativePersonalBalance: 0,
  authoritativePersonalBalanceMinor: 0,
  foundingCost: 2_000_000,
  foundingCostMinor: 200_000_000,
  canAfford: false,
};

const booleanOrFalse = (value: unknown) => typeof value === "boolean" ? value : false;
const numberOrDefault = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const parseFestivalCompanyEligibility = (value: unknown): FestivalCompanyFoundingEligibility => {
  if (!value || typeof value !== "object") return disabledFestivalCompanyEligibility;
  const candidate = value as Record<string, unknown>;
  return {
    newFestivalSystemEnabled: booleanOrFalse(candidate.newFestivalSystemEnabled),
    festivalCompanyCreationEnabled: booleanOrFalse(candidate.festivalCompanyCreationEnabled),
    festivalCompanyManagementEnabled: booleanOrFalse(candidate.festivalCompanyManagementEnabled),
    festivalConfigurationEnabled: booleanOrFalse(candidate.festivalConfigurationEnabled),
    companyLimit: numberOrDefault(candidate.companyLimit, 3),
    ownedCompanyCount: numberOrDefault(candidate.ownedCompanyCount, 0),
    canFoundCompany: booleanOrFalse(candidate.canFoundCompany),
    companyLimitReason: typeof candidate.companyLimitReason === "string" ? candidate.companyLimitReason : "capabilities_unavailable",
    vipEligible: booleanOrFalse(candidate.vipEligible),
    authoritativePersonalBalance: numberOrDefault(candidate.authoritativePersonalBalance, 0),
    authoritativePersonalBalanceMinor: numberOrDefault(candidate.authoritativePersonalBalanceMinor, 0),
    foundingCost: numberOrDefault(candidate.foundingCost, 2_000_000),
    foundingCostMinor: numberOrDefault(candidate.foundingCostMinor, 200_000_000),
    canAfford: booleanOrFalse(candidate.canAfford),
  };
};
