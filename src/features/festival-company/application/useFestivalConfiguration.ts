import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { completeFestivalSetup, getFestivalConfiguration, saveFestivalConfiguration } from "../data/festivalCompanyRepository";
import type { FestivalConfigurationDraft } from "../domain/festivalConfiguration";

export const festivalConfigurationQueryKey = (id?: string) => ["festival-configuration", id] as const;
export const useFestivalConfiguration = (id?: string, enabled = true) => useQuery({ queryKey: festivalConfigurationQueryKey(id), enabled: enabled && Boolean(id), retry: false, queryFn: () => getFestivalConfiguration(id!) });
export const useSaveFestivalConfiguration = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { festivalCompanyId: string; expectedVersion: number; configuration: FestivalConfigurationDraft; idempotencyKey: string }) => {
      if (!input.configuration.complete) return saveFestivalConfiguration(input);
      // Completion is authoritative. A follow-up read failure must not turn a
      // successfully created edition into a reported failed mutation.
      return completeFestivalSetup(input);
    },
    onSuccess: (data) => {
      // The edition result is not the configuration document; refresh separately.
      void client.invalidateQueries({ queryKey: festivalConfigurationQueryKey(data.festivalCompanyId) });
      void Promise.all(["festival-company-setup", "owned-festival-companies", "companies", "festival-company-capabilities"].map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
  });
};
