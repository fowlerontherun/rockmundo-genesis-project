# Festival booking hardening notes

## Confirmed PR #1193 findings

Repository inspection confirmed that `band_members` has both `user_id` and `profile_id`, uses `member_status`, and existing commercial/governance code treats `leader`, `founder`, `co-leader`, and `manager` as privileged band roles. PR #1193 used broad active-member checks for commercial booking actions, stored mutable setlists in place, mixed offer-row economics with revision snapshots, and relied on partial per-table idempotency keys rather than one canonical request ledger.

## Corrected authority rules

The hardening migration adds `is_current_band_member`, `can_apply_for_band`, `can_negotiate_for_band`, `can_sign_for_band`, and `can_manage_festival_booking`. Normal active members may read relevant workspace data but cannot submit/withdraw applications, negotiate, accept offers, amend/cancel contracts, or sign. Band leaders, founders, co-leaders, managers, and admins can perform commercial commitments. Festival organisers continue to be authorised through `can_manage_festival_brand`.

## Idempotency architecture

`festival_booking_requests` records operation, actor, entity scope, idempotency key, request hash, result entity and result snapshot. Mutations begin by inserting or locking a request record. Identical retries return the original result; changed input with the same key fails. Because the request record lives in the same transaction, failed mutations roll back without leaving completed request state.

## Offer proposer/acceptor rules

Offer revisions are immutable. `festival_contract_offers.current_revision_id` points to the authoritative current revision; offer-row commercial fields are compatibility snapshots only. The side that proposed the current revision cannot accept it. Counters lock the offer/current revision and require the expected revision number.

## Reservation lifecycle

`festival_stage_slot_reservations` owns provisional/confirmed/released/expired state. A partial unique index allows only one live reservation for a slot. Offer creation can reserve provisionally, acceptance transfers the reservation to the contract, activation confirms it, and cancellation releases it.

## Contract versioning and activation

`festival_contract_versions` preserves immutable contract terms. Signatures must reference the current version and hash. The second signature confirms the reservation, assigns the stage slot with `UPDATE ... RETURNING`, writes schedule blocks, updates application/offer state, and activates the contract atomically. If the slot assignment updates zero rows, activation fails.

## Schedule integration

Activated contracts create idempotent `player_scheduled_activities` blocks for active band members using canonical edition, contract, stage slot and band metadata. Application submission, offers and unsigned contracts do not block schedules. Cancellation cancels related schedule blocks.

## Setlist versioning

Setlist saves create immutable current versions with `supersedes_setlist_id`, `is_current`, and `content_hash`. Previous submitted, approved and locked versions remain intact. Locked setlists cannot be edited. Setlist item `song_id` is now non-null and references `songs`.

## Public/private read rules

`public_festival_lineup_read` exposes only public lineup identity, band/stage names, timing, slot type, headline flag and public status. Economics, terms JSON, signatures, travel/accommodation clauses, organiser notes and private application details remain private. Band and organiser workspace functions return scoped private data through server-side checks.

## Deployment order

Deploy after `20291206090000_festival_booking_contracts.sql`. The migration is additive/corrective and is safe for environments where PR #1193 has already run.

## Rollback strategy

Rollback by reverting the new RPC definitions to the PR #1193 versions and dropping newly introduced tables/columns only after confirming no booking requests, reservations, versions or immutable setlist versions have been created in production.

## Deferred work

Full UI migration, canonical performance sessions, fame rewards, guarantee/deposit payment, bonus calculation, merch settlement, ticket migration and audience simulation remain deferred.

## Booking UI migration update

Player and organiser UI now consume canonical application, offer, contract and setlist services. Legacy festival participation remains only for unresolved compatibility flows; performance sessions and financial settlement are deferred.

## UI hardening checkpoint

The canonical booking UI now has a reusable stable idempotency hook, typed domain projections for booking records, modular components and unit tests for key retry behaviour, progress failure states and currency fallback. Database validation still requires a local Supabase stack.
