

# Rockmundo Game Audit — Gaps, Bugs & Expansion Roadmap

## Methodology
Reviewed all 150+ pages, 28 `@ts-nocheck` files, 100+ edge functions, TODOs/FIXMEs, hooks, and interconnected game loops.

---

## PHASE 1 — Critical Bugs & Broken Features (Stability)

These items are broken or partially implemented and likely cause runtime errors or dead-end UX.

1. **28 files with `@ts-nocheck`** — These bypass TypeScript entirely, meaning any schema drift silently breaks them at runtime. Key offenders:
   - `Housing.tsx`, `CompetitiveCharts.tsx`, `side-hustles/index.tsx`, `talent/discovery.tsx`, `studio/recording.tsx`, `events/narratives/[storyId].tsx`
   - API layers: `labels.ts`, `tours.ts`, `legacy.ts`, `career.ts`, `charts.ts`, `feed.ts`, `talent.ts`, `analytics.ts`, `contracts.ts`, `personalGear.ts`, `training.ts`
   - Hooks: `usePlayerEquipment.ts`, `useRecordingData.tsx`

2. **Underworld crypto payments** — `useUnderworldStore.ts` line 157: `throw new Error("Crypto payments coming soon")` — crypto purchases in the underworld store always fail.

3. **Release config never saves** — `admin/ReleaseConfig.tsx`: `TODO: Save to database when game_config table is created` — admin release config is a no-op.

4. **Merchandise player level hardcoded** — `Merchandise.tsx` line 357: `const playerLevel = 10; // TODO: Get from profile` — merch calculations always use level 10.

5. **Tour support artist availability not checked** — `SupportArtistPicker.tsx`: TODO notes schedule conflict checking is missing — you can book unavailable bands as support acts.

6. **SkillSystemProvider missing on pages** — We fixed 3 pages last session; audit remaining pages that use `useSkillSystem` to ensure none crash.

---

## PHASE 2 — Incomplete Game Systems (Depth)

Features that exist but are shallow or missing key loops.

7. **Teaching sessions don't process daily XP automatically** — The `processTeachingSessions` utility was planned but no edge function exists to run it on a cron. Sessions complete on page visit only, not server-side.

8. **Side Hustles minigames** — The page exists but uses `@ts-nocheck` and `isLoading` (should be `isPending`). Needs audit for whether minigames actually award XP through the progression system.

9. **Narrative Events** — `events/narratives/[storyId].tsx` requires `story_states` and `story_choices` tables that may not exist in the DB schema. Likely dead page.

10. **Talent Discovery** — `talent/discovery.tsx` missing casting call and profile fields. Page may render but casting system is incomplete.

11. **Recording Studio page** — `studio/recording.tsx` relies on edge functions not in types. Session completion flow may be broken.

12. **Labels API** — `lib/api/labels.ts` imports from `@/lib/supabase-client` (not the standard `@/integrations/supabase/client`). Potentially using a different or missing client.

13. **Jam Sessions** — Room creation and joining works, but there's no actual real-time jam mechanic (no WebRTC audio via PeerJS integration despite the dependency being installed). It's a lobby with no gameplay.

14. **Busking locations are hardcoded** — Not city-aware. Every player sees the same locations regardless of which city they're in.

15. **DikCok (TikTok clone)** — Video creation exists but virality/algorithm simulation appears thin. No trending page, no duets, no cross-platform discovery loop.

16. **Sponsorship offer generation** — Edge function exists (`generate-sponsorship-offers`) but unclear if it runs on cron or only manually. Offers may never appear for players.

17. **Festival performance flow** — `FestivalPerformance.tsx` exists but festivals are complex multi-band events. Unclear if the festival slot → performance → outcome pipeline is fully wired.

---

## PHASE 3 — Missing Interconnections (Game Loop Gaps)

Systems that exist in isolation but don't feed into each other.

18. **Teaching XP doesn't feed the progression edge function** — Teaching awards XP client-side via direct DB inserts, bypassing the `progression` edge function's validation, cooldowns, and wallet system.

19. **Clothing quality doesn't affect gig outcomes** — `clothingGigBonus.ts` was created but needs verification that `complete-gig` edge function actually reads and applies clothing bonuses.

20. **Housing has no gameplay impact** — Properties exist with upkeep costs but don't affect health, energy recovery rate, or provide buffs. It's purely a money sink.

21. **Wellness habits don't affect gameplay stats** — Health/energy tracking exists but completing habits doesn't modify `health` or `energy` on the profile. No mechanical consequence.

22. **Prison has no crime system feeding it** — Prison page exists with bail and events, but there's no clear "commit crime → get caught → go to prison" pipeline from the underworld.

23. **City elections/mayor powers are cosmetic** — Election system exists but mayor dashboard law changes don't appear to have mechanical effects on city residents.

24. **Tattoos have no stat effects** — Getting tattoos costs money and has infection risk, but tattoos don't provide any buffs, fame bonuses, or visual changes to gig performances.

25. **Song quality doesn't cascade fully** — Quality score (0-1000) is calculated during songwriting but it's unclear if recording, mixing, mastering, and release all properly compound quality through the pipeline.

---

## PHASE 4 — New Systems for Depth (Expansion)

26. **Aging & Life Events** — No time-based character aging. Players never face retirement pressure, health decline, or career phases (early career, peak, legacy).

27. **Fan engagement mini-game** — Fans exist as numbers but there's no direct fan interaction (meet & greets, fan mail, fan clubs, parasocial events).

28. **Rival bands / AI competition** — No NPC bands competing on charts, stealing gig slots, or creating rivalry narratives.

29. **Manager / Agent NPCs** — No manager system that unlocks better gigs, handles scheduling, takes a percentage cut.

30. **Genre reputation system** — Playing certain genres should build genre-specific reputation affecting which gigs/labels/festivals accept you.

31. **Addiction/vice system** — The underworld exists but there's no consequence loop for substance use affecting performance, health, or relationships.

32. **Band breakup / drama events** — Band chemistry exists but no dramatic events (member quits, creative differences, public feuds).

33. **Seasonal content rotation** — Seasonal events calendar exists but unclear if events actually rotate or if content is static.

34. **Player-to-player trading** — Song marketplace exists for songs, but no general item trading (gear, merch, collectibles between players).

35. **Achievement system depth** — Achievements table exists but the unlock conditions appear to only cover "First Steps". Needs 50-100+ achievements across all game systems.

---

## Phase Summary

| Phase | Items | Focus | Effort |
|-------|-------|-------|--------|
| **1** | 1-6 | Fix crashes, type safety, dead code | 2-3 sessions |
| **2** | 7-17 | Complete half-built features | 5-8 sessions |
| **3** | 18-25 | Wire systems together for cascading gameplay | 4-6 sessions |
| **4** | 26-35 | New systems for long-term depth | 8-12 sessions |

