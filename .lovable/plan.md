
# RockMundo Custom Character Creator - Complete RPM Replacement

## Overview

This plan replaces the Ready Player Me (RPM) 3D avatar system with a custom 2D layered sprite character creator using the stylised punk rock comic illustration art style you've specified. The new system will use modular PNG assets that stack/layer together, making it performant, consistent, and future-proof.

## Current System Analysis

### What's Being Replaced

The current RPM system spans these areas:

| Area | Files | Purpose |
|------|-------|---------|
| **Avatar Creator** | `ReadyPlayerMeCreator.tsx`, `RpmAvatarCreator.tsx` | Embeds RPM iframe for 3D avatar creation |
| **3D Rendering** | `ReadyPlayerMeAvatar.tsx`, `SharedRpmAvatar.tsx` | Loads .glb models via three.js/drei |
| **Gig Viewer** | `RpmAvatarImage.tsx`, `ParallaxGigViewer.tsx` | Renders RPM 2D portraits on stage |
| **Data** | `rpmAvatarPool.ts` | Pool of shared RPM URLs for crowd/band |
| **Database** | `rpm_avatar_url`, `rpm_avatar_id`, `use_rpm_avatar` columns | Stores RPM model references |
| **Hooks** | `usePlayerRpmAvatar.ts` | Fetches/saves RPM URLs |

### What's Staying (Existing Procedural System)

The project already has a partial procedural avatar system:

- `EnhancedAvatar.tsx`, `EnhancedBody.tsx`, `EnhancedFace.tsx`, `EnhancedHair.tsx` - 3D procedural meshes
- `BodySelector.tsx`, `FaceSelector.tsx`, `HairSelector.tsx`, `ClothingSelector.tsx` - UI for customisation
- `usePlayerAvatar.ts` - Manages `player_avatar_config` table with ~50 customisation fields

This existing system will be **enhanced** to work with the new 2D sprite layers.

---

## New System Architecture

### Art Style Specification

```text
Stylised illustrated punk rock character art. Hand-drawn comic-book style 
with bold confident linework, slightly exaggerated proportions, gritty but 
clean finish. Flat colours with subtle texture and light shading, no gradients. 
Inspired by classic punk zine illustrations, 80s-90s underground comics, and 
modern indie game character art. Clear outlines suitable for sprite layering.
```

### Layering System (Bottom to Top)

```text
┌─────────────────────────────────────────────┐
│  Layer 10: Accessories (hats, glasses)      │
├─────────────────────────────────────────────┤
│  Layer 9:  Hair (front pieces)              │
├─────────────────────────────────────────────┤
│  Layer 8:  Face Details (scars, makeup)     │
├─────────────────────────────────────────────┤
│  Layer 7:  Facial Hair (beards, stubble)    │
├─────────────────────────────────────────────┤
│  Layer 6:  Mouth                            │
├─────────────────────────────────────────────┤
│  Layer 5:  Nose                             │
├─────────────────────────────────────────────┤
│  Layer 4:  Eyes + Eyebrows                  │
├─────────────────────────────────────────────┤
│  Layer 3:  Hair (back/main)                 │
├─────────────────────────────────────────────┤
│  Layer 2:  Clothing (jacket/shirt)          │
├─────────────────────────────────────────────┤
│  Layer 1:  Body Base (with skin tone)       │
└─────────────────────────────────────────────┘
```

### Database Schema Updates

New table for sprite assets:

```sql
CREATE TABLE character_sprite_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'body', 'eyes', 'nose', 'mouth', 'hair', 'jacket', 'shirt', 'trousers', 'shoes', 'hat', 'glasses'
  subcategory TEXT, -- 'male_slim', 'female_athletic', etc.
  name TEXT NOT NULL,
  asset_url TEXT NOT NULL, -- URL to PNG with transparent background
  layer_order INTEGER NOT NULL, -- z-index for stacking
  anchor_x FLOAT DEFAULT 0.5, -- normalized anchor point
  anchor_y FLOAT DEFAULT 0.5,
  supports_recolor BOOLEAN DEFAULT true, -- can apply tint/recolour
  color_variants JSONB, -- pre-generated colour URLs if not recolourable
  is_premium BOOLEAN DEFAULT false,
  price INTEGER DEFAULT 0,
  collection_id UUID REFERENCES skin_collections(id),
  gender_filter TEXT[], -- ['male', 'female', 'any']
  body_type_filter TEXT[], -- ['slim', 'athletic', 'average', etc.]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sprite_assets_category ON character_sprite_assets(category);
CREATE INDEX idx_sprite_assets_gender ON character_sprite_assets USING GIN(gender_filter);
```

Updates to `player_avatar_config`:

```sql
ALTER TABLE player_avatar_config
  -- Remove RPM columns (migration will handle data)
  DROP COLUMN IF EXISTS rpm_avatar_url,
  DROP COLUMN IF EXISTS rpm_avatar_id,
  DROP COLUMN IF EXISTS use_rpm_avatar,
  
  -- Add sprite selection columns
  ADD COLUMN body_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN eyes_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN nose_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN mouth_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN hair_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN jacket_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN shirt_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN trousers_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN shoes_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN hat_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN glasses_sprite_id UUID REFERENCES character_sprite_assets(id),
  ADD COLUMN facial_hair_sprite_id UUID REFERENCES character_sprite_assets(id),
  
  -- Composite render cache
  ADD COLUMN rendered_avatar_url TEXT, -- cached composite image
  ADD COLUMN render_hash TEXT; -- hash of config for cache invalidation
```

Also clean up profiles table:

```sql
ALTER TABLE profiles DROP COLUMN IF EXISTS rpm_avatar_url;
```

---

## Implementation Phases

### Phase 1: Database & Asset Infrastructure

1. **Create migration** for `character_sprite_assets` table
2. **Update `player_avatar_config`** schema (add sprite columns, keep RPM columns temporarily for migration)
3. **Create storage bucket** `character-sprites` for uploaded PNG assets
4. **Seed initial assets** - Generate starter set using AI image generation:
   - 12 male body types
   - 12 female body types
   - 20 eye styles
   - 12 nose styles
   - 15 mouth styles
   - 25 hair styles (mohawks, liberty spikes, etc.)
   - 10 hats
   - 15 jackets
   - 20 shirts/t-shirts
   - 10 trousers
   - 8 shoes
   - 10 glasses

### Phase 2: Sprite Asset Generator (Edge Function)

Create `supabase/functions/generate-character-sprite/index.ts`:

```typescript
// Uses Lovable AI gateway with punk art style prompts
// Generates individual sprite layers as PNGs
// Uploads to storage bucket
// Returns asset URL

const PUNK_ART_STYLE = `Stylised illustrated punk rock character art. 
Hand-drawn comic-book style with bold confident linework, slightly 
exaggerated proportions, gritty but clean finish. Flat colours with 
subtle texture and light shading, no gradients. Clear outlines suitable 
for sprite layering. Transparent background.`;

async function generateSprite(category: string, description: string) {
  const prompt = buildPromptForCategory(category, description);
  // Call Lovable AI gateway
  // Process response, upload to storage
  // Return asset record
}
```

### Phase 3: Character Creator UI

Replace `src/pages/AvatarDesigner.tsx` with new sprite-based creator:

**New Components:**

| Component | Purpose |
|-----------|---------|
| `PunkCharacterCreator.tsx` | Main page with layer preview |
| `SpriteLayerCanvas.tsx` | Stacks sprite layers with proper z-index |
| `SpriteCategoryPicker.tsx` | Grid of available sprites per category |
| `SkinToneRecolorizer.tsx` | Applies CSS filters for skin tone variation |
| `ColorVariantPicker.tsx` | Shows available colours for clothing |
| `CharacterPreview.tsx` | Live preview with animation support |

**UI Flow:**

```text
┌────────────────────────────────────────────────────────────────┐
│  CHARACTER CREATOR                                    [Save]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐ │
│  │                  │  │ [Body] [Face] [Hair] [Clothes] [Acc]│ │
│  │   LIVE PREVIEW   │  ├─────────────────────────────────────┤ │
│  │                  │  │                                     │ │
│  │   (Stacked       │  │   Grid of sprite options            │ │
│  │    Sprites)      │  │   with colour variants              │ │
│  │                  │  │                                     │ │
│  │                  │  │   [Slim] [Athletic] [Muscular]...   │ │
│  │                  │  │                                     │ │
│  └──────────────────┘  └─────────────────────────────────────┘ │
│                                                                │
│  Skin Tone: [● ● ● ● ● ● ● ● ● ●]                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Phase 4: Composite Renderer (Edge Function)

Create `supabase/functions/render-character-composite/index.ts`:

- Takes sprite IDs + colour selections
- Composites all layers into single PNG using canvas/sharp
- Caches result in storage bucket
- Returns URL for use in gig viewer

This ensures consistent rendering and reduces client-side load.

### Phase 5: Gig Viewer Integration

Update `RpmAvatarImage.tsx` -> `CharacterAvatarImage.tsx`:

- Fetches player's `rendered_avatar_url` from `player_avatar_config`
- Falls back to real-time layer stacking if no cached composite
- Maintains existing animation system (bounce, sway, glow effects)

Update `ParallaxGigViewer.tsx`:

- Query `player_avatar_config` for sprite selections instead of RPM URLs
- Use `CharacterAvatarImage` component
- Session musicians use random sprites from pool instead of RPM pool

### Phase 6: Cleanup & Migration

1. **Data migration**: For players with existing RPM avatars, show migration prompt to create new character
2. **Remove RPM dependencies**:
   - Uninstall `@readyplayerme/react-avatar-creator`
   - Delete `ReadyPlayerMeAvatar.tsx`, `SharedRpmAvatar.tsx`, `RpmAvatarCreator.tsx`
   - Delete `rpmAvatarPool.ts`
   - Remove RPM-related hooks
3. **Drop RPM columns** from database after migration period

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/xxx_character_sprites.sql` | New tables and schema changes |
| `supabase/functions/generate-character-sprite/` | AI sprite generation |
| `supabase/functions/render-character-composite/` | Layer compositing |
| `src/components/character-creator/PunkCharacterCreator.tsx` | Main creator page |
| `src/components/character-creator/SpriteLayerCanvas.tsx` | Layer stacking component |
| `src/components/character-creator/SpriteCategoryPicker.tsx` | Asset selection grid |
| `src/components/character-creator/SkinToneRecolorizer.tsx` | Skin tone system |
| `src/components/character-creator/CharacterPreview.tsx` | Animated preview |
| `src/hooks/useCharacterSprites.ts` | Fetches sprite assets |
| `src/hooks/useCharacterComposite.ts` | Manages composite generation |
| `src/data/punkSpritePool.ts` | Default sprites for NPCs/session musicians |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/AvatarDesigner.tsx` | Replace with PunkCharacterCreator |
| `src/hooks/usePlayerAvatar.ts` | Remove RPM fields, add sprite fields |
| `src/components/gig-viewer/RpmAvatarImage.tsx` | Rename & refactor to use sprites |
| `src/components/gig-viewer/ParallaxGigViewer.tsx` | Update avatar fetching logic |
| `src/components/bands/BandRosterTab.tsx` | Update avatar display |
| `src/components/bands/BandMemberDetailDialog.tsx` | Update avatar display |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/avatar-system/ReadyPlayerMeAvatar.tsx` | RPM removal |
| `src/components/avatar-system/SharedRpmAvatar.tsx` | RPM removal |
| `src/components/avatar-system/RpmAvatarCreator.tsx` | RPM removal |
| `src/components/avatar-designer/ReadyPlayerMeCreator.tsx` | RPM removal |
| `src/hooks/usePlayerRpmAvatar.ts` | RPM removal |
| `src/data/rpmAvatarPool.ts` | RPM removal |

---

## Technical Considerations

### Skin Tone System

Rather than generating 10 variants of every body sprite, use CSS filters:

```css
.skin-tone-1 { filter: sepia(0.2) saturate(1.1) hue-rotate(-10deg); }
.skin-tone-2 { filter: sepia(0.3) saturate(1.0) hue-rotate(-5deg); }
/* etc. */
```

The body sprites are generated in a neutral base tone, and filters are applied at render time.

### Colour Variants for Clothing

Two approaches:

1. **Pre-generated**: Generate 20 colour variants per item, store URLs in `color_variants` JSONB
2. **Runtime recolor**: Use canvas `globalCompositeOperation` to tint grayscale base

Recommendation: Pre-generated for premium items (better quality), runtime for basic items (storage efficient).

### Performance

- Composite images are cached in storage bucket
- Cache key = hash of all sprite IDs + colour selections
- Invalidate on any config change
- Lazy load sprite grids in creator UI

### Consistency Rules (From Your Spec)

These will be enforced programmatically:

- All assets align to same anchor points (0.5, 0.5 default)
- Transparent backgrounds only
- No baked-in shadows
- Consistent line thickness (validated on upload)
- Future skins are drop-in replacements

---

## Estimated Effort

| Phase | Components | Complexity |
|-------|------------|------------|
| Phase 1: Database | 2 migrations, storage setup | Low |
| Phase 2: Sprite Generator | 1 edge function | Medium |
| Phase 3: Creator UI | 5 new components | High |
| Phase 4: Composite Renderer | 1 edge function | Medium |
| Phase 5: Gig Integration | 3 component updates | Medium |
| Phase 6: Cleanup | File deletions, migration | Low |

---

## Version Update

This will be released as **v1.0.547** with version history entry:

> "Replaced Ready Player Me avatars with custom punk rock character creator. New 2D sprite layering system with modular body types, facial features, hair styles, and clothing. Art style: hand-drawn comic-book punk zine aesthetic."
