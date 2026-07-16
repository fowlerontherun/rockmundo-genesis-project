export type FestivalLifecycleState =
  | "concept" | "planning" | "applications_open" | "booking" | "announced" | "on_sale"
  | "setup" | "live" | "settling" | "completed" | "postponed" | "cancelled" | "abandoned";

export type FestivalDataHealthIssue = {
  code: string;
  severity: "warning" | "blocker";
  message: string;
};

export type AdminFestivalCatalogueRow = {
  festivalId: string;
  brandName: string;
  ownerName: string | null;
  cityName: string | null;
  currentEditionId: string | null;
  currentEditionTitle: string | null;
  nextEditionId: string | null;
  completedEditionId: string | null;
  editionCount: number;
  lifecycleState: FestivalLifecycleState | null;
  stageCount: number;
  activeContractCount: number;
  performanceSessionCount: number;
  outcomeCount: number;
  attendance: number | null;
  currencyCode: string;
  projectedFinanceCents: number;
  actualFinanceCents: number;
  legacyMappings: number;
  operationalReadiness: "missing_edition" | "needs_stages" | "needs_contracts" | "ready";
  dataHealthWarnings: FestivalDataHealthIssue[];
};

export type AdminBrandInput = {
  name: string;
  homeCityId?: string | null;
  description?: string | null;
  genre?: string | null;
  scale?: string | null;
  brandType?: string | null;
  recurringPolicy?: string | null;
  ownerProfileId?: string | null;
  publicMetadata?: Record<string, unknown>;
  idempotencyKey: string;
};

export type AdminEditionInput = {
  festivalId: string;
  title: string;
  startAt: string;
  endAt: string;
  cityId?: string | null;
  capacity?: number | null;
  expectedAttendance?: number | null;
  minimumTicketPriceCents?: number | null;
  maximumTicketPriceCents?: number | null;
  idempotencyKey: string;
};

export type OwnerEditionOption = {
  id: string;
  festivalId: string;
  title: string;
  editionNumber: number;
  status: FestivalLifecycleState;
  startAt: string | null;
  endAt: string | null;
  cityName: string | null;
  currencyCode: string;
};

export type PermissionRole = "platform_admin" | "festival_owner" | "delegated_manager" | "talent_booker" | "finance_manager" | "operations_manager" | "stage_manager" | "safety_officer";

export type PermissionProjection = Record<"manageBrand" | "manageEdition" | "manageLifecycle" | "manageLineup" | "manageFinance" | "manageOperations" | "viewOutcomes", boolean>;

export type StageInput = {
  editionId: string;
  name: string;
  type?: string;
  capacity?: number;
  genreFocus?: string | null;
  stageSize?: string | null;
  soundCapability?: string | null;
  lightingCapability?: string | null;
  backstageCapability?: string | null;
  weatherProtection?: string | null;
  changeoverDuration?: number;
  curfew?: string | null;
  technicalMetadata?: Record<string, unknown>;
  publicMetadata?: Record<string, unknown>;
  idempotencyKey: string;
};

export type SlotTemplate = {
  type: "opener" | "support" | "headline" | "dj_intermission" | "host" | "flexible" | "reserved_emergency";
  start_time: string;
  duration_minutes: number;
};

export type SlotGenerationInput = {
  stageId: string;
  date: string;
  openingTime: string;
  curfew: string;
  templates: SlotTemplate[];
  changeoverDuration?: number;
  soundcheckPolicy?: Record<string, unknown>;
  idempotencyKey: string;
  apply?: boolean;
};

export type StaffHireInput = {
  editionId: string;
  candidateId: string;
  role: string;
  wageCents: number;
  assignmentScope?: Record<string, unknown>;
  shiftStartAt?: string | null;
  shiftEndAt?: string | null;
  idempotencyKey: string;
};
