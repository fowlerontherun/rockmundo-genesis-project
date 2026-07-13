import { describe, expect, it } from 'vitest';
import { DEFAULT_GOVERNANCE_POLICY } from '../catalog';
import { calculateVoteResult, outcomeCannotChange, quorumTarget } from '../voting';
import type { ProposalPolicy } from '../types';

const base: ProposalPolicy = { ...DEFAULT_GOVERNANCE_POLICY, quorumType: 'fixed', quorumValue: 2 };

describe('band governance voting', () => {
  it('calculates quorum targets', () => {
    expect(quorumTarget({ ...base, quorumType: 'percentage', quorumValue: 60 }, 5)).toBe(3);
    expect(quorumTarget({ ...base, quorumType: 'all' }, 4)).toBe(4);
  });

  it('passes simple majority when quorum is reached and yes beats no', () => {
    const result = calculateVoteResult(base, { yes: 2, no: 1, abstain: 0, eligible: 4 });
    expect(result.passed).toBe(true);
  });

  it('fails quorum even with enough yes votes', () => {
    const result = calculateVoteResult({ ...base, quorumValue: 4 }, { yes: 2, no: 0, abstain: 0, eligible: 4 });
    expect(result.reason).toBe('quorum_not_reached');
  });

  it('handles abstentions as quorum participation but not simple majority approvals', () => {
    const result = calculateVoteResult(base, { yes: 1, no: 1, abstain: 2, eligible: 4 });
    expect(result.quorumReached).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('supports supermajority and unanimous policies', () => {
    expect(calculateVoteResult({ ...base, votingMethod: 'supermajority', approvalThreshold: 2 / 3 }, { yes: 2, no: 1, abstain: 0, eligible: 3 }).passed).toBe(true);
    expect(calculateVoteResult({ ...base, votingMethod: 'unanimous', quorumType: 'all' }, { yes: 2, no: 0, abstain: 1, eligible: 3 }).passed).toBe(false);
  });

  it('supports fixed approvals, leader approval and owner approval', () => {
    expect(calculateVoteResult({ ...base, votingMethod: 'fixed_approvals' }, { yes: 3, no: 4, abstain: 0, eligible: 8, requiredApprovals: 3 }).passed).toBe(true);
    expect(calculateVoteResult({ ...base, votingMethod: 'leader_approval' }, { yes: 0, no: 0, abstain: 2, eligible: 2, leaderApproved: true }).passed).toBe(true);
    expect(calculateVoteResult({ ...base, votingMethod: 'owner_approval' }, { yes: 2, no: 0, abstain: 0, eligible: 2, ownerApproved: true }).passed).toBe(true);
  });

  it('identifies safe early resolution cases', () => {
    expect(outcomeCannotChange({ ...base, votingMethod: 'fixed_approvals' }, { yes: 2, no: 0, abstain: 0, eligible: 5, requiredApprovals: 2 })).toBe(true);
    expect(outcomeCannotChange({ ...base, votingMethod: 'unanimous' }, { yes: 1, no: 1, abstain: 0, eligible: 5 })).toBe(true);
  });
});
