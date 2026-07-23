import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFestivalFeatureFlags } from "../config/featureFlags";
import { foundFestivalCompany } from "../data/festivalCompanyRepository";
import { festivalCompanyCapabilitiesQueryKey, festivalCompanyFoundingEligibilityQueryKey, ownedFestivalCompaniesQueryKey } from "./useFestivalCompanyCapabilities";
import { festivalCompanySetupQueryKey } from "./useFestivalCompanySetup";
import { mapFestivalFoundingError, type FoundFestivalCompanyInput } from "../domain/festivalCompany";

export const useFoundFestivalCompany = () => {
  const flags = useFestivalFeatureFlags();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: FoundFestivalCompanyInput) => {
      if (!flags.newFestivalSystemEnabled || !flags.festivalCreationEnabled) {
        throw new Error("festival_creation_disabled");
      }
      return foundFestivalCompany(input);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ownedFestivalCompaniesQueryKey });
      queryClient.invalidateQueries({ queryKey: festivalCompanyFoundingEligibilityQueryKey });
      queryClient.invalidateQueries({ queryKey: festivalCompanyCapabilitiesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: festivalCompanySetupQueryKey(result.festivalCompanyId) });
      toast.success("Festival company founded", {
        description: "The founding fee was charged from personal cash. Company balance starts at $0.",
      });
      navigate(`/companies/festivals/${result.festivalCompanyId}/setup`);
    },
    onError: (error: Error) => {
      toast.error("Could not found festival company", {
        description: mapFestivalFoundingError(error.message),
      });
    },
  });
};
