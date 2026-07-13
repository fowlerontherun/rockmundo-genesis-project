# Band governance proposals

Band governance extends the existing membership, recruitment, notification, SSE and audit foundations with a structured proposal system. It is intentionally limited to understandable voting methods rather than a full political simulation.

## Eligibility model

Eligibility is snapshotted when a proposal is opened. The default voter rule is active non-touring band members. Members who later leave or are suspended cannot cast or change votes because vote RPCs re-check active membership, but existing votes remain in the audit record unless a mandatory platform policy excludes them in a later execution service.

Conflict-of-interest exclusions are deterministic and stored on `band_proposal_eligible_voters.exclusion_reason`. Examples include a candidate not voting on their own membership, a target not voting on their own removal, and an expense beneficiary being excluded where policy requires it.

## Voting methods and abstentions

Supported methods are:

- `simple_majority`: yes must be greater than no.
- `supermajority`: yes must meet the configured approval threshold.
- `unanimous`: every eligible voter must vote yes and no votes fail the proposal.
- `fixed_approvals`: a fixed approval count must be reached.
- `leader_approval`: a leader approval flag must be present.
- `owner_approval`: owner confirmation is required and the configured threshold still applies.

Abstentions count toward quorum. Abstentions do not count in the yes/no approval denominator for simple majority or supermajority. This makes abstain a participation signal without silently approving or rejecting a proposal.

## Quorum

Supported quorum rules are no quorum, fixed count, percentage of eligible voters, and all eligible voters. A proposal cannot pass unless quorum is reached. Dashboard cards display eligible voters, votes cast, quorum target and remaining participation.

## Execution behaviour

Passing a proposal does not mean the action has executed. Passed proposals enter an execution phase that must call explicit domain services such as recruitment, gig booking, finance, release or membership services. Generic governance code must not directly mutate domain tables when a validated service exists.

Execution uses `band_proposal_execution_records.idempotency_key` (`band-proposal:<proposal id>`) so retries, duplicate jobs and manual retry actions do not duplicate payments, memberships, bookings or releases. Before execution, services must revalidate band existence, related entity state, schedule conflicts, funds, candidate eligibility, permissions, moderation restrictions and mandatory platform rules. Safe failures set `execution_failed`, store a user-friendly reason and preserve the vote result and audit trail.

## Privacy and audit

Hidden and anonymous votes are privacy controls for ordinary members only. Vote identity remains stored for moderation and audit. Financial payloads, recruiter notes, moderation restrictions and execution stack traces must not be exposed in member-facing views. Proposal comments are sanitised and can be reported or moderator removed without deleting the immutable governance audit.
