import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyFestivalSettlementBatch, getFestivalSettlementReadiness, getFestivalSettlementReport, prepareFestivalEditionSettlement } from './service';
import { festivalSettlementQueryKeys } from './queryKeys';

export const useFestivalSettlementReadiness = (editionId: string) => useQuery({ queryKey: festivalSettlementQueryKeys.readiness(editionId), queryFn: () => getFestivalSettlementReadiness(editionId), enabled: Boolean(editionId) });
export const useFestivalSettlementReport = (settlementId: string) => useQuery({ queryKey: festivalSettlementQueryKeys.report(settlementId), queryFn: () => getFestivalSettlementReport(settlementId), enabled: Boolean(settlementId) });

export const usePrepareFestivalSettlement = (editionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { expectedReadinessHash: string; idempotencyKey: string; adminOverrideReason?: string }) => prepareFestivalEditionSettlement(editionId, input.expectedReadinessHash, input.idempotencyKey, input.adminOverrideReason), onSuccess: () => queryClient.invalidateQueries({ queryKey: festivalSettlementQueryKeys.edition(editionId) }) });
};

export const useApplyFestivalSettlementBatch = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { settlementId: string; idempotencyKey: string }) => applyFestivalSettlementBatch(input.settlementId, input.idempotencyKey), onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: festivalSettlementQueryKeys.report(variables.settlementId) }) });
};
