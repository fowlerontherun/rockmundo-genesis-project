import type { ProposalPolicy, VoteResult, VoteTally } from './types';

export function quorumTarget(policy: ProposalPolicy, eligible: number): number {
  if (policy.quorumType === 'none') return 0;
  if (policy.quorumType === 'all') return eligible;
  if (policy.quorumType === 'fixed') return Math.min(eligible, Math.max(0, Math.ceil(policy.quorumValue)));
  return Math.min(eligible, Math.ceil(eligible * Math.max(0, policy.quorumValue) / 100));
}

export function calculateVoteResult(policy: ProposalPolicy, tally: VoteTally): VoteResult {
  const votesCast = tally.yes + tally.no + tally.abstain;
  const target = quorumTarget(policy, tally.eligible);
  const quorumReached = votesCast >= target;
  const denominator = policy.votingMethod === 'unanimous' ? tally.eligible : Math.max(1, tally.yes + tally.no);
  let approvalsNeeded = 0;
  let thresholdReached = false;
  switch (policy.votingMethod) {
    case 'simple_majority': approvalsNeeded = Math.floor((tally.yes + tally.no) / 2) + 1; thresholdReached = tally.yes > tally.no; break;
    case 'supermajority': approvalsNeeded = Math.ceil(denominator * policy.approvalThreshold); thresholdReached = tally.yes >= approvalsNeeded; break;
    case 'unanimous': approvalsNeeded = tally.eligible; thresholdReached = tally.no === 0 && tally.yes >= tally.eligible; break;
    case 'fixed_approvals': approvalsNeeded = tally.requiredApprovals ?? Math.ceil(policy.approvalThreshold); thresholdReached = tally.yes >= approvalsNeeded; break;
    case 'leader_approval': approvalsNeeded = 1; thresholdReached = !!tally.leaderApproved; break;
    case 'owner_approval': approvalsNeeded = 1; thresholdReached = !!tally.ownerApproved && tally.yes >= Math.ceil(denominator * policy.approvalThreshold); break;
  }
  const passed = quorumReached && thresholdReached;
  return { quorumReached, thresholdReached, passed, yesNeeded: Math.max(0, approvalsNeeded - tally.yes), quorumTarget: target, votesCast, denominator, reason: passed ? 'passed' : !quorumReached ? 'quorum_not_reached' : 'threshold_not_reached' };
}

export function outcomeCannotChange(policy: ProposalPolicy, tally: VoteTally): boolean {
  const remaining = Math.max(0, tally.eligible - tally.yes - tally.no - tally.abstain);
  if (policy.votingMethod === 'fixed_approvals' && tally.requiredApprovals) return tally.yes >= tally.requiredApprovals;
  if (policy.votingMethod === 'unanimous') return tally.no > 0 || tally.yes === tally.eligible;
  const bestNo = tally.no + remaining;
  return calculateVoteResult(policy, tally).passed && policy.votingMethod === 'simple_majority' && tally.yes > bestNo;
}
