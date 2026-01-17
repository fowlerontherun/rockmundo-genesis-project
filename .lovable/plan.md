## Objective
Fix gig viewer so Ready Player Me avatars reliably render on stage (instead of the “Session Guitarist” silhouette or profile photos), and ensure gig viewer consistently uses real band members.

## What’s happening now (root causes)
1. The “Session Guitarist” card is rendered by `RpmAvatarImage`’s `FallbackAvatar` when the `<img>` fails to load (`imageError=true`) or no URL exists.
2. We confirmed RPM URLs exist in `player_avatar_config` and `use_rpm_avatar=true` for multiple users. So the remaining likely failure is the **2D render URL derivation** for RPM.
3. `RpmAvatarImage.getAvatarImageUrl` currently converts `.../<id>.glb` to `.../<id>.png?scene=fullbody-portrait-v1&background=transparent`. That “scene=fullbody-portrait-v1” format is not the recommended/guaranteed query format and can 404 depending on RPM settings. Recommended format uses `camera=fullbody` (and optional `background=transparent`, `size=...`). When the derived URL 404s, the image errors and the session silhouette appears.
4. Separately, the gig viewer filters `band_members` with `eq('is_touring_member', false)`. If your real members have `is_touring_member` as NULL or true, they can be excluded, leading to missing roles and unexpected fallbacks. We should treat NULL as false.

## Implementation steps

### 1) Make RPM 2D render URL generation reliable
**File:** `src/components/gig-viewer/RpmAvatarImage.tsx`
- Update `getAvatarImageUrl(url)`:
  - If the URL matches `models.readyplayer.me/<id>.glb`, derive:
    - Primary: `https://models.readyplayer.me/<id>.png?camera=fullbody&background=transparent&size=512`
    - Optional fallback attempt if primary fails (see step 2): `https://models.readyplayer.me/<id>.png` (no query params)
  - If it’s already a `models.readyplayer.me/<id>.png...`, keep as-is.
  - Otherwise return the original URL.

Why: this directly targets the observed behavior (session silhouette due to image load failures).

### 2) Add a safe, automatic retry if the first RPM render URL fails
**File:** `src/components/gig-viewer/RpmAvatarImage.tsx`
- Keep `imageError`, but add a second derived URL option:
  - Attempt A: `camera=fullbody...`
  - If onError triggers AND the avatarUrl is RPM, automatically switch to Attempt B (`.png` without query) before giving up.

Why: some RPM configurations/CDNs can be picky; a single retry avoids falling straight to the silhouette.

### 3) Ensure real band members aren’t accidentally filtered out
**File:** `src/components/gig-viewer/ParallaxGigViewer.tsx`
- Adjust the band member query to include members where `is_touring_member` is either `false` OR `NULL`.
  - Example approach: remove the `eq('is_touring_member', false)` and instead filter client-side with `(is_touring_member !== true)`.

Why: fixes cases where your real members were created with a null touring flag, causing roles to be missing.

### 4) Add temporary debug logging (optional but recommended)
**Files:**
- `src/components/gig-viewer/ParallaxGigViewer.tsx`
- `src/components/gig-viewer/RpmAvatarImage.tsx`

Add `console.debug` logs (guarded so they’re not noisy) to print:
- For each band member: instrument_role, chosen avatarUrl, whether it is RPM, and the final derived imageUrl.
- On image error: log the attempted URL.

Why: if RPM still fails, we’ll know whether it’s data selection vs. image URL vs. network/CORS.

### 5) Versioning requirements
Per your rule (“after every change update the version number displayed in the banner and update the version history page”):
- Update banner version in `src/components/VersionHeader.tsx` to **1.0.440**.
- Add a changelog entry in `src/pages/VersionHistory.tsx` describing:
  - Fix: RPM avatar 2D render URL derivation + retry
  - Fix: band members query now treats NULL touring flag as non-touring

## Validation checklist
1. Open a gig with known RPM avatars.
2. Confirm guitarist/vocalist show RPM full-body render (not silhouette, not profile photo).
3. Confirm that if a member has `use_rpm_avatar=false`, it correctly falls back to `profiles.avatar_url`.
4. Confirm “session musician” silhouette only shows when there truly is no avatar (or both render attempts fail).

## Risks / considerations
- RPM 2D render availability depends on Ready Player Me service uptime and avatar privacy settings.
- If your RPM IDs contain non-hex characters (rare but possible), the regex may need to be widened; we’ll adjust if logs show mismatches.
