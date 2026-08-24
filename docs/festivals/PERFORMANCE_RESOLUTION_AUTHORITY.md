# Festival performance resolution authority

Backlog B3 closes the canonical performance outcome mutation boundary.

`resolve_festival_performance(session_id, idempotency_key)` is the only supported
resolution entry point. It is available to an authorised festival operator or a
service worker, locks the performance session, and returns the already resolved
outcome when a retry races or arrives later.

Before calculation, the function stores an immutable input record containing the
canonical session, audience snapshot, readiness requirements, setlist, equipment,
crew, and incidents. Rivalry is neutral until an authoritative rivalry source is
available. Sponsor and media values are downstream outcome/settlement effects, and
presentation mini-game input is explicitly cosmetic.

The raw deterministic calculator is private to the service role. Resolution
finalises the outcome immediately, records its source hash in outcome metadata,
and emits a `performance_resolved` session event. A partial unique index permits
historical invalidated versions while enforcing exactly one live outcome for each
session. Outcome, song-outcome, audience-snapshot and resolution-input evidence
cannot be edited or deleted after creation.
