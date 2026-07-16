export const festivalAdminQueryKeys = {
  catalogue: ["festivals", "admin", "catalogue"] as const,
  cityCoverage: ["festivals", "admin", "city-coverage"] as const,
  ownerEditions: (festivalId: string) => ["festivals", "owner", festivalId, "editions"] as const,
  settlementReadiness: (editionId: string) => ["festivals", "edition", editionId, "settlement-readiness"] as const,
  operations: (scope: string, editionId: string) => ["festivals", scope, "edition", editionId, "operations"] as const,
  finance: (scope: string, editionId: string) => ["festivals", scope, "edition", editionId, "finance"] as const,
  dataHealth: ["festivals", "admin", "data-health"] as const,
  legacyRecords: ["festivals", "admin", "legacy-records"] as const,
  audit: (filters: Record<string, string>) => ["festivals", "admin", "audit", filters] as const,
};
