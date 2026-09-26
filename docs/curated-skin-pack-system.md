# Rockmundo curated skin-pack system

**Existing catalogue first:** [Avatar V2 upgrade and ownership-safe migration plan](avatar-v2-existing-clothing-migration-plan.md) documents the current 57-item inventory, the two active packs, in-place upgrades, detail attachment repairs and the production release gate. The Admin → Curated Skin Packs page now reports the live work queue.

## Decision

Retire the experimental procedural clothing creator as a production content-authoring workflow.

Rockmundo clothing will use curated, pre-built skins that are validated against the player avatar rig before release. The Skin Store remains the player-facing discovery, purchase, equip and collection experience.

The existing clothing data model remains compatible so older items do not break, but geometry/construction should not be authored in the browser.

## Goals

- Consistent Rockmundo visual style.
- No giant or malformed procedural clothing geometry.
- Every released skin must fit the supported avatar frames and animations.
- One approved skin definition is used by Avatar Creator, profiles, Gig Viewer and Top of the Pops.
- New content should be quick to add through packs and drops.
- Preserve rarity, prices, VIP/limited flags, bonuses, colour variants and collection ownership.

## Authoring workflow

1. Define a skin or themed pack.
2. Create the pre-built garment asset/configuration in the established Rockmundo style.
3. Validate it on masculine and feminine avatar frames.
4. Validate front, back and performance poses.
5. Check clipping with hair, accessories, guitars/basses and tattoos.
6. Generate/store preview frames.
7. Import the approved skin into the admin Skin Pack page.
8. Set store metadata: name, description, category, slot, price, rarity, colours, premium/limited/featured flags and optional gameplay bonuses.
9. Assign it to a pack and publish.

The admin pack page is deliberately a metadata/pack manager, not a free-form 3D garment generator.

## Player experience

Players browse:

- Featured
- New
- Skin Packs
- Clothing
- Instruments
- Owned

Clothing is purchased as a curated item. A skin may expose safe curated colour variants, but players cannot alter garment construction.

## Initial pack catalogue

### Starter Wardrobe
- Rockmundo logo tee
- Plain black tee
- Plain white tee
- Vintage charcoal tee
- Dark slim jeans
- Blue straight jeans
- Black straight jeans
- Canvas trainers
- Black boots
- Brown boots

### Punk Essentials
- Ripped black tee
- Safety-pin tee
- Red tartan trousers
- Black tartan trousers
- Studded denim vest
- Biker jacket
- Patch jacket
- Combat boots
- Punk belt
- Wrist cuffs

### Indie / Britpop
- Parka
- Retro track jacket
- Striped polo
- Vintage football-style top
- Denim jacket
- Cord jacket
- Straight blue jeans
- Black skinny jeans
- Desert-style boots
- Retro trainers

### Rock Stage
- Black fitted stage tee
- Sleeveless rock tee
- Leather jacket
- Red leather jacket
- Dark denim vest
- Black stage jeans
- Distressed jeans
- Chelsea boots
- Stage boots
- Statement belt

### Glam Rock
- Metallic jacket
- Sequinned jacket
- Satin shirt
- Deep-red shirt
- Flared black trousers
- Metallic trousers
- Platform boots
- Star boots
- Glitter scarf
- Statement sunglasses

### Metal
- Black band-style tee
- Sleeveless black tee
- Leather vest
- Studded leather jacket
- Black cargo trousers
- Ripped black jeans
- Heavy combat boots
- Studded boots
- Chain accessory
- Leather wristbands

### Festival
- Festival tee
- Tie-dye tee
- Sleeveless vest
- Lightweight jacket
- Denim shorts
- Cargo shorts
- Festival trousers
- Wellies
- Trainers
- Bucket hat

### Premium Rockstar
- Tailored stage jacket
- Velvet jacket
- Satin shirt
- Designer-style black tee
- Tailored trousers
- Premium leather trousers
- Polished boots
- Premium trainers
- Statement sunglasses
- Luxury watch/accessory

This gives an initial target of roughly 80 curated clothing pieces before colour variants.

## Skin definition rules

Each released item should have:

- stable external key
- category and wearable slot
- supported avatar frames
- asset/mesh identifier
- material definition
- approved colour variants
- tattoo coverage regions
- preview manifest
- clipping/fit validation status
- store metadata
- collection/pack membership

Optional:

- rarity
- limited-edition dates
- premium/VIP status
- gameplay bonus configuration

## Visual style

New skins should match the existing Rockmundo avatar aesthetic:

- stylised low-poly/moderate-poly geometry rather than photorealism
- readable silhouettes at full-body camera distance
- restrained material detail so items remain clear under stage lighting
- proportions consistent with existing avatar heads, hands and footwear
- rock/music styling without making every item extreme
- colours/materials that work in dark gigs as well as the fitting/store preview

## Validation gate

A skin is not publishable until it passes:

- front view
- back view
- side view
- arms-out/T-pose
- singing animation
- guitarist/bassist pose where relevant
- seated/drummer pose where relevant
- no major torso/limb clipping
- no extreme stretching
- no detached garment parts
- preview generated successfully
- equipping it does not replace unrelated avatar parts
- tattoos are hidden only where the garment actually covers the body

## Future expansion

Do not reintroduce a full procedural garment creator until there is a proper skinned-mesh/morph-target clothing pipeline.

Future safe customisation can be added incrementally:

- curated colourways
- approved logos/graphics
- player band logo decal zones
- patches
- embroidery
- instrument finishes

These should modify textures/materials on validated base assets rather than generating clothing geometry.
