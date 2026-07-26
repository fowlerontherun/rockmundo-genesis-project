import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFestivalConfiguration, saveFestivalConfiguration } from "../data/festivalCompanyRepository";
import type { FestivalConfigurationDraft } from "../domain/festivalConfiguration";

export const festivalConfigurationQueryKey = (id?: string) => ["festival-configuration", id] as const;
export const useFestivalConfiguration = (id?: string, enabled = true) => useQuery({ queryKey: festivalConfigurationQueryKey(id), enabled: enabled && Boolean(id), retry: false, queryFn: () => getFestivalConfiguration(id!) });
export const useSaveFestivalConfiguration = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { festivalCompanyId: string; expectedVersion: number; configuration: FestivalConfigurationDraft; idempotencyKey: string }) => saveFestivalConfiguration(input),
    onSuccess: (data) => {
      client.setQueryData(festivalConfigurationQueryKey(data.festivalCompanyId), data);
      void Promise.all(["festival-company-setup", "owned-festival-companies", "companies", "festival-company-capabilities"].map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
  });
};
