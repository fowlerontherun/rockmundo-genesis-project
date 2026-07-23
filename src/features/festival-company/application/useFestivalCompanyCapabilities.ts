import { useQuery } from "@tanstack/react-query";
import { getFestivalCompanyCapabilities, getFestivalCompanyFoundingEligibility, getOwnedFestivalCompanies } from "../data/festivalCompanyRepository";

export const festivalCompanyCapabilitiesQueryKey = ["festival-company-capabilities"] as const;
export const festivalCompanyFoundingEligibilityQueryKey = ["festival-company-founding-eligibility"] as const;
export const ownedFestivalCompaniesQueryKey = ["owned-festival-companies"] as const;

export const useFestivalCompanyCapabilities = () => useQuery({
  queryKey: festivalCompanyCapabilitiesQueryKey,
  queryFn: getFestivalCompanyCapabilities,
});

export const useFestivalCompanyFoundingEligibility = () => useQuery({
  queryKey: festivalCompanyFoundingEligibilityQueryKey,
  queryFn: getFestivalCompanyFoundingEligibility,
});

export const useOwnedFestivalCompanies = () => useQuery({
  queryKey: ownedFestivalCompaniesQueryKey,
  queryFn: getOwnedFestivalCompanies,
});
