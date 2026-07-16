export const festivalAdminQueryKeys = {
  catalogue: ["festivals", "admin", "catalogue"] as const,
  cityCoverage: ["festivals", "admin", "city-coverage"] as const,
  ownerEditions: (festivalId: string) => ["festivals", "owner", festivalId, "editions"] as const,
  settlementReadiness: (editionId: string) => ["festivals", "edition", editionId, "settlement-readiness"] as const,
};
