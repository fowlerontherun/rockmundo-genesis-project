import type {
  BookingSide,
  FestivalApplicationStatus,
  FestivalContractStatus,
  FestivalOfferStatus,
  FestivalSetlistItemInput,
  FestivalSetlistStatus,
  FestivalTerms,
} from "./bookingTypes";

export interface PublicFestivalEdition {
  id: string;
  title?: string | null;
  festival_name?: string | null;
  city_name?: string | null;
  city?: { name?: string | null } | null;
  start_at?: string | null;
  end_at?: string | null;
  status?: string | null;
  capacity?: number | null;
  expected_attendance?: number | null;
  minimum_ticket_price_cents?: number | null;
  maximum_ticket_price_cents?: number | null;
  currency_code?: string | null;
  supported_currency_codes?: string[] | null;
  application_open_at?: string | null;
  application_close_at?: string | null;
}
export interface FestivalApplicationRecord {
  id: string;
  edition_id: string;
  band_id: string;
  status: FestivalApplicationStatus;
  details?: FestivalTerms | null;
  application_message?: string | null;
  reason?: string | null;
  offer_id?: string | null;
  contract_id?: string | null;
  edition_title?: string | null;
  band_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  allowed_actions?: string[] | null;
}
export interface FestivalOfferRevisionRecord {
  id: string;
  offer_id?: string | null;
  revision_number: number;
  proposed_by?: BookingSide | null;
  terms_snapshot?: FestivalTerms | null;
  terms?: FestivalTerms | null;
  change_summary?: string | null;
  created_at?: string | null;
}
export interface FestivalOfferRecord {
  id: string;
  edition_id: string;
  band_id: string;
  application_id?: string | null;
  status: FestivalOfferStatus;
  current_revision_id?: string | null;
  current_revision?: number | null;
  proposed_by?: BookingSide | null;
  terms_snapshot?: FestivalTerms | null;
  festival_offer_revisions?: FestivalOfferRevisionRecord[] | null;
  revisions?: FestivalOfferRevisionRecord[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}
export interface FestivalContractSignatureRecord {
  id?: string;
  signing_side: BookingSide;
  contract_version: number;
  terms_hash?: string | null;
  signed_at?: string | null;
}
export interface FestivalSetlistRecord {
  id?: string;
  status: FestivalSetlistStatus;
  version?: number | null;
  items?: FestivalSetlistItemInput[] | null;
  change_reason?: string | null;
  is_current?: boolean | null;
}
export interface FestivalScheduleBlockRecord {
  id: string;
  block_type?: "performance" | "soundcheck" | string | null;
  stage_name?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  affected_member_names?: string[] | null;
  conflict_summary?: string | null;
  schedule_url?: string | null;
}
export interface FestivalContractRecord {
  id: string;
  edition_id?: string | null;
  band_id?: string | null;
  status: FestivalContractStatus;
  current_version?: number | null;
  accepted_offer_revision?: number | null;
  terms_snapshot?: FestivalTerms | null;
  schedule_state?: string | null;
  festival_contract_signatures?: FestivalContractSignatureRecord[] | null;
  current_setlist?: FestivalSetlistRecord | null;
  setlist?: FestivalSetlistRecord | null;
  setlist_id?: string | null;
  schedule_blocks?: FestivalScheduleBlockRecord[] | null;
}
export interface RepresentedBandOption {
  id: string;
  name: string;
  role: string;
  canApply: boolean;
  conflictStatus?: "clear" | "warning" | "blocked";
  existingApplicationStatus?: FestivalApplicationStatus | null;
  eligibilityBlockers?: string[];
}
export interface BookingActionProjection {
  label: string;
  description: string;
  severity: "neutral" | "success" | "warning" | "danger";
  availableActions: string[];
  nextActor?: BookingSide | "system";
  deadline?: string | null;
  blocker?: string | null;
}

export interface FestivalApplicationEligibility {
  outcome: "allowed" | "warning" | "blocked";
  canApply: boolean;
  authorityAllowed: boolean;
  editionStatusAllowed: boolean;
  applicationWindowOpen: boolean;
  existingApplicationId?: string | null;
  existingApplicationStatus?: FestivalApplicationStatus | null;
  existingContractId?: string | null;
  hardConflicts: string[];
  advisoryConflicts: string[];
  requestedDurationLimits?: {
    minimum_minutes?: number | null;
    maximum_minutes?: number | null;
  } | null;
  currencyCode?: string | null;
  availableSlotTypes: string[];
  applicationDeadline?: string | null;
  reasons: string[];
  warnings: string[];
}

export interface FestivalBookingSlotProjection {
  slotId: string;
  stageId: string | null;
  stageName: string | null;
  startAt: string | null;
  endAt: string | null;
  slotType: string | null;
  durationMinutes: number | null;
  headlineEligible: boolean;
  reservationState: string | null;
  reservationExpiresAt: string | null;
  currentBandId: string | null;
  currentBandName: string | null;
  technicalCapacitySummary: string | null;
  available: boolean;
  unavailableReason: string | null;
}

export interface FestivalInvitationCandidate {
  bandId: string;
  bandName: string;
  primaryGenres: string[];
  fame: number | null;
  liveRating: number | null;
  memberCount: number;
  bookingStatus: string | null;
  scheduleWarningSummary: string | null;
  previousFestivalHistorySummary: string | null;
  applicationStatus: FestivalApplicationStatus | null;
  activeContractStatus: FestivalContractStatus | null;
  invitationEligible: boolean;
  unavailableReason: string | null;
}

export interface FestivalRepertoireSong {
  songId: string;
  title: string;
  durationSeconds: number | null;
  genre: string | null;
  writers: string[];
  ownershipRelationship: string | null;
  performanceRightsStatus: string | null;
  recordedReleasedStatus: string | null;
  familiarity: number | null;
  readiness: number | null;
  currentlyUsedInSetlist: boolean;
  unavailableReason: string | null;
}

export interface FestivalSetlistPreflight {
  totalDurationSeconds: number;
  contractedMaximumSeconds: number;
  minimumRecommendedSeconds: number;
  invalidSongs: string[];
  duplicateSongs: string[];
  unavailableSongs: string[];
  guestPerformerIssues: string[];
  readinessWarnings: string[];
  versionConflict: {
    expected_version?: number | null;
    current_version?: number | null;
    conflict: boolean;
  };
  outcome: "allowed" | "warning" | "blocked";
  blockingReasons: string[];
  warnings: string[];
}
