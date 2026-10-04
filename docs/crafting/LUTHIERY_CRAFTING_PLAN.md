# RockMundo Luthiery Crafting Plan

Status: Phase 5 player instrument shops implemented; canonical Luthiery XP award remains open
Reviewed against main: 2026-10-04 at 0d4cccefafc544b4d9e8f48035e06c66f819a418
Phase 4 branch: `feat/luthiery-phase-4-authoritative-crafting`

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
- [x] Move final custom-instrument craft resolution to one authoritative server transaction.
- [x] Consume all five selected part materials plus the finish atomically.
- [x] Persist the exact build specification in immutable provenance linked to the created equipment item.
- [x] Replace the legacy Math.random-only quality path for custom workbench instruments with a server-derived bounded deterministic roll.
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

- [x] Add a server-side create-custom-instrument action/RPC.
- [x] Validate active profile, skill unlocks, shape unlocks and all material ownership server-side.
- [x] Lock inventory rows and consume the five part materials plus finish atomically.
- [x] Calculate final quality and boosts server-side.
- [x] Create the equipment item and immutable build specification in the same transaction.
- [x] Make retries idempotent.
- [x] Reject client-supplied quality/stats.
- [x] Return the created item to the reveal screen.
- [x] Add DB/RLS/integration tests.

### Phase 4 implementation review — 2026-10-04

- the live Luthiery tier scale was corrected from obsolete 250/650-style values to the canonical 20-level tier model before server enforcement was enabled;
- authoritative shape/component catalogues now live in the non-exposed `private` schema, with all 9 shapes and 32 component/finish options validated server-side;
- `create_custom_luthiery_instrument` accepts design choices only and rejects client quality/stat fields;
- the RPC requires the authenticated user's active living character, validates skill/shape/component unlocks, resolves production material aliases, locks stock rows and consumes aggregated requirements atomically;
- final quality uses material quality, canonical Luthiery levels, shape difficulty and a bounded deterministic server roll derived from the request identity;
- the equipment row, active-character inventory grant and immutable `luthiery_crafts` provenance are created in the same transaction;
- idempotency uses a per-character request key plus payload hash and a transaction advisory lock, so retries return the existing item and changed payloads are rejected;
- provenance has RLS, clients have read-only access for the active character, anonymous RPC access is revoked and authenticated execution is intentionally limited to the validated SECURITY DEFINER RPC;
- the workbench now exposes a Craft instrument action after review/confirmation and feeds authoritative final quality/stats to the existing reveal dialog;
- the checked-in SQL harness passed against the live database inside a rollback transaction, covering permissions, consumption, equipment minting, six-material provenance, retry idempotency, outcome injection rejection and idempotency conflicts;
- live migrations applied: `20261004211805_luthiery_phase4_authoritative_crafting`, `20261004212003_fix_luthiery_phase4_parts_validation`, and `20261004212140_index_luthiery_phase4_crafts_user`;
- a dedicated Phase 4 CI workflow runs focused tests, typecheck, lint, build and the existing Chromium workbench journey.

Remaining carry-over before the whole crafting foundation is considered complete: award Luthiery XP through the canonical progression service, retire or migrate the legacy recipe collection path, add dedicated neck-stock materials, and balance material prices once enough live crafting data exists.

## Phase 5 — Player instrument shop

- [x] Let qualified Luthiers open an instrument shop.
- [x] Add shop name, branding, city and reputation.
- [x] Let owners list player-made instruments.
- [x] Add pricing, stock, sales history and commission controls.
- [x] Preserve maker identity and build provenance on resale.
- [x] Add customer browsing and purchase flow.
- [x] Add shop reputation effects from quality, value and reliability.

### Phase 5 implementation review — 2026-10-04

- qualified characters can open one instrument shop once Basic Luthiery reaches level 20 (or a higher Luthiery tier is active), and the shop is anchored to the active character's current city;
- shop owners can configure the shop name, tagline, brand colour, optional logo, open/closed state, city relocation and a 0–15% original-maker resale commission;
- only canonical Phase 4 `custom_luthiery` equipment with immutable `luthiery_crafts` provenance can be listed, and equipped instruments cannot be listed;
- active listing inventory is protected from client mutation while for-sale, then ownership is transferred by moving the same `equipment_items.id` into the buyer's `player_equipment` row so maker identity and build provenance survive every resale;
- listing snapshots store maker name, quality, condition, stats and immutable build provenance; sold listings release their obsolete seller inventory-row reference with `ON DELETE SET NULL`;
- purchases use the canonical `finance_transfer` ledger path rather than direct cash mutation, with idempotent seller and maker transfer keys and automatic `profiles.cash` projection updates;
- first-party sales pay the full asking price to the maker/seller; resales split the configured commission to the original maker and the remainder to the current seller;
- customer browsing shows shop/city/reputation, price versus suggested value, quality, condition, maker and build materials before purchase;
- shop reputation is recalculated from average sold-item quality (50%), value-for-money (30%) and listing reliability (20%), while cancelled listings reduce reliability;
- direct client INSERT/UPDATE access is revoked, mutation RPCs are authenticated SECURITY DEFINER functions with fixed search paths, anonymous shop browsing/mutations are blocked, and RLS limits non-public history to participants/shop owners;
- a rollback integration harness passed against the live database for craft provenance, listing locks, ledger settlement, first sale, resale, maker commission, identity preservation and idempotent purchase retry;
- live migrations applied: `20261004215150_luthiery_phase5_player_instrument_shops`, `20261004215337_harden_luthiery_phase5_browsing`, `20261004215545_use_finance_ledger_for_luthiery_shop_sales`, `20261004215752_allow_authoritative_luthiery_shop_transfer`, `20261004220404_allow_luthiery_shop_inventory_ownership_transfer`, `20261004220712_hide_closed_luthiery_shop_listings`, and `20261004220910_index_luthiery_phase5_foreign_keys`;
- a dedicated Phase 5 UI test suite and GitHub Actions verification workflow cover customer browsing, shop qualification/setup, typecheck, lint and build.

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

The legacy recipe collection flow still uses its historical client-side random quality roll. The custom Luthiery workbench no longer uses that path: Phase 4 now resolves custom instruments through the authoritative server transaction. The legacy recipe flow remains scheduled for retirement/migration.
