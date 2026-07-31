# Festival settlement effect authority audit

Audit date: 2026-07-31. Scope: `main` including #1448 and the fail-closed repair in
`20291218244400_fail_closed_festival_canonical_effects.sql`.

## Meaning of “applied”

`festival_effect_authority_results` is an audit pointer only. It is not a domain
transaction and its UUID is never application evidence. An applied response must
name the authority and domain table/service, identify the canonical record and
subject, and persist before/requested/validated/after state, stable reference,
evidence digest, rules version and application time. Both the worker and the
acknowledgement RPC validate the typed response. Replay must load and validate the
domain record; a missing record is `FESTIVAL_EFFECT_CANONICAL_RECORD_MISSING`.

## Audit matrix

“No” under mutation is intentional and blocking. The #1448 adapter only bounded a
delta and generated a receipt UUID for most branches. This audit does **not** call
that a progression integration. The generic handler now fails with
`FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING`, so none of these incomplete effects
can be acknowledged or allow settlement completion.

| Effect | Wrapper | #1448 target/RPC and classification | Intended canonical authority / record ID | Before / after verification | Idempotency and crash recovery | Canonical mutation | Integration / disposable DB | Remaining work |
|---|---:|---|---|---|---|---:|---|---|
| performance_result | Yes | authority receipt; surrogate only | shared gig calculation and persisted performance outcome ID | runtime performance, completed setlist and existing outcome / same persisted outcome | Festival performance stable reference; resume existing outcome | No | No / No | Build the shared-gig adapter; do not award progression twice |
| band_fans | Yes | calculated `appliedDelta`; surrogate only | canonical fan event ID and `bands.weekly_fans` projection | lock band total / query event and exact new total | unique stable reference; transaction with projection update | No | No / No | Use the live-event fan authority and validate audience/billing/fit |
| band_fame | Yes | calculated `appliedDelta`; surrogate only | band fame event ID and `bands.fame` | lock fame / event plus projected fame | unique stable reference | No | No / No | Integrate canonical fame rules and event ledger |
| member_xp | Yes | attendance check plus receipt; partial validation, no mutation | progression/XP transaction ID and `profiles.experience` | profile, historical membership and attendance / ledger plus capped XP | effect stable reference in XP ledger | No | No / No | Call player progression service; validate join time and caps |
| band_chemistry | Yes | `recalculate_band_chemistry`; partial mutation, missing contribution | `band_contribution_events.id` | completed performance and chemistry / contribution then recalculated chemistry | contribution source uniqueness; recalc is replayable | No | No / No | Insert one contribution for each attending member before recalc |
| song_familiarity | Yes | performed-song check plus receipt; surrogate only | song progression event ID | authorised completed setlist song and familiarity / event and new familiarity | song/performance stable reference | No | No / No | Integrate rehearsal/performance familiarity authority |
| song_popularity | Yes | performed-song check plus receipt; surrogate only | song popularity/exposure event ID | completed song and popularity / event and `songs.popularity` | song/performance stable reference | No | No / No | Add exposure adapter; keep balance separate from familiarity |
| festival_company_reputation | Yes | calculated delta receipt; surrogate only | company reputation event ID and canonical company projection | dimension projection / event and bounded new value | dimension-scoped stable reference | No | No / No | Add narrow company reputation domain adapter |
| festival_company_fame | Yes | calculated delta receipt; surrogate only | company fame event ID and company/brand projection | company fame / event and new fame | stable reference | No | No / No | Integrate company/brand fame system |
| artist_relationship | Yes | generic subject receipt; missing contract validation | canonical relationship event ID | booking contract, payment and performer / relationship event and projection | contract/performer stable reference | No | No / No | Integrate relationship system and reject unmatched subjects |
| sponsor_relationship | Yes | generic subject receipt; missing agreement validation | sponsor relationship event ID | sponsor agreement, delivery/payment evidence / relationship event | agreement/sponsor stable reference | No | No / No | Integrate sponsor/company relationship authority |
| achievement_award | Yes | `complete_achievement_for_event`; partial canonical mutation | `player_achievements.id` | valid key and recipient / persisted award and evidence `awarded_at` | source event is idempotency key; current duplicate path may return null | No | No / No | Resolve existing award on replay and prove achievement rewards run once |
| licence_progress | Yes | copied request and generated UUID; surrogate only | licence-progress/application-evidence ID and licence projection | current licence and measured requirements / persisted eligibility record | edition stable reference | No | No / No | Implement licence requirements and application adapter |
| world_event | Yes | inserts `world_events`; real mutation with unsafe old retry boundary | `world_events.id` | source settlement / row with matching stable reference | unique metadata stable-reference index now prevents duplicate insertion | Partial | No / No | Handler must select existing row after unique conflict and return typed evidence |
| notification | Yes | receipt only; surrogate only | `notifications.id` | recipient profile/user and typed route / visible notification row | recipient/type stable reference | No | No / No | Prepare one effect per recipient and use notification authority |
| tax_projection | Yes | zero-tax N/A; non-zero receipt only | `festival_edition_tax_lines.id` or aggregate ID | settlement lines and tax rules / sum equals settlement tax | unique settlement-line/rule | No (zero is N/A) | No / No | Insert authoritative lines transactionally and reconcile exact total |

## Enforcement now active

1. `_festival_apply_canonical_effect` contains no generic success path. Until a
   wrapper is replaced by its domain implementation it fails closed.
2. Worker responses must declare the effect-specific canonical record type and
   match canonical ID, authority, domain table/service, subject, stable reference,
   rules version, requested change and evidence digest, with structured
   before/validated/after state and a valid application timestamp.
3. `acknowledge_festival_settlement_effect` repeats that validation and rejects a
   canonical ID or table/service that points to
   `festival_effect_authority_results`.
4. Missing/incomplete authorities dead-letter immediately into a non-completable
   repair state instead of being retried as though a transient outage occurred.
5. World-event stable references are unique at the domain table boundary.

## Completion status

No effect is certified complete by this matrix. The fail-closed safety repair is
complete; the domain integrations and disposable-database lifecycle assertions
listed above remain required before Festival settlement can legitimately reach
`effects_complete` and `completed`.
