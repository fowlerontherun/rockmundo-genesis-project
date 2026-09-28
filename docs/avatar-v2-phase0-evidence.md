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

## Versioned status contract

Both production manifests retain their explicit `assetVersion` and their existing schemas. The binary gate enforces matching asset versions, unique frame/LOD and garment keys, exact production paths and no unregistered GLBs under the public V2 directory.

- **Source-only**: original CC0 scene or staged garment blockout, kept under `art-source/avatar-v2/` or the independent reference gallery; never a live manifest's validated file.
- **Experimental**: a genuine source rig or lookdev proof with unfinished manual fit; marked `productionValidated=false`, never used for live avatars.
- **Candidate**: `asset_ready` only after the real file exists in its exact manifest path and automated geometry, material and BIN validations pass. `asset_ready` must not bypass V1 fallback.
- **Validated**: `validated` only after automated checks plus a separate, reviewer-signed evidence document bound to the specific GLB SHA-256. A status change alone cannot certify a model.
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
  "assetPath": "avatar-v2/masculine/base-lod0.glb",
  "sha256": "<64-character SHA-256 of the exact exported GLB>",
  "sourceSha256": "<64-character SHA-256 of the reviewed editable source>",
  "sourceOnly": false,
  "rigReviewed": true,
  "visualApproved": true,
  "performanceApproved": true,
  "reviewer": "<independent reviewer>",
  "approvedAt": "<ISO-8601 UTC timestamp>",
  "proofFiles": [
    "art-source/avatar-v2/evidence/masculine-lod0-front.png",
    "art-source/avatar-v2/evidence/masculine-lod0-side.png",
    "art-source/avatar-v2/evidence/masculine-lod0-back.png",
    "art-source/avatar-v2/evidence/masculine-lod0-performance.png"
  ]
}
```

The independent reviewer must confirm full rig fit, morphs, material/texture fidelity, no floating accessories, extreme instrument poses, and the relevant mobile/desktop mesh budgets. Keep evidence outside `public/`; the gate compares the document's GLB SHA-256 and verifies that the proof files exist before accepting `validated`. Do not create placeholder approvals.

## Exit checks

- CI: record the passing full CI URL and the dedicated real-source workflow URL from the **same reviewed commit**; check both frame artifacts are downloadable and checksum verified.
- Binary: the Python regression suite must reject corrupted GLB chunk lengths, JSON-only skin declarations, invalid BIN offsets, illegal positive-weight joint indexes, invalid weight sums and NaN inverse matrices.
- Source-only separation: no preview/reference or blocked asset is found on the production path, and no manifest declares an unreviewed asset validated.
- Admin/browser: after frontend deployment, inspect original GLB and textured lookdev for both frames, plus the draft head-motion variant, on desktop and mobile. A complete manifest and screenshots do **not** replace a browser render, texture or private-archive validation test. Record this visual check separately; it is not automatically certified by CI.

Current registry rollout remains disabled until Phase 1 onward has produced reviewed assets for both frames.
