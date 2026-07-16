# Festival booking contract model

## Responsibilities

The canonical booking layer is edition-scoped. `festival_applications` records a band's application to a `festival_editions` row. `festival_contract_offers` and immutable `festival_offer_revisions` record organiser invitations and counters. `festival_contracts` becomes authoritative only after a specific offer revision is accepted and both required sides sign the same contract version. `festival_contract_setlists` and `festival_contract_setlist_items` persist the festival-specific performance plan for an active contract.

## State machines

Applications use: `draft`, `submitted`, `under_review`, `waitlisted`, `shortlisted`, `offer_pending`, `withdrawn`, `rejected`, `expired`, `converted_to_contract`. Terminal states cannot be edited as active applications.

Offers use: `draft`, `sent`, `viewed`, `countered`, `accepted_pending_contract`, `declined`, `withdrawn`, `expired`, `converted_to_contract`. Counters require the current revision number and create immutable revision rows.

Contracts use: `draft`, `proposed`, `awaiting_band_signature`, `awaiting_organiser_signature`, `awaiting_signatures`, `active`, `amendment_required`, `cancelled`, `terminated`, `fulfilled`, `breached`, `expired`. Activation is server-side and occurs once both band and organiser signatures exist for the same version.

Setlists use: `draft`, `submitted`, `approved`, `changes_requested`, `locked`, `performed`, `cancelled`. Locked setlists cannot be edited.

## Application, offer and contract separation

A submitted application is not a booking. An accepted offer creates an awaiting-signatures contract and still does not book the band. A band is canonical lineup data only when the contract becomes `active`.

## Signature rules

`festival_contract_signatures` stores one signature per side and contract version. Signing an older version fails. Material amendments increment the contract version and reset incomplete signature state. Idempotency keys make retries safe while rejecting reuse with different terms.

## Setlist lifecycle

Bands save drafts through server RPCs. Duration is calculated from persisted items and validated against the contract terms. Organisers can approve or request changes but cannot silently rewrite song choices. Locked setlists are preserved for later performance-session references.

## Stage-slot compatibility

`festival_stage_slots` remains a hybrid legacy table. The booking migration adds `canonical_contract_id` so activation can mark one linked stage slot as confirmed while preventing two active canonical contracts from claiming the same slot. If no compatible slot exists, logical slot details live in the immutable terms snapshot. Full stage re-keying is deferred.

## Public/private data

`public_festival_editions_read()` and `public_festival_lineup` expose safe public projections only. Economics, travel, accommodation, negotiation revisions, organiser notes, eligibility internals and signatures remain behind RLS and private RPCs.

## Legacy migration rules

Legacy participant, offer and setlist data remains compatibility data. Backfills are conservative and idempotent: they only create canonical records where a deterministic edition mapping exists and they preserve legacy terms as metadata rather than inventing economics.

## Cancellation behaviour

Contract cancellation requires a reason and releases compatible stage-slot claims. Financial settlement, clawbacks and rewards are deliberately not performed in this PR; future settlement metadata can be attached later.

## Deferred work

Canonical performance sessions, attendance simulation, fame, money, merch, reward settlement, full stage migration and historical performance migration are deferred to follow-up PRs.

## 20291207090000 hardening correction

The booking model now treats offer revisions and contract versions as immutable authority, with `festival_booking_requests` for idempotency, `festival_stage_slot_reservations` for slot concurrency, server-side band authority helpers, atomic activation, and immutable current setlist versions.

## Booking UI migration update

Player and organiser UI now consume canonical application, offer, contract and setlist services. Legacy festival participation remains only for unresolved compatibility flows; performance sessions and financial settlement are deferred.

## UI contract handling update

The booking UI now renders contract terms through readable sections shared with offer summaries. Signing actions are presented as authorised-side actions with immutable version acknowledgement, rather than letting users choose an arbitrary signing side from generic UI state.

## Workspace authority projections

Booking workspaces must treat signing, negotiating, cancellation, setlist review and setlist lock authority as server-projected data. UI components may hide or disable unavailable actions, but the canonical RPCs remain authoritative and must reject stale or unauthorised writes.

## Performance-session handoff

An active `festival_contracts` row can produce exactly one `festival_performance_sessions` row. The session stores immutable setlist and readiness snapshots and creates settlement-pending completion evidence only. Financial settlement, guarantees, penalties and fame rewards are deferred to later outcome/settlement PRs.
