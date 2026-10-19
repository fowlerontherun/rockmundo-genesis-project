# Solo DJ attendance, local followers and capacity-safe settlement — 19 October 2026

## Live rollout
Migration **`20261019134915_dj_verified_set_attendance_local_fans_20261019`** was applied directly to production Supabase project `yztogmdixmchsmimtent`, and the exact SQL copied from the live `supabase_migrations.schema_migrations` ledger into GitHub.

The deployment adds two new tables:

- `profile_city_dj_fans`: canonical city-by-city solo DJ followers with unique `(profile_id,city_id)`, total verified attendances, sets played and last set date. **Not** the band's separate `band_city_fans`.
- `dj_booking_audiences`: immutable, unique-by-booking receipt with venue city, capacity, actual attendance, returning DJ fans, new DJ fans, satisfaction and model input snapshot.

Both have row-level security, authenticated **SELECT for the actual character's account only**, and NO direct authenticated/anonymous INSERT/UPDATE/DELETE privileges. The private demand estimator is not callable by players.

## Atomic DJ-0503 / DJ-0505 settlement
`private.dj_settle_booking_at` still requires an authenticated actor, canonical live booking, live performance session, valid completed slot and server-verified deck A/B play, tempo and crossfade events through the existing readiness guard. In the same settlement transaction, it now also:

1. Loads canonical venue city and capacities. For a verified purchased nightclub, takes the **smaller of catalog capacity and verified owner capacity**. Ownership must be supported by the original receipt. A club may never show more people than its real capacity.
2. Locks (or creates and locks) this character's city DJ fan population using unique `(profile_id,city_id)`. Concurrent settlements in that city serialize on the fan row.
3. Computes deterministic demand from **character fame**, existing local DJ fan population, club quality, club reputation and cover charge. High fame/loyalty increases demand; an expensive cover reduces demand. All inputs are server-owned. `private.dj_estimate_club_attendance` clamps demand to `0..venue_capacity`.
4. Computes attendance-bounded returning fans and a conservative organic fan conversion based on verified performance score; `returning_fans+new_local_fans <= attendance`. Updates persistent city fandom, exactly one venue audience receipt, `player_dj_performances.fans_gained` and the immutable `dj_settlement_ledger.metadata` together.
5. Returns the original canonical performance receipt for any settled-booking retry. None of those fans, attendance totals, audience snapshots or XP/cash rewards can be applied twice. A failed transaction rolls all effects back.

The audience model is an initial solo DJ **deterministic** attendance baseline. It does not yet factor specific genre compatibility, promotion or city/country-wide non-DJ fan demand. Those are future tuning, not silently invented inputs. The club cover price affects *attendance*, but **no club door revenue or additional performer cash is minted**. Club finance/royalties require a separate money-conserving contract.

The existing `DjCareerOverview` now shows total local followers, all-time verified DJ attendance and the latest actual crowd/capacity. Historical instant-play DJ performances remain legacy and do not receive invented city fans.

## Tests run directly against production (all BEGIN/ROLLBACK)
- `supabase/tests/dj_attendance_city_fans_atomic_settlement.sql`: two real independent user fixtures, temporary receipt-verified purchased venue and royalty-safe synthetic audio, two actual funded canonical bookings plus cancelled and missed cases, verified A/B mixer/tempo/crossfade events; asserts one audience receipt, attendance <= capacity, returning+new fans <= attendance, city population totals and performance fans are identical, ledger confirms fan settlement, repeated settlement does **not** double count, missed/cancelled gigs have **no phantom crowd or followers**, and owner cash payouts/refunds still conserve exact escrow.
- `supabase/tests/dj_capacity_fan_rls_model_contract.sql`: zero-capacity and maximum-fame edge cases, attendance monotonicity with fame/local fan base and reverse with higher cover price; actual `authenticated` PostgreSQL role reads its own city fan row, cannot read another character's row, and cannot write fan populations or forge audience snapshots. Anonymous role has no access.

Both tests passed on the live DB and are wired to `scripts/gigs/run-db-gate.sh`, but **a full clean reset/CI verification is not yet equivalent to those live rollback-only tests**.

## Release safety
- No new production `dj_bookings`, funded offers, fan records, audience rows, receipts or changed cash balances were left by the rollback tests.
- `DJ_SCHEDULED_BOOKINGS_ENABLED` and `DJ_FUNDED_OWNER_BOOKINGS_ENABLED` remain disabled until issue #4265's audio, 3D rendering, mobile, crash recovery, concurrency, economic and CI certification.
- Historical migration reset blockers were addressed in merged #4444; service-only finance monitoring is separately tracked by #4446.
