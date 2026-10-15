# Live band governance and mutual-friend privacy repairs — 15 October 2026

**Already applied to production** Supabase `yztogmdixmchsmimtent`. The accompanying files contain exact SQL from the live `supabase_migrations.schema_migrations.statements[1]`. They live under `supabase/production-repairs/` intentionally; **do not blindly replay them as normal migrations**.

| Recorded production version | Functionality | Exact archived SQL |
| --- | --- | --- |
| `20261015162606` | `rockmundo_20261015_band_governance_profile_scoped_compat` | `20261015162606_band_governance_profile_scoped_compat.sql` |
| `20261015163018` | `rockmundo_20261015_privacy_safe_mutual_friend_counts` | `20261015163018_privacy_safe_mutual_friend_counts.sql` |
| `20261015163051` | `rockmundo_20261015_mutual_friend_counts_unnest_fix` | `20261015163051_mutual_friend_counts_unnest_fix.sql` |

## Band governance

The original October band-leave and leadership migrations assume account IDs are band leader IDs. Production `bands.leader_id` references `profiles.id`, so their direct replay would mis-authorise and potentially delete the wrong character membership. A reviewed compatibility adaptation of the hardened Git migration `20300106190000_harden_band_governance_profile_identity.sql` now installs:

- `transfer_band_leadership_atomic(uuid,uuid,uuid)`: current selected living leader only, validates new member (active/living/not touring), updates chemistry and band history atomically.
- `leave_band_atomic(uuid)`: selected owned character only; rejects leader before transfer and solo artist; preserves account-scoped song ownership when another character in the same account remains a member.
- `disband_band_atomic(uuid,uuid)`: selected leader only, atomic status and audit history.
- Three guards prevent ordinary client updates to protected membership identity/privilege/leadership fields, deleting leader memberships, and changing `bands.leader_id` or disbanded status directly.
- Authenticated callers can execute the three owner-checking RPCs; anonymous callers and ordinary clients cannot execute internal guards. Existing generic member table DML grants were left unchanged to avoid breaking unrelated member workflows.

**Verified in rollback-only transactions:** leader departure before transfer denied, cross-account transfer denied, eligible temporarily activated character received leadership, former leader departed, successor disbanded the band, chemistry and audit rows matched expected deltas. A separate test with PostgreSQL `SET LOCAL ROLE authenticated` verified direct leadership update, role edit and protected membership deletion could not be used. All band data changes were rolled back.

## Social mutual friend counts

`get_mutual_friend_counts(uuid,uuid[])` restored independently of the missing `public.player_profiles` social privacy foundation. This callable authenticated function:
- Requires an owned living viewer profile, caps request to 500 target IDs.
- Returns counts **only for accepted direct friendships**, omits blocked and non-friend targets, and does not reveal third-party identities.
- Excludes shared friends blocked by either side.
- Was followed by a tiny forward fix for a PostgreSQL `unnest()` alias error; **both recorded SQL revisions are archived for faithful history**. The second version is the working one.

**Verified in rollback-only transactions:** existing accepted friend returns a numeric count, stranger absent, other-account caller denied, and inserting a temporary block hides the previously visible count. The block was rolled back.

**Not restored**: `get_safe_friend_suggestions` requires `player_profiles`, which remains absent; its original migration fails closed as designed. Do not fabricate social consent records or run the full original without applying and reviewing the privacy foundation.

## Operations

- Production migration count after these three direct repairs: **1,461**.
- No historical band operation or friend data backfill was applied; no live band or friendship was permanently modified by testing.
- Security advisor still reports pre-existing broad SECURITY DEFINER exposure and mutable function search paths. These need separate caller-by-caller review.
- Recording and AI song Edge Function versions from previous maintenance remain deployed; live provider end-to-end testing is separate.
