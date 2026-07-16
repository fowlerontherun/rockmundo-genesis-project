export const applicationStatuses = [
  'draft',
  'submitted',
  'under_review',
  'waitlisted',
  'shortlisted',
  'offer_pending',
  'withdrawn',
  'rejected',
  'expired',
  'converted_to_contract',
] as const;
export type FestivalApplicationStatus = (typeof applicationStatuses)[number];

export const offerStatuses = [
  'draft',
  'sent',
  'viewed',
  'countered',
  'accepted_pending_contract',
  'declined',
  'withdrawn',
  'expired',
  'converted_to_contract',
] as const;
export type FestivalOfferStatus = (typeof offerStatuses)[number];

export const contractStatuses = [
  'draft',
  'proposed',
  'awaiting_band_signature',
  'awaiting_organiser_signature',
  'awaiting_signatures',
  'active',
  'amendment_required',
  'cancelled',
  'terminated',
  'fulfilled',
  'breached',
  'expired',
] as const;
export type FestivalContractStatus = (typeof contractStatuses)[number];

export const setlistStatuses = ['draft', 'submitted', 'approved', 'changes_requested', 'locked', 'performed', 'cancelled'] as const;
export type FestivalSetlistStatus = (typeof setlistStatuses)[number];

export type BookingSide = 'band' | 'organiser';

export interface PerformanceScheduleTerms {
  stage_slot_id?: string;
  proposed_stage_name?: string;
  proposed_slot_type?: string;
  proposed_start_at?: string;
  proposed_end_at?: string;
  set_duration_minutes?: number;
  soundcheck_start_at?: string;
  soundcheck_end_at?: string;
  headline?: boolean;
}

export interface MoneyTerms {
  currency_code?: string;
  guarantee_fee_cents?: number;
  deposit_cents?: number;
  performance_bonus_cents?: number;
  ticket_bonus_terms?: Record<string, number | string | boolean | null>;
}

export interface MerchandiseTerms {
  merch_share_percent?: number | null;
}

export interface TravelTerms {
  arrival_required_at?: string;
  transport_provided?: boolean;
  notes?: string;
}

export interface AccommodationTerms {
  rooms?: number;
  nights?: number;
  notes?: string;
}

export interface HospitalityTerms {
  meals?: string[];
  buyout_cents?: number;
  notes?: string;
}

export interface TechnicalRiderTerms {
  backline?: string[];
  changeover_minutes?: number;
  notes?: string;
}

export interface ExclusivityTerms {
  radius_km?: number;
  starts_at?: string;
  ends_at?: string;
}

export interface CancellationTerms {
  kill_fee_cents?: number;
  notice_hours?: number;
  settlement_required?: boolean;
}

export interface FestivalTerms extends PerformanceScheduleTerms, MoneyTerms, MerchandiseTerms {
  travel_terms?: TravelTerms;
  accommodation_terms?: AccommodationTerms;
  hospitality_terms?: HospitalityTerms;
  technical_terms?: TechnicalRiderTerms;
  exclusivity_terms?: ExclusivityTerms;
  cancellation_terms?: CancellationTerms;
  message?: string;
  expires_at?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface FestivalApplicationInput {
  editionId: string;
  bandId: string;
  details: FestivalTerms;
  idempotencyKey: string;
}

export interface FestivalSetlistItemInput {
  song_id: string;
  planned_duration_seconds: number;
  performance_notes?: string;
  transition_notes?: string;
  is_encore?: boolean;
  guest_profile_id?: string;
}

export interface SetlistValidationResult {
  totalDurationSeconds: number;
  maximumDurationSeconds: number;
  valid: boolean;
  warnings: string[];
}

export type BookingDomainErrorCode =
  | 'stale_revision'
  | 'expired_offer'
  | 'lost_reservation'
  | 'version_mismatch'
  | 'schedule_conflict'
  | 'idempotency_conflict'
  | 'unauthorised'
  | 'unknown';

export class BookingDomainError extends Error {
  constructor(
    message: string,
    public readonly code: BookingDomainErrorCode,
  ) {
    super(message);
  }
}

export function mapBookingError(error: unknown): BookingDomainError {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes('stale offer revision')) return new BookingDomainError(message, 'stale_revision');
  if (normalized.includes('expired')) return new BookingDomainError(message, 'expired_offer');
  if (normalized.includes('reservation was lost')) return new BookingDomainError(message, 'lost_reservation');
  if (normalized.includes('version mismatch')) return new BookingDomainError(message, 'version_mismatch');
  if (normalized.includes('schedule') || normalized.includes('overlap')) return new BookingDomainError(message, 'schedule_conflict');
  if (normalized.includes('idempotency key reused')) return new BookingDomainError(message, 'idempotency_conflict');
  if (normalized.includes('not authorised') || normalized.includes('authentication')) return new BookingDomainError(message, 'unauthorised');
  return new BookingDomainError(message, 'unknown');
}

export const festivalBookingKeys = {
  root: ['festivals', 'booking'] as const,
  publicEditions: ['festivals', 'booking', 'public-editions'] as const,
  publicLineup: (editionId?: string) => ['festivals', 'booking', 'public-lineup', editionId ?? 'all'] as const,
  bandWorkspace: (bandId?: string) => ['festivals', 'booking', 'band-workspace', bandId ?? 'none'] as const,
  organiserWorkspace: (editionId?: string) => ['festivals', 'booking', 'organiser-workspace', editionId ?? 'none'] as const,
  bandApplications: (bandId?: string, editionId?: string, profileId?: string) =>
    ['festivals', 'booking', 'applications', bandId ?? 'all', editionId ?? 'all', profileId ?? 'anon'] as const,
  organiserApplications: (editionId?: string) => ['festivals', 'booking', 'organiser-applications', editionId ?? 'all'] as const,
  offers: (bandId?: string, editionId?: string) => ['festivals', 'booking', 'offers', bandId ?? 'all', editionId ?? 'all'] as const,
  contracts: (bandId?: string, contractId?: string) => ['festivals', 'booking', 'contracts', bandId ?? 'all', contractId ?? 'all'] as const,
  setlist: (contractId?: string) => ['festivals', 'booking', 'setlist', contractId ?? 'none'] as const,
};

const applicationTransitions: Record<FestivalApplicationStatus, FestivalApplicationStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'shortlisted', 'waitlisted', 'rejected', 'withdrawn', 'offer_pending', 'expired'],
  under_review: ['shortlisted', 'waitlisted', 'rejected', 'withdrawn', 'offer_pending', 'expired'],
  waitlisted: ['shortlisted', 'rejected', 'withdrawn', 'offer_pending', 'expired'],
  shortlisted: ['offer_pending', 'rejected', 'withdrawn', 'expired'],
  offer_pending: ['converted_to_contract', 'withdrawn', 'expired'],
  withdrawn: [],
  rejected: [],
  expired: [],
  converted_to_contract: [],
};

export function canTransitionApplication(from: FestivalApplicationStatus, to: FestivalApplicationStatus): boolean {
  return from === to || applicationTransitions[from].includes(to);
}

const contractTransitions: Record<FestivalContractStatus, FestivalContractStatus[]> = {
  draft: ['awaiting_signatures', 'awaiting_band_signature', 'awaiting_organiser_signature', 'cancelled', 'expired'],
  proposed: ['awaiting_signatures', 'awaiting_band_signature', 'awaiting_organiser_signature', 'cancelled', 'expired'],
  awaiting_band_signature: ['active', 'cancelled', 'expired', 'amendment_required'],
  awaiting_organiser_signature: ['active', 'cancelled', 'expired', 'amendment_required'],
  awaiting_signatures: ['active', 'cancelled', 'expired', 'amendment_required'],
  active: ['amendment_required', 'cancelled', 'terminated', 'fulfilled', 'breached'],
  amendment_required: ['awaiting_signatures', 'cancelled', 'terminated'],
  cancelled: [],
  terminated: [],
  fulfilled: [],
  breached: [],
  expired: [],
};

export function canTransitionContract(from: FestivalContractStatus, to: FestivalContractStatus): boolean {
  return from === to || contractTransitions[from].includes(to);
}

const setlistTransitions: Record<FestivalSetlistStatus, FestivalSetlistStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'changes_requested', 'cancelled'],
  approved: ['locked', 'changes_requested', 'cancelled'],
  changes_requested: ['submitted', 'cancelled'],
  locked: ['performed', 'cancelled'],
  performed: [],
  cancelled: [],
};

export function canTransitionSetlist(from: FestivalSetlistStatus, to: FestivalSetlistStatus): boolean {
  return from === to || setlistTransitions[from].includes(to);
}

export function canCounterOffer(status: FestivalOfferStatus, expectedRevision: number, currentRevision: number): boolean {
  return expectedRevision === currentRevision && ['sent', 'viewed', 'countered'].includes(status);
}

export function canAcceptRevision(proposedBy: BookingSide, acceptingSide: BookingSide): boolean {
  return proposedBy !== acceptingSide;
}

export function requiredSignatureSides(status: FestivalContractStatus): BookingSide[] {
  return ['awaiting_band_signature', 'awaiting_organiser_signature', 'awaiting_signatures', 'proposed', 'draft'].includes(status)
    ? ['band', 'organiser']
    : [];
}

export function bothSidesSigned(signatures: Array<{ signing_side: BookingSide; contract_version: number; terms_hash?: string }>, version: number, termsHash?: string): boolean {
  const sides = new Set(
    signatures
      .filter((signature) => signature.contract_version === version && (!termsHash || signature.terms_hash === termsHash))
      .map((signature) => signature.signing_side),
  );
  return sides.has('band') && sides.has('organiser');
}

export function normalizeTermsForComparison(terms: FestivalTerms): string {
  return JSON.stringify(
    Object.keys(terms)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = terms[key as keyof FestivalTerms];
        return acc;
      }, {}),
  );
}

export function termsChanged(a: FestivalTerms, b: FestivalTerms): boolean {
  return normalizeTermsForComparison(a) !== normalizeTermsForComparison(b);
}

export function calculateTotalDuration(items: FestivalSetlistItemInput[]): number {
  return items.reduce((total, item) => total + item.planned_duration_seconds, 0);
}

export function hashSetlistContent(items: FestivalSetlistItemInput[]): string {
  return JSON.stringify(
    items.map((item, index) => ({
      position: index + 1,
      song_id: item.song_id,
      planned_duration_seconds: item.planned_duration_seconds,
      performance_notes: item.performance_notes ?? null,
      transition_notes: item.transition_notes ?? null,
      is_encore: item.is_encore ?? false,
      guest_profile_id: item.guest_profile_id ?? null,
    })),
  );
}

export function validateFestivalSetlist(items: FestivalSetlistItemInput[], maximumDurationSeconds: number, minimumDurationSeconds = 60): SetlistValidationResult {
  const totalDurationSeconds = calculateTotalDuration(items);
  const warnings: string[] = [];
  const seen = new Set<string>();
  if (totalDurationSeconds > maximumDurationSeconds) warnings.push('Setlist exceeds contracted duration.');
  if (totalDurationSeconds < minimumDurationSeconds) warnings.push('Setlist is shorter than the minimum performance duration.');
  items.forEach((item, index) => {
    if (!item.song_id) warnings.push(`Item ${index + 1} is missing a song.`);
    if (seen.has(item.song_id)) warnings.push(`Item ${index + 1} duplicates a song.`);
    seen.add(item.song_id);
    if (item.planned_duration_seconds < 30) warnings.push(`Item ${index + 1} is shorter than the minimum song duration.`);
  });
  return { totalDurationSeconds, maximumDurationSeconds, valid: warnings.length === 0, warnings };
}

export function ensureCurrentRevision(expected: number, current: number): void {
  if (expected !== current) throw new BookingDomainError('Stale offer revision', 'stale_revision');
}

export function selectCurrentRevision<T extends { id: string; revision_number: number }>(revisions: T[], currentRevisionId?: string | null): T | undefined {
  return currentRevisionId ? revisions.find((revision) => revision.id === currentRevisionId) : [...revisions].sort((a, b) => b.revision_number - a.revision_number)[0];
}

export function selectCurrentSetlistVersion<T extends { version: number; is_current?: boolean | null }>(versions: T[]): T | undefined {
  return versions.find((version) => version.is_current) ?? [...versions].sort((a, b) => b.version - a.version)[0];
}

export function projectPublicLineup(contract: { edition_id: string; band_id: string; status: FestivalContractStatus; terms_snapshot?: FestivalTerms }) {
  const terms = contract.terms_snapshot ?? {};
  return {
    edition_id: contract.edition_id,
    band_id: contract.band_id,
    stage_display_name: String(terms.proposed_stage_name ?? 'TBA'),
    slot_type: typeof terms.proposed_slot_type === 'string' ? terms.proposed_slot_type : null,
    public_status: contract.status === 'active' ? 'active' : 'hidden',
  };
}
