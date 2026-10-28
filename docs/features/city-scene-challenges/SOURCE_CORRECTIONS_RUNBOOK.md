# City Scene source correction operator runbook

**Status:** Code and rollback-only CI verification. Do not use the manual application procedure on live player contributions until this migration and the integration suite have passed.

## Why the review gate exists

A completed gig, studio recording or rehearsal can be corrected by admins after City Scene points are recorded. A mismatch in `private.scene_source_integrity_preview(100)` is a **diagnostic warning**, not proof of abuse. In particular, do not invalidate a legitimately performed gig merely because a band member moved cities or left the band afterwards.

A deliberate correction requires **two recorded operators** and the live source to remain inconsistent. There is no automatic job applying corrections, no new player-visible write RPC, and no wallet clawback.

## 1. Inspect without changing player history

Use a database owner/admin SQL connection and run:

```sql
select private.scene_source_integrity_preview(100);
```

Investigate any reported contribution ID against the original game outcome, recording XP evidence or rehearsal result. Keep the independent source evidence/reference and a meaningful written explanation.

Supported sources: `verified_gig_performance`, `completed_recording`, `verified_rehearsal`.

## 2. Request review

Only after verifying the original event is genuinely invalid, use a database owner/admin connection:

```sql
select private.scene_request_correction(
  '<contribution-uuid>',
  'operator-one',
  'The archived event outcome was voided and did not represent a real performance',
  'github-issue-number-or-canonical-source-reference'
);
```

The returned UUID is the immutable review ID. The request is denied when source evidence is still valid, the contribution is already inactive, or the challenge is outside its seven-day correction grace window. Repeated requests for the same contribution are rejected, not silently reset.

## 3. Independent decision

A **different** reviewer must inspect the evidence and choose a decision:

```sql
select private.scene_decide_correction(
  '<review-uuid>', 'operator-two', true
);
```

Use `false` to dismiss an incorrect report without changing points. The requester's own approval is rejected, and the function re-verifies source invalidity.

## 4. Explicit apply

Within 24 hours of approval, a database operator can apply a confirmed correction:

```sql
select private.scene_apply_confirmed_correction(
  '<review-uuid>', 'db-operator'
);
```

The operation rechecks the canonical event and blocks application when the source has been restored, the credit was already invalidated, or the seven-day cycle window has elapsed. **If any reward has already been paid for any linked cycle, application fails and requires separate finance reconciliation.** Do not delete actual XP receipts or ledger entries to circumvent this guard.

On successful application, **all linked credits for the confirmed invalid event are soft-invalidated together** (never deleted), including daily, weekly and monthly credits. For a cancelled/voided gig outcome, this covers **all affected performers**; if only one musician's lineup evidence is invalid, other legitimate performers keep their points. Each affected contribution/cycle is recorded separately in `private.scene_correction_affected`. The review is marked applied, and city objective/cycle status and mural unlocks are reconciled in the **same database transaction**. Player wallets are never debited here.

## 5. Verify afterward

Run the provenance preview again and inspect the specific review and contribution, then check the authenticated city board. Invalidated contributions should no longer count towards goals and any milestone falling below its threshold must no longer be displayed. Verify the scoring scheduler, payouts and related claims as well.

To investigate an operator action:

```sql
select id,contribution_id,status,requested_by,request_reason,
  evidence_reference,requested_at,approved_by,approved_at,
  applied_by,applied_at
from private.scene_correction_reviews
order by requested_at desc limit 50;
```

The review's linked credits are auditable with `select * from private.scene_correction_affected where review_id='<review-uuid>';`. Keep source activity and review history intact. Restoration of incorrectly invalidated history requires separate reviewed remediation; do **not** simply delete an audit row or edit XP balances.

## Security

The review table is in `private` with RLS and no grants to `anon`, `authenticated`, or `service_role`. The queue, approve, validate and apply functions are `SECURITY INVOKER` with their default public execute permission revoked, including from `service_role`. They are **DBA-only manual actions**, not available to the Edge processor or browser. Existing verified scoring remains active and XP payout activation remains independently guarded and disabled.
