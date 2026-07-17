export type FestivalLifecycleState =
  | "concept"
  | "planning"
  | "applications_open"
  | "booking"
  | "announced"
  | "on_sale"
  | "setup"
  | "live"
  | "settling"
  | "completed"
  | "postponed"
  | "cancelled"
  | "abandoned";

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
  operationalReadiness:
    | "missing_edition"
    | "needs_stages"
    | "needs_contracts"
    | "ready";
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

export type OwnerManagementBootstrapStatus =
  | "ready"
  | "no_editions"
  | "not_found"
  | "access_denied"
  | "migration_blocked"
  | "unauthenticated"
  | "rpc_unavailable";

export type OwnerManagementBootstrap = {
  status: OwnerManagementBootstrapStatus;
  inputId: string | null;
  identifierType: string | null;
  festival: {
    id: string;
    name: string;
    ownerType: string | null;
    ownerProfileId: string | null;
  } | null;
  authority: {
    isOwner: boolean;
    isAdmin: boolean;
    delegatedRoles: string[];
    canCreateEdition: boolean;
    canManage: boolean;
  };
  editions: OwnerEditionOption[];
  preferredEditionId: string | null;
  migration: { required: boolean; issues: FestivalDataHealthIssue[] };
  availableActions: string[];
  message: string | null;
};

export type PermissionRole =
  | "platform_admin"
  | "festival_owner"
  | "delegated_manager"
  | "talent_booker"
  | "finance_manager"
  | "operations_manager"
  | "stage_manager"
  | "safety_officer";

export type PermissionProjection = Record<
  | "manageBrand"
  | "manageEdition"
  | "manageLifecycle"
  | "manageLineup"
  | "manageFinance"
  | "manageOperations"
  | "viewOutcomes",
  boolean
>;

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
  type:
    | "opener"
    | "support"
    | "headline"
    | "dj_intermission"
    | "host"
    | "flexible"
    | "reserved_emergency";
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

export type FestivalCreationMode =
  | "create_festival"
  | "create_first_edition"
  | "add_edition";
export type FestivalIdentityInput = {
  name: string;
  shortDescription: string;
  fullDescription: string;
  festivalType: string;
  primaryGenres: string[];
  imageUrl?: string | null;
  isPublic: boolean;
};
export type FestivalEditionCreationInput = {
  title: string;
  editionNumber: number;
  startAt: string;
  endAt: string;
  applicationsOpenAt: string;
  applicationsCloseAt: string;
  bookingDeadlineAt?: string | null;
  timezone: string;
  currencyCode: string;
};
export type FestivalLocationInput = {
  country: string;
  cityId: string;
  cityName?: string | null;
  venueId?: string | null;
  siteName?: string | null;
  capacity: number;
  minTicketPriceCents: number;
  maxTicketPriceCents: number;
  defaultTicketPriceCents: number;
  festivalDays: number;
};
export type FestivalStageCreationInput = {
  name: string;
  type: string;
  capacity: number;
  changeoverMinutes: number;
  curfew: string;
  weatherProtection: string;
  soundCapability: string;
  lightingCapability: string;
};
export type FestivalCommercialConfig = {
  estimatedAttendance: number;
  operatingBudgetCents: number;
  performerBudgetCents: number;
  staffingBudgetCents: number;
  marketingBudgetCents: number;
  sponsorshipEnabled: boolean;
  merchandiseEnabled: boolean;
  concessionsEnabled: boolean;
};
export type FestivalCreationDraft = {
  mode: FestivalCreationMode;
  existingFestivalId?: string;
  identity: FestivalIdentityInput;
  edition: FestivalEditionCreationInput;
  location: FestivalLocationInput;
  stages: FestivalStageCreationInput[];
  commercial: FestivalCommercialConfig;
  idempotencyKey: string;
};
export type FestivalCreationValidationErrors = Partial<
  Record<
    "identity" | "edition" | "location" | "stages" | "commercial" | "submit",
    string[]
  >
>;
export type FestivalCreationResult = {
  festivalId: string;
  editionId: string;
  stageIds: string[];
  lifecycleStatus: FestivalLifecycleState;
  publicRoute: string;
  managementRoute: string;
  created: boolean;
};
