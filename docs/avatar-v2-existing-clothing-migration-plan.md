# Avatar V2: migrate existing clothing and skin sets before adding new stock

**Status:** implementation plan + live, read-only audit. No catalogue or customer
inventory mutations, and no production V2 garments certified by this document.

## Verified baseline (RockMundo database, 26 September 2026)

| Existing stock | Current state | Migration implication |
|---|---:|---|
| All clothing-item records | 57 | In-place upgrades; do not create duplicate store SKUs |
| Published curated items | 14 | First V2 garment production wave; available to players today |
| Temporarily blocked curated items | 4 | Fix attachments and visual QA before allowing sale |
| Legacy items | 39 | Preserve historical ownership and compatibility; review individually |
| Active curated collections | 2 | Starter Wardrobe (10 published), Punk Essentials (4 published, 4 blocked) |
| Existing V2 garment mappings | 0 | **No current item can yet be certified for the live V2 renderer** |
| Published items with `preview_status='pending'` | 14 | Check generation/output references and reconcile metadata; do not assert renders are missing solely from this status |
| Items with enabled bonuses | 14 | Keep each existing `bonus_config` and equip behaviour unchanged |
| Legacy items without a collection | 39 | Do not silently sell, move, delete, replace or equip unknown legacy stock |

The four blocked Punk items already have preview status `ready` but fail
their **rig-attached detail placement** visual-QA requirement. An available
preview is not approval to republish those items.

The 14 published bonuses currently cover nine performance, four recording,
three songwriting, three daily XP and two daily AP configurations. Individual
items can contain more than one category. Preserve all configured values,
ownership and gameplay calculations during the art migration.

The **Admin → Curated Skin Packs** page contains a new dynamic read-only
V2 migration work queue. The live totals above are a baseline, not hardcoded
into the page. Refresh to re-evaluate additions, pack reassignments and proof
status; it never silently updates the live database.

## Non-negotiable migration contract

1. Keep each existing `avatar_clothing_items.id`, `curated_asset_key`,
   `collection_id`, price, rarity, limited/premium flags and selected colour
   variants. Never give an existing owner a different inventory ID and never
   require a second purchase. All `player_owned_skins` records, purchase
   history, equip choices, presets and applicable bonus data must survive.
2. Add artwork under the **existing** `garment_config.avatarV2` namespace,
   not in a duplicate skin shop, parallel purchase table or procedural
   browser garment creator. An item has separate masculine/feminine LOD0–3
   paths and exact approved occlusion regions. Material zone names are
   explicit and retained when customised.
3. **Keep V1 available** for every outfit whose body/garments/accessories
   cannot be assembled and validated together in V2. Neither the latest
   genuine source-only models nor the separate provisional head-turn and
   eye-gaze proofs are artist-fitted production skeletons.
4. Do not equate `curated_asset_status='published'` (sale availability),
   `preview_status='ready'` (preview processing), and
   `garment_config.avatarV2.status='validated'` (V2-specific garment QA).
   These are independent stages. An item's V2 mapping is never considered
   complete just because it has a GLB filename.
5. Do not extend or silently rebalance existing paid-item performance,
   recording, songwriting, daily XP/AP or rarity boosts. Any future new
   bonuses need separate balance, stacking-cap and fairness review.
6. A discontinued legacy garment remains recoverable and displayable for
   prior owners. Hiding it from **new** sales is not deletion from wardrobes.

## Release sequence and actual existing-item assignments

### Phase A — baseline, real geometry and storefront truth

- Use the migration work queue to enumerate **all** current items regardless
  of sale visibility. Flag missing/duplicated keys, missing pack membership,
  absent V2 paths, incomplete frames/LODs, missing occlusion and broken
  preview metadata. No auto-fixing status, sale or purchase records.
- Reconcile the 14 published `pending` preview statuses with **actual**
  available and verified image assets. Re-generate missing proof images from
  authoring geometry; update metadata only after the assets pass inspection.
- Stabilise the full V2 body skeleton first: manually fit head, shoulders,
  clavicles, wrists, fingers, hips, knees and toes to the real source. Author
  eyelid, mouth and singing morphs; valid real LOD0–3 and body region masks
  are prerequisites for final skinned-clothing certification.
- Preserve current curated item keys and bonus values as immutable
  before/after regression fixtures.

### Phase B — upgrade the 14 **already published** garments

Reuse underlying authored garment *silhouettes* wherever possible, with
distinct approved texture sets, material colours and surface-bound details.
Do not make 14 copies of a procedural box garment.

| Collection | Existing items | Shared V2 authoring families |
|---|---|---|
| Starter Wardrobe | Rockmundo Logo Tee, Plain Black Tee, Plain White Tee, Vintage Charcoal Tee | Fitted and regular crew-neck tees; high-resolution UV-baked logo/decal **on the actual shirt surface** |
| Starter Wardrobe | Dark Slim Jeans, Blue Straight Jeans, Black Straight Jeans | Distinct slim/straight denim fits, real seams, waistband, hems and fold-aware deformation |
| Starter Wardrobe | Canvas Trainers, Black Boots, Brown Boots | Anatomical left/right footwear with real sole, lace or leather detail and ankle/toe deformation |
| Punk Essentials | Biker Jacket | Fitted layered leather jacket with zipper/collar/lapels physically constrained to garment |
| Punk Essentials | Red Tartan Trousers, Black Tartan Trousers | Properly aligned tartan UV pattern and trouser seams; distinct colourways of the validated fit |
| Punk Essentials | Combat Boots | Reinforced boot silhouette, laces, leather grain and bend-safe ankles |

For each item: fit **both** masculine and feminine frames; make genuine
four-distance LOD0–3 GLBs and masks, not renames of the same quality. Build
approved authored normal/roughness/metallic and ambient-occlusion maps.
Use close-up texture detail for LOD0 while preserving clear patterns and
legible Rockmundo branding at performer distance. Texture resolution and
geometry budgets must pass desktop **and mobile** performance measurements;
avoid enormous single textures or floating decorative text.

Existing dyes, variant keys, editable `main`/`trim` colour zones, visual
tattoo coverage, outfit presets and applicable boosts must survive. Keep
existing asset IDs stable; a common rigged tee silhouette may share mesh
topology while having distinct authored maps and purchase records.

### Phase C — correct the four **blocked** Punk items

| Existing blocked item | Current documented blocker | Release evidence |
|---|---|---|
| Safety Pin Tee | Rig-attached detail placement | Safety pins anchored to mesh or UV, no detached parts through singing, guitar and bass poses |
| Patch Jacket | Rig-attached detail placement | All patches attached to jacket material/body surface with no sleeve or guitar intersections |
| Double Eyelet Belt | Rig-attached detail placement | Bilateral eyelets/buckle following waist/hip deformation and seated drummer pose |
| Studded Wrist Cuffs | Rig-attached detail placement | Each stud/cuff follows the correct left/right forearm/hand; no guitar-neck or drumstick collisions |

These remain **blocked** until the original documented visual-QA issues
are resolved on both body frames and rechecked in the required roles.
Having existing proof PNGs or passing the V2 GLB contract is not enough.
No premature purchase/republication or automatic `blocked → published`.

### Phase D — reconcile all 39 legacy skins and owned wardrobes

- Join existing legacy rows to purchase/equip records in an authorized
  migration audit, without exposing player identities in admin reports.
- Build a stable old-ID → current-owner/appearance compatibility ledger.
  Individually classify as upgrade-in-place, preserve V1-only for historical
  owners, or hide from **new** sales; no deletion of legacy ownership.
- Review 39 missing pack assignments and any duplicate/equivalent entries.
  Do not auto-assign a legacy garment to a curated pack by name alone.
- Restore original saved colourways, customization zones and tattoo
  occlusion; verify every previously equipped item displays consistently
  in the character editor, player profile, Gig Viewer and Top of the Pops.
- If a legacy item has a unique appearance, commission its own V2
  geometry/texture transfer; do not silently substitute generic clothing.

### Phase E — complete the previously planned eight-set catalogue

Keep the two active packs stable, then expand the remaining planned
collections **after** the first 18 curated items and legacy compatibility
work have measurable completion evidence:

Indie/Britpop (parka, denim, polos and relaxed fits); Rock Stage (leather
and expressive stagewear); Glam Rock (sequins, satin, flare and platforms);
Metal (studded leather and battle-ready footwear); Festival (layerable
summer outfits, wellies and hats); Premium Rockstar (tailored velvet,
luxury footwear and authored hardware). Their higher visual quality must
come from actual fitted mesh geometry and authored materials, not a
procedure that creates oversized objects or loose graphics.

New sets can reuse **approved** silhouette families and shared rig
weight-transfer workflows. Each set needs a coherent look, distinct
surface details and variants, appropriate rarity, realistic boosts only
after balance review, a complete pack preview and accurate Admin counts.

## Per-item visual QA and acceptance

Every replacement V2 wearable requires documented source provenance,
artist-reviewed fitted mesh, clean UVs, correct surface normals, valid
non-empty bone weights with no more than four influences, exact joint
names, pose correctives where needed, validated body occlusion,
material-zone mapping and all four genuine quality LODs on BOTH frames.

Capture front, rear, side, three-quarter and close-up attachment proofs.
Test idle, singing, guitar, bass, seated drumming and full stage lighting;
also check both shoulder extremes, elbow bends, knee bends, ankle flex
and combinations of long hair, glasses, two independent earrings, hats
and tattoos. Require no stretched branding, hovering decals/studs,
clipped hands through guitars, missing drumsticks, detached belts,
transparent torso holes, incorrect garment-over-tattoo masks or
equipment floating in space. Repeat at mobile and desktop camera
distances and compare full-body performance and memory budgets.

**Acceptance for the first release milestone:** the 14 published items
retain IDs and boosts, have valid real V2 mapping/evidence for two frames
and all 4 LODs, independent V2 garment checks pass and preview metadata
is reconciled. The four blocked items stay off sale until individual
visual QA passes. All 39 legacy items remain safely accessible where
previously owned. Only then consider a controlled player V2 rollout,
with an immediate V1 fallback for any non-compatible outfit.

## Concrete implementation hooks

- Real authoring: `scripts/avatar-v2/blender/` and the separate verified
  Blender source workflow. Keep the currently published head-motion
  experiment quarantined from production asset paths.
- Geometry/asset gates: `scripts/avatar-v2/` validators and
  `public/avatar-v2/clothing/` per-item per-frame LOD files **once authored**.
- Runtime: `src/features/player-model/v2/avatarV2Garments.ts`,
  `avatarV2Registry.ts`, `avatarMeshEngine.ts` and the established V1
  fallback. Catalogue records already support `garment_config.avatarV2`.
- Admin: `/admin/skin-collections` migration audit (read-only) and existing
  `/admin/skin-collections/:id/items` pack asset manager (future
  per-item review/sign-off). Retain existing preview/bonus/rarity controls.
- Proof: V2 preview for players remains explicitly **preview-only** until
  full-body fit, performance, garment and tattoo integration pass.

**Do not seed fake production GLBs or mark any existing garment validated
to make dashboard counts look complete.** The work queue is deliberately
live and shows the gap until actual visual/functional proof exists.
