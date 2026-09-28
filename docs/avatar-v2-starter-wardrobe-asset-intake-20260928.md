# Avatar V2 Starter Wardrobe asset intake — 28 September 2026

**Status: authoring handoff, not production import.** The seven generated static GLB artist-start meshes and their texture references were delivered as downloadable conversation ZIP packs, but the connected GitHub file API accepts UTF-8 text only; binary GLBs/PNGs have **not** been uploaded to the repository or deployed.

## Authored starter files

- `rockmundo_v2_tee_authoring_pack.zip`: Rockmundo Logo Tee, Plain Black Tee, Plain White Tee, Vintage Charcoal Tee. Each has a static shell GLB and 2048px colour reference. The Rockmundo logo is a reference texture only, not baked into the GLB.
- `rockmundo_v2_denim_authoring_pack.zip`: Dark Slim Jeans, Blue Straight Jeans, Black Straight Jeans. Each has a static shell GLB and 1024px denim colour reference.

## Binary import handoff

Extract the ZIPs locally and commit the original binary files under `art/avatar-v2/starter-wardrobe/tees/` and `art/avatar-v2/starter-wardrobe/denim/`, retaining each item folder and README. Review file licensing and use Git LFS if the art repository policy requires it. Do **not** reference these source GLBs in `garment_config.avatarV2.frames`: they are static unskinned artist-start shapes, not the required separate frame/LOD files.

## Required certification before gameplay

Sculpt actual clothing silhouettes and UVs, fit masculine/feminine production skeletons, skin every mesh and attached detail, author distinct LOD0–3 for each frame, add body occlusion and material zones, bake logo/decal to tee surface, test pose corrective and twist weights in guitar/bass/drums/singing animations, inspect close-up and mobile budgets, and obtain visual QA signoff. Preserve original item IDs, purchases, bonuses, dye variants, and V1 fallback throughout. No sale status or V2 validation status has been changed by this handoff.
