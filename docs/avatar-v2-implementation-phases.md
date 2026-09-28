# Avatar V2 implementation phases — player avatars and gigs

Status: **implementation plan; not a release approval**. V1 remains live until the V2 rollout gates pass. Track evidence separately for masculine and feminine frames. Do not promote source-only or experimental proofs, staged garments, or structural-validator passes to production status.

## Baseline (28 September 2026)

- `src/features/player-model/v2/avatarV2Registry.ts`: all eight frame/LOD base entries are `planned`; `AVATAR_V2_ROLLOUT.enabled` is `false`.
- The minimum guarded rollout needs **validated LOD0 and LOD1 for both frames**; the complete release gate checks all four LODs for each frame.
- Genuine CC0 source meshes, lookdev references, joint handles and a partial head/eye movement experiment exist. Neither full-body guide is certified fitted or fully weighted.
- Fifteen clothing blockouts and preview textures are staged for private authoring review; none is a production-ready fitted garment.
- Structural GLB skinning checks and regression tests exist. They do not certify binary vertex weight correctness, actual deformation, visual fit, or game performance.
- Verify CI status independently. Inspect/fix the skinning test step in `.github/workflows/avatar-v2-real-source-seeds.yml` (currently appears to contain literal `\\n` text).

## Phase 0 — Pipeline and evidence reliability

**Goal:** ensure subsequent work produces trustworthy, reproducible evidence.

**Implementation**
- Fix and run the Avatar V2 GitHub Actions workflow, including skinning tests, genuine-source build and artifact verification.
- Strengthen GLB inspection to read actual BIN accessors: joint index bounds, finite/normalised vertex weights, buffer/accessor ranges, inverse bind matrix bytes, and exported mesh/skin associations. Add real binary GLB fixtures and Blender-exported sample regression assets.
- Define versioned authoring manifest and QA evidence for each frame/LOD and garment. Keep preview assets isolated from production paths.
- Confirm admin previews load actual textures and geometry and show clear `source-only`, `experimental`, `candidate`, `validated` status.

**Exit evidence:** green CI run URL, tested real exported GLBs, reproducible source artifacts, no preview-only asset marked validated.

## Phase 1 — Production masculine and feminine body rigs

**Goal:** produce genuinely fitted, fully skinned base bodies.

**Implementation**
- Review and apply anatomical joint handles on the real CC0 masculine and feminine sculpts, including spine, shoulders, arms, hands/fingers, hips, knees, ankles, toes, eyes, jaw and independent ear anchors.
- Finish production skeleton, skin binding, four-influence weight cleanup, twist helpers and eight body-occlusion regions for both frames.
- Author shoulder/elbow/wrist/hip/knee corrective shapes; verify neutral stance and extreme reach, crouch, sitting and instrument-holding poses.
- Run Blender weight/topology audits, serialized GLB binary validation and independent artist deformation review.

**Exit evidence:** editable reviewed `.blend` per frame, fit reports, weight audit and GLB validation results, front/side/back and extreme-pose captures. **Dependency for Phase 3.**

## Phase 2 — Faces, body customisation and attachments

**Goal:** make both bodies suitable for close-up profile and gig cameras.

**Implementation**
- Finish eyelid/blink, eye tracking, jaw, mouth-opening, singing visemes, brow and expression shapes, including facial surface bindings and close-up texture maps.
- Implement/verify body and face morphs, hairstyles, eyebrow options and skin/material variants; ensure saved choices round-trip through creator, persistence and preview.
- Fit glasses, independent left/right earrings and hair attachments against both frames and morph extremes. Provide the default RockMundo logo T-shirt as a fully authored garment in Phase 3.
- Verify facial deformation with singing and camera close-ups, including accessory and hair collision/placement.

**Exit evidence:** facial-expression capture sheet, saved-customisation round-trip tests, accessory attachment screenshots, close-up QA approval for both frames. May overlap with Phase 3 after Phase 1.

## Phase 3 — Production clothing and skin-pack migration

**Goal:** replace staged blockouts with genuinely wearable, high-quality V2 items.

**Implementation**
- Prioritise a small playable capsule: RockMundo tee, one jeans fit, one footwear option and one outerwear option; then finish all 15 staged designs.
- Replace planar preview UVs with authored UVs and detailed, traceable PBR maps. Review logos, patches, pins, belts and cuffs as properly attached geometry/materials.
- Fit every garment independently to both production frames; transfer and manually correct weights from the matching fitted body. Handle wrist accessories, belts and footwear by appropriate attachment/weight rules.
- Implement body-region occlusion, clothing layering, material/colour variants and skin-pack catalogue/admin visibility. Preserve existing gameplay boost rules separately from visual asset validation.
- Capture neutral and performance-pose clipping checks on both frames, including torso twist, arm lift, seated drumming and foot/ankle motion.

**Exit evidence:** source scenes, distinct frame/LOD manifests, texture provenance, skinned GLBs, clipping screenshots, visual sign-off and validated catalogue mappings. **Do not migrate old purchasable skins until replacement assets are approved.**

## Phase 4 — Genuine LODs, optimisation and asset certification

**Goal:** certify assets for real player and gig rendering budgets.

**Implementation**
- Author distinct LOD0–LOD3 meshes for both bodies, preserving silhouette and required rig/face capabilities appropriate to distance.
- Create real garment LODs for the approved capsule first, then the remaining catalogue; enforce triangle, vertex, bone and texture limits in `avatarV2Contract.ts`.
- Verify morph and skeleton compatibility across LOD transitions; test skin/material fidelity, draw calls, memory, texture loading and multi-avatar rendering.
- Record signed validation evidence before changing registry/garment statuses. Keep missing or failed assets blocked.

**Exit evidence:** validated LOD0/LOD1 for both frames and approved capsule for minimum rollout; LOD0–LOD3 and wider garment certification for complete release.

## Phase 5 — Player avatar integration and guarded rollout

**Goal:** make V2 usable by players without breaking existing appearances.

**Implementation**
- Integrate certified body/garment assets into the creator, player profile, band member views, skin store and persistence. Map legacy V1 appearance data with reversible fallback.
- Test all frame/morph/outfit combinations, mobile preview, admin diagnostics, asset failures and versioned saves.
- Enable V2 only behind a controlled rollout after the minimum asset gate passes; monitor crashes, loading failures and player-visible regressions.
- Keep V1 fallback available during rollout and document a rollback path.

**Exit evidence:** end-to-end creator/save/reload tests, both-frame mobile and desktop QA, no starter-model substitution on normal profile loads, staged rollout and rollback sign-off.

## Phase 6 — Gigs and Top of the Pops

**Goal:** prove V2 characters under real performance and camera conditions.

**Implementation**
- Bind V2 to guitar, bass, drums, keyboards, microphone, walk and stage-performance animation sets; verify instrument grip/attachment and seated drummer contact.
- Validate garment deformation, hair/accessory attachment and facial singing across animation transitions and the closest stage cameras.
- Integrate V2 into gig viewer, saved-gig playback and Top of the Pops using versioned appearance snapshots; handle old V1 recordings and missing assets gracefully.
- Run representative small and large venues with multiple distinct band members, stage lighting, screens, camera cuts and LOD switching; benchmark mobile and desktop.

**Exit evidence:** recorded per-instrument animation QA, saved-gig replay parity, close-up screenshots/video, multi-performer performance results and rollback/fallback tests.

## Phase 7 — Release and legacy migration

**Goal:** move from guarded V2 to default player/gig avatars.

**Implementation**
- Close remaining defects and complete LOD0–LOD3/body and catalogue certification; verify no broken or legacy skin products remain incorrectly purchasable.
- Run regression, accessibility, mobile, persistence, gig replay and performance suites on release candidates.
- Promote versioned assets and enable V2 by cohort; monitor production errors, allow rollback, then make V2 the default once acceptance criteria are met.
- Retire V1-dependent rendering only after old saves and historical gigs remain supported.

**Exit evidence:** complete release-blocker report, approved assets and catalogue, passing release CI, production monitoring and rollback drill.

## Milestone gates

| Milestone | Required phases | Gate |
|---|---|---|
| Trustworthy authoring | 0 | CI and genuine GLB evidence reproducible |
| First real playable V2 | 1, core 2, capsule 3, minimum 4, 5 | Both frames LOD0/LOD1 validated; creator/save/load and basic animations work |
| Gig-ready V2 | First playable + 6 | Instruments, singing, outfits, saved-gig replay, multiple performers and camera QA pass |
| Full V2 release | Remaining 2–4 + 7 | All body LODs and approved catalogue complete; release/rollback evidence signed off |

## Work tracking convention

Create one GitHub milestone/epic per phase. For each deliverable record: owner, both-frame coverage, linked PR, source asset version, automated test run, visual proof, blockers, reviewer and approval date. A code commit or structural pass alone is never equivalent to artist acceptance or a production-ready asset.
