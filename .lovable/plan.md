# Rockmundo on Steam — Phased Release Plan

Rockmundo is a React/Vite web app backed by Lovable Cloud (Supabase). Steam ships native desktop binaries, so we wrap the existing web build in **Electron**, integrate **Steamworks** for identity/achievements/cloud, and submit through Steamworks Partner.

---

## Phase 0 — Business & Account Setup (1–2 weeks, mostly waiting)
- Register a Steamworks Partner account ($100 Steam Direct fee, tax/banking forms).
- Decide pricing, regions, age rating (IARC), and content descriptors (gambling minigames, alcohol, drugs in the addictions system — all must be declared).
- Reserve the app name; receive AppID + depot IDs.
- Confirm legal: privacy policy URL, EULA, third-party credits (MiniMax, Gemini, shadcn, etc.).

**Deliverable:** AppID provisioned, store page draft started.

---

## Phase 1 — Electron Desktop Wrapper (3–5 days)
- Add `electron/main.cjs`, set `vite.config.ts` `base: './'`, install `electron` + `@electron/packager`.
- Window chrome: custom title bar matching FM 2024 theme, fullscreen toggle, min size 1280×800.
- Bundle production Vite build; verify all routes, Supabase calls, AI generation, audio playback work under `file://`.
- Handle deep links (`rockmundo://`) for OAuth callbacks if needed.
- Auto-updater strategy: rely on Steam's depot updates (no Squirrel needed).

**Deliverable:** Local `MyApp-linux-x64` / `win32` / `darwin` builds launch and play.

**Exit criteria:** Full smoke test of core loops (gig → recording → release → chart) inside Electron.

---

## Phase 2 — Steamworks SDK Integration (1 week)
- Add `steamworks.js` (Greenworks alternative, maintained, prebuilt binaries).
- Initialize SDK in `main.cjs` with AppID; expose IPC bridge to renderer via `contextBridge`.
- Wire features:
  - **Steam identity** → map `steamId` to a Supabase profile (new edge function `steam-auth` issues a Supabase JWT from a verified Steam session ticket).
  - **Rich Presence** ("Playing a gig in Tokyo", "Recording in Studio").
  - **Cloud saves** disabled — server is source of truth; document this.
- Add `steam_appid.txt` to dev builds.

**Deliverable:** Launching from Steam signs the player in automatically; presence shows live.

---

## Phase 3 — Achievements & Stats Mapping (3–4 days)
- Mirror existing in-game achievements (mem://features/achievements) to Steam achievement IDs in Steamworks dashboard.
- On unlock in DB, emit IPC → `SetAchievement` + `StoreStats`.
- Backfill on launch: reconcile Supabase achievement rows vs Steam state.
- Add 20–30 launch achievements covering: first gig, first #1, label signed, world tour, etc.

**Deliverable:** Achievements unlock live in the Steam overlay.

---

## Phase 4 — Offline & Resilience Pass (3–5 days)
- Currently 100% online. For Steam reviews this is acceptable but must be graceful:
  - Detect offline at boot → branded screen ("Rockmundo requires an internet connection") instead of white screen.
  - Retry/backoff on Supabase failures; queue non-critical writes (journal entries, twaater posts) in IndexedDB.
  - Cache static hub images + audio assets locally (already partly done per static-asset memory).
- Crash reporter: Sentry or electron-log shipped to a Supabase table.

**Deliverable:** No silent failures; clear messaging on network loss.

---

## Phase 5 — Platform Builds & Depots (3 days)
- Cross-compile from CI:
  - Windows x64 (primary — 95% of Steam).
  - Linux x64 (Steam Deck compatibility — see Phase 7).
  - macOS x64 + arm64 (requires macOS runner + notarization; optional for v1).
- Configure Steamworks depots per platform; `steam_build.vdf` scripts.
- Install `steamcmd` in CI; upload via `steamcmd +run_app_build`.

**Deliverable:** Push-button build pipeline to Steam's `default` branch.

---

## Phase 6 — Store Page & Marketing Assets (parallel, 1–2 weeks)
- Capsule images (small/main/wide/library), header, page background.
- 5–10 screenshots, 1 trailer (30–60s), animated GIFs.
- Short + long description, feature list, system requirements.
- Tags, categories, languages supported (English at launch).
- Set up community hub, news posts, Discord link.

**Deliverable:** Coming Soon page live; wishlist accumulating.

---

## Phase 7 — Steam Deck Verification (1 week)
- Test under Proton on a Deck (or via `steamos-devkit` / Holo VM).
- Controller support: app is mouse/keyboard, so configure a default Steam Input layout (trackpad-as-mouse) and document.
- Text legibility at 1280×800; ensure FM bottom bar buttons hit 40px+ touch targets.
- Submit for **Deck Verified** rating.

**Deliverable:** "Playable" or "Verified" badge.

---

## Phase 8 — Closed Beta on Steam (2 weeks)
- Create `beta` branch with password; invite 20–50 testers via Steam keys.
- Telemetry: track crashes, session length, funnel from launch → first gig.
- Iterate on perf (Electron memory ceiling, Supabase query budgets).

**Exit criteria:** <2% crash rate, P95 boot <8s, no P0/P1 bugs open.

---

## Phase 9 — Submission & Launch (1 week + Valve review)
- Steam build review (1–5 business days).
- Set release date, finalize price, configure launch discount (10–15% suggested).
- Day-1 patch branch ready.
- Press kit + Discord/Twaater announcement.

**Deliverable:** Rockmundo live on Steam.

---

## Phase 10 — Post-Launch (ongoing)
- Weekly patch cadence via Steam depots (auto-update).
- Trading cards, seasonal sales, Workshop (future: custom venues/songs).
- Localization roadmap (EFIGS first).

---

## Technical Notes
- **Wrapper:** Electron + `@electron/packager` (NOT electron-builder — sandbox/CI 7zip issues per existing memory).
- **Main process file:** `.cjs` extension; `package.json` is `"type": "module"`.
- **Vite:** `base: './'` is mandatory or window renders blank.
- **Supabase auth bridge:** new edge function `steam-auth` validates a Steam session ticket against `https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/` and mints a Supabase JWT — Steam Web API key stored as a secret.
- **Code signing:** Windows EV cert ($200–400/yr) recommended to avoid SmartScreen warnings; Apple Developer ID ($99/yr) required for macOS notarization.
- **Repo layout:** `electron/`, `build/steam/` (vdf scripts, icons), `.github/workflows/steam-release.yml`.

## Open Questions
1. Launch platforms — Windows-only for v1, or also Linux + macOS?
2. Steam Deck Verified a launch goal, or post-launch?
3. Do you have a Steamworks Partner account already, or start from scratch?
4. Code-signing certs: existing, or budget for new ones?
