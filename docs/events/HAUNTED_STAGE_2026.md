# The Haunted Stage — Halloween 2026

## Dates and cosmetic

- Event window: **24 October to 1 November 2026**, inclusive, in `Europe/London` time.
- Every existing player character receives the **Haunted Pumpkin Hat 2026** as a permanent owned clothing item.
- New playable characters created through 1 November receive it too.
- The hat is in the **headwear** slot, replaces any other equipped hat, and is **not auto-equipped**.
- The wardrobe and stage share Avatar V1's `assemblePlayerModel` renderer; the `render_config.headwearStyle = "pumpkin"` item creates a head-bone-bound mesh which follows performer animations in the 3D gig viewer. Frozen gig appearances must continue to use their persisted equipped-clothing snapshots.
- The item remains in inventory and remains wearable after the event ends.

## Gameplay rules (future separate implementation; not included in the cosmetic patch)

For an eligible **completed** gig during the event, inspect the **performer's server-authoritative equipped item at the relevant gig snapshot time**, not the client's current appearance, and require the pumpkin hat item key `clothing.halloween.2026.pumpkin-hat`.

- Roll one performance bonus per eligible performer per gig: **+5%** (50% probability), **+10%** (35%), or **+15%** (15%).
- Apply it to the authoritative performance scoring path before gig settlement, with an explicit bound on the combined effective clothing bonus; do not merely label a report as boosted.
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

## QA gates

1. Existing and newly created playable characters receive exactly one unequipped item.
2. Masculine and feminine models visibly wear the mesh in their wardrobe, previews and live 3D performances; the pumpkin follows head animation.
3. Wearing a store headwear item overrides the selected starter hat; unequipping it restores the starter.
4. The outfit is preserved in replay snapshots; no re-query of a currently edited wardrobe to rewrite historical costumes.
5. Idempotency and event-date boundary tests are required before enabling performance/XP/achievement rewards.
6. Do not enable `bonus_config` for this item as a stand-in for the per-gig random bonus.
