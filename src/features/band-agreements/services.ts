import type { AgreementParty, AgreementStatus, AgreementType, BandAgreement, BandAgreementTerms, RevenueAllocationInput, RevenueAllocationSnapshot, RevenueCategory, RevenueCategoryRule } from './types';

export const AGREEMENT_STATUSES: AgreementStatus[] = ['draft','proposed','awaiting_signatures','partially_signed','active','rejected','withdrawn','expired','superseded','terminated','completed','disputed','cancelled'];
const transitions: Record<AgreementStatus, AgreementStatus[]> = { draft:['proposed','awaiting_signatures','withdrawn','cancelled'], proposed:['awaiting_signatures','rejected','withdrawn','expired'], awaiting_signatures:['partially_signed','active','rejected','withdrawn','expired','cancelled'], partially_signed:['awaiting_signatures','active','rejected','withdrawn','expired'], active:['superseded','terminated','completed','disputed'], rejected:['cancelled'], withdrawn:['cancelled'], expired:['cancelled'], superseded:[], terminated:['disputed'], completed:['disputed'], disputed:['terminated','completed'], cancelled:[] };
export const REVENUE_CATEGORIES: RevenueCategory[] = ['gig_income','tour_income','streaming_revenue','digital_sales','physical_sales','songwriting_royalties','recording_royalties','merchandise_profit','sponsorship_income','festival_income','licensing_income','other_band_income'];

export function requiredPartyRolesFor(type: AgreementType): AgreementParty['partyRole'][] {
  if (type === 'revenue_share_amendment') return ['affected_member', 'band_signatory'];
  if (type === 'songwriting_collaboration' || type === 'recording_participation') return ['contributor'];
  if (type === 'founder_ownership') return ['owner', 'band_signatory'];
  return ['member', 'band_signatory'];
}
export function assertTransition(from: AgreementStatus, to: AgreementStatus) { if (!transitions[from]?.includes(to)) throw new Error(`Invalid agreement transition: ${from} -> ${to}`); }
export function validateRevenueTerms(rules: RevenueCategoryRule[]): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const pctTotal = rule.recipients.reduce((sum, r) => sum + (r.percentage ?? 0), 0) + (rule.unallocatedPercentage ?? 0);
    if (pctTotal > 100.0001) errors.push(`${rule.category} percentages exceed 100%`);
    if (pctTotal < 99.9999 && rule.recipients.some(r => r.percentage != null)) errors.push(`${rule.category} must explicitly allocate or mark unallocated remainder`);
    for (const r of rule.recipients) if ((r.percentage ?? 0) < 0 || (r.fixedAmount ?? 0) < 0) errors.push(`${rule.category} contains negative share`);
    if (!rule.appliesFrom) errors.push(`${rule.category} requires an effective date`);
  }
  return errors;
}
export function validateAgreement(agreement: Pick<BandAgreement, 'agreementType'|'effectiveFrom'|'effectiveUntil'|'termsSnapshot'|'parties'>): string[] {
  const errors = validateRevenueTerms(agreement.termsSnapshot.revenueShares);
  if (agreement.effectiveUntil && agreement.effectiveUntil <= agreement.effectiveFrom) errors.push('effective_until must be after effective_from');
  if (agreement.termsSnapshot.noticePeriodDays < 0 || agreement.termsSnapshot.noticePeriodDays > 28) errors.push('notice period must be between 0 and 28 gameplay days');
  const roles = requiredPartyRolesFor(agreement.agreementType);
  for (const role of roles) if (!agreement.parties.some(p => p.partyRole === role && p.mandatory)) errors.push(`missing mandatory ${role} party`);
  return errors;
}
export function signAgreement(agreement: BandAgreement, playerId: string, now = new Date().toISOString()): BandAgreement {
  if (agreement.effectiveUntil && agreement.effectiveUntil < now) throw new Error('Agreement expired before signature');
  const party = agreement.parties.find(p => p.playerId === playerId);
  if (!party) throw new Error('Only agreement parties can sign');
  if (party.signatureVersion && party.signatureVersion !== agreement.version) throw new Error('Agreement changed before signing; review the new version');
  const parties = agreement.parties.map(p => p.playerId === playerId ? { ...p, signatureStatus: 'signed' as const, signedAt: now, signatureVersion: agreement.version, acknowledgementSnapshot: { acceptedVersion: agreement.version, acceptedAt: now } } : p);
  const allMandatorySigned = parties.filter(p => p.mandatory).every(p => p.signatureStatus === 'signed' && p.signatureVersion === agreement.version);
  return { ...agreement, parties, status: allMandatorySigned ? 'active' : 'partially_signed', activatedAt: allMandatorySigned ? now : agreement.activatedAt, updatedAt: now };
}
export function amendAgreement(agreement: BandAgreement, terms: BandAgreementTerms, actorId: string, reason: string, now = new Date().toISOString()): BandAgreement {
  return { ...agreement, id: `${agreement.id}:v${agreement.version + 1}`, version: agreement.version + 1, status: 'awaiting_signatures', createdBy: actorId, supersedesAgreementId: agreement.id, termsSnapshot: { ...terms, notes: [terms.notes, `Change reason: ${reason}`].filter(Boolean).join('\n') }, parties: agreement.parties.map(p => ({ ...p, signatureStatus: 'invalidated', signedAt: undefined, signatureVersion: undefined, acknowledgementSnapshot: undefined })), createdAt: now, updatedAt: now, activatedAt: undefined };
}
export function diffAgreementTerms(previous: BandAgreementTerms, next: BandAgreementTerms): string[] {
  const changes: string[] = [];
  if (previous.noticePeriodDays !== next.noticePeriodDays) changes.push(`Notice period changed from ${previous.noticePeriodDays} to ${next.noticePeriodDays} days`);
  const prevCats = new Map(previous.revenueShares.map(r => [r.category, r]));
  for (const rule of next.revenueShares) {
    const old = prevCats.get(rule.category); if (!old) { changes.push(`${rule.category.split('_').join(' ')} revenue rule added`); continue; }
    for (const rec of rule.recipients) { const oldRec = old.recipients.find(r => r.recipientId === rec.recipientId && r.recipientType === rec.recipientType); if ((oldRec?.percentage ?? 0) !== (rec.percentage ?? 0)) changes.push(`${rule.category.split('_').join(' ')} share for ${rec.recipientId} changed from ${oldRec?.percentage ?? 0}% to ${rec.percentage ?? 0}%`); }
  }
  if (previous.creativeOwnership.songwritingDefault !== next.creativeOwnership.songwritingDefault) changes.push('Songwriting ownership default changed');
  if (previous.expectations.touring !== next.expectations.touring) changes.push(next.expectations.touring ? 'Touring requirement changed or added' : 'Touring requirement removed');
  return changes;
}
export function calculateBandRevenueShares(agreement: BandAgreement | undefined, input: RevenueAllocationInput): RevenueAllocationSnapshot {
  const net = Math.max(0, input.grossAmount - input.costs);
  const rule = agreement?.termsSnapshot.revenueShares.find(r => r.category === input.category && r.appliesFrom <= input.occurredAt);
  const allocations = rule ? rule.recipients.map(r => ({ recipientId: r.recipientId, recipientType: r.recipientType, percentage: r.percentage, amount: Math.round(((r.percentage ? net * r.percentage / 100 : r.fixedAmount ?? 0)) * 100) / 100 })) : [{ recipientId: input.bandId, recipientType: 'band_reserve' as const, percentage: 100, amount: net }];
  return { agreementId: agreement?.id, agreementVersion: agreement?.version, revenueSource: input.source, grossAmount: input.grossAmount, costs: input.costs, netDistributable: net, shareRulesUsed: rule ? [rule] : [], allocations, allocatedAt: new Date().toISOString() };
}
export const previewRevenueDistribution = calculateBandRevenueShares;
