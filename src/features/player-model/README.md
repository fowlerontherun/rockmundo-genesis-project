# RockMundo player avatar system

RockMundo uses a single production avatar runtime: **Avatar V1**.

## Runtime ownership

- appearance.ts owns player appearance and starter wardrobe choices.
- model.ts assembles the live skinned avatar used by the creator, profiles, gigs and Top of the Pops.
- PlayerModelEditor.tsx is the player-facing avatar editor.
- PlayerModelPreview.tsx renders the same V1 model path used by gameplay.
- hair.ts, faceDetails.ts, accessories.ts and tattoos.ts extend the base model without introducing a second avatar engine.
- Curated Skin Store clothing remains layered onto the V1 model and preserves existing ownership, variants and bonuses.

## V1 expansion priorities

1. Increase hairstyle, facial-hair and face-detail variety while keeping reliable head/ear/eye anchoring.
2. Improve glasses, earrings and left/right accessories so attachments do not float or intersect badly.
3. Expand curated clothing and skin packs with better textures, materials and silhouettes while retaining existing item IDs and ownership.
4. Improve close-up material quality for skin, hair and clothing without creating a parallel model pipeline.
5. Expand performance animation variety and instrument-specific posing on the existing skeleton.
6. Keep the avatar creator, player profiles, gigs and Top of the Pops on the same rendering and asset path.

## Compatibility rule

New avatar work must extend V1. Do not add version-selection UI, alternate avatar runtimes, duplicate garment ownership systems or hidden fallback engines.
