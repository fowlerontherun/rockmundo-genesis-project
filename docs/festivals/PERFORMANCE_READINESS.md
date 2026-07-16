# Festival Performance Readiness

Readiness is calculated server-side by `festival_session_readiness(session_id)` and locked by `lock_festival_session_readiness(session_id, idempotency_key)`. The lock snapshots attendance, equipment, crew, technical and incident evidence so later membership, setlist or equipment edits cannot silently rewrite the performance record.

## Dimensions

- **Attendance / arrival**: expected performers, checked-in performers, missing required performers, late performers, required roles and next deadline.
- **Travel and schedule**: represented as blockers/warnings in readiness facts; check-in does not teleport a performer.
- **Health and wellness**: uses deterministic categories (`excellent`, `ready`, `strained`, `compromised`, `unfit`) and remains read-only until explicit lifecycle/outcome processing.
- **Equipment**: required item, supplier, assigned performer, condition, availability, compatibility, readiness and issue reason.
- **Crew**: required role, assigned entity, skill, attendance, conflict, supplier and readiness.
- **Technical rider**: unresolved recognised requirements and critical soundcheck issues remain blockers; unrecognised free text is not silently satisfied.
- **Soundcheck**: begin, record issue, resolve issue and complete actions create evidence without calculating final quality.
- **Setlist**: one locked immutable snapshot is consumed by the session.
- **Incidents**: operational incidents are persisted with severity, source, impact and resolution.

## Overrides and audit

Readiness lock returns the same snapshot on retry. Remaining blockers keep the session out of `ready` unless a future authorised override path records an actor and reason. Events are persisted in `festival_performance_session_events` rather than frontend logs.

## Deferred work

Audience simulation, song quality scoring, crowd response, fan conversion, fame/popularity rewards, guarantees, bonuses, merch and ticket settlement are intentionally not calculated here. The next PR should consume this immutable readiness and progression evidence.

## Festival audience outcome integration

Audience simulation and performance outcomes now read immutable festival session evidence, generate canonical crowd/highlight records for viewers, and leave settlement pending.
