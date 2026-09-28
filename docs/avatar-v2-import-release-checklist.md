# Avatar V2 authoring import release checklist

The admin ZIP intake, checksum verification and private extraction are merged into main. Backend bucket, review table and JWT-protected validator were deployed directly to the RockMundo Supabase project on 28 September 2026. Verify the UI deployment separately; do not treat these authoring blockouts as production garments.

- [ ] CI green on the current main commit.
- [ ] Deploy frontend and confirm Admin → Curated Skin Packs displays Import Avatar V2 assets.
- [ ] Authenticated admin uploads the combined authoring ZIP and verifies the persisted review.
- [ ] Extract for review, refresh, confirm staged status and 38 reviewed objects.
- [ ] Non-admin users cannot list, download, validate or stage the private assets.
- [ ] Rig, fit, animation, materials and visual QA before any garment publication.
