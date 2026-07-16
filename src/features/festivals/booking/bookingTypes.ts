export const applicationStatuses = ['draft','submitted','under_review','waitlisted','shortlisted','offer_pending','withdrawn','rejected','expired','converted_to_contract'] as const;
export type FestivalApplicationStatus = typeof applicationStatuses[number];
export const offerStatuses = ['draft','sent','viewed','countered','accepted_pending_contract','declined','withdrawn','expired','converted_to_contract'] as const;
export type FestivalOfferStatus = typeof offerStatuses[number];
export const contractStatuses = ['draft','proposed','awaiting_band_signature','awaiting_organiser_signature','awaiting_signatures','active','amendment_required','cancelled','terminated','fulfilled','breached','expired'] as const;
export type FestivalContractStatus = typeof contractStatuses[number];
export const setlistStatuses = ['draft','submitted','approved','changes_requested','locked','performed','cancelled'] as const;
export type FestivalSetlistStatus = typeof setlistStatuses[number];
export type BookingSide = 'band' | 'organiser';
export type FestivalTerms = Record<string, unknown> & { set_duration_minutes?: number; guarantee_fee_cents?: number; proposed_stage_name?: string; };
export interface FestivalSetlistItemInput { song_id: string; planned_duration_seconds: number; performance_notes?: string; transition_notes?: string; is_encore?: boolean; }
export interface SetlistValidationResult { totalDurationSeconds: number; maximumDurationSeconds: number; valid: boolean; warnings: string[]; }
export const festivalBookingKeys = {
  publicEditions: ['festivals','booking','public-editions'] as const,
  bandApplications: (bandId?: string, editionId?: string, profileId?: string) => ['festivals','booking','applications',bandId ?? 'all',editionId ?? 'all',profileId ?? 'anon'] as const,
  organiserApplications: (editionId?: string) => ['festivals','booking','organiser-applications',editionId ?? 'all'] as const,
  offers: (bandId?: string, editionId?: string) => ['festivals','booking','offers',bandId ?? 'all',editionId ?? 'all'] as const,
  contracts: (bandId?: string, contractId?: string) => ['festivals','booking','contracts',bandId ?? 'all',contractId ?? 'all'] as const,
  setlist: (contractId?: string) => ['festivals','booking','setlist',contractId ?? 'none'] as const,
};
const terminalApplications: FestivalApplicationStatus[] = ['withdrawn','rejected','expired','converted_to_contract'];
export function canTransitionApplication(from: FestivalApplicationStatus, to: FestivalApplicationStatus) { if (from === to) return true; if (terminalApplications.includes(from)) return false; const map: Record<FestivalApplicationStatus, FestivalApplicationStatus[]> = { draft:['submitted','withdrawn'], submitted:['under_review','shortlisted','waitlisted','rejected','withdrawn','offer_pending','expired'], under_review:['shortlisted','waitlisted','rejected','withdrawn','offer_pending','expired'], waitlisted:['shortlisted','rejected','withdrawn','offer_pending','expired'], shortlisted:['offer_pending','rejected','withdrawn','expired'], offer_pending:['converted_to_contract','withdrawn','expired'], withdrawn:[], rejected:[], expired:[], converted_to_contract:[] }; return map[from].includes(to); }
export function canCounterOffer(status: FestivalOfferStatus, expectedRevision: number, currentRevision: number) { return expectedRevision === currentRevision && ['sent','viewed','countered'].includes(status); }
export function requiredSignatureSides(status: FestivalContractStatus): BookingSide[] { return ['awaiting_band_signature','awaiting_organiser_signature','awaiting_signatures','proposed','draft'].includes(status) ? ['band','organiser'] : []; }
export function bothSidesSigned(signatures: Array<{ signing_side: BookingSide; contract_version: number }>, version: number) { const sides = new Set(signatures.filter((s) => s.contract_version === version).map((s) => s.signing_side)); return sides.has('band') && sides.has('organiser'); }
export function normalizeTermsForComparison(terms: FestivalTerms) { return JSON.stringify(Object.keys(terms).sort().reduce<Record<string, unknown>>((acc, key) => { acc[key] = terms[key]; return acc; }, {})); }
export function termsChanged(a: FestivalTerms, b: FestivalTerms) { return normalizeTermsForComparison(a) !== normalizeTermsForComparison(b); }
export function calculateTotalDuration(items: FestivalSetlistItemInput[]) { return items.reduce((total, item) => total + item.planned_duration_seconds, 0); }
export function validateFestivalSetlist(items: FestivalSetlistItemInput[], maximumDurationSeconds: number, minimumDurationSeconds = 60): SetlistValidationResult { const totalDurationSeconds = calculateTotalDuration(items); const warnings: string[] = []; if (totalDurationSeconds > maximumDurationSeconds) warnings.push('Setlist exceeds contracted duration.'); if (totalDurationSeconds < minimumDurationSeconds) warnings.push('Setlist is shorter than the minimum performance duration.'); items.forEach((item, index) => { if (item.planned_duration_seconds < 30) warnings.push(`Item ${index + 1} is shorter than the minimum song duration.`); }); return { totalDurationSeconds, maximumDurationSeconds, valid: warnings.length === 0, warnings }; }
export function ensureCurrentRevision(expected: number, current: number) { if (expected !== current) throw new Error('Stale offer revision'); }
export function projectPublicLineup(contract: { edition_id: string; band_id: string; status: FestivalContractStatus; terms_snapshot?: FestivalTerms }) { const terms = contract.terms_snapshot ?? {}; return { edition_id: contract.edition_id, band_id: contract.band_id, stage_display_name: String(terms.proposed_stage_name ?? 'TBA'), slot_type: typeof terms.proposed_slot_type === 'string' ? terms.proposed_slot_type : null, public_status: contract.status === 'active' ? 'active' : 'hidden' }; }
