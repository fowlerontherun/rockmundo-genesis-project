export type ProposalStatus = 'draft'|'open'|'passed'|'rejected'|'withdrawn'|'cancelled'|'expired'|'executing'|'executed'|'execution_failed'|'invalidated';
export type VoteChoice = 'yes'|'no'|'abstain';
export type VotingMethod = 'simple_majority'|'supermajority'|'unanimous'|'fixed_approvals'|'leader_approval'|'owner_approval';
export type QuorumType = 'none'|'fixed'|'percentage'|'all';
export type EligibleVoterRuleType = 'all_full_members'|'all_non_trial_members'|'leaders_only'|'permission'|'role'|'project_participants'|'revenue_share_holders'|'selected_members';

export interface ProposalPolicy {
  votingMethod: VotingMethod;
  approvalThreshold: number;
  quorumType: QuorumType;
  quorumValue: number;
  votingDurationHours: number;
  eligibleVoterRule: EligibleVoterRuleType;
  votesVisible: 'public'|'hidden_until_close'|'anonymous'|'leaders_only';
  votesChangeable: boolean;
  earlyResolution: boolean;
  discussionEnabled: boolean;
  mandatory?: boolean;
}

export interface VoteTally { yes: number; no: number; abstain: number; eligible: number; requiredApprovals?: number; leaderApproved?: boolean; ownerApproved?: boolean; }
export interface VoteResult { quorumReached: boolean; thresholdReached: boolean; passed: boolean; yesNeeded: number; quorumTarget: number; votesCast: number; denominator: number; reason: string; }
export interface BandProposalSummary { id: string; band_id: string; proposal_type: string; title: string; status: ProposalStatus; created_by?: string; closes_at?: string; executed_at?: string; execution_error?: string; vote_summary?: VoteTally; viewer_has_voted?: boolean; viewer_action_required?: boolean; }
