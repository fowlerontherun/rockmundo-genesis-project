
# Character Creator Layered Sprite Fix

## Overview
The current character creator has misaligned sprites because each asset was generated independently without a shared canvas/coordinate system. This plan will create a properly functioning layered sprite system where all assets are drawn on the same fixed canvas size with consistent positioning.

---

## Root Cause Analysis

The current system has three fundamental issues:

1. **Inconsistent canvas sizes** - Each sprite was generated at different sizes and positions
2. **No anchor point alignment** - Body, clothing, and facial features need to share the same reference points
3. **Mixed legacy and new assets** - The database contains old unaligned assets alongside newer attempts

---

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                 Fixed Canvas (512 x 1024)               │
├─────────────────────────────────────────────────────────┤
│  Layer 10: Hat / Glasses (accessories on top)           │
│  Layer 9:  Hair (covers top of head)                    │
│  Layer 7:  Facial Hair (beard/mustache)                 │
│  Layer 6:  Mouth                                        │
│  Layer 5:  Nose                                         │
│  Layer 4:  Eyes                                         │
│  Layer 3:  Jacket (outer layer clothing)                │
│  Layer 2:  Shirt (under jacket)                         │
│  Layer 2:  Trousers / Skirt                             │
│  Layer 1:  Shoes                                        │
│  Layer 0:  Base Body (skin-colored silhouette)          │
└─────────────────────────────────────────────────────────┘
```

All assets will be generated on the **same 512×1024 transparent canvas** with the body centered identically in every image.

---

## Implementation Plan

### Phase 1: Generate Properly Aligned Base Templates

Create 2 base body templates on a fixed 512×1024 canvas:
- `aligned-base-male.png` - Male body silhouette, skin-colored, centered
- `aligned-base-female.png` - Female body silhouette, centered

These are the foundation that all other layers align to.

### Phase 2: Generate Aligned Overlay Layers

For each category, generate assets on the same 512×1024 canvas positioned to overlay exactly on the base templates:

**Hair (Layer 9):**
- Mohawk, Afro, Long Wavy, Pixie, Braids, Buzzcut, Emo

**Eyes (Layer 4):**
- Neutral, Happy, Angry, Cool

**Nose (Layer 5):**
- Small, Medium, Large

**Mouth (Layer 6):**
- Neutral, Smirk, Sneer, Singing

**Facial Hair (Layer 7):**
- Beard, Goatee, Mustache

**Shirt (Layer 2):**
- T-Shirt, Tank Top, Graphic Tee, Band Tee

**Jacket (Layer 3):**
- Leather, Hoodie, Varsity, Denim, Flannel

**Trousers (Layer 2):**
- Skinny Jeans, Baggy Jeans, Cargo, Plaid Skirt

**Shoes (Layer 1):**
- Combat Boots, Sneakers, High-tops, Chelsea Boots

**Hat (Layer 10):**
- Beanie, Snapback, Flatcap

**Glasses (Layer 10):**
- Aviators, Round

### Phase 3: Database Cleanup

1. Delete or deactivate all legacy unaligned assets from `character_sprite_assets`
2. Insert the new properly aligned assets with correct `layer_order` values
3. Update asset URLs to point to the new `aligned-*` files

### Phase 4: Frontend Updates

**SpriteLayerCanvas.tsx:**
- Import all new aligned assets
- Update `ASSET_MAP` with new file paths
- No anchor point logic needed since all images use the same canvas

**SpriteCategoryPicker.tsx:**
- Update asset mapping for picker thumbnails

**PunkCharacterCreator.tsx:**
- Add auto-default selection logic:
  - On mount, if no config exists, auto-select one default body + one item per layer
  - Use `is_default` flag in database to identify default options
- Filter to only show assets with `subcategory` containing "aligned" or use a new `is_aligned` flag

---

## Asset Generation Approach

Each image will use a prompt like:

> "On a transparent 512x1024 pixel canvas, draw ONLY [specific item] in 80s-90s underground comic book style, bold ink outlines, crosshatching, positioned to fit on a standing human figure centered in the canvas. The figure's head should be at approximately y=80, shoulders at y=180, waist at y=400, feet at y=980. Draw ONLY the [item], nothing else."

This ensures every layer shares the same coordinate system.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/assets/sprites/aligned-*.png` | New aligned assets (30+ files) |
| `src/components/character-creator/SpriteLayerCanvas.tsx` | New asset imports, updated ASSET_MAP |
| `src/components/character-creator/SpriteCategoryPicker.tsx` | Filter for aligned assets only |
| `src/components/character-creator/PunkCharacterCreator.tsx` | Auto-default selection logic |
| `src/hooks/useCharacterSprites.ts` | Add filter for aligned assets, add default selection helper |
| Database migration | Insert new aligned assets, mark old ones as non-aligned |
| `src/components/VersionHeader.tsx` | Version bump to v1.0.552 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Expected Outcome

After implementation:
- Opening `/avatar-designer` shows a complete default character immediately
- Selecting any body/hair/clothing option properly overlays on the character
- All layers stack correctly because they share the same canvas coordinate system
- Only aligned, compatible assets are shown in the pickers
- Shoes are a separate interchangeable layer

---

## Technical Notes

- All sprites use transparent PNG format
- Canvas size: 512×1024 pixels (3:4 aspect ratio, good for character display)
- Skin tone filter will continue to apply CSS filter to body layer only
- Gender filtering will apply to base body and gender-specific clothing
