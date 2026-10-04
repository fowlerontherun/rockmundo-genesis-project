# RockMundo Luthiery Crafting Plan

Status: Phase 3 in progress
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
- [ ] Add custom artwork/decal placement in a later Phase 3 slice.

### 3.5 Previewed outcome
- [x] Show projected build quality from selected material quality plus Luthiery skill.
- [x] Show projected tone, sustain, stability, output and stage-presence tendencies.
- [x] Label the number as a preview estimate until Phase 2 server settlement is authoritative.
- [ ] Add item naming.
- [ ] Add final review / confirm-build step.
- [ ] Connect confirm-build to the authoritative custom-instrument RPC from Phase 2 hardening.

### 3.6 Tests
- [x] Add pure tests for unlock rules and projected-quality calculations.
- [ ] Add component interaction tests for keyboard/touch part selection.
- [ ] Add browser coverage for the complete five-part assembly journey.

Acceptance gate: a player can assemble a guitar or bass visually, choose all five part materials, choose an unlocked shape and colour/finish, understand locks and owned stock, and see a stable projected outcome without changing inventory.

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

## Current review notes

The current main branch already has a useful crafting foundation, but the legacy recipe path is not yet the final Luthiery system. In particular, the existing collection flow derives quality from a client-side random roll and does not create the requested five-part custom instrument from the selected materials. Phase 3 is therefore being implemented as an additive visual workbench while Phase 4 will make final crafting authoritative and transactional.
