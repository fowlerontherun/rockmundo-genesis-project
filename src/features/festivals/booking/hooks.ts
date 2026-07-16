import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { festivalBookingKeys } from "./bookingTypes";
import {
  getBandApplications,
  listOrganiserApplications,
  submitFestivalApplication,
  withdrawFestivalApplication,
  reviewFestivalApplication,
} from "./applications";
import {
  acceptFestivalOffer,
  counterFestivalOffer,
  createFestivalOffer,
  declineFestivalOffer,
  listFestivalOffers,
} from "./offers";
import {
  getFestivalContract,
  listBandContracts,
  signFestivalContract,
} from "./contracts";
import {
  lockFestivalSetlist,
  reviewFestivalSetlist,
  saveFestivalSetlistDraft,
  submitFestivalSetlist,
} from "./setlists";
import type { FestivalSetlistItemInput } from "./bookingTypes";
import type { FestivalApplicationRecord, FestivalOfferRecord } from "./domainTypes";
import {
  getFestivalApplicationEligibility,
  listFestivalBookingSlots,
  listFestivalContractRepertoire,
  listFestivalInvitationCandidates,
  listFestivalRepresentedBands,
  preflightFestivalSetlist,
} from "./projections";

export function useFestivalApplications(
  bandId?: string,
  editionId?: string,
  profileId?: string,
) {
  return useQuery({
    queryKey: festivalBookingKeys.bandApplications(
      bandId,
      editionId,
      profileId,
    ),
    queryFn: () => getBandApplications(bandId!, editionId),
    enabled: Boolean(bandId),
  });
}

export function useFestivalApplicationActions(
  bandId?: string,
  editionId?: string,
) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: festivalBookingKeys.bandApplications(bandId, editionId),
    });
  return {
    submitApplication: useMutation({
      mutationFn: submitFestivalApplication,
      onSuccess: invalidate,
    }),
    withdrawApplication: useMutation({
      mutationFn: ({
        applicationId,
        reason,
        idempotencyKey,
      }: {
        applicationId: string;
        reason: string;
        idempotencyKey: string;
      }) => withdrawFestivalApplication(applicationId, reason, idempotencyKey),
      onSuccess: invalidate,
    }),
    reviewApplication: useMutation({
      mutationFn: reviewFestivalApplication,
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root }),
    }),
  };
}

export function useOrganiserFestivalApplications(editionId?: string) {
  return useQuery({
    queryKey: festivalBookingKeys.organiserApplications(editionId),
    queryFn: () => listOrganiserApplications(editionId!) as Promise<FestivalApplicationRecord[]>,
    enabled: Boolean(editionId),
  });
}

export function useFestivalOffers(bandId?: string, editionId?: string) {
  return useQuery({
    queryKey: festivalBookingKeys.offers(bandId, editionId),
    queryFn: () => listFestivalOffers(bandId, editionId) as Promise<FestivalOfferRecord[]>,
    enabled: Boolean(bandId || editionId),
  });
}

export function useFestivalOfferActions(bandId?: string, editionId?: string) {
  const queryClient = useQueryClient();
  const invalidateOffers = () =>
    queryClient.invalidateQueries({
      queryKey: festivalBookingKeys.offers(bandId, editionId),
    });
  return {
    createOffer: useMutation({
      mutationFn: createFestivalOffer,
      onSuccess: invalidateOffers,
    }),
    counterOffer: useMutation({
      mutationFn: counterFestivalOffer,
      onSuccess: invalidateOffers,
    }),
    acceptOffer: useMutation({
      mutationFn: ({
        offerId,
        revision,
        idempotencyKey,
      }: {
        offerId: string;
        revision: number;
        idempotencyKey: string;
      }) => acceptFestivalOffer(offerId, revision, idempotencyKey),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: festivalBookingKeys.root }),
    }),
    declineOffer: useMutation({
      mutationFn: ({
        offerId,
        reason,
        idempotencyKey,
      }: {
        offerId: string;
        reason: string;
        idempotencyKey: string;
      }) => declineFestivalOffer(offerId, reason, idempotencyKey),
      onSuccess: invalidateOffers,
    }),
  };
}

export function useFestivalContracts(bandId?: string) {
  return useQuery({
    queryKey: festivalBookingKeys.contracts(bandId),
    queryFn: () => listBandContracts(bandId!),
    enabled: Boolean(bandId),
  });
}

export function useFestivalContract(contractId?: string) {
  return useQuery({
    queryKey: festivalBookingKeys.contracts(undefined, contractId),
    queryFn: () => getFestivalContract(contractId!),
    enabled: Boolean(contractId),
  });
}

export function useFestivalContractActions(contractId?: string) {
  const queryClient = useQueryClient();
  return {
    signContract: useMutation({
      mutationFn: signFestivalContract,
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: festivalBookingKeys.contracts(undefined, contractId),
        }),
    }),
  };
}

export function useFestivalSetlist(contractId?: string) {
  const queryClient = useQueryClient();
  const invalidateSetlist = () =>
    queryClient.invalidateQueries({
      queryKey: festivalBookingKeys.setlist(contractId),
    });
  return {
    saveDraft: useMutation({
      mutationFn: saveFestivalSetlistDraft,
      onSuccess: invalidateSetlist,
    }),
    submitSetlist: useMutation({
      mutationFn: ({
        setlistId,
        idempotencyKey,
      }: {
        setlistId: string;
        idempotencyKey: string;
      }) => submitFestivalSetlist(setlistId, idempotencyKey),
      onSuccess: invalidateSetlist,
    }),
    reviewSetlist: useMutation({
      mutationFn: ({
        setlistId,
        action,
        reason,
        idempotencyKey,
      }: {
        setlistId: string;
        action: "approve" | "request_changes";
        reason?: string;
        idempotencyKey: string;
      }) => reviewFestivalSetlist(setlistId, action, reason, idempotencyKey),
      onSuccess: invalidateSetlist,
    }),
    lockSetlist: useMutation({
      mutationFn: ({
        setlistId,
        idempotencyKey,
      }: {
        setlistId: string;
        idempotencyKey: string;
      }) => lockFestivalSetlist(setlistId, idempotencyKey),
      onSuccess: invalidateSetlist,
    }),
  };
}

export function useFestivalRepresentedBands() {
  return useQuery({
    queryKey: [...festivalBookingKeys.root, "represented-bands"],
    queryFn: listFestivalRepresentedBands,
  });
}

export function useFestivalApplicationEligibility(
  editionId?: string,
  bandId?: string,
) {
  return useQuery({
    queryKey: [
      ...festivalBookingKeys.root,
      "eligibility",
      editionId ?? "none",
      bandId ?? "none",
    ],
    queryFn: () => getFestivalApplicationEligibility(editionId!, bandId!),
    enabled: Boolean(editionId && bandId),
  });
}

export function useFestivalInvitationCandidates(
  editionId?: string,
  search?: string,
) {
  return useQuery({
    queryKey: [
      ...festivalBookingKeys.organiserWorkspace(editionId),
      "invitation-candidates",
      search ?? "",
    ],
    queryFn: () => listFestivalInvitationCandidates(editionId!, search),
    enabled: Boolean(editionId),
  });
}

export function useFestivalBookingSlots(editionId?: string) {
  return useQuery({
    queryKey: [...festivalBookingKeys.organiserWorkspace(editionId), "slots"],
    queryFn: () => listFestivalBookingSlots(editionId!),
    enabled: Boolean(editionId),
  });
}

export function useFestivalContractRepertoire(contractId?: string) {
  return useQuery({
    queryKey: [...festivalBookingKeys.setlist(contractId), "repertoire"],
    queryFn: () => listFestivalContractRepertoire(contractId!),
    enabled: Boolean(contractId),
  });
}

export function useFestivalSetlistPreflight(
  contractId: string | undefined,
  items: FestivalSetlistItemInput[],
) {
  return useQuery({
    queryKey: [
      ...festivalBookingKeys.setlist(contractId),
      "preflight",
      JSON.stringify(items),
    ],
    queryFn: () => preflightFestivalSetlist(contractId!, items),
    enabled: Boolean(contractId),
  });
}
