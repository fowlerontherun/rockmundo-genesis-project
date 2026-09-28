# Avatar V2 Phase 3 — garment production acceptance matrix

Tracks issue #2204. This is an **artist handoff and acceptance contract**, not proof that a garment has been finished. All 15 existing authoring blockouts remain source-only until each item's real evidence is attached. Phase 1 #2197 must approve **both** fitted, painted body scenes before production garment weight transfer.

## Ordered production queue

| Order | Existing design | Family | Critical fit and material checks |
|---:|---|---|---|
| 1 | RockMundo Logo Tee | tee | UV-baked logo follows actual shirt surface; raised arms, torso twist, singing |
| 2 | Blue Straight Jeans | denim | pelvis, knees, seated drummer and boot overlap |
| 3 | Black Boots | footwear | independent left/right sole, ankle/toe and floor contact |
| 4 | Patch Jacket | outerwear | sleeve clearance, patches welded or surface-bound, guitar/bass grip |
| 5 | Plain Black Tee | tee | collar, armpit and sleeve clearance |
| 6 | Plain White Tee | tee | fabric opacity and body occlusion |
| 7 | Vintage Charcoal Tee | tee | distressed surface maps, no floating decal |
| 8 | Black Straight Jeans | denim | waistband, hems and drumming |
| 9 | Dark Slim Jeans | denim | tighter knee/hip envelope and ankle fit |
| 10 | Brown Boots | footwear | leather grain and ankle bend |
| 11 | Canvas Trainers | footwear | laces and sole grounded |
| 12 | Combat Boots | footwear | laces/hardware anchored and ankle flex |
| 13 | Double Eyelet Belt | accessory | waist/hip attachment, buckle and eyelets stay bound in seated pose |
| 14 | Safety Pin Tee | tee | every pin surface-attached, arm lift and close-up stage camera |
| 15 | Studded Wrist Cuffs | accessory | independent left/right wrist attachment, stick/guitar clearance |

The four-item capsule (rows 1–4) is the first QA milestone. A design is not accepted simply because a preview renders.

## One evidence record per item, separately for masculine and feminine

- [ ] Actual **approved Phase 1** fitted body source reference, source SHA-256 and reviewed joint-fit report.
- [ ] Editable garment .blend, licensed texture sources, artist-created UVs and actual base-colour, normal, roughness/metallic and AO maps. Record texture provenance and dimensions.
- [ ] Mesh skin weights and attachment rules correct for its slot, with no unweighted floating patches, pins, buckles, eyelets or studs. Wrist cuffs must independently follow each side; belt/footwear must not inherit arbitrary torso weights.
- [ ] Neutral front/side/back, arm raise, torso twist, singing, guitar/bass grip, seated drums, ankle/toe bend as relevant. Include close-up attachment views and both frame morph extremes.
- [ ] Body-region occlusion and layer tests: tee under jacket, jeans into boots, exposed skin and tattoo boundaries. No transparent torso holes or body penetration.
- [ ] Four **genuinely distinct** LOD0–LOD3 GLBs per frame at the exact manifest paths, real skins, JOINTS_0/WEIGHTS_0, skeleton names, non-zero meaningful influences (maximum four), budget and binary integrity report.
- [ ] Store exact GLB SHA-256, author, independent visual reviewer, approval date, linked CI run and pose contact sheets before any `validated` mapping.

## Release integration

Keep the existing `avatar_clothing_items.id`, `curated_asset_key`, pack, price, rarity, variants, `player_owned_skins`, equip presets and bonus configurations intact. Write the approved V2 mappings only into existing `garment_config.avatarV2`. Keep sale publication, preview readiness and V2 validation as independent statuses. Previously blocked Punk items stay blocked until independent attachment review; historical legacy purchases must remain recoverable. Preserve V1 fallback in the creator, profiles, gigs and Top of the Pops.

## Reviewer sign-off template

| Item key | Frame | Source SHA-256 | GLB LOD0–3 SHA-256 | Automated report | Contact sheet | Artist | Independent reviewer/date | Decision |
|---|---|---|---|---|---|---|---|---|
| _pending_ | masculine | — | — | — | — | — | — | source-only |
| _pending_ | feminine | — | — | — | — | — | — | source-only |

Do not change a row to accepted without actual binary and visual evidence. See `docs/avatar-v2-garment-rigging-handoff.md`, `docs/avatar-v2-phase1-body-rigs.md` and `docs/avatar-v2-existing-clothing-migration-plan.md`.
