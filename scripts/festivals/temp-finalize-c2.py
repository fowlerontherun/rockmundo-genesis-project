from pathlib import Path

# Temporary branch-only helper. The workflow removes this file after C2 checks pass.
path = Path("docs/IMPLEMENTATION_BACKLOG.md")
text = path.read_text(encoding="utf-8")

old = """## PR C2 — Festival check-in, readiness and leave lifecycle

**Priority:** P0  
**Status:** NOT STARTED

### Scope

- Implement `ready_to_check_in` eligibility.
- Implement server-authoritative check-in.
- Implement early leave.
- Implement completion, cancellation, and refund lifecycle handling.
- Add time/location/edition checks where required.

### Acceptance criteria

- Browser clients cannot directly mutate attendee lifecycle rows.
- Invalid, refunded, or wrong-edition tickets cannot check in.
- State transitions are idempotent and audited.

### Dependencies

- PR C1.
"""

new = """## PR C2 — Festival check-in, readiness and leave lifecycle ([#1646](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/1646))

**Priority:** P0  
**Status:** COMPLETE

### Scope

- Implement `ready_to_check_in` eligibility.
- Implement server-authoritative check-in.
- Implement early leave.
- Implement completion, cancellation, and refund lifecycle handling.
- Add time/location/edition checks where required.

### Acceptance criteria

- Browser clients cannot directly mutate attendee lifecycle rows.
- Invalid, refunded, or wrong-edition tickets cannot check in.
- State transitions are idempotent and audited.

### Implementation notes

- Added a forward-only attendee lifecycle synchronizer that persists `ready_to_check_in` from canonical admission, Festival-local date, current city/travel state, edition and schedule-conflict authorities.
- Existing server-authoritative check-in, early-leave and expiry-completion RPCs remain the transition boundaries; direct browser lifecycle mutations remain revoked.
- Ticket refunds/transfers/cancellations and Festival launch/edition cancellation now propagate into terminal attendee state and release only Festival-owned schedule reservations.
- Added immutable, versioned attendee lifecycle audit events so real status transitions are recorded once while retries remain idempotent.
- Attendance, eligibility and check-in projections now reconcile lifecycle state before use, while C1 admission-issued wristbands remain unchanged.
- Added focused C2 regression coverage for readiness, invalid/wrong-edition admission, terminal propagation, audit idempotency and the C1 wristband contract.

### Dependencies

- PR C1.
"""

if old not in text:
    raise SystemExit("C2 backlog block did not match expected NOT STARTED state")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
