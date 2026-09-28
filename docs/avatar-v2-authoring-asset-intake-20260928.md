# Avatar V2 authoring asset intake — 28 September 2026

This record tracks **local, downloadable artist blockouts**, not repository-imported or production-certified garments. Do not set `garment_config.avatarV2.status=validated` based on these files.

| Pack | Local archive | Content | Readiness |
|---|---|---|---|
| Starter tees | `rockmundo_v2_tee_authoring_pack.zip` | Four static GLB tee shells and 2048px colour references | Artist-start only |
| Starter denim | `rockmundo_v2_denim_authoring_pack.zip` | Three static GLB trouser silhouettes and colour references | Artist-start only |
| Starter footwear | `rockmundo_v2_footwear_authoring_pack.zip` | Four static GLB shoe/boot blockouts and colour references | Artist-start only |
| Punk Essentials | `rockmundo_v2_punk_authoring_pack.zip` | Safety Pin Tee, Patch Jacket, Double Eyelet Belt, Studded Wrist Cuffs blockouts | **Keep all four items blocked** |

The four Punk blockouts deliberately contain separately editable rigid details. They must be merged into, or weighted to, the correct skinned garment bones; they do **not** resolve the existing visual-QA failure. Each garment still needs production anatomical tailoring, UVs, textures and material maps, both body frames, genuine LOD0–3, body-build and pose-corrective morphs where required, full performance-animation proof, and mobile/desktop budgets.

## Binary import checklist

1. Import each source GLB and reference PNG into a dedicated **authoring-only** directory; preserve the source manifests and readmes. Do not place these files under production `public/avatar-v2/clothing/` LOD paths.
2. Confirm that every GLB opens and compare silhouette and materials to the existing item identity. Match real existing catalogue keys before assigning files; the archive names are working names, **not** verified database keys.
3. Have an artist produce fitted and rigged variants for masculine and feminine frames, all four real LODs, and appropriate occlusion, dye zones, and attachment weights.
4. Run existing geometry and runtime validators and capture front/back/side/close-up proofs for singing, guitar, bass, seated drums, hair and accessories.
5. Review each item independently in the admin migration queue. Preserve all original item IDs, variants, inventory and bonuses. Keep V1 fallback until full-outfit V2 compatibility is proven.

The archives are delivered as conversation downloads, **not committed binary assets**. A GitHub text-file commit does not constitute a binary import.

## Local GLB integrity check (28 September 2026)

All **15** artist-start GLBs across the four packs were individually loaded as 3D scenes using `trimesh` (4 tees, 3 denim, 4 footwear, 4 Punk). All 15 loaded. This verifies only GLB parseability; it **does not** verify rigging, UVs, PBR materials, animation fit, body frames, production LODs or in-game render quality. The generated local `rockmundo_v2_asset_qa_report.md` records per-model geometry counts and is delivered separately to the project owner. Binary import remains pending.
