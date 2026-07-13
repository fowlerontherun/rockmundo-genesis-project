import type { ProposalPolicy } from './types';

export const BAND_PROPOSAL_TYPES = {
  membership: ['accept_applicant','remove_member','extend_trial_membership','confirm_trial_member','change_member_role','appoint_band_leader','remove_band_leader'],
  gigs_tours: ['accept_gig','decline_gig','book_tour','cancel_tour','add_tour_date','change_tour_transport','approve_festival_appearance'],
  finance: ['approve_expense','purchase_equipment','sell_band_asset','set_budget','change_spending_limit','change_revenue_split','withdraw_band_funds'],
  creative: ['approve_song','select_recording','book_recording_studio','approve_tracklist','approve_release','select_single','change_band_genre_direction','approve_collaboration'],
  publicity_merch: ['approve_campaign','create_merchandise_range','place_large_stock_order','change_merch_prices','approve_sponsorship'],
  governance: ['change_voting_rules','create_governance_policy','transfer_leadership','transfer_ownership','disband_band'],
} as const;

export type BandProposalType = typeof BAND_PROPOSAL_TYPES[keyof typeof BAND_PROPOSAL_TYPES][number];

export const DEFAULT_GOVERNANCE_POLICY: ProposalPolicy = {
  votingMethod: 'simple_majority', approvalThreshold: 0.5, quorumType: 'percentage', quorumValue: 50,
  votingDurationHours: 72, eligibleVoterRule: 'all_non_trial_members', votesVisible: 'hidden_until_close',
  votesChangeable: true, earlyResolution: true, discussionEnabled: true,
};

const critical: Partial<Record<BandProposalType, Partial<ProposalPolicy>>> = {
  change_revenue_split: { votingMethod: 'unanimous', approvalThreshold: 1, quorumType: 'all', mandatory: true },
  remove_member: { votingMethod: 'supermajority', approvalThreshold: 2 / 3, quorumType: 'percentage', quorumValue: 66, mandatory: true },
  transfer_ownership: { votingMethod: 'owner_approval', approvalThreshold: 1, quorumType: 'all', mandatory: true },
  disband_band: { votingMethod: 'owner_approval', approvalThreshold: 0.75, quorumType: 'percentage', quorumValue: 75, mandatory: true },
  appoint_band_leader: { votingMethod: 'supermajority', approvalThreshold: 2 / 3, quorumType: 'percentage', quorumValue: 50 },
  purchase_equipment: { votingMethod: 'supermajority', approvalThreshold: 2 / 3, quorumType: 'percentage', quorumValue: 50 },
};

export function policyForProposalType(type: BandProposalType, bandDefault: ProposalPolicy = DEFAULT_GOVERNANCE_POLICY): ProposalPolicy {
  return { ...bandDefault, ...critical[type] };
}
