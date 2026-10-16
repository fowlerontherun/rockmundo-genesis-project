# 16 October 2026: Halloween migration preflight and safe production reconciliation

Production project: `yztogmdixmchsmimtent`. Event: **The Haunted Stage 2026**.

## Recorded direct database changes

| SQL source in repository | Production migration receipt | Decision |
|---|---|---|
| `20261016090000_halloween_2026_announcement_settings.sql` | `20261016100234_halloween_2026_announcement_settings_disabled` | Applied safely, feature flags **both OFF** |
| `20261016080000_halloween_2026_pumpkin_hat.sql` | `20261016100427_halloween_2026_pumpkin_hat_staged_pending_visual_qa` | Corrected and applied with `curated_asset_status='asset_ready'`, **not published** |
| `20261016103000_halloween_2026_gig_rewards.sql` | None | Hold until gig/XP staging, full suite and visual sign-off |
| `20261016111000_gig_immutable_stage_costume_snapshots.sql` | None | Hold until immutable gig-start snapshot regression tests |

The first attempt to apply the original pumpkin-hat SQL failed and rolled back because `guard_curated_clothing_publication` enforces `validation_notes.result='pass'` **and** explicit passing visual QA checks. **Never fabricate QA results or disable the publication trigger.**

The revised source seeds an unpublished, free, permanent asset-ready hat owned by each existing playable character, and adds a new-profile gift trigger until 2 November 2026 at 00:00 Europe/London. It never auto-equips. At reconciliation, **304/304** existing playable profiles had one gifted hat and **0** had it equipped, by design. Current new-profile grants are enforced by `grant_halloween_2026_pumpkin_hat_on_profile`; no synthetic production accounts were created.

### Required before publishing the hat

1. On a staging deployment, visually inspect **both masculine and feminine Avatar V1 models** with the actual pumpkin mesh. Test hairstyle overlap, outfit/hair clipping, close camera and distant stage shots.
2. Check animation on singer, guitar, bass and drummer, gig viewer and frozen replay, plus clothing selection and starter headwear overrides.
3. Populate **genuine** visual QA evidence in `validation_notes`: `result='pass'` and all five keys under `checks` set to `true` only after confirmation: `surface_attachment`, `graphic_alignment`, `distance_readability`, `silhouette_readability`, `material_readability`. The DB publication trigger then permits `curated_asset_status='published'` and `featured=true`.
4. Do not advertise that the item can be equipped until publication is actually completed and tested.
5. Only after the event reward and snapshot migrations have passed tests, and the completion worker has been deployed/tested, set `rewards_live=true` and separately enable event advertising. Avoid premature login announcements and unearned 500 XP.

### Additional last-seven-days reconciliations

- `20261010181500_correct_discord_invite.sql`: **already effective**. `announcement_banner.cta_url` points to `https://discord.gg/ZNF4hRrj2`. No reapplication.
- `20261010180500_secure_book_reading_cron.sql`: **already effective**. Active job `daily-book-reading-attendance` executes at `0 23 * * *` and reads `internal_cron_secret` from Vault. Secret is present. Avoid rescheduling.
- `20261013184000_achievement_event_reward_integrity.sql`: **blocked**. Requires the missing `achievement_events`, `achievement_rewards` and other canonical schema from `20260713120001_progression_achievements_canonical.sql`. Do not replay without staged compatibility analysis.
- `20261012213100_atomic_sponsorship_installments.sql`: **blocked**. Live `update_band_balance_from_earnings()` still recomputes band balance as sum of earnings, potentially overwriting prior expenses. Do not deploy a new money path until the ledger fix is staged, backed up and verified.

A differently named production receipt does **not** mean the original migration was absent functionally. Do not replay historical SQL automatically. The full 9–16 October file scan found 127 migration files, of which 86 matched migration descriptions and 41 required effect-level reconciliation prior to these two safe direct writes.
