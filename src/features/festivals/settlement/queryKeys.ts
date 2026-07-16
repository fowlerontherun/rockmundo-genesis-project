export const festivalSettlementQueryKeys = {
  all: ['festivals', 'settlement'] as const,
  edition: (editionId: string) => [...festivalSettlementQueryKeys.all, 'edition', editionId] as const,
  report: (settlementId: string) => [...festivalSettlementQueryKeys.all, 'report', settlementId] as const,
  readiness: (editionId: string) => [...festivalSettlementQueryKeys.all, 'readiness', editionId] as const,
};
