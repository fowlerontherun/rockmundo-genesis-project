# Player stage models

## Genuine Avatar V2 previews for players

The normal **Avatar Creator** now has an explicit **See the actual new Avatar V2
models** preview switch beside the current live V1 avatar. The Character Hub,
character sidebar and mobile route also link directly to
`/avatar-v2-preview`. The stand-alone page works even when no active player
character has been selected.

Both use the immutable, verified
`avatar-v2-reference-previews/preview-manifest.json` and its original plus
improved Blender proof views for **masculine and feminine** source bodies, plus optional separately verified
experimental head-turn and gaze proofs.
Players can switch front, three-quarter, side and face views and deliberately
opt in to a rotating, zoomable **real .glb**. The 3D module is loaded only after
the player presses its button, and switching away from the active live avatar
unmounts the other WebGL canvas. All references are locked to locally constructed
GitHub preview-only paths; an invalid manifest or unavailable network displays
an honest error and retry rather than any replacement stock mannequin.

This is **not** early access to a working avatar replacement. The original
V2 Blender source and lookdev scenes are unweighted and unequipped. A separate,
optional real Blender **head/eye-motion experiment** uses draft two-influence
head/neck weights and true measured eyeball pivots, with four actual deformed
pose renders and a real but non-certified skinned GLB per frame. It must not
be used as a performance avatar. The remaining body still needs manually fitted
joints, authored full skinning, facial morphs, garments and LODs. The existing Avatar Creator
form still modifies and saves V1 only, the live Gig Viewer still uses validated
V1 models, and no new production LOD or rollout flag is promoted.

`/avatar-designer` and the onboarding appearance step open the full-body Avatar
Creator, replacing the photo-generator designer. Existing profile images remain
stored separately. The editor and gig viewers use the same rig,
modular assembly, skin/clothing dyes and performance poses.

## Shipped behaviour

- Masculine and feminine rig families; height/build, five saved muscle-definition states, skin tone, hair colour and shared head-detail anchors.
- Three heads, seven free top choices (including Topless), and six free choices
  each for bottoms and footwear: 19 starter pieces, 12 named colour swatches per
  clothed slot and a custom colour picker. Every new and existing character can
  equip them immediately; no purchase or grant is needed.
- Three base silhouettes per slot plus fabric/finish variants: striped and plaid
  tops, denim/check/pinstripe bottoms, canvas/two-tone/patent footwear. Local 128px
  textile maps use rest-space UVs so patterns follow the animated rig. These are
  garment designs built from the existing meshes, not 18 new mesh silhouettes.
- Free starter clothing and standard instrument finishes. Saving costs nothing
  and does not affect skill, cash, equipment ownership or gig outcomes.
- Five hat states (none, beanie, baseball cap, bucket hat, fedora), five eyewear states (none, round, square, aviator, sunglasses), and four earring states (none, studs, hoops, drops), with named colours and a custom picker. Accessories fit from measured head bounds, attach to the animated Head bone and are saved with the stage appearance.
- Owned Tattoo Parlour ink is rendered on the same 3D model using the shared body-slot catalogue. Arm, shoulder, wrist, neck, chest, stomach, back, thigh and calf tattoos follow rig bones; quality controls ink opacity and infection adds a visible irritated tint without changing the authoritative tattoo record. The Tattoo Parlour temporarily uses an unclothed inspection presentation so covered placements can be checked without modifying the saved outfit.
- Camera rotation/zoom, keyboard controls and ten performance preview poses. Tattoo Parlour presentation adds dedicated neck, front torso, back, left arm, right arm and legs inspection cameras while keeping the saved outfit untouched.
- The active character owns its model. Switching characters resets the editor
  session; saves target the character captured in the request.
- Gig lineups load cosmetic appearances, rich clothing and a minimal tattoo visual projection in batched reads. Missing models use stable starter appearances. Tattoo purchase price, artist, custom text and minigame data are never exposed through the stage projection. Read failures show a recoverable notice.
- Ordinary gig replays use each performer's **current saved appearance**. Top of the Pops broadcast archives freeze appearance, rich clothing and tattoo visuals when the canonical replay is created, so later cosmetic changes do not rewrite television history.

## Storage and permissions

`public.player_stage_appearances` stores a version 1 appearance, character ID,
server revision and timestamps. Authenticated players can read this public
cosmetic data. Insert/update policies check profile ownership with both `USING`
and `WITH CHECK`. Private portraits and avatar-provider metadata stay separate.

The database validates the entire shape, known item IDs, dye colours and bounded
body dimensions. Unknown versions, item IDs, URLs and extra fields are rejected.
The client mirrors these rules with Zod. Updates use an expected revision;
conflicting saves preserve the draft and offer a reload. Revisions and timestamps
are stamped by the server. Direct client deletion is not granted.

Migration: `supabase/migrations/20260908160013_player_stage_appearances.sql`.
It was applied directly to project `yztogmdixmchsmimtent`. The rollback-only
`supabase/tests/player_stage_appearances.sql` verifies owner/second-character
writes, authenticated reads, cross-owner and anonymous denials, input validation
and stale revisions without leaving test appearances behind.

## Asset assembly

All six source GLBs are served locally from `public/gig-demo-3d`. Provenance and
hashes are in `assets-manifest.json`. Women and men use separate skeleton families;
parts never cross families. Every donor retains its local transform, bind matrix
and inverse binds. Material primitive groups are copied as a unit.

Only mesh containers count as wardrobe parts: bones named `Body` or `Head` must
never be cloned as clothing. The women's independent foot controls are reparented
to the lower legs while preserving their rest world transforms for the shared IK
solver. A skinned calf fills the gap between cropped punk trousers and low shoes.
Tests check base mesh combinations, all 19 starter items on both frames, topless and unclothed tattoo presentations, round-trip saves,
owned texture lifetimes, unique bones, visible mesh deformation and hand
contact with instruments. Loaded source geometry, preview swaps, inactive crowd
poses and WebGL resources have explicit cleanup.

## Expanding clothing and items

1. Add a curated item catalogue entry with a stable ID, slot, compatible rig
   families, asset version and material/dye metadata. Keep old IDs resolvable.
2. Introduce inventory grants and ownership-checked server equip operations before
   adding paid or unlockable items. Do not add them to the free starter allow-list
   or trust a client-supplied price. Existing legacy purchase mutations are not
   reused by this feature.
3. Extend the shipped Head attachment system for jewellery and authored accessory meshes; retain the current standard instrument fallback for unsupported roles/items.
4. If ordinary gig history later needs frozen cosmetics, capture the same render-only snapshot server-side when the authoritative replay is generated. Do not write snapshots from the viewer.

Paid accessory ownership and a full face-sculpting system remain follow-up features; the shipped free hats/glasses and owned tattoos now affect the actual stage model.

The original six-starter-clothing migration extends the validated item allow-list.
`20260923192633_avatar_v2_muscle_topless.sql` adds the Topless top ID and optional
body muscle field while preserving legacy version-1 saves. The rollback-only
`supabase/tests/avatar_v2_body_topless.sql` covers all five muscle values, Topless,
legacy saves and invalid body values. Run the offline frontend suite
with `./node_modules/.bin/vitest run --config vitest.stage-models.config.ts --maxWorkers=1`.


## Hair and facial hair

The creator offers the imported original haircut plus 15 procedural choices:
bald, buzz cut, quiff, mohawk, bob, shoulder length, layered long hair, long waves,
ponytail, high ponytail, side braid, twin ponytails, bun, curls and long hair.
Facial hair has clean shaven, stubble, moustache, goatee, short/full/long beard and
sideburns. All are free and available on either body frame, with ten named colours
and a custom picker. Facial hair can follow hair colour or use an independent dye.
Face close-up and Full body buttons switch preview framing.

Optional `head.hairStyle`, `head.facialHair` and `head.facialHairColor` fields
extend appearance version 1. Absent fields preserve the imported haircut, clean
shaven face and matching dye; existing rows are not rewritten. The original
haircut selector remains available when Original haircut is selected. New cuts
use the complete casual scalp from the appropriate rig family. Only scalp-hair
primitives are replaced; skin, eyes and brows remain intact.

Hair shells follow the authored scalp and every procedural non-bald cut also has
a shallow crown shell. The latter closes gaps on feminine head exports where the
skin mesh does not provide enough crown triangles for the clipped scalp alone.
Longer feminine crowd styles are sampled from the same catalogue, reducing repeat
silhouettes in gigs. Facial hair follows the actual face surface, with frame-specific
jaw anchors. Geometry is batched by hair/beard material and attached to the existing
Head bone, so it follows performance animation in the fitting room and shared viewer.
There are no extra downloads. These are stylised solid hair meshes, not strand-level
hair simulation.

The additive `avatar_hair_styles` and `expand_avatar_hair_styles` migrations are
applied directly to the connected project. `supabase/tests/avatar_hair_styles.sql`
checks 256 hair/beard/frame combinations, matching colour, old saved data and
invalid-input rejection using read-only validation calls. Offline tests exercise
actual rig assembly, crown coverage, bone attachment, animation and independent
colour persistence. Browser visual review remains before release.


## Accessories and tattoo integration

Accessory choices remain part of appearance version 1 through an optional `accessories`
object so pre-existing saved rows continue to validate without a rewrite. The original
four-field hat/glasses payload remains accepted; newer saves add optional earring style
and colour fields. The database
allow-list accepts only known hat/glasses IDs and six-digit hex colours. The fitting
room uses the same procedural attachment renderer as gigs and Top of the Pops.

Tattoo ownership is **not** duplicated into `player_stage_appearances`. The Tattoo
Parlour remains authoritative. `public.get_stage_tattoo_visuals(uuid[])` exposes only
the render fields required by authenticated stage viewers: profile/tattoo IDs, body
slot, ink colour, quality, infection state and design category. Anonymous execution is
revoked. This keeps financial and artist data private while letting bandmates' visible ink appear in shared performances. Tattoo purchases and treatment invalidate the fitting-room and gig cosmetic caches immediately. Future Top of the Pops replay snapshots also freeze these render-only tattoo fields alongside clothing and appearance.

Migration: `supabase/migrations/20260921183000_avatar_accessories_stage_tattoos.sql`.


### Tattoo and clothing occlusion

Rich garments may define `garment_config.tattooCoverageSlots` with any valid tattoo body slots.
The fitting room, gigs and Top of the Pops use that explicit metadata to hide ink covered by
clothing. Coverage is never inferred from a garment name or category, so a sleeveless jacket
and a long-sleeved jacket can behave differently without renderer special cases. The Clothing
Studio exposes every shared body slot as a coverage toggle.

The shared catalogue now mirrors the live Tattoo Parlour data, including stomach, thigh and
calf placement plus blackwork, fine-line, realism and traditional styles. This prevents newer
tattoos from disappearing when a player moves from the 2D parlour view into the 3D avatar.


## Phase 3: face, skin and garment detail

Phase 3 extends the existing version-1 appearance rather than creating another avatar format.
Face shape, eye colour, eyebrow style/colour and skin detail are optional head fields, so old
saved avatars remain valid. Face-shape adjustments are applied on the animated Head bone and
the detail layer follows that same bone through fitting-room and performance poses. Freckles,
beauty marks and weathered detail are lightweight rig-attached geometry; eye and brow tinting
uses the existing authored head materials where present.

Rich procedural garments now add small construction cues such as shoulder and hem seams,
front folds, trouser creases and footwear soles. These reuse the existing rig anchors and
materials, so they move with the same torso/limb bones and do not require extra downloads.

Migration: `supabase/migrations/20260921185858_avatar_face_detail_phase_3.sql`.
Regression: `supabase/tests/avatar_face_detail_phase_3.sql`.

## Phase 4: unified tattoo/avatar polish

The Tattoo Parlour's **My Tattoos** tab now includes the shared animated 3D player model next
to the placement map. It reads the same saved appearance and render-only Tattoo Parlour
projection as gigs, but deliberately suppresses clothing inside the parlour so chest, stomach,
back, thigh and other covered placements can always be inspected. This is a renderer-only
presentation and never equips or unequips the player's saved outfit. The existing cache
invalidation after purchase, text/custom tattoo and infection treatment updates this view as
well as subsequent gigs.

Tattoo surfaces use smoother curved geometry, stable per-tattoo orientation and mipmapped
style masks for cleaner close-up rendering. The authoritative tattoo record remains in the
Tattoo Parlour; no ownership, pricing, artist or private minigame data is copied into avatar
appearance JSON.

## Accessory polish — 22 September 2026

The existing appearance contract now also accepts `cowboy`, optional
`accessories.lensTint` (`clear`/`tinted`) and `accessories.lensColor`. Old appearances
and old TOTP snapshots remain valid; absent lens settings retain tinted sunglasses
and clear regular glasses. The creator exposes these controls and a collection
panel for immediately equipping/removing already owned hats and eyewear. Inventory
mutations capture the character ID and preserve the item's variant/custom colours.
Starter accessories still save with the whole appearance and its revision.

Starter glasses have shaped frames, lenses, bridges, side arms and ear hooks.
Caps have a curved visor and seams; fedora/cowboy crowns have a crease. Hats tuck
procedural hair above the brim, keeping lower long hair, and now pull the narrow
hair band immediately beneath the brim clear so side panels, locs and braids are
not cut by the hat edge. Glasses and earrings use the actual generated hairstyle
vertices to open small local clearance channels around temple arms, ear hooks and
ear jewellery while keeping the accessories fitted to the measured face/ear
surface. Owned eyewear uses the same hair-clearance pass. Imported scalp hair is
hidden while hatted; eyebrows, face details and facial hair remain visible. Removing
the hat rebuilds the unchanged saved haircut. This is stylised geometry, not hair
simulation. The shared fitting-room/performer assembly suppresses starter headwear
and eyewear when an owned item occupies that slot, without changing the saved choice.
Purchased garments keep their existing renderer and customisation behaviour.

The face, earrings, tattoo rendering/occlusion, and TOTP tattoo snapshots already
on main are retained. No tattoo purchases or tattoo records are changed by this PR.

Visual check: [both body frames and all five hats](../../../docs/qa/avatar-accessory-polish.html).
The image comes from the actual GLB models and shared renderer in local Chromium.
This is not a live account screenshot or an end-to-end broadcast recording.

Database: the existing clothing prerequisite migrations `20260910165000`,
`20260910172000`, `20260910184000`, and `20260910184200` were missing on the connected
project and were applied on 22 September (recorded versions `20260922093609`,
`20260922093611`, `20260922093613`, `20260922093614`). Inventory was empty beforehand.
The new appearance validator is recorded as `20260922094106_avatar_accessory_polish`.
The rollback-only `supabase/tests/avatar_accessory_polish.sql` passed against that
project: 120 frame/hat/glasses/lens combinations, legacy/existing appearances,
malformed input rejection, owner equip/remove, slot conflicts, cross-owner denial.
No test inventory or cash changes persist. The security advisor's warnings for the
two authenticated clothing SECURITY DEFINER RPCs are expected: public stage reads
exclude private inventory, and writes explicitly verify character and item ownership.

Validation: all 39 player-model tests and 11 performer tests passed after rebasing
onto main at `02fdfe6`, and the build passed. Repository typecheck now reports an
unrelated TS2677 predicate error at `TotpFullEpisodePlayer.tsx:61`, whose contents
are identical to `02fdfe6`; it passed before rebasing onto these newer TOTP changes.
The check required `NODE_OPTIONS=--max-old-space-size=6144` in this environment.
The lint baseline
check reports 2,891 errors versus its saved 2,872 baseline; untouched `02fdfe6` has
the identical count, so this branch adds none. The wider stage suite previously
showed nine pre-existing failures in four gig/TV tests;
the same nine failures were reproduced on untouched main at `37015dc`.


## Avatar V2 mesh foundation — 23 September 2026

The current Quaternius rigs remain the production avatar while a replacement
RockMundo-authored humanoid mesh system is developed. The new foundation lives in
`src/features/player-model/v2` and is deliberately fail-closed.

Avatar V2 defines semantic humanoid bones, facial-expression requirements, LOD
budgets and a GLB import contract. The V2 material pass now uses quality-scaled
skin pore/roughness fallback maps only when authored maps are absent, and treats
iris/sclera/cornea, teeth, tongue and mouth interior as distinct close-up surfaces.
LOD0/LOD1 now require complete three-joint finger chains on both hands. Those bones
are normalized into the live performer rig and receive instrument-specific poses:
fretting/chord shapes, guitar pick pinch, alternating bass plucks, microphone wrap
and drumstick fulcrum grip. Close-up V2 meshes can also provide eight pose-space
corrective morphs for shoulders, elbows, hips and knees; the performer drives them
from the final IK pose to preserve joint volume under aggressive stage animation.
The close-up expression controller now blends adjacent singing visemes and can
drive jaw, mouth stretch/funnel/pucker, cheek squint, eye squint and brow tension
from the deterministic performance clock. LOD0/LOD1 also use dedicated normalized
`Eye.L`/`Eye.R` bones for replay-safe micro-saccades plus non-deforming
`EarAnchor.L/R` attachment bones for precise earrings/glasses/hair clearance.
The eyes support deliberate gaze toward
bandmates, audience cues and the fretboard, with slightly asymmetric/double blinks
and subtle idle facial motion so close-ups do not freeze between vocal phrases.
This gives gigs and Top of the Pops replay-safe facial motion without depending on
random animation; later audio-timed phonemes can feed the same morph interface.
`npm run validate:avatar-v2` validates candidate GLBs before they can be marked
validated. Body-worn V2 garments must carry the same
body-width and muscle morph targets as the base avatar; the selected weights are
copied onto each garment after skeleton rebinding. A shaped body paired with a
garment missing its required fit morph fails closed to V1 instead of rendering
body/clothing intersections. The fitting room and stage performer loader now pass
through a dual-engine adapter; because the V2 rollout registry is locked and its
assets are still planned, the adapter resolves to the unchanged V1 model today.

Admin → Avatar & Cosmetics → **Avatar V2 Mesh System** exposes the LOD/asset
readiness matrix. Full architecture and authoring guidance:
`docs/avatar-v2-mesh-system.md`.

This separation is intentional: higher-resolution materials can continue shipping
on V1 while V2 receives proper face/hand/joint topology and skinned garments. No
player is moved onto a partial replacement mesh.
