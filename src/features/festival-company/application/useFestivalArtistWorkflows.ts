import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as repository from "../data/festivalCompanyRepository";
import {
  createFestivalEditionArtistOffer,
  searchFestivalEditionArtistCandidates,
  sendFestivalEditionArtistInvitation,
  sendFestivalEditionArtistOffer,
} from "@/features/festivals/projections/repository";

export const festivalArtistOpportunitiesKey = [
  "festival-artist-opportunities",
] as const;

export const useFestivalArtistOpportunities = () =>
  useQuery({
    queryKey: festivalArtistOpportunitiesKey,
    queryFn: repository.getMyFestivalArtistOpportunities,
    retry: false,
  });

export const useFestivalArtistCandidates = (input: {
  festivalCompanyId: string;
  festivalEditionId?: string;
  query?: string;
}) =>
  useQuery({
    queryKey: ["festival-artist-candidates", input],
    queryFn: () =>
      input.festivalEditionId
        ? searchFestivalEditionArtistCandidates({
            festivalCompanyId: input.festivalCompanyId,
            festivalEditionId: input.festivalEditionId,
            query: input.query,
          })
        : repository.searchFestivalArtistCandidates(input),
    enabled: Boolean(input.festivalCompanyId),
    retry: false,
  });

const factories = {
  submitApplication: repository.submitFestivalArtistApplication,
  withdrawApplication: repository.withdrawFestivalArtistApplication,
  reviewApplication: repository.reviewFestivalArtistApplication,
  sendInvitation: repository.sendFestivalArtistInvitation,
  respondInvitation: repository.respondToFestivalArtistInvitation,
  createOffer: repository.createFestivalArtistOffer,
  sendOffer: repository.sendFestivalArtistOffer,
  counterOffer: repository.counterFestivalArtistOffer,
  respondOffer: repository.respondToFestivalArtistOffer,
  withdrawOffer: repository.withdrawFestivalArtistOffer,
  cancelBooking: repository.cancelFestivalArtistBooking,
};

const invalidateArtistState = async (
  client: ReturnType<typeof useQueryClient>,
) => {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["festival-artist-programme"] }),
    client.invalidateQueries({ queryKey: ["festival-artist-candidates"] }),
    client.invalidateQueries({ queryKey: festivalArtistOpportunitiesKey }),
    client.invalidateQueries({ queryKey: ["festival-company-setup"] }),
    client.invalidateQueries({ queryKey: ["festival-company-editions"] }),
    client.invalidateQueries({ queryKey: ["notifications"] }),
    client.invalidateQueries({ queryKey: ["mail"] }),
  ]);
};

export const useFestivalArtistAction = (action: keyof typeof factories) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["festival-artist-action", action],
    mutationFn: (input: Record<string, unknown>) =>
      (factories[action] as (payload: any) => Promise<unknown>)(input),
    onSuccess: () => invalidateArtistState(client),
  });
};

const editionFactories = {
  sendInvitation: sendFestivalEditionArtistInvitation,
  createOffer: createFestivalEditionArtistOffer,
  sendOffer: sendFestivalEditionArtistOffer,
};

export const useFestivalEditionArtistAction = (
  action: keyof typeof editionFactories,
) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["festival-edition-artist-action", action],
    mutationFn: (input: Record<string, unknown>) =>
      (editionFactories[action] as (payload: any) => Promise<unknown>)(input),
    onSuccess: () => invalidateArtistState(client),
  });
};
