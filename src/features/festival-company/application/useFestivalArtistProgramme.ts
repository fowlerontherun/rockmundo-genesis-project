import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFestivalArtistProgramme,
  saveFestivalArtistProgramme,
} from "../data/festivalCompanyRepository";
import {
  getFestivalEditionArtistProgramme,
  saveFestivalEditionArtistProgramme,
} from "@/features/festivals/projections/repository";
import type {
  FestivalApplicationWindow,
  FestivalArtistProgramme,
} from "../domain/festivalArtistProgramme";

export const festivalArtistProgrammeQueryKey = (
  festivalCompanyId?: string,
  festivalEditionId?: string,
) => [
  "festival-artist-programme",
  festivalCompanyId,
  festivalEditionId ?? "company",
] as const;

export const useFestivalArtistProgramme = (
  festivalCompanyId?: string,
  festivalEditionIdOrEnabled?: string | boolean,
  enabled = true,
) => {
  const festivalEditionId =
    typeof festivalEditionIdOrEnabled === "string"
      ? festivalEditionIdOrEnabled
      : undefined;
  const queryEnabled =
    typeof festivalEditionIdOrEnabled === "boolean"
      ? festivalEditionIdOrEnabled
      : enabled;

  return useQuery({
    queryKey: festivalArtistProgrammeQueryKey(
      festivalCompanyId,
      festivalEditionId,
    ),
    enabled: queryEnabled && Boolean(festivalCompanyId),
    retry: false,
    queryFn: () =>
      festivalEditionId
        ? getFestivalEditionArtistProgramme(
            festivalCompanyId!,
            festivalEditionId,
          )
        : getFestivalArtistProgramme(festivalCompanyId!),
  });
};

export const useSaveFestivalArtistProgramme = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      festivalCompanyId: string;
      festivalEditionId?: string;
      expectedVersion: number;
      programme: FestivalArtistProgramme;
      applicationWindows: FestivalApplicationWindow[];
      idempotencyKey: string;
      complete?: boolean;
    }) =>
      input.festivalEditionId
        ? saveFestivalEditionArtistProgramme({
            ...input,
            festivalEditionId: input.festivalEditionId,
          })
        : saveFestivalArtistProgramme(input),
    onSuccess: (data, input) => {
      client.setQueryData(
        festivalArtistProgrammeQueryKey(
          data.festivalCompanyId,
          input.festivalEditionId,
        ),
        data,
      );
      void Promise.all(
        [
          ["festival-company-setup"],
          ["owned-festival-companies"],
          [
            "festival-ticket-plan",
            data.festivalCompanyId,
            input.festivalEditionId ?? "company",
          ],
          ["festival-opportunities"],
          ["festival-company-editions", data.festivalCompanyId],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
};
