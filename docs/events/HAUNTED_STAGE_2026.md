# The Haunted Stage — Halloween 2026

## Dates and cosmetic

- Event window: **24 October to 1 November 2026**, inclusive, in `Europe/London` time.
- Every existing player character receives the **Haunted Pumpkin Hat 2026** as a permanent owned clothing item.
- New playable characters created through 1 November receive it too.
- The hat is in the **headwear** slot, replaces any other equipped hat, and is **not auto-equipped**.
- The wardrobe and stage share Avatar V1's `assemblePlayerModel` renderer; the `render_config.headwearStyle = "pumpkin"` item creates a head-bone-bound mesh which follows performer animations in the 3D gig viewer. Frozen gig appearances must continue to use their persisted equipped-clothing snapshots.
- The item remains in inventory and remains wearable after the event ends.

## Gameplay rules (implemented in rewards PR #4182; deploy only after testing)

For an eligible **completed** gig during the event, inspect the **performer's server-authoritative equipped item at the relevant gig snapshot time**, not the client's current appearance, and require the pumpkin hat item key `clothing.halloween.2026.pumpkin-hat`.

- Roll one performance bonus per eligible performer per gig: **+5%** (50% probability), **+10%** (35%), or **+15%** (15%).
- Apply the band-wide average of qualifying performer rolls (non-wearers contribute zero) to the authoritative performance score **before commerce settlement**. Existing outfit plus Halloween bonus share a 25% total modifier ceiling; the final rating remains capped at 25/25.
- On their first eligible *completed* Halloween gig, reward each character **500 XP once** and award permanent **Pumpkin Headliner 2026** achievement.
- Subsequent eligible gigs receive a new performance roll, but no duplicate XP or achievement.
- Store the chosen bonus and reward evidence under stable `gig_id + profile_id + event_id` unique keys; repeated worker runs must use saved outcomes, not reroll.
- Canceled, non-performed and out-of-window gigs must not qualify.
- Eligible contexts: normal, tour and festival gigs when using the canonical completion/settlement path.

## Login announcement and release gating

The `halloween_2026_event` setting is separate from the ordinary `announcement_banner`. Migration `20261016090000_halloween_2026_announcement_settings.sql` seeds:

- `enabled: false`: admin-controlled publication gate via Admin → System Status & News Banner.
- `rewards_live: false`: back-end release gate. The admin page cannot activate the announcement until the actual gig rewards have shipped, been tested, and the gate has been explicitly marked ready by a controlled migration.
- `starts_at: 2026-10-23T23:00:00Z` and `ends_at: 2026-11-02T00:00:00Z`: exactly the 24 Oct–1 Nov window in Europe/London. The end is **exclusive**.

When both gates are on and the clock is inside the window, authenticated players get a **dismissible first-login dialog** with the hat, equip path, reward mechanics and explicit deadline. Dismissal uses a separate local key per account and active character, so it is not repeated every navigation; the **dashboard banner stays available** for reminder and review. Public landing and auth also show a concise notice without overriding other news banners. The time boundary removes all notices automatically.

If the reward deployment is delayed, leave `rewards_live` disabled: do not advertise nonexistent +5–15% / 500 XP / achievement. Once verified, enable the rewards flag through the migration rollout and the announcement in System Status. No date- or button-only client change should ever grant gameplay rewards.

## Canonical data path

- `20261016103000_halloween_2026_gig_rewards.sql` adds a frozen `halloween_2026_gig_outfits` row for each selected/performed participant at the authoritative gig start, with a persisted weighted roll based on gig ID + profile ID. Equip changes after the snapshot do not affect the result.
- The service-role-only `get_halloween_2026_gig_bonus` resolver averages the frozen values, counting non-wearers as 0. `complete-gig` uses that value alongside ordinary clothing before settlement and stores `xp_breakdown.halloween_2026`.
- The completed-gig database trigger verifies the real event window, live completion, at least one performed song, and participation; the `halloween_2026_first_rewards` primary key guarantees 500 XP and the achievement at most once per character, even across gig retries or concurrent completions.
- `GigOutcomeReport` renders the **persisted** bonus, and confirms first-time 500 XP only when the current profile appears in the authoritative claim list.
- No backfill for gigs that started without an immutable equipment snapshot: missing evidence fails closed. The hat stays owned after expiry.

## Full regression matrix and how to run

| Area | Automated coverage | Additional release sign-off |
|---|---|---|
| Gifted wearable | `supabase/functions/complete-gig/halloween-2026.integration.test.ts` asserts free, unique, non-equipped grant; `supabase/tests/halloween_2026_rewards.sql` validates seeded item | Existing/new character accounts after applying original hat migration |
| Avatar V1 / gig viewer | `src/features/player-model/accessories.test.ts` checks both frames, actual head-bone geometry, gig animation, archived snapshot after wardrobe edit | Visually verify different hair styles, singer/guitar/bass/drums, camera close-ups and replay |
| Start/expiry dates | `src/features/seasonal/halloween2026.test.ts`, `HalloweenEventNotice.test.tsx` and SQL UK BST/GMT tests | Check midnight transition with server clock, not browser time |
| Welcome popup / notices | `HalloweenEventNotice.test.tsx`: modal, dismissal, second character, public login link, dashboard card, reward text, gates | Verify on narrow phone, desktop, festival mode and Today's News |
| Performed-gig bonus | `halloween-2026.integration.test.ts` tests settlement ordering, audit and combined cap; SQL checks 50/35/15 roll buckets and snapshot immutability | Synthetic completed gigs in an isolated Supabase environment, solo/band/festival/tour; ensure actual rating, profits and fans change |
| XP and achievement | SQL test checks private claims, unique PK and required achievement; integration test guards completed-only ledger logic | Complete two gigs and run worker twice; assert 500 total XP and a single achievement |
| Security | SQL privilege/RLS assertions; contract prohibits accepting client roll/equipment | Verify anon and other-user cannot read/write private snapshots or claim reward |
| Result report | `HalloweenGigRewardSummary.test.tsx` confirms persisted bonus and character-specific reward, never invents results | Check reporting after refresh and late retry |

A file being present is **not** proof its test has passed. Validate migration order on an **isolated test DB**, run `supabase/tests/halloween_2026_rewards.sql` within its rollback transaction, then run repo Vitest, typecheck, lint and build in CI. The current production database has not received these new migration files.

## QA gates

1. Existing and newly created playable characters receive exactly one unequipped item.
2. Masculine and feminine models visibly wear the mesh in their wardrobe, previews and live 3D performances; the pumpkin follows head animation.
3. Wearing a store headwear item overrides the selected starter hat; unequipping it restores the starter.
4. The outfit is preserved in replay snapshots; no re-query of a currently edited wardrobe to rewrite historical costumes.
5. Idempotency and event-date boundary tests are required before enabling performance/XP/achievement rewards.
6. Do not enable `bonus_config` for this item as a stand-in for the per-gig random bonus.


## Live release runbook — October 2026

**Time window (Europe/London):** 00:00 Sat 24 October through 23:59 Sun 1 November 2026. Automatic hard stop is 00:00 Mon 2 November. October 24 starts in BST (2026-10-23T23:00:00Z); the closing date is in GMT (2026-11-02T00:00:00Z).

1. **Prelaunch database:** All five Halloween-related schema stages are applied (gifted hat, notice defaults, gig rewards, immutable replay wardrobe, and retry-safe first-claim audit). The separate admin preflight SQL and service-role compatibility migration must also be applied. Never replay the original hat backfill to re-equip or duplicate ownership.
2. **Prelaunch verification:** In Admin → System Status → Halloween, click **Recheck**. Every database check must pass, including gifting, permissions and trigger health. The preflight is a read-only database audit, **not** confirmation of frontend assets or Edge Function versions.
3. **Release artifact verification:** Compare deployed `complete-gig` and `generate-gig-viewer-replay` Edge source to current merged main; do not rely on historical version numbers because unrelated deployments may supersede them. Verify the published website includes the seasonal dialog/dashboard banner and Stage V1 renderer.
4. **Real gig snapshot QA before Halloween:** Have an opted-in test character equip the pumpkin, begin a normal gig and inspect `gig_stage_visual_snapshots` for a record; unequip after gig completion and confirm the historical 3D replay retains the hat. Check both avatar frames and mobile. **Do not alter a real player's completed gig or XP for testing.**
5. **Stage the event only after QA:** An admin explicitly checks the live release confirmation, enables **Mark live gig rewards verified**, enables the separate public announcement switch, and saves. This sets both `rewards_live` and `enabled` while leaving the first day governed by the UTC start boundary. Verify that public notices remain hidden until 24 October.
6. **First real Halloween performance after launch:** A qualifying performer must be wearing the hat **at gig start**, participate in a completed gig with performed songs, and receive exactly one permanent 500 XP award and Pumpkin Headliner achievement. Confirm the saved result uses a rolled +5/10/15% performance boost and displays any first reward from the durable claim. Repeat worker/report retrieval to verify no duplicate XP or erased audit.
7. **Automatic closure:** On/after 2 November midnight UK time, verify the login popup, public strip and dashboard reminder have disappeared and new gigs get no Halloween boost or first-time claim. Players keep the hat and any earned achievement.
8. **Incident rollback:** Use the admin panel to turn **off** the public event switch and reward readiness, then verify both `enabled=false` and `rewards_live=false` in settings. Do **not** delete outfit snapshots, rollback permanent player XP or delete hats. Keep #4179 and #4184 open until live validations are recorded.

**Caution:** A brand-new qualifying Halloween XP transaction cannot be smoke-tested against the live calendar before October 24 without unacceptably manipulating live production clocks or gameplay. The isolated PostgreSQL regression suite tests this logic before launch; genuine award verification happens after the event begins.

### Deferred outcome safety

The initial 500 XP claim is settled on completion when a completed `gig_outcomes` record and performed song already exist. The late-outcome reconciliation migration additionally retries **only** the same idempotent Halloween settlement when an outcome becomes completed or a performed song is inserted **after** the gig has reached `completed`. These triggers never cycle gig status, replay other settlements or reroll outfit bonuses. A gig started while Halloween was disabled does not acquire a snapshot later and is never eligible. The permanent `halloween_2026_first_rewards` claim and `ON CONFLICT DO NOTHING` guarantee at-most-once XP, and the saved report audit is reconstructed from claim rows on retries. Post-launch verification must include a delayed result as well as a normal result.


### Server-side Pumpkin Hat publication interlock

The release switches alone are insufficient evidence that the real Avatar V1
Pumpkin Hat has been visually approved. A hat staged with
`curated_asset_status='asset_ready'` is **not** `published`. Migration
`20261016205500_halloween_2026_reward_publication_interlock.sql`
requires actual catalogue publication at three independent authorities:
gig-start outfit capture, server-read performance bonus, and deferred/completed
first XP/achievement settlement.

- An unpublished item produces no Halloween reward-eligible gig outfit snapshot,
  even if `enabled` and `rewards_live` are both true.
- Publishing after the gig started never backfills that missing outfit snapshot.
- Temporarily removing publication stops new score/XP payouts; pre-existing
  historical snapshots and earned permanent rewards are not erased.
- No migration changes player equipment, seeds fake visual-QA status, awards XP,
  or modifies the admin activation flags.
- `supabase/tests/halloween_2026_reward_publication_interlock.sql` exercises
  real PostgreSQL start triggers, bonus reads, delayed claims, publication
  toggles and idempotent 500 XP on a rolled-back disposable test database. The
  matching Vitest contract ensures the replacement function bodies differ only
  by the new publication check.

**Sign-off remains separate:** inspect and approve the actual Pumpkin Hat in
masculine and feminine Avatar V1 wardrobe, full gig stage and archived playback,
then publish via the existing genuine visual QA workflow. Neither a green CI
result nor both admin switches being enabled proves publication or visual quality.
