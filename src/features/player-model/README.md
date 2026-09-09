# Player stage models

`/avatar-designer` opens the 3D stage model editor; the existing profile portrait
creator remains in its own tab. The editor and gig viewers use the same rig,
modular assembly, skin/clothing dyes and performance poses.

## Shipped behaviour

- Masculine and feminine rig families; height/build, skin tone and hair colour.
- Three heads and three choices each for top, trousers and footwear. There are
  81 combinations per frame, plus dyes and body proportions.
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
Tests check all combinations, unique bones, visible mesh deformation and hand
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
