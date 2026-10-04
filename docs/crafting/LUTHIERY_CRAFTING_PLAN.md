# RockMundo Luthiery Crafting Plan

Status: Phase 3 implementation complete; focused release gate added
Reviewed against main: 2026-10-04 at f2a2ca6843a19311493f6dee46092b9e31c1ecec

## Product goal

Turn Luthiery into a full player profession where a character can learn the craft, buy raw materials, assemble an instrument from five meaningful parts, customise its shape and colour, create a unique item whose quality and boosts depend on skill plus materials, and eventually operate a player-owned instrument shop.

The initial profession scope is guitars and basses. Other crafting professions remain out of scope until the Luthiery loop is complete and balanced.

## Canonical instrument build

Every player-built guitar or bass is assembled from exactly five gameplay parts:

1. Body
2. Neck
3. Fretboard
4. Electronics
5. Hardware

Finish and colour are customisation layers, not a sixth structural part.

Each part must support multiple material choices. Material quality, rarity and the player's Luthiery progression contribute to the final result. Body shape is a separate unlockable visual choice.

## Phase 0 — Audit and foundation

- [x] Review the existing crafting workshop, material catalogue, recipes and skill tree.
- [x] Keep Luthiery on the canonical Basic -> Professional -> Mastery skill chain.
- [x] Keep the existing crafting route and current inventory/shop tabs available during migration.
- [x] Define guitars and basses as the first supported Luthiery instrument families.
- [x] Define the five-part instrument contract.
- [x] Identify the legacy random-quality collector as non-authoritative for the new custom-instrument path.
- [ ] Remove or migrate legacy recipe-only assumptions once the custom builder is authoritative.

Acceptance gate: the new Luthiery work can be added without breaking existing crafting routes or unrelated recipes.

## Phase 1 — Skills, unlocks and materials

- [x] Luthiery Basics exists in the skill tree.
- [x] Professional Luthiery exists in the skill tree.
- [x] Master Luthier exists in the skill tree.
- [x] Existing material catalogue includes body woods, fretboards, pickups/electronics, hardware and finishes.
- [x] Existing material inventory and shop can display and purchase crafting materials.
- [x] Unlock requirements can be expressed against the canonical Luthiery tier progress values.
- [ ] Add dedicated neck-stock variants rather than relying on generic wood stock where needed.
- [ ] Balance material prices after the five-part custom build loop is live.

Acceptance gate: the UI can determine whether a shape or material is available from the active character's Luthiery progression.

## Phase 2 — Five-part build model and outcome rules

- [x] Body, neck, fretboard, electronics and hardware are the canonical five parts.
- [x] Material quality tiers already exist and can feed projected quality.
- [x] Guitar and bass are the first instrument families.
- [x] Existing finish materials can be used as the visual finish layer.
- [x] Existing player material inventory can be surfaced beside choices.
- [ ] Move final craft resolution to one authoritative server transaction.
- [ ] Consume all five selected materials atomically.
- [ ] Persist the exact build specification on the created equipment item.
- [ ] Replace the legacy Math.random-only quality roll for custom instruments.
- [ ] Award Luthiery XP through the canonical progression service.

Acceptance gate: the final server result is deterministic from the submitted build inputs plus an authoritative bounded quality roll/seed, and cannot be forged or duplicated by the client.

## Phase 3 — Visual Luthiery Workbench

Goal: make instrument construction visible and understandable on screen before connecting the visual build to final server settlement.

### 3.1 Workbench shell
- [x] Add a dedicated Workbench tab to Crafting Workshop.
- [x] Keep Blueprints, Materials, Shop, Active, Salvage and Enchant intact.
- [x] Show current Basic / Professional / Master Luthiery progress.

### 3.2 Instrument and shape selection
- [x] Select electric guitar or electric bass.
- [x] Add progressively unlocked body shapes.
- [x] Clearly show locked shapes and their Luthiery requirement.
- [x] Update the instrument preview immediately when shape changes.

### 3.3 Five-part assembly
- [x] Show exactly five selectable part slots.
- [x] Let the player select a part from the list or directly from the preview.
- [x] Show eligible material choices for the active part.
- [x] Show owned quantity for each material.
- [x] Show locked material requirements.
- [x] Update the visible instrument as parts are selected.

### 3.4 Colour and finish
- [x] Add a colour palette.
- [x] Add finish selection.
- [x] Apply the selected colour/finish treatment to the live preview.
- [x] Add custom artwork/decal placement with selectable decals, colour, position, scale and rotation.

### 3.5 Previewed outcome
- [x] Show projected build quality from selected material quality plus Luthiery skill.
- [x] Show projected tone, sustain, stability, output and stage-presence tendencies.
- [x] Label the number as a preview estimate until Phase 2 server settlement is authoritative.
- [x] Add item naming with bounded validation.
- [x] Add final review / confirm-design step with aggregated material-stock validation.
- [x] Produce a validated immutable preview specification on confirmation without mutating inventory.
- Phase boundary: the actual craft/mint action is intentionally owned by Phase 4 because it requires the authoritative transaction listed there; Phase 3 must remain read-only.

### 3.6 Tests
- [x] Add pure tests for unlock rules and projected-quality calculations.
- [x] Add component interaction tests for keyboard/touch part selection, visible part changes, artwork and confirmation blockers.
- [x] Add real Playwright browser coverage for the complete five-part assembly journey and verify the fixture performs no game-data mutations.
- [x] Add a dedicated Phase 3 CI/release-gate workflow covering focused tests, typecheck, lint, build and Chromium.

Acceptance gate: a player can assemble a guitar or bass visually, choose all five part materials, choose an unlocked shape and colour/finish, place artwork, name the instrument, understand locks and aggregated owned stock, review the complete design, and confirm a read-only build specification without changing inventory.

### 3.7 Production catalogue verification
- [x] Verify every workbench material choice resolves against the live production crafting catalogue.
- [x] Seed missing woods, electronics, hardware and finishes idempotently without overwriting existing balanced production rows.
- [x] Verify there are no duplicate rows for the newly reconciled material names.
- [x] Apply the catalogue migration directly to the live RockMundo database and keep the migration in source control.

## Phase 4 — Authoritative crafting and item persistence

- [ ] Add a server-side create-custom-instrument action/RPC.
- [ ] Validate active profile, skill unlocks, shape unlocks and all material ownership server-side.
- [ ] Lock inventory rows and consume the five part materials plus finish atomically.
- [ ] Calculate final quality and boosts server-side.
- [ ] Create the equipment item and immutable build specification in the same transaction.
- [ ] Make retries idempotent.
- [ ] Reject client-supplied quality/stats.
- [ ] Return the created item to the reveal screen.
- [ ] Add DB/RLS/integration tests.

## Phase 5 — Player instrument shop

- [ ] Let qualified Luthiers open an instrument shop.
- [ ] Add shop name, branding, city and reputation.
- [ ] Let owners list player-made instruments.
- [ ] Add pricing, stock, sales history and commission controls.
- [ ] Preserve maker identity and build provenance on resale.
- [ ] Add customer browsing and purchase flow.
- [ ] Add shop reputation effects from quality, value and reliability.

## Phase 6 — Equipment and gig integration

- [ ] Make player-crafted guitars/basses equippable everywhere normal instruments are used.
- [ ] Feed their boosts into the existing equipment/readiness calculations without double counting.
- [ ] Show maker, shape, materials, colour and quality on equipment detail.
- [ ] Render the selected custom shape/colour in supported avatar/gig instrument views.
- [ ] Preserve the immutable build snapshot in historical gig replays where required.

## Phase 7 — Balance and content expansion

- [ ] Add more body shapes, including intentionally extreme RockMundo designs.
- [ ] Expand dedicated neck woods, fretboards, pickups and hardware.
- [ ] Add rare drops and region/vendor-specific materials.
- [ ] Add repair, refinishing and modification jobs.
- [ ] Add maker signatures, serial numbers and collectible provenance.
- [ ] Add commissions/custom orders between players.
- [ ] Review economy sinks/sources and prevent material/shop exploits.

## Phase 3 completion review — 2026-10-04

The merged first Phase 3 slice was reviewed again and the following gaps/bugs were corrected:

- starter builds now default to the catalogue-backed Alder body instead of a Pine body that may not exist in the live material catalogue;
- both guitar and bass retain a level-zero usable body shape;
- neck, fretboard, electronics and hardware selections now visibly change the instrument preview instead of only changing projected numbers;
- the SVG preview exposes interactive parts to keyboard and touch input rather than hiding controls behind an image semantic;
- repeated use of the same material is aggregated at review time, so two parts cannot pass stock validation against one inventory unit;
- item naming, artwork placement and a complete review/confirm-design journey are implemented;
- confirmation remains read-only and returns a deterministic preview specification; Phase 4 owns material consumption and equipment creation;
- focused Vitest and real Chromium Playwright coverage are included in a dedicated Luthiery Phase 3 workflow;
- the live production material catalogue was reconciled after the UI review exposed missing finish/hardware/advanced material rows; all 32 workbench material-choice groups now resolve against production.

The legacy recipe collection flow still uses its historical client-side random quality roll. It is not used as the authority for the custom Luthiery workbench and will be replaced/retired when Phase 4 introduces the server-authoritative custom-instrument transaction.
