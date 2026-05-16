# Project Review: Unfinished, Expandable & Bug‑Fix Candidates

A scan of `docs/`, `.lovable/plan.md`, source TODOs, "coming soon" strings, and stub components surfaced the following backlog. Grouped by category, with concrete file/line evidence so any item can be picked up directly.

## 1. Explicitly Unfinished ("coming soon" / stubs)

| # | Area | Where | Status |
|---|------|-------|--------|
| 1 | DikCok reactions | `src/components/dikcok/DikCokEngagement.tsx:48,70` | UI present, toast "Reactions coming soon" — no table writes |
| 2 | DikCok comments | `DikCokEngagement.tsx:82` | Same — comment button is a stub |
| 3 | Twaater replies tab | `src/components/twaater/TwaaterProfilePage.tsx:257` | Tab renders placeholder text |
| 4 | Twaater liked-twaats tab | `TwaaterProfilePage.tsx:265` | Same — no query |
| 5 | Crafting → Salvage | `src/components/crafting/SalvagePanel.tsx:45` | Button toasts "Salvage coming soon" |
| 6 | Merch factory contracts | `src/pages/MerchFactoryManagement.tsx:101` | Whole tab is placeholder copy |
| 7 | Merch custom art uploader | `src/pages/Merchandise.tsx:767` | "Mock uploader coming soon" |
| 8 | Song gifting | `src/pages/Songwriting.tsx:2226` | Button stubbed |
| 9 | Simple band manager — song catalog | `src/pages/SimpleBandManager.tsx:152` | Empty-state placeholder |
| 10 | Award Shows metrics | `src/pages/AwardShows.tsx:43` | "Placeholders will later sync to real ticketing/stream deltas/influencer reach" |
| 11 | Onboarding avatar uploader | `src/components/onboarding/AvatarPreview.tsx:71` | Image uploads disabled, URL-only fallback |
| 12 | Tour wizard member travel costs | `src/hooks/useTourWizard.ts:448` | Placeholder calc, not using real member count |
| 13 | Generic "table not implemented" stub | `src/components/StubComponent.tsx` | Any feature still routed here is dead UI |

## 2. Large Feature Plans Authored But Not Implemented

Each of these has a doc but no/partial code:

- **Festival expansion** — `docs/festival-expansion-tasks.md` lists **50** discrete tasks (contract negotiation UI, schedule conflict detection, setlist editor per slot, gear validation, perform-now minigame, admin lifecycle states, ticket tiers, fan voting, lineup posters, map view, sponsorship hooks, merge of duplicate admin screens). Almost none are shipped — biggest single backlog in the repo.
- **DikCok social platform** — `docs/plans/dikcok-social-media-plan.md` — engagement loop (reactions/comments/shares) ties into stubs #1–#2.
- **Marriage & children** — `docs/marriage-and-children-system-plan.md` — partially shipped per memory; verify gestation/inheritance edge cases.
- **Music video release workflow** — `docs/music-video-release-workflow.md` — confirm release-side wiring.
- **Record label system**, **TV/podcast/radio**, **Studio booking**, **Night clubs**, **Realtime gig system** — each doc has scope beyond current implementation; spot-check against current code before committing scope.

## 3. Bug-Fix / Hardening Candidates

Drawn from console-error patterns, memory rules, and code smells:

1. **Placeholder lyrics still possible** in `generate-song-audio` (`index.ts:749, 832`) and `admin-generate-song-audio` (`:666`) — repeated regression in VersionHistory (lines 9208, 9237, 9439). Worth replacing the fallback with a hard error + retry queue.
2. **Stub `(supabase as any)` casts** — audit for tables that now have generated types (per Core memory, only allowed when types are missing).
3. **Admin festival screens duplication** — task 50 of festival list; merging removes drift.
4. **Tour member travel cost placeholder** (#12 above) under-reports tour cost; financial bug.
5. **Bot twaat hardcoded "coming soon" strings** (`generate-bot-twaats:165,210,230`, `useBotTwaats.ts:13,36`) leak placeholder copy into live feed.
6. **`StubComponent`** — any route still rendering it is a broken feature surface; grep callers and either delete or implement.
7. **Onboarding avatar** — URL-only flow is fragile; many users will hit it. Needs the proper uploader (Lovable Cloud storage).
8. **Songwriting "gift" + Merch uploader** — both are user-visible dead buttons; either implement or hide.

## 4. Likely Expansions of Already-Shipped Systems

Low-risk, high-value additions on top of working features:

- **Fame & Fans Attribution panel** (just shipped) → add band-aggregate view and CSV per-week export; surface the "untracked" diagnostics it already computes.
- **Gig MemberRewardsCard** (just shipped) → extend to festivals and open-mic outcome reports.
- **Skill tree "Hide maxed" filter** (just shipped) → mirror the same toggle on Education/Mentors and Stage Practice skill lists.
- **Marketplace blind-box/gift filters** (just shipped) → add same `acquisition_source` chips to song detail pages and inbox notifications.
- **Acting daily tick cron** (just scheduled) → add an admin dashboard widget showing last run + last-payload summary, matching other cron monitors.

## 5. Recommended Next Slice (if you want one)

A focused, shippable batch:

1. Wire DikCok reactions + comments to real tables (kills 2 stubs, completes the engagement loop).
2. Implement Twaater replies + liked-twaats tabs (2 more stubs, all simple reads).
3. Delete or hide the remaining "coming soon" buttons (Salvage, Song gifting, Merch uploader, Merch factory contracts) until owners commit.
4. Pick top 10 of the Festival 50 (contract UI, conflict detection, setlist editor, perform-now outcome breakdown, admin lifecycle states) as a v1.2 festival pass.

## How to use this list

Tell me which group (1–5) or which numbered items you want to tackle and I'll create per-item implementation plans with file-level changes and a version bump.
