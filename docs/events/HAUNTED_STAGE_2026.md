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

## QA gates

1. Existing and newly created playable characters receive exactly one unequipped item.
2. Masculine and feminine models visibly wear the mesh in their wardrobe, previews and live 3D performances; the pumpkin follows head animation.
3. Wearing a store headwear item overrides the selected starter hat; unequipping it restores the starter.
4. The outfit is preserved in replay snapshots; no re-query of a currently edited wardrobe to rewrite historical costumes.
5. Idempotency and event-date boundary tests are required before enabling performance/XP/achievement rewards.
6. Do not enable `bonus_config` for this item as a stand-in for the per-gig random bonus.
