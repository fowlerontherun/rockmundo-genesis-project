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

const isFiniteNonNegative = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0;
const isNonNegativeInteger = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 0;

export const parseFestivalCompanyEligibility = (value: unknown): FestivalCompanyFoundingEligibility => {
  if (!value || typeof value !== "object") return disabledFestivalCompanyEligibility;
  const candidate = value as Record<string, unknown>;
  const valid = typeof candidate.newFestivalSystemEnabled === "boolean"
    && typeof candidate.festivalCompanyCreationEnabled === "boolean"
    && typeof candidate.festivalCompanyManagementEnabled === "boolean"
    && typeof candidate.festivalConfigurationEnabled === "boolean"
    && isNonNegativeInteger(candidate.companyLimit)
    && isNonNegativeInteger(candidate.ownedCompanyCount)
    && typeof candidate.canFoundCompany === "boolean"
    && typeof candidate.companyLimitReason === "string"
    && typeof candidate.vipEligible === "boolean"
    && isFiniteNonNegative(candidate.authoritativePersonalBalance)
    && isNonNegativeInteger(candidate.authoritativePersonalBalanceMinor)
    && isFiniteNonNegative(candidate.foundingCost)
    && isNonNegativeInteger(candidate.foundingCostMinor)
    && typeof candidate.canAfford === "boolean";
  if (!valid) return disabledFestivalCompanyEligibility;
  return {
    newFestivalSystemEnabled: candidate.newFestivalSystemEnabled,
    festivalCompanyCreationEnabled: candidate.festivalCompanyCreationEnabled,
    festivalCompanyManagementEnabled: candidate.festivalCompanyManagementEnabled,
    festivalConfigurationEnabled: candidate.festivalConfigurationEnabled,
    companyLimit: Number(candidate.companyLimit),
    ownedCompanyCount: Number(candidate.ownedCompanyCount),
    canFoundCompany: candidate.canFoundCompany,
    companyLimitReason: candidate.companyLimitReason,
    vipEligible: candidate.vipEligible,
    authoritativePersonalBalance: Number(candidate.authoritativePersonalBalance),
    authoritativePersonalBalanceMinor: Number(candidate.authoritativePersonalBalanceMinor),
    foundingCost: Number(candidate.foundingCost),
    foundingCostMinor: Number(candidate.foundingCostMinor),
    canAfford: candidate.canAfford,
  };
};
