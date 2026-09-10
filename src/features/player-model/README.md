# Player stage models

`/avatar-designer` and the onboarding appearance step open the full-body Avatar
Creator, replacing the photo-generator designer. Existing profile images remain
stored separately. The editor and gig viewers use the same rig,
modular assembly, skin/clothing dyes and performance poses.

## Shipped behaviour

- Masculine and feminine rig families; height/build, skin tone and hair colour.
- Three heads and six free choices each for tops, bottoms and footwear: 18 starter
  pieces, 12 named colour swatches per slot and a custom colour picker. Every new
  and existing character can equip them immediately; no purchase or grant is needed.
- Three base silhouettes per slot plus fabric/finish variants: striped and plaid
  tops, denim/check/pinstripe bottoms, canvas/two-tone/patent footwear. Local 128px
  textile maps use rest-space UVs so patterns follow the animated rig. These are
  garment designs built from the existing meshes, not 18 new mesh silhouettes.
- Free starter clothing and standard instrument finishes. Saving costs nothing
  and does not affect skill, cash, equipment ownership or gig outcomes.
- Camera rotation/zoom, keyboard controls and ten performance preview poses.
- The active character owns its model. Switching characters resets the editor
  session; saves target the character captured in the request.
- Gig lineups load cosmetic appearances in one batched read. Missing models use
  stable starter appearances. Read failures show a recoverable notice.
- Replays use each performer's **current saved appearance**. Historical wardrobe
  snapshots are not yet recorded. Their canonical event/checksum contracts stay
  unchanged.

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
Tests check base mesh combinations, all 18 items on both frames, round-trip saves,
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
3. Add attachment slots for hats, glasses, jewellery and instrument meshes; retain
   the current standard instrument fallback for unsupported roles/items.
4. Add appearance snapshots to the authoritative replay generation workflow if
   historical clothing must be preserved. Do not write snapshots from the viewer.

Purchases, accessories and a full face sculpting system are follow-up features;
the shipped editor only exposes controls that affect the actual stage model.

The six-starter-clothing migration extends only the validated item allow-list.
`supabase/tests/starter_wardrobe.sql` tests all 18 IDs on both frames and rejects
invalid IDs/colours without writing player data. Run the offline frontend suite
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
