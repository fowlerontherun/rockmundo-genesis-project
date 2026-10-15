# Production rollout: recording/AI workers and legacy crafting tier bridge — 15 October 2026

Production: Supabase `yztogmdixmchsmimtent`. **The following changes are already deployed.** This document is not a rollout instruction or approval to re-run the SQL.

## Live Edge Function deployments

Updated production workers **from existing GitHub `main` source**, including all matching `_shared` module files. Configuration was unchanged.

| Worker | Before | After | Status | Existing `verify_jwt` |
| --- | ---: | ---: | --- | --- |
| `complete-recording-sessions` | 411 | **412** | ACTIVE | false (worker validates service key or verified manual owner internally) |
| `replicate-webhook` | 104 | **105** | ACTIVE | false (signed callback verified internally) |
| `admin-generate-song-audio` | 257 | **258** | ACTIVE | false (admin JWT and role verified internally) |
| `generate-song-audio` | 258 | **259** | ACTIVE | true |

The recording worker now uses `claim_recording_completion`, `award_recording_xp_atomic`, `finalize_recording_completion`, and `release_recording_completion`. The song generators use `reserve_song_generation_atomic` and `finish_song_generation_atomic`; the callback uses the same atomic finalisation to reject stale/duplicate outcomes. All four updated bundles were re-read from the live deployment and verified. No overdue recording jobs and no in-progress audio generation were present at the time of rollout. No provider API calls or live song generation were initiated.

A SQL transaction **explicitly rolled back** after testing reservation, denied non-service caller, duplicate-generation lock, one successful failed-status finalisation and ignored stale finalisation. No test generation attempts remained (56 persisted attempts after verification).

## New database repair: tiered crafting compatibility

Live SQL version `20261015161928`, identity `rockmundo_20261015_crafting_tiered_skill_eligibility_live_compat`.

Exact SQL archived in `supabase/production-repairs/20261015161928_crafting_tiered_skill_eligibility_live_compat.sql`, deliberately outside `supabase/migrations/`. **Do not replay automatically with a db push.**

The 12 legacy crafting recipes use virtual skill names `luthiery` and `percussion`, but the actual tiered skill catalogue uses `luthiery_basic_technical`, `luthiery_professional_technical`, `luthiery_mastery_technical`, `basic_percussions`, and `professional_percussions`. The private effective-skill helper enforces 20-level tier boundary prerequisites and preserves the recipe's original absolute threshold. The `start_crafting_session_atomic` RPC now calls it rather than looking up missing skill slug rows.

The helper is **not executable by anon or authenticated users**; the owner-checked crafting RPC remains authenticated. No player skill row or recipe was rewritten.

Rollback-only verification used a genuinely eligible character with Luthiery Basics level 8 to purchase materials and start an eligible real recipe. The skill level was unchanged. Final counts: 0 crafting sessions, 0 player_equipment, 912 blueprints; unchanged from before testing. Migration history: **1,458**.

## Outstanding work

- Complete a real scheduled recording and a real Replicate generation under the new deployed workers; static bundle checks and rollback-only DB tests do not substitute for provider/network end-to-end results.
- Normal skill unlock and legacy crafting UI still need browser validation.
- Skill-quest rewards are gated by disabled definitions; do not pay or backfill automatically.
- Financial/payroll/sponsorship and remaining privileged social/governance migrations require separate safety reviews.
- Supabase security advisor still lists existing privilege/search-path warnings, but no `security_definer_view` error (cleared previously).
