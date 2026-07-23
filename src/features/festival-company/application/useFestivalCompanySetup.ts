import { useQuery } from "@tanstack/react-query";
import { getFestivalCompanySetup } from "../data/festivalCompanyRepository";

export const festivalCompanySetupQueryKey = (festivalCompanyId?: string) => ["festival-company-setup", festivalCompanyId] as const;

export const useFestivalCompanySetup = (festivalCompanyId?: string, enabled = true) => {
  return useQuery({
    queryKey: festivalCompanySetupQueryKey(festivalCompanyId),
    enabled: enabled && Boolean(festivalCompanyId),
    queryFn: () => {
      if (!festivalCompanyId) throw new Error("festival_company_not_found");
      return getFestivalCompanySetup(festivalCompanyId);
    },
    retry: false,
  });
};
