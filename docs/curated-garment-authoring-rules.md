# Rockmundo garment authoring rules (uploaded 3D clothing)

Finished clothing is made outside the game (Blender recommended) and uploaded at **Admin → Garment Upload**. The upload page checks every rule below automatically and refuses files that fail.

## Files
- Format: **.glb** (binary glTF 2.0), max 20 MB.
- One file per body frame: **masculine** and **feminine**. Both are required.
- Start from the reference bodies in `public/gig-demo-3d/` (`casual.glb` for masculine, `female-casual.glb` for feminine). Fit the garment on them, then delete the body before exporting.

## Skeleton
- Skin the garment to the reference body's armature. Keep bone names **exactly** as they are; don't rename or add bones.
- Every mesh must be a skinned mesh. No loose props unless weighted to a bone.
- Keep the reference bind pose (don't apply pose changes before export).

## Mesh
- No body parts in the file (no head, skin, eyes, hair meshes).
- Triangle budgets: headwear 4,000 · eyewear 3,000 · top 16,000 · outerwear 20,000 · bottom 14,000 · footwear 8,000.
- Maximum 4 materials. Name them `mat_<purpose>` (e.g. `mat_cloth_navy`, `mat_print_front`).
- Sit the garment 2–4 mm off the skin to avoid flicker; no clipping in rest, T-pose, singing, guitar, bass or drum poses.

## Look
- Stylised, moderate-poly, readable from full-body distance under dark stage light.
- Bake stripes, logos and prints into the texture (UV-mapped), not as floating planes.
- Colour variants are applied as a tint over the base colour texture, so keep the base texture fairly neutral if the item has variants.

## Process
1. Create the item record in Curated Skin Packs (name, slot, price, bonus).
2. Model both frames, test poses in Blender.
3. Upload both files on Garment Upload. Fix anything it flags.
4. When both pass, press **Publish** — the item switches from the stand-in shape to your model everywhere (wardrobe, store, gigs, TV).
