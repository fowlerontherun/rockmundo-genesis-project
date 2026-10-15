# Direct-production education compatibility repairs — 15 October 2026

These are exact SQL statements already applied to Supabase `yztogmdixmchsmimtent`, stored outside `supabase/migrations/`. **Never replay them through a blanket `supabase db push`.**

| Live migration version | SQL archive | Outcome |
| --- | --- | --- |
| `20261015154951` | `20261015154951_education_video_reward_live_schema_compat.sql` | Restored `reward_education_video_atomic`; catalog-backed UUID and skill selection, 2 claims per rolling 2 hours, profile ownership and active/living checks, row-lock serialization, canonical XP wallet plus `experience_ledger`, bounded existing unlocked skill XP, claim RLS |
| `20261015155319` | `20261015155319_legacy_skill_book_inventory_write_lock.sql` | Removed anonymous/direct client write privileges to the empty legacy `player_skill_books` inventory; retained character-scoped authenticated SELECT |

## Verification

- Transactional production test awarded 15 XP twice to a valid test profile, verified 30 wallet XP/SXP, unchanged AP, 2 claim rows and 2 audit entries, denied a third claim within 2 hours, and rejected a different account. The transaction was rolled back. Final `education_video_reward_claims` row count: zero.
- `player_skill_books` had zero rows before and after hardening. RLS enabled; `authenticated` has SELECT but no INSERT/UPDATE/DELETE; `anon` has no SELECT. Existing frontend inventory code only performs SELECT and calls a separate completion RPC.
- Migration history increased from 1,452 to 1,454.

## Outstanding limitations

- The client reports a video as watched when the Watch button is clicked; server verification of *actual playback completion* remains unimplemented. This repair restricts awards to catalogued resources, correct character, and rolling server quota, but it is not cryptographic or attested watch proof.
- The legacy `complete_legacy_skill_book_atomic` RPC is deliberately **not installed**. The original migration refers to missing `progression_award_action_xp` and the legacy inventory has no rows; introducing an XP payout before canonical purchase provenance has been reconciled would create risk.
- Existing `player_xp_wallet` client writes and more broadly exposed definer functions require a coordinated client/database permissions migration, not blind revocation.
- Payroll and sponsorship migrations still require canonical ledger reconciliation, backups, and rollback/concurrency tests.
