# Quest XP integration: live trigger audit (2026-10-09)

Read-only inspection of the connected Rockmundo Supabase database confirms:

- `public.increment_profile_xp(uuid,integer)` updates **only** `profiles.experience`; it does not write `player_xp_wallet` or an XP ledger. Do **not** use this RPC alone for quest reward payout.
- `player_xp_wallet` has an active `trg_sync_profile_level_wallet` trigger calling `sync_profile_overall_level(profile_id)`.
- `calculate_profile_overall_level(profile_id)` uses `greatest(wallet.skill_xp_lifetime,wallet.lifetime_xp)` plus fame and skill levels. Therefore quest XP must update the correct wallet lifetime/balance fields, not merely profile experience.
- `experience_ledger` has a daily-category-statistics trigger, but no wallet-update trigger was found on that table. Inserting an experience ledger row alone is not a confirmed payout mechanism.
- Repository quest processor depends on absent `profile_action_xp_events` and `xp_ledger`, so it cannot currently run against production.

## Required payout contract

1. Establish intended reward currency: general XP (`xp_balance/lifetime_xp`) versus skill XP (`skill_xp_balance/skill_xp_lifetime`); do not conflate them.
2. Implement **one** trusted atomic payout path: claim row lock, verified quest source check, authoritative wallet update, matching ledger entry, claim status update.
3. Avoid combining `increment_profile_xp` with another mechanism that already updates `profiles.experience`.
4. Check wallet trigger side effects and consistency with existing stipend/university XP.
5. Validate in staging with concurrent calls, duplicate claim, rollback and exact wallet delta assertions.
6. Do not enable definitions until live migrations and payout tests are complete.

No production DDL, reward activation, or XP changes were performed.
