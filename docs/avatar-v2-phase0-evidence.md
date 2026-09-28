# Avatar V2 Phase 0 — binary validation and QA evidence contract

Status: **pipeline guardrails only**. This does not certify a body or garment, enable V2, replace saved V1 appearances, or make staged blockouts purchasable.

## Reproducible commands

```sh
npm ci
npm run verify:avatar-v2-blender-scripts
npm run test:avatar-v2:python
npm run test:avatar-v2
npm run validate:avatar-v2
```

The shared CI workflow runs the same checks. The real-source workflow separately fetches pinned CC0 Blender Human Base Meshes 1.4.1, builds the masculine and feminine authoring packs, checks the SHA-256 inventory, then reads **actual BIN skin/accessor bytes** from both Blender-exported experimental head-motion GLBs. It does not count their draft weights as production assets. The proofs stay on the source-only preview branch; production files belong only under `public/avatar-v2/` after review.

## Browser evidence for real source experiments

The real-source authoring workflow now renders each generated **masculine and feminine experimental head-rig GLB** in a genuine Chromium WebGL/Three.js viewer at 1440 × 900 desktop and 390 × 844 mobile widths. It uses the binary files generated **in the same workflow run** after Blender source-hash and GLB BIN validation. Playwright intercepts a CI-only fixture URL; these source GLBs are **not** copied into the production `public/avatar-v2/` registry.

The `npm run test:avatar-v2:browser-proof` command runs four checks once `work/avatar-v2-authoring-artifacts/` has been built. Each check requires visible WebGL canvas, real skinned geometry and source materials, reports UV-mapped and embedded-texture slots separately, and writes a screenshot and structured diagnostics to `work/avatar-v2-browser-proofs/`. The workflow uploads these alongside the source-only Blender artifacts for reviewer inspection.

Passing this gate proves automated desktop/mobile **browser rendering of the source experiment**, not authenticated private admin storage access, correct garment UV fitting, finished production textures, independent artist fit approval or mobile GPU frame-rate budgets. Those require separate manual/admin acceptance evidence before production certification.

## Versioned status contract

Both production manifests retain their explicit `assetVersion` and their existing schemas. The binary gate enforces matching asset versions, unique frame/LOD and garment keys, exact production paths and no unregistered GLBs under the public V2 directory.

- **Source-only**: original CC0 scene or staged garment blockout, kept under `art-source/avatar-v2/` or the independent reference gallery; never a live manifest's validated file.
- **Experimental**: a genuine source rig or lookdev proof with unfinished manual fit; marked `productionValidated=false`, never used for live avatars.
- **Candidate**: `asset_ready` only after the real file exists in its exact manifest path and automated geometry, material and BIN validations pass. `asset_ready` must not bypass V1 fallback.
- **Validated**: `validated` only after automated checks plus a separate, independently reviewed, checksum-bound evidence document bound to the specific GLB SHA-256. A status change alone cannot certify a model.
- **Blocked/planned**: permitted to remain absent; blocked assets must not be placed under the public production path.

The gate rejects out-of-range BIN bufferView/accessor layouts, missing bytes, non-finite positions or weights, non-normalised weights, vertex joints outside the bound skin, non-finite inverse bind matrices, unskinned mesh nodes, and multiple/absent GLB BIN chunks. These are necessary structural checks, not deformation, texture appearance or performance approval.

## Per-asset QA evidence (version 1)

A `validated` body record must contain `qaEvidence: "art-source/avatar-v2/evidence/<frame>-lodN.json"`. A validated garment includes `qaEvidence.<frame>.lodN` for **each of its eight distinct GLBs**. The evidence document uses this example shape (values shown are illustrative, not approval):

```json
{
  "schema": "rockmundo.avatar-v2-qa-evidence",
  "version": 1,
  "kind": "body",
  "frame": "masculine",
  "lod": 0,
  "assetVersion": "v2-alpha-1",
  "assetPath": "avatar-v2/masculine/base-lod0.glb",
  "sha256": "<actual lowercase SHA-256 of exported GLB>",
  "sourceFile": "art-source/avatar-v2/masculine/reviewed-base.blend",
  "sourceSha256": "<actual lowercase SHA-256 of the reviewed .blend>",
  "sourceOnly": false,
  "rigReviewed": true,
  "visualApproved": true,
  "performanceApproved": true,
  "author": "<source artist>",
  "reviewer": "<different independent reviewer>",
  "approvedAt": "2026-09-28T12:00:00Z",
  "proofFiles": {
    "front": { "path": "art-source/avatar-v2/evidence/masculine-lod0-front.png", "sha256": "<actual file SHA-256>" },
    "side": { "path": "art-source/avatar-v2/evidence/masculine-lod0-side.png", "sha256": "<actual file SHA-256>" },
    "back": { "path": "art-source/avatar-v2/evidence/masculine-lod0-back.png", "sha256": "<actual file SHA-256>" },
    "performance": { "path": "art-source/avatar-v2/evidence/masculine-lod0-performance.png", "sha256": "<actual file SHA-256>" }
  }
}
```


The independent reviewer must confirm full rig fit, morphs, material/texture fidelity, no floating accessories, extreme instrument poses, and the relevant mobile/desktop mesh budgets. Keep evidence outside `public/`; the gate compares the document's GLB SHA-256 and requires a different named reviewer, checks the UTC approval timestamp, matches the actual reviewed editable Blender source file, and verifies four distinct PNG proof captures against their recorded SHA-256 digests before accepting `validated`. Do not create placeholder approvals. This is a reviewed artifact record, not a cryptographic digital signature; independent visual QA remains a separate human gate.

## Verified pipeline evidence — 28 September 2026

Reviewed code commit: [`432cd7433f78bfb2d4da2ef825be1965b4116bd4`](https://github.com/fowlerontherun/rockmundo-genesis-project/commit/432cd7433f78bfb2d4da2ef825be1965b4116bd4) (merged in PR #2200; corrects the NaN camera bug in PR #2199). These two green runs use that same reviewed commit:

- [Phase 0 integrity gate — successful](https://github.com/fowlerontherun/rockmundo-genesis-project/actions/runs/36477287040): real-BIN and QA evidence regression tests, source and garment manifest enforcement, Avatar V2 runtime preview tests, TypeScript and release-focused lint.
- [Real-source Blender + Chromium workflow — successful](https://github.com/fowlerontherun/rockmundo-genesis-project/actions/runs/36477287061): pinned official source and Blender, both frame artifacts and actual BIN weights, followed by all four real WebGL browser tests and uploaded desktop/mobile PNGs and JSON diagnostics. See workflow artifact `avatar-v2-real-browser-source-only`.

Visual inspection of the four uploaded Chromium captures confirms both real body frames visibly appear on desktop and mobile. Each experimental GLB has 18 skinned meshes, 12 UV-mapped meshes, 18 material slots and 35,776 triangles. Both frames have **zero embedded image-texture slots** in this source experiment. The screenshots and structural results must not be mistaken for completed PBR textures, actual fitted production rigs or artist acceptance. Initial blank screenshots revealed a test camera radius bug (using `Vector3.length` instead of `length()`); the final version checks the real WebGL framebuffer and finite camera coordinates before passing.

Remaining Phase 0 sign-off limitations: the wider monorepo `CI` unit suite is red for unrelated Node/Vitest collection and multiple festival, social, finance and gig contracts; local Supabase tests also fail in other workflows. This dedicated green Phase 0 run is **not** a claim that general CI is green. Authenticated private-admin preview loading/actual embedded textures and direct mobile-device inspection still need separate manual evidence. Keep all source-only/experimental artifacts isolated and the V2 rollout disabled.

## Exit checks

- CI: record green isolated integrity and real-source workflow URLs from the **same reviewed commit**, and separately record the wider full CI result; do not infer monorepo green from isolated green.
- Binary: the Python regression suite must reject corrupted GLB chunk lengths, JSON-only skin declarations, invalid BIN offsets, illegal positive-weight joint indexes, invalid weight sums and NaN inverse matrices.
- Source-only separation: no preview/reference or blocked asset is found on the production path, and no manifest declares an unreviewed asset validated.
- Admin/browser: after frontend deployment, inspect original GLB and textured lookdev for both frames, plus the draft head-motion variant, on desktop and mobile. The automated browser proof above does not replace authenticated private-archive loading, review of actual embedded textures, or a device-performance check. Record this visual check separately; it is not automatically certified by CI.

Current registry rollout remains disabled until Phase 1 onward has produced reviewed assets for both frames.
