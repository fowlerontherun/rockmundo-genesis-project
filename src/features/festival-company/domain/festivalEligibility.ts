import { disabledFestivalCompanyCapabilities, parseFestivalCompanyCapabilities, type FestivalCompanyCapabilities } from "./festivalCapabilities";

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

const isFiniteNonNegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isIntegerNonNegative = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;

export const parseFestivalCompanyEligibility = (value: unknown): FestivalCompanyFoundingEligibility => {
  if (!value || typeof value !== "object") return disabledFestivalCompanyEligibility;
  const candidate = value as Record<string, unknown>;
  const caps = parseFestivalCompanyCapabilities(candidate);
  if (caps === disabledFestivalCompanyCapabilities
    || !isIntegerNonNegative(candidate.ownedCompanyCount)
    || typeof candidate.canFoundCompany !== "boolean"
    || typeof candidate.companyLimitReason !== "string"
    || candidate.companyLimitReason.trim().length === 0
    || typeof candidate.vipEligible !== "boolean"
    || !isFiniteNonNegative(candidate.authoritativePersonalBalance)
    || !isIntegerNonNegative(candidate.authoritativePersonalBalanceMinor)
    || !isFiniteNonNegative(candidate.foundingCost)
    || !isIntegerNonNegative(candidate.foundingCostMinor)
    || candidate.foundingCost !== 2_000_000
    || candidate.foundingCostMinor !== 200_000_000
    || typeof candidate.canAfford !== "boolean") {
    return disabledFestivalCompanyEligibility;
  }
  return { ...caps, ownedCompanyCount: candidate.ownedCompanyCount, canFoundCompany: candidate.canFoundCompany, companyLimitReason: candidate.companyLimitReason, vipEligible: candidate.vipEligible, authoritativePersonalBalance: candidate.authoritativePersonalBalance, authoritativePersonalBalanceMinor: candidate.authoritativePersonalBalanceMinor, foundingCost: candidate.foundingCost, foundingCostMinor: candidate.foundingCostMinor, canAfford: candidate.canAfford };
};
