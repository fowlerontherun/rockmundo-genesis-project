
## What’s actually going wrong (based on the code + DB)
Right now the “layering” code is mostly correct (absolute stacking with z-index). The reason it still doesn’t produce a believable “whole character” is that **the PNGs are not truly aligned as a shared template set** at render-time.

Specifically:
- `SpriteLayerCanvas` renders each PNG with `object-contain` inside the same box (`absolute inset-0 w-full h-full object-contain`).
- If **any** layer PNG has a different intrinsic aspect ratio (ex: 1024×1024 vs 512×1024), or the content is drawn at a different scale/position inside its canvas, `object-contain` will scale it differently → layers drift.
- The current approach assumes “all layers share the same canvas and the body is in the same place”, but we have no runtime enforcement/validation of that assumption.
- Also, “template-only assets” is not yet strictly enforced in `useCharacterSprites.getSpritesByCategory()`—it currently pulls by `category` and `gender_filter`, but does **not** filter to `subcategory = aligned` (or an `is_aligned` flag). That means legacy assets can still leak into selection and defaults.

The result: even though images stack, they still don’t compose into a coherent RPM replacement.

---

## Goal (what “fully working layered replacement” means)
1. When opening `/avatar-designer`, the app auto-builds a complete character: body + hair + face + shirt + trousers + shoes (plus optional extras).
2. Any selection change swaps **only** that layer, without disturbing the others.
3. Layers remain aligned and consistent across all combinations.
4. The UI only shows the aligned template set (no legacy sprites).
5. We can reliably reproduce and confirm correctness with a built-in “layer test” view and a screenshot/export of 1 item per layer.

---

## Implementation strategy (robust + debuggable)
Instead of relying on “all PNGs are perfect,” we will make the renderer **template-aware** and add **validation + debug tooling** so we can prove alignment.

### Key changes
A) **Enforce template-only assets**
- Filter sprites to aligned set only:
  - Add a strict filter rule: `subcategory === 'aligned'` OR `subcategory startsWith('aligned_')` OR add an explicit DB column `is_aligned`.
- Ensure this filter applies in:
  - `useCharacterSprites()` fetch result (preferred: filter after fetch so all consumers are safe)
  - `getSpritesByCategory()`
  - `buildDefaultCharacter()` selection logic

B) **Stop using `object-contain` for stacking**
For layered sprites, we want identical pixel mapping across layers.
- Replace `object-contain` with a rendering mode that guarantees all layers fill the same coordinate space:
  - Use `object-fill` so every layer always maps to the container exactly (no per-layer aspect-ratio scaling differences).
  - Lock the preview container to the template aspect ratio (512:1024 = 1:2) and ensure consistent sizing.

This single change often fixes the “it’s not layering” feeling immediately when assets are slightly inconsistent.

C) **Introduce optional anchor/offset support (safety net)**
Even with a template system, some layers might still be slightly off. We already have `anchor_x` / `anchor_y` columns in `CharacterSprite`.
- Use `anchor_x/anchor_y` as pixel offsets (or normalized offsets) applied via CSS transform:
  - `transform: translate(var(--dx), var(--dy))`
- Default to 0 offsets for aligned assets.
- This provides a path to “fine-tune” without regenerating everything.

D) **Add a “Layer Debug / Proof” mode**
User asked for “Take a screenshot with 1 item from each layer added”.
Because you’re reporting persistent issues, we should add an explicit in-app debug panel that:
- Selects a known “test set” (one sprite per category) with a single click.
- Displays a checklist showing each layer is present and which exact sprite is used.
- Provides a “Export composite PNG” button:
  - Draw layers onto a `<canvas>` in correct order.
  - Export as PNG (download) and optionally store it to Supabase Storage to share a URL.

This removes guesswork and gives us a definitive “this is correct/incorrect” artifact every time.

E) **Default character logic tightened**
Current default builder:
- Does not consistently apply gender filter to all categories (hair/face etc).
- Does not enforce aligned-only.
We’ll update it to:
- Only choose from aligned sprites
- Apply gender filtering consistently where relevant
- Ensure a complete set is always chosen (body is mandatory, shoes mandatory, trousers mandatory, etc)

F) **Versioning**
Per your project instruction: every change must bump the banner version and add a Version History entry.

---

## Step-by-step plan (what I will implement next)

### 1) Codebase audit and alignment constraints
- Inspect the exact set of aligned sprites available, confirm categories:
  - `body, hair, eyes, nose, mouth, shirt, jacket, trousers, shoes, hat, glasses, facial_hair`
- Confirm `subcategory` values and decide the exact “aligned-only” rule:
  - Based on DB sample, `subcategory` is `aligned` for most, `aligned_male` / `aligned_female` for bodies.
  - Rule will be: `subcategory LIKE 'aligned%'`.

### 2) Enforce template-only assets everywhere
- Update `useCharacterSprites`:
  - After fetching `character_sprite_assets`, filter down to aligned set only.
  - Optionally expose `spritesAligned` vs `spritesAll` if needed, but default export should be aligned-only since you explicitly chose that.

### 3) Fix renderer to use consistent coordinate mapping
- Update `SpriteLayerCanvas.tsx`:
  - Change the layer image class from `object-contain` to `object-fill`.
  - Ensure the container itself has a stable aspect ratio (it already uses an aspect wrapper in `PunkCharacterCreator`, but we’ll ensure the internal canvas respects it).
  - Apply optional `anchor_x/anchor_y` offset if present:
    - Example: `style={{ transform: \`translate(${sprite.anchor_x}px, ${sprite.anchor_y}px)\` }}` (or scaled relative to rendered size if we decide normalized anchors).

### 4) Add “Debug composite + screenshot” tooling
- Add a small debug section to the Avatar Designer (can be behind a “Debug” toggle):
  - “Apply test set” button: picks one default per layer.
  - “Export PNG” button: renders a composite onto a canvas using the resolved image URLs and saves it.
  - Also show a simple text list of selected sprite names + categories.

This satisfies your request to “take a screenshot with 1 item from each layer added” in a reproducible way, even without needing my remote session logged in.

### 5) Make default character truly complete and stable
- Update `buildDefaultCharacter()` in `PunkCharacterCreator.tsx`:
  - Ensure each category selection pulls from the aligned-only set.
  - Ensure gender filtering for body + trousers (and facial hair).
  - Ensure we always pick: `body, hair, eyes, nose, mouth, shirt, trousers, shoes` (jacket optional but default can include it).

### 6) Validate with a known test case
- Open `/avatar-designer`
- Use “Apply test set”
- Confirm:
  - Body visible
  - Trousers align to hips/legs
  - Shoes align to feet
  - Shirt aligns to torso
  - Jacket overlays correctly
  - Face features sit on the head
  - Hair sits on top
- Export PNG to confirm the composite is correct.

### 7) Version bump + Version History entry
- Update the banner version number (next patch)
- Add a changelog entry describing:
  - “Aligned-only filtering enforced”
  - “Renderer changed to fill template space for consistent layering”
  - “Added debug composite export”
  - “Improved default auto-build to include 1 item per layer reliably”

---

## Risks / tradeoffs
- `object-fill` can slightly distort if an asset has a different aspect ratio. For layered sprites, this is preferable to misalignment; it forces uniform mapping.
- If assets are drastically inconsistent (not just minor), no renderer can fully fix it; we’d then regenerate the problematic layers. The debug export will tell us exactly which category is wrong.
- Anchor offsets are a fallback; ideally aligned assets should require no offsets.

---

## Deliverable definition (what you’ll see when done)
- The Avatar Designer immediately shows a complete character on load.
- Changing any layer swaps cleanly without shifting others.
- Only aligned sprites show in pickers.
- A “Debug/Test composite” action demonstrates 1 item from each layer and can export a PNG proof.

