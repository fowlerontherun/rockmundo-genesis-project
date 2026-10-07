# Rockmundo Shareable Moments — Implementation Plan

## Goal
Turn meaningful Rockmundo gameplay events into attractive, branded, referral-aware social graphics built from authoritative game data and the existing Avatar V1/player-model renderer.

## Product rules
- Avatar V1 is the only avatar target.
- Game features emit structured share data; they do not own graphic layout code.
- Historical moments snapshot visual/game data needed to reproduce the original moment.
- Every template supports square (1080x1080), story (1080x1920), and landscape (1200x630) composition.
- Rockmundo branding is consistent and restrained.
- Referral attribution is optional in presentation but preserved in the share URL.
- Native Web Share is preferred; copy link/image and download remain fallbacks.
- Sharing never changes gameplay outcomes or awards rewards merely for posting.

## Existing functionality to consolidate
The live codebase already has native share flows for achievements, chart milestones, releases, band recruitment and Blind Box graphics. Phase 1 extracts their repeated Web Share/referral behavior into one system and migrates suitable callers incrementally.

## Architecture
```
Game event / profile action
        |
        v
ShareMoment (structured immutable payload)
        |
        +--> ShareTemplate resolver
        +--> Avatar V1 visual snapshot
        +--> artwork / band / event snapshot
        +--> referral-aware destination
        |
        v
Share Renderer
        |
        +--> square
        +--> story
        +--> landscape
        |
        v
Share Sheet
  native share / copy image / download / copy link
```

### Core contracts
- `ShareMomentType`: character_profile, band_profile, gig_result, achievement, release, chart, referral, blind_box; later festival, tour, crafted_item and gig_photo.
- `ShareMoment`: version, type, subject IDs, headline/subheadline, metrics, artwork, avatar snapshot, branding, destination, referral code, createdAt.
- `ShareFormat`: square | story | landscape.
- `ShareTemplate`: pure renderer contract receiving a normalized moment and dimensions.
- `ShareResult`: blob/file, filename, title, text, URL.

## Phase 1 — Core engine and first five cards

### 1A. Foundation
- [x] Add `src/features/shareable-moments/`.
- [x] Define versioned ShareMoment and template contracts.
- [x] Add central format dimensions/safe areas.
- [x] Add reusable Canvas drawing helpers (text fitting, rounded panels, image loading, branding).
- [x] Add referral-aware share URL helper using the existing `/auth?ref=CODE` contract.
- [x] Add native share helper with file capability detection and clipboard/download fallbacks.
- [x] Unit-test URL construction, dimensions, filenames and share capability selection.

### 1B. Avatar V1 capture
- [x] Reuse `features/player-model` assembly; do not create another avatar implementation.
- [x] Add a deterministic share presentation/camera preset.
- [x] Support current appearance, rich clothing, tattoos, merch wearable and equipped/luthiery instruments.
- [x] Capture transparent/high-quality avatar image for card composition.
- [ ] Define serialisable avatar visual snapshot contract for historical moments.
- [ ] Gracefully render a branded non-avatar fallback if WebGL/assets fail.

### 1C. Initial templates
- [ ] Character profile card.
- [ ] Band profile card.
- [ ] Gig result card.
- [ ] Achievement/fame milestone card.
- [ ] New release card.
- [ ] Render all five in square/story/landscape formats.

### 1D. UI
- [x] Reusable `ShareMomentSheet` with live preview.
- [x] Format selector.
- [x] Native Share button.
- [x] Copy image, download image and copy link.
- [ ] Accessible labels/status and mobile-safe layout.
- [ ] Add Share entry points to the five initial surfaces.

### 1E. Consolidate current sharing
- [ ] Migrate Dashboard achievement sharing.
- [ ] Migrate chart milestone sharing.
- [ ] Migrate release milestone sharing.
- [ ] Keep band recruitment semantics but move transport/referral utilities to shared helpers.
- [ ] Adapt BlindBoxShareSheet to shared primitives without regressing its existing image card.

### 1F. Analytics
- [ ] Define events: share_prompt_viewed, share_studio_opened, share_rendered, share_native_started, share_downloaded, share_link_copied.
- [ ] Include moment type/template/format but no sensitive player data.
- [ ] Preserve referral attribution through destination links.
- [ ] Add admin reporting later once event volume exists.

### Phase 1 acceptance
- [ ] A real Avatar V1 character can be rendered into a branded Character Profile card.
- [ ] All five templates produce valid PNGs in all three formats.
- [ ] Android/iOS-capable browsers receive file sharing where supported.
- [ ] Desktop has download/copy fallbacks.
- [ ] Referral links retain attribution.
- [ ] Existing achievement/chart/release sharing still works after migration.
- [ ] Typecheck, lint-ci and focused unit tests pass.

## Phase 2 — Music graphics
- [ ] Gig announcement/poster and sold-out variants.
- [ ] Tour announcement and world-map route card.
- [ ] Festival lineup/headliner/result posters.
- [ ] Chart #1 / gold / platinum-style milestone families.
- [ ] Genre-aware visual themes with controlled templates.

## Phase 3 — Avatar share photography
- [ ] Share-specific Avatar V1 poses.
- [ ] Instrument-aware poses.
- [ ] Multi-member band compositions.
- [ ] Stage/venue backgrounds.
- [ ] Gig viewer virtual photographer capture points.
- [ ] Post-gig photo gallery.

## Phase 4 — Share Studio and career gallery
- [ ] Template/theme selection.
- [ ] Pose/background selection.
- [ ] Player-selectable safe statistics.
- [ ] Saved Share Gallery / career scrapbook.
- [ ] Regenerate old moments from snapshots.
- [ ] Internal Twaater publishing using the same generated asset.

## Phase 5 — Growth loop
- [ ] Attribute share link click -> signup -> qualified referral.
- [ ] Measure templates/moments that convert.
- [ ] Admin funnel dashboard.
- [ ] Contextual Tier A prompts for exceptional milestones.
- [ ] Rate-limit prompts and allow player preference controls.
- [ ] Reward successful referrals, never raw social posting.

## Future moment catalogue
Character progression; skill mastery; professional unlock; education completion; fame milestones; band creation/join; songwriting; recording; releases; charts; sales; gigs; sell-outs; biggest audience; tours; first city/country; festivals; awards; crafted instruments; Luthier shop; merch launches; anniversaries.

## Guardrails
- No arbitrary freeform HTML screenshotting for canonical cards.
- No duplicate avatar renderer.
- No client-trusted achievement/reward mutations from sharing.
- Do not expose private profile/account data in generated images or analytics.
- Respect reduced motion and renderer quality/device capability.
- Snapshot historical display data instead of silently replacing it with current mutable values.
