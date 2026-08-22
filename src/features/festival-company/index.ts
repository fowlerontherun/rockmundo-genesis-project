export {
  festivalFeatureFlags,
  resolveFestivalFeatureFlags,
  useFestivalFeatureFlags,
} from "./config/featureFlags";
export type { FestivalFeatureFlags } from "./config/featureFlags";
export { LegacyFestivalGate } from "./ui/LegacyFestivalGate";
export { FestivalRebuildingScreen } from "./ui/FestivalRebuildingScreen";

export { FestivalCompanyEligibilityCard } from "./ui/FestivalCompanyEligibilityCard";
export { useFestivalCompanyCapabilities, useFestivalCompanyFoundingEligibility, useOwnedFestivalCompanies } from "./application/useFestivalCompanyCapabilities";
export type { OwnedFestivalCompanySummary } from "./data/festivalCompanyRepository";
export { FestivalCompanyCard } from "./ui/FestivalCompanyCard";

export * from "./domain/festivalSitePlan";
export * from "./domain/festivalTicketPlan";
export * from "./domain/festivalArtistProgramme";
export * from "./application/useFestivalArtistProgramme";
export * from "./domain/festivalTicketForecast";
export * from "./domain/festivalTicketValidation";
export * from "./domain/festivalSitePlanValidation";
export * from "./application/useFestivalSitePlan";

// Detailed operations remain available to the server/domain layer as compatibility
// machinery, but their retired owner-facing planner components are deliberately
// not exported from the Festival-company public UI surface.
export { parseFestivalOperationsResult, FESTIVAL_OPERATIONS_ERROR } from "./domain/festivalOperationsPlan";
export type { FestivalOperationsDraft, FestivalOperationsIssue, FestivalOperationsPlan, FestivalOperationsResult, FestivalOperationsStatus, OperationsBudgetSummary, OperationsQualityScores } from "./domain/festivalOperationsPlan";
export * from "./application/useFestivalOperations";
export * from "./domain/festivalSponsorship";
export * from "./application/useFestivalSponsorship";

export * from "./domain/festivalTimetablePlan";
export * from "./application/useFestivalTimetable";
export * from "./domain/festivalLaunch";
export * from "./application/useFestivalLaunch";
export * from "./domain/festivalRuntime";
export * from "./data/festivalRuntimeRepository";
export * from "./application/useFestivalRuntime";
export * from "./performance/festivalGigAdapter";
export * from "./ui/FestivalRuntimeViews";
export { parseFestivalSettlement, parseFestivalSettlementLine, parseFestivalSettlementLines, parseFestivalParticipantStatement, parseFestivalSettlementSummary } from "./domain/festivalSettlement";
export type { FestivalSettlement, FestivalSettlementLine, FestivalSettlementSummary, FestivalParticipantStatement } from "./domain/festivalSettlement";
export * from "./data/festivalSettlementRepository";
export * from "./application/useFestivalSettlement";
export * from "./ui/FestivalSettlementView";