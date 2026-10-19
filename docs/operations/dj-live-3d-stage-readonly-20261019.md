# Read-only live DJ nightclub 3D stage — 19 October 2026

## Scope

This is the **first** presentation bridge for #4247, not a complete 3D release or financial settlement change. It reuses the existing shared `ConcertScene` venue, avatar, clothing and turntables rather than creating a second gig renderer. A player with an already-live, authenticated, server-confirmed DJ booking may explicitly choose **View my live DJ in 3D** from nightclub details.

The scene is lazy-loaded so ordinary nightclub entry, DJ practice, audio playback, and the existing mixer do not pay the WebGL bundle/GPU cost. It is entirely optional. A WebGL loading failure has a visible fallback and Retry control, and the live mixer below remains the authoritative activity surface.

## Data contracts and security boundaries

- The selected active character is the **only performer**, with `instrument='turntablism'`; appearance, clothing, tattoos and equipped instrument skins use the existing gig player-model service.
- `dj_bookings` is read with `id` and `profile_id` selectors and existing owner-scoped RLS. Render **only** status `live`. Refetch on focus and every 15 seconds; an error or a terminal transition must dispose the scene.
- `dj_live_mix_events` is read with `booking_id` and `profile_id` under owner-only RLS. Reactions derive from **persisted server-accepted** action numbers, not browser-supplied scores. They are cosmetic only.
- `dj_booking_audiences` is read, never written. The canonical attendance receipt is created **only upon verified server settlement**. In its absence the scene uses a 12%-density **illustration clearly labelled non-authoritative**, never a player-facing attendance count. When the receipt exists, display and occupancy clamp to the smallest known valid venue capacity. **Do not convert illustrated people into cash, tickets or fans.**
- The viewer never invokes `dj-booking-action`, never changes bookings, never writes fan/financial tables, and does not calculate or award XP, cash, fame or scores.
- It deliberately does **not** introduce copyrighted soundtrack playback. Any song audio remains in the already-licensed live mixer, subject to its own rights checks.

## Accessibility and resilience

The player can choose wide or close camera, low graphics, and reduced motion. Reduced-motion preference is respected on first mount; no optional strobing/pyrotechnic effects are invoked. The visualizer and avatar data may fail independently of settlement; they must never make a successful, already-authoritative DJ payout fail.

Automatic rendering and playback stops on leaving the stage, a booking read failure, closing the mixing studio or a terminal booking status.

## Manual release-gate checks still needed

1. Once safely enabled in a **staged test cohort**, start a funded, verified nightclub DJ set. Inspect the player's correct avatar, equipped clothes and turntables (not invented band members) and verify no avatar data leaks to another account.
2. With both decks already playing, open and close 3D; audio must continue uninterrupted and no new `dj_live_mix_events` or rewards must appear solely from scene activity.
3. Send six server-verified mixer actions. Observe read-only scene changes without any false score, admission or payment indicator. Try a second user, changed active character, a cancelled set, and a missed slot.
4. Test WebGL denial/loss, minimized/backgrounded Android, low-performance handset, reduced motion, camera changes, and repeated open/close for GPU memory and audio cleanup.
5. Complete a server-authoritative settlement; confirm audience receipt and fans are emitted exactly once by the existing backend, and the live renderer disappears. A zero-attendance receipt must render an empty dancefloor.
6. Confirm normal gig/TV/festival viewer regressions do not change and any failed scene can fall back to the text/mixer UI.

**Rollout/rollback:** Leave `VITE_DJ_SCHEDULED_BOOKINGS_ENABLED`, server `DJ_SCHEDULED_BOOKINGS_ENABLED`, and `DJ_FUNDED_OWNER_BOOKINGS_ENABLED` in their existing OFF state. This PR changes no database schema, jobs, security grants, existing records or payout flags. Reverting this presentation-only PR removes the optional stage without requiring a DB rollback.

## Outstanding

No complete 3D/camera/3D audio mobile certification, separate spectator mode, immutable completed DJ replay, audience-density based on a pre-settlement authoritative server estimate, or Beatmatch & Drop minigame is claimed by this slice. Keep #4247 and #4265 open.
