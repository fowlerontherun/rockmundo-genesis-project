import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Wrench, Plus, Sparkles, Bug } from "lucide-react";

interface VersionEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'fix' | 'improvement';
    description: string;
  }[];
}

const versionHistory: VersionEntry[] = [
  {
    version: "1.1.158",
    date: "2026-04-12",
    changes: [
      { type: 'fix', description: "Fixed persistent band creation error — replaced partial unique index on sponsorship_entities.band_id with full unique constraint so ON CONFLICT inference works correctly, and fixed trigger OLD reference on INSERT" },
    ],
  },
  {
    version: "1.1.157",
    date: "2026-04-11",
    changes: [
      { type: 'fix', description: "Fixed band creation ON CONFLICT error — restored missing unique constraint on sponsorship_entities.band_id required by the auto-create trigger" },
    ],
  },
  {
    version: "1.1.156",
    date: "2026-04-11",
    changes: [
      { type: 'fix', description: "Fixed band creation foreign key error — bands.leader_id now correctly references profiles table instead of auth.users, and all existing data migrated" },
    ],
  },
  {
    version: "1.1.155",
    date: "2026-04-11",
    changes: [
      { type: 'fix', description: "City chat channels now visible on mobile — channel selector uses a compact horizontal scrollable strip showing all channels including cities" },
      { type: 'improvement', description: "Search filter moved to desktop sidebar only to save vertical space on mobile" },
    ],
  },
  {
    version: "1.1.154",
    date: "2026-04-11",
    changes: [
      { type: 'fix', description: "Dashboard chat now fits properly on mobile screens — removed fixed max-height constraints and compacted header/padding" },
      { type: 'improvement', description: "Channel selector uses less vertical space on mobile with a capped height" },
    ],
  },
  {
    version: "1.1.153",
    date: "2026-04-11",
    changes: [
      { type: 'feature', description: "DikCok Weekly Challenges — auto-rotating challenges generated each week with themed requirements, rewards, and optional sponsors" },
      { type: 'feature', description: "Challenge Entry system — enter active challenges with your band, track entries, and compete on leaderboards" },
      { type: 'feature', description: "Fan Tips economy sink — tip DikCok videos with in-game cash ($5/$10/$25/$50), cash deducted from tipper and credited to band balance" },
      { type: 'improvement', description: "DikCok stats overview now shows Tips Received alongside Followers, Views, Hype, and Revenue" },
      { type: 'improvement', description: "Past Challenges section shows recently ended challenges with themes and sponsors" },
    ],
  },
  {
    version: "1.1.152",
    date: "2026-04-11",
    changes: [
      { type: 'feature', description: "Player-to-player mentorship system — offer, accept, and run mentoring sessions with friends for XP rewards" },
      { type: 'feature', description: "Nightclub social — 'Who's Here' section shows other players at the same club, plus club-specific chat channel" },
      { type: 'improvement', description: "Gear trading is now functional — select actual equipment from your inventory to send to friends instead of just logging a text event" },
      { type: 'feature', description: "Club presence tracking — entering a nightclub registers your presence for other players to see (auto-expires after 1 hour)" },
    ],
  },
  {
    version: "1.1.151",
    date: "2026-04-11",
    changes: [
      { type: 'fix', description: "Fixed DJ performance recording — RLS policy now correctly uses profile-based lookup instead of auth UID comparison, so DJ sets actually save and show in history" },
      { type: 'feature', description: "Added Nightclubs tile to World Hub — nightclubs are now accessible from the World navigation section" },
    ],
  },
  {
    version: "1.1.150",
    date: "2026-04-11",
    changes: [
      { type: 'fix', description: "Fixed band creation RLS policy — leader_id stores a profile ID, not auth.uid(), so the INSERT policy now correctly checks profile ownership" },
      { type: 'fix', description: "Fixed band update RLS policy to use profile-based membership lookup instead of direct auth.uid() comparison" },
    ],
  },
  {
    version: "1.1.149",
    date: "2026-04-11",
    changes: [
      { type: 'feature', description: "Added Nightclub Hub page (/nightclubs) — browse all 80+ clubs worldwide with filters by city, quality tier, and search" },
      { type: 'feature', description: "Added Club Reputation system — track visits, DJ sets, and spending to earn tiers (Newcomer → Regular → VIP → Legend) with perks" },
      { type: 'feature', description: "Added DJ Performance History on club detail pages — stats summary, recent sets with scores, earnings, and fame gained" },
      { type: 'feature', description: "Seeded 25 new NPC quests across iconic clubs worldwide (Berghain, Amnesia, Marquee NY, XS Vegas, Sub Club, Motion, and more)" },
      { type: 'improvement', description: "Club visits now automatically track reputation — stance selections, guest actions, DJ sets, and drink purchases all build your standing" },
    ],
  },
  {
    version: "1.1.148",
    date: "2026-04-11",
    changes: [
      { type: 'improvement', description: "Simplified university course filtering — removed skill category filter chips, kept only text search for course names" },
    ],
  },
  {
    version: "1.1.147",
    date: "2026-04-10",
    changes: [
      { type: 'feature', description: "Added universal schedule conflict detection with Smart Suggestions — all booking flows now check for overlapping activities and offer alternative time slots" },
      { type: 'fix', description: "Fixed WorkBooking writing to wrong table (scheduled_activities → player_scheduled_activities) and bypassing conflict checks" },
      { type: 'fix', description: "Fixed EducationBooking bypassing conflict detection and writing to wrong table" },
      { type: 'improvement', description: "PerformanceBooking (rehearsal, gig, busking, songwriting) now checks for conflicts before booking" },
      { type: 'improvement', description: "Rehab recovery now checks schedule conflicts before entering rehabilitation program" },
      { type: 'feature', description: "New ScheduleConflictAlert component shows conflicting activities and suggests up to 3 available time slots with 'Pick this slot' buttons" },
    ],
  },
  {
    version: "1.1.146",
    date: "2026-04-09",
    changes: [
      { type: 'fix', description: "Jam session booking errors (e.g. scheduling conflicts) are now displayed to the user as toast notifications instead of silently failing" },
    ],
  },
  {
    version: "1.1.145",
    date: "2026-04-09",
    changes: [
      { type: 'fix', description: "Fixed jam session join not updating participant count or participant list on the session" },
      { type: 'fix', description: "Join button now correctly shows 'You're in!' after successfully joining a session" },
      { type: 'fix', description: "Removed duplicate toast notifications when joining jam sessions" },
      { type: 'improvement', description: "Added error handling for participant insert failures during jam session join" },
    ],
  },
  {
    version: "1.1.144",
    date: "2026-04-07",
    changes: [
      { type: 'feature', description: "Hosts can now cancel active or waiting jam sessions via a Cancel button on the session card" },
    ],
  },
  {
    version: "1.1.143",
    date: "2026-04-07",
    changes: [
      { type: 'feature', description: "Added NPC Cameos to Jam Sessions — 12 unique mentor NPCs (common → legendary) can randomly appear during sessions, each with genre affinity and unique buffs (XP boost, mood boost, synergy boost, skill XP boost, or song drop luck)" },
      { type: 'feature', description: "Completed Gifted Song Drops from Jam Sessions — NPC mentors with gift_chance_boost increase song drop rates; results dialog now shows gifted song details including quality and recipient" },
      { type: 'improvement', description: "Enhanced Jam Session results dialog with animated NPC cameo card showing rarity, buff type, genre, and mentor description" },
    ],
  },
  {
    version: "1.1.142",
    date: "2026-04-06",
    changes: [
      { type: 'feature', description: "Added AP → SXP conversion: players can now exchange Attribute Points for Skill XP at a rate of 1 AP = 100 SXP" },
    ],
  },
  {
    version: "1.1.141",
    date: "2026-04-06",
    changes: [
      { type: 'fix', description: "Fixed festival schedule conflict detection — player_scheduled_activities SELECT policy now supports profile_id lookups used by the conflict hook" },
      { type: 'fix', description: "Fixed festival performance outcomes silently failing — added INSERT policy on band_fame_events for band members" },
      { type: 'fix', description: "Fixed post-performance fame/fan/balance updates — bands UPDATE policy expanded from leader-only to all band members" },
      { type: 'fix', description: "Fixed song stat bumps (popularity, play count) after festival performances — band members can now update band songs" },
      { type: 'fix', description: "Fixed streaming/chart boost application — band members can now view and update their band's song_releases" },
      { type: 'fix', description: "Fixed festival participant status not updating to 'performed' — band members can now update their own participation records" },
    ],
  },
  {
    version: "1.1.139",
    date: "2026-04-05",
    changes: [
      { type: 'fix', description: "Fixed promotional campaigns failing with RLS error when created via band context — INSERT policy now allows band members" },
      { type: 'fix', description: "Fixed promo tours failing to schedule — added 'release_promo', 'release_manufacturing', 'festival_attendance', 'festival_performance', and 'teaching' to the allowed activity_type check constraint" },
    ],
  },
  {
    version: "1.1.138",
    date: "2026-04-04",
    changes: [
      { type: 'fix', description: "Fixed music charts not updating since March 8th — float values (from per-track sales division) were being inserted into bigint columns causing 'invalid input syntax for type bigint' errors" },
      { type: 'fix', description: "All chart entry numeric fields (plays_count, weekly_plays, combined_score) are now rounded to integers before database insertion" },
    ],
  },
  {
    version: "1.1.137",
    date: "2026-04-02",
    changes: [
      { type: 'feature', description: "Nightlife Risk Layer — Stance-based decision system: choose Stay Sober, Party Hard, Network, or Leave Early when visiting nightclubs" },
      { type: 'feature', description: "Each stance carries unique risk/reward multipliers for fame, energy, cash, addiction risk, scandal chance, and inspiration" },
      { type: 'feature', description: "Resolution engine with 8 outcome types: Great Night, Scandal, Eureka Moment, Exhaustion, Networking Win, Relationship Drama, Minor Arrest, Quick Appearance" },
      { type: 'feature', description: "Stance confirmation dialog with risk preview (fame/energy/cost multipliers, scandal %, addiction risk)" },
      { type: 'feature', description: "Rich outcome dialog showing fame/energy/cash changes, inspiration & contact badges, scandal warnings, and addiction triggers" },
      { type: 'fix', description: "Fixed remaining TypeScript build errors in tours, training, minigames, personal-loadouts, musicVideoMetrics, contracts, CompetitiveCharts, recording, talent discovery, and narratives" },
    ],
  },
  {
    version: "1.1.136",
    date: "2026-04-02",
    changes: [
      { type: 'improvement', description: "Tech debt: Removed @ts-nocheck from all 27 source files — full TypeScript type checking now active across the entire codebase" },
      { type: 'improvement', description: "Affected files: API modules (tours, charts, feed, career, analytics, leaderboards, legacy, training, talent, personalGear), utility libs (musicVideoMetrics, personal-loadouts, minigames/progress, workflows/contracts), hooks (usePlayerEquipment, useRecordingData), components (BandRosterTab, TicketTierManager, MusicVideoReleaseTab, MusicVideoSummaryCard), and pages (CompetitiveCharts, Housing, label dashboard, talent discovery, studio recording, event narratives)" },
    ],
  },
  {
    version: "1.1.135",
    date: "2026-04-02",
    changes: [
      { type: 'fix', description: "Fixed song regeneration — retry now properly clears old audio URL so the generation engine accepts the request" },
      { type: 'fix', description: "Fixed regeneration button not appearing on failed songs that already had a previous audio file" },
      { type: 'improvement', description: "AI lyrics generator now enforces 550-character limit to fit MiniMax Music's input constraints, preventing truncation" },
      { type: 'improvement', description: "Added max_tokens to lyrics generation API call to prevent output truncation on long songs" },
      { type: 'improvement', description: "Lyrics generation system prompt now instructs concise output with no preamble for cleaner audio generation" },
    ],
  },
  {
    version: "1.1.134",
    date: "2026-04-01",
    changes: [
      { type: 'feature', description: "DikCok 2.0 — Added personalized 'For You' feed with genre affinity, fame proximity, and freshness-boosted algorithm" },
      { type: 'feature', description: "New Creator Dashboard with tier progression (Newcomer → Diamond), engagement rate, growth trends, top videos, and fan conversion metrics" },
      { type: 'improvement', description: "DikCok page now has 5 tabs: For You, Trending, My Videos, Challenges, and Analytics with improved empty states" },
    ],
  },
  {
    version: "1.1.133",
    date: "2026-04-01",
    changes: [
      { type: 'feature', description: "Jam Sessions 2.0 — Added venue traits system (8 unique traits like Acoustic Haven, Electric Arena, Underground Den) that provide bonuses during sessions" },
      { type: 'feature', description: "Added session challenges system with 9 challenges across 4 difficulty tiers (Easy → Legendary) offering 15-100% XP bonuses" },
      { type: 'feature', description: "Integrated live mood meter and synergy indicator into active jam session panels with animated bars and fire/synergy effects" },
      { type: 'feature', description: "Added Challenges tab to Jam Sessions page showing all available challenges with difficulty badges and XP bonus info" },
      { type: 'improvement', description: "Session cards now display venue traits when assigned, showing active bonuses" },
      { type: 'improvement', description: "Added participant session roles (lead/rhythm/support) and instrument tracking to jam session participants" },
    ],
  },
  {
    version: "1.1.132",
    date: "2026-03-31",
    changes: [
      { type: 'feature', description: "Added Festival History tab — view past performances, career stats, scores, earnings, fan growth, and best performance highlights" },
      { type: 'improvement', description: "Wired existing festival history components (FestivalHistoryCard, FestivalHistoryStats) into the Festivals page as a dedicated tab" },
      { type: 'improvement', description: "Confirmed Twaater Tier 1 features fully operational — mentions feed, hashtag rendering, trending sidebar, and explore tab all active" },
    ],
  },
  {
    version: "1.1.131",
    date: "2026-03-31",
    changes: [
      { type: 'feature', description: "Added auto-verification system for Twaater accounts — fame >= 10,000, award winners, and charting artists (top 100) automatically receive verified badges" },
      { type: 'improvement', description: "Enhanced trending algorithm with exponential time decay (half-life ~8h), verified account boost (1.5x), and minimum engagement threshold" },
      { type: 'fix', description: "Fixed is_verified → verified field name in trending and hashtag hooks to match actual database schema" },
    ],
  },
  {
    version: "1.1.130",
    date: "2026-03-30",
    changes: [
      { type: 'improvement', description: "Venue capacity upgrades now use multiplicative scaling (25% per level) with a max cap of 50,000 — higher levels yield much larger capacity gains" },
    ],
  },
  {
    version: "1.1.129",
    date: "2026-03-30",
    changes: [
      { type: 'fix', description: "Fixed venue capacity not updating after purchasing capacity upgrades — added error handling and proper query invalidation for company-venues" },
      { type: 'fix', description: "Backfilled Fratton Park capacity to correct value (1150) based on 7 installed capacity upgrades" },
    ],
  },
  {
    version: "1.1.128",
    date: "2026-03-30",
    changes: [
      { type: 'fix', description: "Venue capacity upgrades now actually increase the venue's capacity in the database (50 + level×25 per upgrade)" },
      { type: 'improvement', description: "Capacity upgrade success toast now confirms the expansion" },
      { type: 'fix', description: "Venue data queries are invalidated after upgrades so capacity changes reflect immediately" },
    ],
  },
  {
    version: "1.1.127",
    date: "2026-03-29",
    changes: [
      { type: 'improvement', description: "Redesigned record label management with overview stats dashboard showing balance, artists, releases, units, revenue, and staff" },
      { type: 'improvement', description: "Enhanced artist roster with expandable per-artist detail panels showing release catalog, contract terms, campaign spend, and profitability status" },
      { type: 'improvement', description: "Upgraded releases tab with pipeline/released filter, campaign tracking, and compact release cards with per-release stats" },
      { type: 'improvement', description: "Added reputation tier badges (Indie → Legendary) and headquarters location to label header" },
      { type: 'improvement', description: "Scrollable tab navigation for mobile-friendly label management" },
    ],
  },
  {
    version: "1.1.126",
    date: "2026-03-29",
    changes: [
      { type: 'improvement', description: "Enhanced Income Breakdown chart with interactive hover, percentage labels, and detailed source breakdown list" },
      { type: 'improvement', description: "Enhanced Income vs Expenses chart with net profit dashed line, color-coded totals, and cleaner grid" },
      { type: 'feature', description: "Added Spending Categories horizontal bar chart showing top expense categories" },
      { type: 'improvement', description: "Finances overview now shows full income/expense trend chart above the breakdown panels" },
      { type: 'fix', description: "Verified starter AP/SXP grants are working correctly for new characters" },
    ],
  },
  {
    version: "1.1.125",
    date: "2026-03-28",
    changes: [
      { type: 'feature', description: "Added Death System admin page — configure health decay rate, days until permadeath, resurrection lives, recovery health/energy, and family inheritance percentages" },
      { type: 'fix', description: "Fixed new characters not receiving starter 500 SXP and 10 AP — the database RPC was missing the XP wallet seeding step" },
    ],
  },
  {
    version: "1.1.124",
    date: "2026-03-28",
    changes: [
      { type: 'fix', description: "Fixed login redirect for dead players — successful sign-in now routes to the homepage so the death/resurrection flow can load instead of bypassing it" },
    ],
  },
  {
    version: "1.1.123",
    date: "2026-03-27",
    changes: [
      { type: 'fix', description: "Fixed race condition where dead players saw 'Create New Character' fallback instead of the death/resurrection screen because dead characters query hadn't finished loading yet" },
    ],
  },
  {
    version: "1.1.122",
    date: "2026-03-27",
    changes: [
      { type: 'fix', description: "Fixed dead players getting stuck on loading screen — 117 out of 121 players were dead from inactivity with no way to recover" },
      { type: 'feature', description: "Added resurrection system — every player gets 3 lives to resurrect their character and continue where they left off" },
      { type: 'feature', description: "Players can now choose to resurrect, start as a child (inherit 10% skills, 50% cash), or start completely fresh when their character dies" },
      { type: 'fix', description: "Fixed character death detection to query profiles directly instead of relying on hall_of_immortals entries (which were missing for many deaths)" },
      { type: 'fix', description: "Fixed navigation logic so dead players see the death/resurrection screen instead of an infinite spinner" },
    ],
  },
  {
    version: "1.1.121",
    date: "2026-03-26",
    changes: [
      { type: 'fix', description: "Fixed Release Manager analytics showing wrong sales figures — was limited to 100 rows but releases can have thousands of sale records. Now uses releases table totals as source of truth" },
      { type: 'fix', description: "Fixed financial breakdown in analytics dialog using row-limited aggregation instead of authoritative release table data" },
      { type: 'feature', description: "Songs already on releases are now auto-hidden when creating new releases (singles/EPs hide all released songs, albums hide songs already on albums)" },
      { type: 'improvement', description: "Added toggle to show/hide already-released songs in song selection step" },
      { type: 'improvement', description: "Albums can now include songs previously released as singles or on EPs (only songs already on another album are blocked)" },
    ],
  },
  {
    version: "1.1.120",
    date: "2026-03-26",
    changes: [
      { type: 'fix', description: "Fixed recording sessions never completing for bands — location check was using band_members.current_city_id (always NULL) instead of profiles.current_city_id" },
      { type: 'fix', description: "Fixed 3 songs showing as 'failed' despite having successfully generated audio (status corrected to 'completed')" },
      { type: 'fix', description: "Reset 5 stuck/failed AI song generations to allow retry (including 'Nunca mais' stuck since Feb 14)" },
      { type: 'fix', description: "Requeued 7 stuck recording sessions for reprocessing with the corrected location logic" },
    ],
  },
  {
    version: "1.1.119",
    date: "2026-03-25",
    changes: [
      { type: 'improvement', description: "Slowed down gig commentary pace from 3-6s to 10-18s between ambient lines for a more realistic feel" },
      { type: 'feature', description: "Added 'Skip to Outcome' button in live gig commentary viewer" },
      { type: 'fix', description: "Fixed gig commentary starting from last song — existing songs now process sequentially from first to last on load" },
      { type: 'feature', description: "Gig commentary viewer now shows average quality score, current song name, and set progress bar" },
      { type: 'feature', description: "Song commentary now includes quality score inline (e.g. '16.5/25 ⭐')" },
      { type: 'feature', description: "Gig outcome report now shows individual band member performance ratings with skill level and contribution breakdown" },
    ],
  },
  {
    version: "1.1.118",
    date: "2026-03-24",
    changes: [
      { type: 'fix', description: "Fixed rehearsal/gig booking failing with 'Cannot perform this action while traveling' — trigger now only blocks if travel overlaps with the scheduled activity time, not at insert time" },
    ],
  },
  {
    version: "1.1.117",
    date: "2026-03-24",
    changes: [
      { type: 'fix', description: "Label Finance tab now shows ALL revenue from signed artists (streaming + sales) — was previously only showing deposits/withdrawals" },
      { type: 'feature', description: "Added per-artist revenue breakdown table showing Total Revenue, Marketing Spend, Advance, Recouped, and Net P&L per signed artist" },
      { type: 'feature', description: "Added summary cards: Total Revenue from Artists, Marketing Spend, and Net P&L on Finance overview" },
      { type: 'improvement', description: "Unified transaction feed merges deposit/withdrawal history with revenue/expense transactions in chronological order" },
    ],
  },
  {
    version: "1.1.116",
    date: "2026-03-23",
    changes: [
      { type: 'fix', description: "Fixed admin Release Pump tool not working for physical sales (CD, Vinyl, Cassette) — function was not deployed" },
      { type: 'fix', description: "Admin Release Pump now correctly deducts physical inventory when pumping non-digital sales" },
      { type: 'improvement', description: "Release Pump UI now shows available stock quantity for physical formats" },
    ],
  },
  {
    version: "1.1.115",
    date: "2026-03-23",
    changes: [
      { type: 'fix', description: "Fixed university XP not working for multi-character slots — enrollment was saving profile_id as user_id, causing activity_feed FK violation" },
      { type: 'fix', description: "Fixed attendance trigger to look up auth user_id from profiles table instead of using broken enrollment user_id" },
      { type: 'fix', description: "Repaired all existing enrollments with incorrect user_id values" },
    ],
  },
  {
    version: "1.1.114",
    date: "2026-03-22",
    changes: [
      { type: 'improvement', description: "All business upgrade types now support up to 20 levels (previously 3-5) — Rehearsal Studios, Recording Studios, Venues, Merch Factories, Security Firms, and Logistics Companies" },
      { type: 'improvement', description: "Upgrade costs now scale dynamically using a 1.5x multiplier per level instead of hardcoded arrays" },
      { type: 'improvement', description: "Venue and Logistics upgrades now support multi-level progression instead of binary on/off" },
    ],
  },
  {
    version: "1.1.113",
    date: "2026-03-22",
    changes: [
      { type: 'fix', description: "Fixed label staff hiring — now properly deducts hiring cost from label balance with affordability checks" },
      { type: 'feature', description: "Added weekly marketing budget system for labels — set a budget that auto-promotes signed artists' releases daily, building hype" },
      { type: 'feature', description: "New Marketing tab in label management for configuring weekly marketing spend" },
      { type: 'improvement', description: "Staff hiring now shows cost preview, balance display, and insufficient funds warnings" },
      { type: 'improvement', description: "Daily sales cron now processes label marketing budgets — deducts spend and boosts hype for recent/upcoming releases" },
    ],
  },
  {
    version: "1.1.112",
    date: "2026-03-21",
    changes: [
      { type: 'fix', description: "Fixed university enrollment auto-attendance using user_id instead of profile_id — broke multi-character support" },
      { type: 'fix', description: "Fixed YouTube video watch cooldown being account-wide instead of per-character — now tracks separately per profile" },
      { type: 'fix', description: "Added missing query invalidation for enrollment queries after attendance" },
    ],
  },
  {
    version: "1.1.111",
    date: "2026-03-21",
    changes: [
      { type: 'improvement', description: "Removed 26 unused/orphaned edge functions to reduce deployment size and improve maintainability" },
      { type: 'fix', description: "Cleaned up duplicate cron job entries for generate-daily-sales and trigger-random-events" },
      { type: 'improvement', description: "Slimmed down config.toml by removing entries for deleted functions" },
    ],
  },
  {
    version: "1.1.110",
    date: "2026-03-20",
    changes: [
      { type: 'fix', description: "Fixed simulate-merch-sales cron job failing — referenced non-existent 'production_cost' column instead of 'cost_to_produce'" },
      { type: 'fix', description: "Fixed update-music-charts cron job failing — completeJobRun/failJobRun called with wrong parameter names" },
      { type: 'fix', description: "Fixed update-daily-streams cron getting stuck in 'running' forever — added wall-clock timeout safety to finish gracefully before edge function limit" },
      { type: 'fix', description: "Fixed check-character-health-decay build error — replaced incompatible npm: import with esm.sh" },
      { type: 'fix', description: "Cleaned up all stuck 'running' cron job records and added auto-cleanup function for future timeouts" },
    ],
  },
  {
    version: "1.1.109",
    date: "2026-03-19",
    changes: [
      { type: 'fix', description: "Fixed release retail prices being stored in dollars instead of cents — caused extremely low sales revenue for releases created after Feb 2026" },
      { type: 'fix', description: "Repaired all affected release format prices in database (Red Dwarf, Como faz?, Cansei, etc.)" },
    ],
  },
  {
    version: "1.1.108",
    date: "2026-03-19",
    changes: [
      { type: 'fix', description: "Fixed label release error saying label doesn't have money — manufacturing costs were compared in cents vs label balance in dollars" },
      { type: 'fix', description: "Fixed parent company navigation link using wrong route (/companies/ instead of /company/)" },
    ],
  },
  {
    version: "1.1.107",
    date: "2026-03-18",
    changes: [
      { type: 'fix', description: "Fixed behavior settings not loading — added missing profile_id column to player_behavior_settings table" },
    ],
  },
  {
    version: "1.1.106",
    date: "2026-03-18",
    changes: [
      { type: 'fix', description: "Resolved git merge conflicts in admin-boost-plays edge function" },
      { type: 'fix', description: "Fixed missing currentGameYear in Awards page by calling useGameCalendar hook" },
      { type: 'fix', description: "Fixed invalid CeremonyPhase type and missing Masks icon in AwardCeremonyExperience" },
      { type: 'fix', description: "Fixed setupTests.ts type import error for local stub package" },
    ],
  },
  {
    version: "1.1.105",
    date: "2026-03-17",
    changes: [
      { type: 'feature', description: "Replaced 2D top-down pixel art gig viewer with immersive commentary-only mode — plays full song audio with volume controls and generates hundreds of live commentary lines covering crowd atmosphere, musician moments, production effects, and narrative beats" },
      { type: 'improvement', description: "Removed all legacy pixel art viewer components (stage, crowd, HUD, venue features, weather, etc.) for cleaner codebase" },
      { type: 'improvement', description: "Updated gig history review dialog to use commentary mode instead of pixel art viewer" },
    ],
  },
  {
    version: "1.1.104",
    date: "2026-03-17",
    changes: [
      { type: 'feature', description: "Added hub tile image for Cars & Motorbikes category page" },
      { type: 'fix', description: "Fixed build errors in Relationships page (missing imports for toast, supabase, Select components)" },
      { type: 'fix', description: "Fixed TourManager and gigExecution type errors" },
    ],
  },
  {
    version: "1.1.103",
    date: "2026-03-16",
    changes: [
      { type: 'feature', description: "Replaced vehicle catalog with 14 real cars and motorbikes — Honda PCX, Kawasaki Ninja, Harley Street Bob, Ducati Panigale, VW Golf GTI, Toyota GR86, BMW 3 Series, Mercedes-AMG C63, Range Rover Sport, Porsche 911, Lamborghini Huracán, Rolls-Royce Ghost, Bugatti Chiron, and Triumph Bonneville" },
      { type: 'feature', description: "Added realistic pricing ($3,500 – $3,200,000) with daily insurance costs alongside upkeep" },
      { type: 'feature', description: "Added AI-generated images for every vehicle and category banners for Cars and Motorbikes" },
    ],
  },
  {
    version: "1.1.102",
    date: "2026-03-16",
    changes: [
      { type: 'feature', description: "Added search and skill filter to the university detail page — filter courses by name or skill when viewing a specific university" },
    ],
  },
  {
    version: "1.1.101",
    date: "2026-03-16",
    changes: [
      { type: 'feature', description: "Added search and skill category filters to the Books tab — filter by title, author, or skill" },
      { type: 'feature', description: "All Legendary Masters (instrument mentors) are now unlocked for all players — discovery gating removed" },
    ],
  },
  {
    version: "1.1.100",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Book reading (purchases, active sessions) now isolated per character — no longer shared across characters on the same account" },
      { type: 'fix', description: "New characters now receive a starter XP wallet with 500 SXP and 10 AP on creation" },
    ],
  },
  {
    version: "1.1.099",
    date: "2026-03-16",
    changes: [
      { type: 'feature', description: "Pending band applications now link to the applicant's player profile — click their name to view skills, attributes, and stats before accepting or rejecting" },
    ],
  },
  {
    version: "1.1.098",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Band Profile page was showing 'Band not found' due to ambiguous foreign key from band_members to bands — now uses explicit FK hint" },
      { type: 'fix', description: "Band Profile now correctly displays touring members with their role instead of 'Unknown'" },
    ],
  },
  {
    version: "1.1.097",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Band leader detection now correctly compares auth user_id to leader_id instead of profile_id — fixes recruiting toggle, applications, and leader-only actions not showing for band leaders" },
      { type: 'fix', description: "Band Profile page null-safety for date formatting to prevent crashes when navigating from Band Finder" },
    ],
  },
  {
    version: "1.1.096",
    date: "2026-03-16",
    changes: [
      { type: 'feature', description: "Band recruiting system — bands can now toggle 'Open for Recruiting' in settings, players can apply to join via Band Finder or Band Profile, and leaders can accept/reject applications from the Members tab" },
      { type: 'fix', description: "Band Finder now links to the public Band Profile page instead of the management page" },
      { type: 'feature', description: "Recruiting badge shown on bands that are open for applications in both Band Finder and Band Profile" },
    ],
  },
  {
    version: "1.1.095",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Band member display now uses profile_id instead of user_id to fetch character names — fixes multi-character bug where the wrong character was shown as a band member" },
    ],
  },
  {
    version: "1.1.094",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Band Health section redesigned — Band Health overview is now full-width, Fan Sentiment and Media Cycle are side-by-side in a 2-column layout, and Health Event Log moved below Sentiment charts for better readability" },
    ],
  },
  {
    version: "1.1.093",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Fixed book purchasing RLS error — BooksTab was passing profileId as user_id instead of auth userId, causing row-level security violation" },
    ],
  },
  {
    version: "1.1.092",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Final audit of profile_id vs user_id usage across all files — confirmed all remaining 65 instances are correct (variable named userId but holds profileId)" },
      { type: 'fix', description: "Identified unused dead hooks: useGameNotifications and useGigNotifications (not imported anywhere)" },
    ],
  },
  {
    version: "1.1.091",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "Fixed remaining 13 files with user_id/profileId mismatch: BandSearch, RandomEventsNews, StagePracticeResults, SongVoting, DonationSuccess, SeasonalEventsCalendar, PerformanceBooking, RehearsalsTab, useFestivalAttendance, useContractOfferGeneration, useLottery claim, skillGearPerformance, shift-clock-out edge function" },
      { type: 'fix', description: "Tables with profile_id column now correctly use profile_id: player_events, stage_practice_sessions, songs, band_members, lottery_tickets, releases" },
      { type: 'fix', description: "Tables with only user_id now correctly use auth userId: band_ratings, song_votes, festival_attendance, activity_feed" },
      { type: 'fix', description: "Fixed shift-clock-out edge function querying band_members by user_id instead of profile_id" },
    ],
  },
  {
    version: "1.1.090",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "CRITICAL: Fixed progression edge function loadActiveProfile — was loading oldest character instead of active one (broke XP/AP claiming after switching)" },
      { type: 'fix', description: "Fixed 14+ hooks passing profileId to user_id columns: achievements, holidays, equipment, crypto, festivals, lottery, playlists, fan management, clothing brands, wellness" },
      { type: 'fix', description: "Tables with profile_id column now correctly use .eq('profile_id', profileId) for character isolation (achievements, habits, scheduled activities, lottery, experience ledger)" },
      { type: 'fix', description: "Tables with only user_id column now correctly use auth userId (equipment, holidays, festivals, crypto, fan mgmt, playlists, wellness)" },
      { type: 'fix', description: "Fixed NightClubDetail querying profiles by user_id instead of id" },
      { type: 'fix', description: "Fixed inbox realtime subscription filtering by profileId instead of userId" },
    ],
  },
  {
    version: "1.1.089",
    date: "2026-03-16",
    changes: [
      { type: 'fix', description: "CRITICAL: Fixed useActiveProfile to expose userId (auth) alongside profileId" },
      { type: 'fix', description: "Fixed VIP status query — was using profileId instead of auth user_id" },
      { type: 'fix', description: "Fixed inbox, radio, tutorial, conditions, prison, survey, producer hooks to use auth userId for user_id columns" },
    ],
  },
  {
    version: "1.1.088",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Batch 28 (final): Migrated MyGear, useWatchVideo to profileId" },
      { type: 'improvement', description: "Remaining 11 hooks/pages confirmed as legitimately needing auth user.id" },
    ],
  },
  {
    version: "1.1.087",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Batch 27: Migrated 11 files from useAuth to profileId" },
      { type: 'improvement', description: "UniversityDetail, RecordLabel, MajorEvents, TourManager migrated" },
      { type: 'improvement', description: "ReleaseManager, CityElection, OpenMicNights, Journal migrated" },
      { type: 'improvement', description: "BooksTab, useEducationSummary migrated" },
    ],
  },
  {
    version: "1.1.086",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Batch 26: Migrated 13 files from useAuth to profileId" },
      { type: 'improvement', description: "BandRiders, SongwritingBooking, UnderworldNew, Housing migrated" },
      { type: 'improvement', description: "WorkBooking, ReleaseDetail, Schedule, training, NightClubDetail migrated" },
      { type: 'improvement', description: "SimpleBandManager, VipSuccess, BandManager migrated" },
    ],
  },
  {
    version: "1.1.085",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Batch 25: Migrated 12 files from useAuth to profileId" },
      { type: 'improvement', description: "EducationBooking, Awards, FestivalBrowser, JamSessions migrated" },
      { type: 'improvement', description: "Relationships, UniversityTab, CompanyDetail, Eurovision migrated" },
      { type: 'improvement', description: "TattooParlour, SelfPromotionBrowser, RadioBrowser migrated" },
    ],
  },
  {
    version: "1.1.084",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Batch 24: Migrated 13 pages from useAuth to profileId" },
      { type: 'improvement', description: "FestivalDetail, PerformGig, AISongGeneration, statistics/index migrated" },
      { type: 'improvement', description: "SeasonalEventsCalendar, PerformanceBooking, Modeling, BandSearch migrated" },
      { type: 'improvement', description: "DonationSuccess, Gettit, PublicRelations, PlayerStatistics migrated" },
    ],
  },
  {
    version: "1.1.083",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Batch 23: Migrated 12 pages from useAuth to profileId" },
      { type: 'improvement', description: "FestivalPerformance, GigBooking, SkillsPage, MayorDashboard migrated" },
      { type: 'improvement', description: "InventoryManager, OffersDashboard, LabelManagement, AdvisorPage migrated" },
      { type: 'improvement', description: "SetlistManager, BandRepertoire, Songwriting, Rehearsals migrated" },
    ],
  },
  {
    version: "1.1.082",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "All remaining components migrated from useAuth to profileId" },
      { type: 'improvement', description: "ChatWindow, RealtimeChatPanel, JamSessionsEnhanced, RadioSubmissionWizard migrated" },
      { type: 'improvement', description: "SongGenerationStatus, CompleteRecordingDialog, CompanyFinanceDialog migrated" },
      { type: 'improvement', description: "BandSettingsTab, RehearsalsTab, MediaSubmissionDialog, FestivalBrowser migrated" },
    ],
  },
  {
    version: "1.1.081",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "InvestmentsTab, FestivalMerchStand, BandEarnings migrated to profileId" },
      { type: 'improvement', description: "FinancialStats, SocialStats, CareerStats, PlayerGainsNews migrated to profileId" },
      { type: 'improvement', description: "LabelDirectory, TransferLabelDialog, LabelUpgradesTab migrated to profileId (removed redundant profile queries)" },
      { type: 'improvement', description: "LiveFestivalView removed unused useAuth" },
    ],
  },
  {
    version: "1.1.080",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "LabelFinanceDialog migrated to profileId" },
      { type: 'improvement', description: "AiAvatarCreator migrated to profileId" },
      { type: 'improvement', description: "FestivalExclusiveShop migrated to profileId" },
      { type: 'improvement', description: "BandGainsNews migrated to profileId" },
      { type: 'improvement', description: "LabelFinanceTab migrated to profileId" },
      { type: 'improvement', description: "CreateLabelDialog migrated to profileId" },
      { type: 'improvement', description: "MusicStats migrated to profileId" },
      { type: 'improvement', description: "LoansTab migrated to profileId" },
      { type: 'improvement', description: "DashboardOverviewTabs migrated to profileId" },
    ],
  },
  {
    version: "1.1.079",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useHolidays migrated to profileId" },
      { type: 'improvement', description: "useClothingMarketplace migrated to profileId" },
      { type: 'improvement', description: "useRomanceSystem migrated to profileId via useActiveProfile" },
      { type: 'improvement', description: "useJamSessionBooking migrated to profileId" },
      { type: 'improvement', description: "useJamVoiceChat migrated to profileId, removed redundant profile query" },
      { type: 'improvement', description: "useCompanies migrated to profileId" },
      { type: 'improvement', description: "useMajorEvents migrated to profileId" },
    ],
  },
  {
    version: "1.1.078",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useEmotionalEngine migrated to profileId via useActiveProfile" },
      { type: 'improvement', description: "useFestivalScheduleConflict removed useAuth dependency" },
      { type: 'improvement', description: "useCharacterRelationships migrated to profileId" },
      { type: 'improvement', description: "useClothingBrand migrated to profileId" },
      { type: 'improvement', description: "useProducerCareer migrated to profileId" },
      { type: 'improvement', description: "useUnderworldStore migrated to profileId" },
      { type: 'improvement', description: "useSkinStore migrated to profileId, removed redundant profile lookups" },
      { type: 'improvement', description: "useInterviewSession migrated to profileId" },
      { type: 'improvement', description: "useNPCRelationship removed useAuth dependency" },
    ],
  },
  {
    version: "1.1.077",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useTourWizard removed useAuth dependency" },
      { type: 'improvement', description: "useTrackSongPlay migrated to profileId" },
      { type: 'improvement', description: "useUnderworld removed unused useAuth" },
      { type: 'improvement', description: "useUnderworldInventory migrated to profileId" },
      { type: 'improvement', description: "usePlayerEquipmentMutations migrated to profileId" },
      { type: 'improvement', description: "useMentorSessions migrated to profileId" },
      { type: 'improvement', description: "useNPCRelationships migrated to profileId via useActiveProfile" },
    ],
  },
  {
    version: "1.1.076",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useDjPerformance migrated to profileId" },
      { type: 'improvement', description: "useCasino migrated to profileId" },
      { type: 'improvement', description: "useNightlifeEvents migrated to profileId" },
      { type: 'improvement', description: "useNightclubQuests migrated to profileId" },
      { type: 'improvement', description: "useCompanyFinance.useUserCashBalance migrated to profileId" },
      { type: 'improvement', description: "usePrimaryBand queries profileId directly" },
      { type: 'improvement', description: "useUserBand queries profileId directly" },
      { type: 'improvement', description: "useOpenMicNights sign-up uses profileId" },
    ],
  },
  {
    version: "1.1.075",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useHousing (7 hooks) fully migrated to profileId" },
      { type: 'improvement', description: "usePrisonStatus queries and bail use profileId" },
      { type: 'improvement', description: "useFestivalAttendance join/move/leave use profileId" },
      { type: 'improvement', description: "useCurrentEnrollment queries profileId directly" },
      { type: 'improvement', description: "usePlayerEvents removed useAuth dependency" },
      { type: 'fix', description: "EventNotificationModal aligned with actual hook types" },
    ],
  },
  {
    version: "1.1.074",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useVipStatus VIP subscription lookup uses profileId" },
      { type: 'improvement', description: "useCityElections voting/registration uses profileId" },
      { type: 'improvement', description: "useRetirementCheck removed useAuth dependency" },
      { type: 'improvement', description: "useTravelStatus travel queries and cancellation use profileId" },
      { type: 'improvement', description: "useFestivalTickets ticket purchase and queries use profileId" },
      { type: 'improvement', description: "useHospitalization check-in/discharge use profileId" },
    ],
  },
  {
    version: "1.1.073",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "useFinances hook fully uses profileId, removed useAuth" },
      { type: 'improvement', description: "useConditions queries and mutations use profileId" },
      { type: 'improvement', description: "useCharacterIdentity removed useAuth dependency" },
      { type: 'improvement', description: "useAddictions recovery/therapy mutations use profileId" },
      { type: 'improvement', description: "usePlayerEquipment gear queries use profileId" },
      { type: 'improvement', description: "usePlayerSurvey completion/responses use profileId" },
    ],
  },
  {
    version: "1.1.072",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "BandInvitations uses profileId, removes redundant profile fetch on accept" },
      { type: 'improvement', description: "BandChat messages sent with profileId for character isolation" },
      { type: 'improvement', description: "JamSessionsTab join/create/display uses profileId" },
      { type: 'improvement', description: "CreateCompanyDialog profile lookup uses profileId directly" },
      { type: 'improvement', description: "PlaylistsTab passes profileId to usePlaylists hook" },
      { type: 'improvement', description: "CharacterFameOverview queries profile/band/activity by profile_id" },
    ],
  },
  {
    version: "1.1.071",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "LinkGigDialog band membership lookup uses profile_id" },
      { type: 'improvement', description: "MyLabelsTab uses profileId directly, removes redundant profile fetch" },
      { type: 'improvement', description: "ReorderStockDialog activity feed scoped to profileId" },
      { type: 'improvement', description: "AddPhysicalFormatDialog activity feed scoped to profileId" },
      { type: 'improvement', description: "FamilyDashboard removed unused useAuth import" },
    ],
  },
  {
    version: "1.1.070",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Stage practice sessions and XP awards scoped to profileId" },
      { type: 'improvement', description: "Twaater LinkSongDialog band membership uses profile_id" },
      { type: 'improvement', description: "GigPerformanceTab band membership lookup uses profile_id" },
      { type: 'improvement', description: "BandCreationForm uses profileId directly instead of fetching active profile" },
      { type: 'improvement', description: "CoverSongDialog authentication check uses profileId" },
    ],
  },
  {
    version: "1.1.069",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Song voting scoped to active profile instead of auth user" },
      { type: 'improvement', description: "Earnings news band membership lookup uses profile_id" },
      { type: 'improvement', description: "Random events news queries use profileId" },
      { type: 'improvement', description: "DikCok engagement and video creation use profileId" },
      { type: 'improvement', description: "Twaater composer band lookup uses profileId" },
    ],
  },
  {
    version: "1.1.068",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Lottery tickets, purchases, and prize claims scoped to active profile" },
      { type: 'improvement', description: "Marriage proposals, responses, and divorce activity feed entries use profileId" },
      { type: 'improvement', description: "Habit tracker queries, inserts, and stat boosts use profileId" },
      { type: 'improvement', description: "Wellness goals scoped to active profile" },
      { type: 'improvement', description: "Personal updates (band invites, scheduled activities) use profileId" },
      { type: 'improvement', description: "Reputation hooks removed unnecessary useAuth dependency" },
    ],
  },
  {
    version: "1.1.067",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "PerformGig city check and scheduling conflict use profileId instead of auth user" },
      { type: 'improvement', description: "Tutorial progress (useTutorial) scoped to active profile" },
      { type: 'improvement', description: "Holiday booking and cooldown checks use profileId" },
      { type: 'improvement', description: "Rehearsal booking activity log uses active profile id" },
    ],
  },
  {
    version: "1.1.066",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "BandSearch ratings scoped to active profile instead of auth user" },
      { type: 'improvement', description: "Player inbox (useInbox) queries and real-time subscriptions use profileId" },
      { type: 'improvement', description: "BandVehicles band membership lookup uses profile_id" },
      { type: 'improvement', description: "MyCharacterEdit avatar update targets profile by id instead of user_id" },
      { type: 'improvement', description: "Child birth activity feed entries include profile_id" },
      { type: 'improvement', description: "Busking history query and scheduling conflict check use profile id" },
    ],
  },
  {
    version: "1.1.065",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Charter flight booking now scoped to active profile instead of auth user" },
      { type: 'improvement', description: "GigLocationWarning passes profileId to charter flight utility" },
      { type: 'improvement', description: "Festival watch rewards claimed and XP applied on active profile" },
      { type: 'improvement', description: "Loan creation includes profile_id for character-level debt tracking" },
      { type: 'improvement', description: "Band reactivation triggered_by uses profileId" },
      { type: 'improvement', description: "Travel history and activity feed entries from charter flights include profile_id" },
    ],
  },
  {
    version: "1.1.064",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "PersonalVehicles buy/sell operations use profileId directly" },
      { type: 'improvement', description: "RpmAvatarCreator saves avatar to active profile instead of user_id lookup" },
      { type: 'improvement', description: "UniversityDetail profile cash lookup uses profileId" },
      { type: 'improvement', description: "useEducationSummary profile lookup uses profileId" },
      { type: 'improvement', description: "CreateLabelDialog profile lookup eliminated, uses profileId directly" },
      { type: 'improvement', description: "LabelFinanceTab balance lookup uses profileId" },
      { type: 'improvement', description: "useJamSessionBooking profile lookup uses profileId" },
      { type: 'improvement', description: "usePlayerEquipmentMutations equip/unequip scoped to profileId" },
      { type: 'improvement', description: "PlaylistsTab, StreamingMyReleasesTab release queries scoped to band membership" },
      { type: 'improvement', description: "MusicVideoReleaseTab release and config queries scoped to band membership" },
    ],
  },
  {
    version: "1.1.061",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "UpcomingTravelList travel history and band queries use profile_id" },
      { type: 'improvement', description: "MyAirplayStats radio airplay song queries scoped to profile_id" },
      { type: 'improvement', description: "CreateReleaseDialog band detection and label contract lookup use profileId" },
      { type: 'improvement', description: "StagePracticeSelection skills and songs queries use profileId directly" },
      { type: 'improvement', description: "OffersDashboard band membership lookup uses profile_id" },
      { type: 'improvement', description: "WorldMap uses activeProfile for current city instead of auth lookup" },
      { type: 'improvement', description: "PlayerAnalytics gig stats, song stats, earnings all query by profileId" },
      { type: 'improvement', description: "SongSelector recording songs query uses profile_id" },
      { type: 'improvement', description: "LinkReleaseDialog band membership and releases use profile_id" },
      { type: 'improvement', description: "bandStatus utility functions accept profileId instead of userId" },
      { type: 'improvement', description: "BandManager loads bands via profileId" },
      { type: 'improvement', description: "bandHiatus reactivation conflict check uses profile_id" },
      { type: 'improvement', description: "Employment profile lookup uses active profileId" },
      { type: 'improvement', description: "ReleaseDetail uses activeProfile for cash/health/energy and band lookup" },
      { type: 'improvement', description: "MyReleasesTab releases query scoped to band membership by profile_id" },
      { type: 'improvement', description: "CollaboratorInviteDialog cash lookup uses active profile" },
    ],
  },
  {
    version: "1.1.060",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Songwriting page song queries use profile_id for character isolation" },
      { type: 'improvement', description: "MyContractsList eliminates redundant profile lookup, queries band_members by profile_id" },
      { type: 'improvement', description: "BuskingTab activity feed history scoped to profile_id" },
      { type: 'improvement', description: "TwaaterComposer and LinkTourDialog band membership queries use profile_id" },
      { type: 'improvement', description: "Mayor dashboard hooks use profileId directly, eliminating profile lookup hops" },
      { type: 'improvement', description: "Dashboard achievements query uses profile_id" },
      { type: 'improvement', description: "CurrentLearningSection eliminates profile lookups, queries directly by profileId" },
      { type: 'improvement', description: "MerchSalesNews band membership queries use profile_id" },
      { type: 'improvement', description: "InvestmentsTab cash operations use profile_id instead of user_id" },
      { type: 'improvement', description: "ReleaseSalesTab band membership queries use profile_id" },
      { type: 'improvement', description: "Game notifications band lookup uses profile_id" },
      { type: 'improvement', description: "Radio SubmitSongDialog uses active profile pattern for song and band queries" },
    ],
  },
  {
    version: "1.1.059",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Casino page profile cash and transaction stats scoped to profile_id" },
      { type: 'improvement', description: "DikCok band membership query uses profile_id instead of user_id" },
      { type: 'improvement', description: "Song Rankings band lookup for covers uses profile_id" },
      { type: 'improvement', description: "Travel page profile and city loading uses profile_id" },
      { type: 'improvement', description: "Band Search ratings query and mutations use profile_id" },
      { type: 'improvement', description: "Underworld Store active boosts, purchase history, and token holdings use profile_id" },
      { type: 'improvement', description: "AI Avatar Creator profile fetch and save use profile_id" },
    ],
  },
  {
    version: "1.1.058",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Dashboard career stats and financial summary use profile_id for band membership and earnings queries" },
      { type: 'improvement', description: "Player gains news (XP/skill) queries by profile_id instead of user_id" },
      { type: 'improvement', description: "Band gains news uses profile_id for band membership lookup" },
      { type: 'improvement', description: "Festival browser profile cash and band slot queries use profile_id" },
      { type: 'improvement', description: "Festival exclusive shop purchases and activity logs scoped to profile_id" },
      { type: 'improvement', description: "Festival merch stand creation includes profile_id" },
    ],
  },
  {
    version: "1.1.057",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Player statistics hook uses profile_id for band membership and songwriting queries" },
      { type: 'improvement', description: "Recent activity feed filters by profile_id instead of user_id" },
      { type: 'improvement', description: "Chart positions component queries songs by profile_id" },
      { type: 'improvement', description: "Performance history uses profile_id for band membership lookup" },
      { type: 'improvement', description: "Promo tour card deducts cash and queries activities by profile_id" },
      { type: 'improvement', description: "Recording type selector fetches fame/level from active profile" },
      { type: 'improvement', description: "Music video release tab uses profile_id for band membership queries" },
      { type: 'improvement', description: "Modeling offers panel queries contracts by profile_id" },
    ],
  },
  {
    version: "1.1.056",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Promo tour completion uses active profile filter for scheduled activities, health/energy drain, and band membership" },
      { type: 'improvement', description: "Global gig execution uses profile_id-based band membership lookup via active profile" },
      { type: 'improvement', description: "Auto recording completion band lookup migrated to profile_id" },
      { type: 'improvement', description: "Nightclub quests use useActiveProfile for progress, energy deduction, and reward claims" },
      { type: 'fix', description: "DJ performance addiction tracking uses profile_id for queries and inserts" },
      { type: 'improvement', description: "Underworld inventory queries and item usage migrated from user_id to profile_id" },
    ],
  },
  {
    version: "1.1.055",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Housing hooks (properties, rentals, buy, sell, toggle rent) migrated from user_id to profile_id" },
      { type: 'improvement', description: "Lottery ticket queries and prize claims now use profileId for character isolation" },
      { type: 'improvement', description: "Auto rehearsal completion uses profile_id-based band membership lookup" },
      { type: 'improvement', description: "Auto major event completion queries by profile_id instead of user_id" },
      { type: 'fix', description: "Chart notification cooldowns use profile_id instead of user_id" },
      { type: 'improvement', description: "Jam session booking uses active profile filter and profile_id for conflict checks" },
    ],
  },
  {
    version: "1.1.054",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "DJ performance hook uses profileId for profile queries, updates, skill progress, and club performance history" },
      { type: 'improvement', description: "Character sprites hook replaced manual profile query with useActiveProfile" },
      { type: 'improvement', description: "Gig notifications use profile_id-based band membership lookup" },
      { type: 'improvement', description: "Player avatar hook migrated to useActiveProfile, removing redundant profile query" },
      { type: 'improvement', description: "Auto release manufacturing uses profile_id for band membership lookups" },
      { type: 'fix', description: "Festival tickets query key now scoped to profileId for proper cache isolation" },
    ],
  },
  {
    version: "1.1.053",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Collaboration invites now fetch active profile (is_active/died_at filter) for pending invitations and cash checks" },
      { type: 'improvement', description: "Upcoming gig warning uses profileId-based band membership lookup instead of user_id" },
      { type: 'fix', description: "Company finance useUserCashBalance now queries active profile instead of any profile" },
      { type: 'improvement', description: "Open mic nights profile lookup uses active profile filter" },
      { type: 'improvement', description: "Producer career hooks use profileId for city lookups and profile operations" },
      { type: 'improvement', description: "Mentor sessions hook uses useActiveProfile() instead of separate profile query" },
      { type: 'fix', description: "Skin store owned skins and purchase hooks use active profile filter" },
    ],
  },
  {
    version: "1.1.064",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "TravelSystem bookTravel/validateEligibility now use profileId for all profile queries and inserts" },
      { type: 'improvement', description: "BehaviorSettings, AchievementsSection, ActivityStatusIndicator scoped to active profile" },
      { type: 'improvement', description: "TattooParlour profile/cash/tattoo queries and inserts migrated to profileId" },
      { type: 'improvement', description: "BandEarnings leader profile balance uses profile id" },
      { type: 'improvement', description: "InventoryManager book sessions and properties scoped to active profile" },
      { type: 'improvement', description: "LoansTab cash updates use profile id instead of user_id" },
      { type: 'fix', description: "useRecentSkillImprovements queries by profile_id" },
    ],
  },
  {
    version: "1.1.052",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "PastTravelList, AnalyticsTab, PRConsultantPanel, WellnessTrends now use profileId for character isolation" },
      { type: 'improvement', description: "RadioSubmissionWizard, SongwritingBooking, ReleaseSelector scoped to active profile" },
      { type: 'improvement', description: "Playtime tracker now updates profile by id instead of user_id" },
      { type: 'improvement', description: "Career overview (fetchCareerOverview) queries band memberships and skills by profileId" },
      { type: 'improvement', description: "OffersDashboard modeling/media offers scoped to active profile" },
      { type: 'fix', description: "RequestReleaseDialog cash checks and deductions use profile id" },
    ],
  },
  {
    version: "1.1.062",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Underworld store now queries cash balance and applies effects by profileId instead of user_id lookup" },
      { type: 'improvement', description: "Underworld inventory addiction checks now use profile_id for character-specific addiction tracking" },
      { type: 'fix', description: "Festival attendance queries scoped to active profile for correct character isolation" },
      { type: 'fix', description: "Scheduled activity creation now fetches active profile (is_active=true, died_at=null) instead of any profile" },
      { type: 'fix', description: "Skill practice profile lookup uses active profile filter for correct character" },
    ],
  },
  {
    version: "1.1.051",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Jam session chat now uses active profile directly instead of separate profile lookup query" },
      { type: 'improvement', description: "Jam session outcomes query filtered by profileId instead of user_id lookup" },
      { type: 'fix', description: "Activity booking now fetches active profile (is_active=true, died_at=null) instead of any profile" },
      { type: 'improvement', description: "Game event notifications band membership check uses profile_id with active member_status filter" },
      { type: 'fix', description: "Company share transfers correctly reference active profile's user_id" },
    ],
  },
  {
    version: "1.1.050",
    date: "2026-03-16",
    changes: [
      { type: 'improvement', description: "Profile isolation extended to streaming components: MyReleasesTab, ReleaseSongTab, PlaylistsTab, AnalyticsTab, DetailedAnalyticsTab, PlatformComparisonChart, StreamingMyReleasesTab" },
      { type: 'improvement', description: "Statistics components (CareerStats, FinancialStats, MusicStats, SocialStats) now query by active profile instead of auth user" },
      { type: 'fix', description: "Tour booking and tour wizard hooks now use profileId for tour ownership and profile lookups" },
      { type: 'fix', description: "Radio station submissions now use profileId for submission tracking and duplicate checking" },
      { type: 'improvement', description: "StreamingPlatforms page passes profileId to all child streaming tabs for character-specific data" },
    ],
  },
  {
    version: "1.1.049",
    date: "2026-03-15",
    changes: [
      { type: 'improvement', description: "Profile isolation extended to equipment store, health impact system, achievements, NPC relationships, and player survey" },
      { type: 'fix', description: "Equipment purchase/maintenance cash operations now target active profile. Health checks and drains use profile_id" },
      { type: 'improvement', description: "Callers updated: Gear page, EnhancedEquipmentStore, GearMarketplaceListings, and Statistics page now pass profileId" },
    ],
  },
  {
    version: "1.1.048",
    date: "2026-03-15",
    changes: [
      { type: 'improvement', description: "Profile isolation extended to crypto tokens, holidays, clothing brand, fan management, festival schedule conflicts, and equipment mutations" },
      { type: 'fix', description: "Crypto buy/sell operations now deduct/credit cash on the active character profile instead of the auth account" },
      { type: 'improvement', description: "Holiday booking, cancellation, and health boosts now target the active profile. Schedule activities include profile_id" },
      { type: 'fix', description: "FanManagement page and UnderworldNew page now pass profileId instead of user.id to data hooks" },
    ],
  },
  {
    version: "1.1.047",
    date: "2026-03-15",
    changes: [
      { type: 'improvement', description: "Extended profile isolation to nightlife events, VIP status, clothing marketplace, retirement checks, player equipment, festival tickets, city elections, song auctions, and released songs" },
      { type: 'fix', description: "Cash operations (nightlife costs, clothing purchases, festival tickets) now correctly target the active character profile" },
      { type: 'improvement', description: "City election voting and candidacy registration now use profileId directly instead of redundant profile lookups" },
    ],
  },
  {
    version: "1.1.046",
    date: "2026-03-15",
    changes: [
      { type: 'improvement', description: "Full character isolation: songwriting, recording, housing, lottery, music videos, skill books, media facilities, playlists, and underworld inventory now use profile_id instead of shared user_id" },
      { type: 'fix', description: "Profile cash/balance operations (buy property, rent, sell, playlist submissions) now target the active character profile instead of the auth account" },
      { type: 'improvement', description: "Hooks refactored: useSongwritingData, useRecordingData, useHousing, useLottery, useMusicVideos, useSkillBooksInventory, useMediaFacilities, usePlaylists, useUnderworldInventory" },
    ],
  },
  {
    version: "1.1.045",
    date: "2026-03-15",
    changes: [
      { type: 'fix', description: "Band membership is now isolated per character via profile_id — new characters no longer inherit other characters' bands" },
      { type: 'improvement', description: "Band creation, invitation acceptance, and band lookups now use active profile_id instead of shared user_id" },
    ],
  },
  {
    version: "1.1.044",
    date: "2026-03-15",
    changes: [
      { type: 'feature', description: "New characters now receive 300 AP and 1000 XP as a starter grant on completing onboarding" },
      { type: 'fix', description: "Schedule now filters by active profile (profile_id) instead of user_id — each character has its own independent schedule" },
    ],
  },
  {
    version: "1.1.043",
    date: "2026-03-15",
    changes: [
      { type: 'feature', description: "Added Gender selection step (step 2) to the new player onboarding wizard" },
      { type: 'fix', description: "Onboarding now saves display name, stage name, and gender to the character profile on completion" },
    ],
  },
  {
    version: "1.1.042",
    date: "2026-03-15",
    changes: [
      { type: 'fix', description: "Fixed 'duplicate key profiles_username_key' error when creating characters after deletion — usernames now include timestamp suffix and slot numbers account for deleted characters" },
    ],
  },
  {
    version: "1.1.041",
    date: "2026-03-15",
    changes: [
      { type: 'fix', description: "New character creation now properly takes you through the full onboarding wizard (fixed stale game data cache)" },
      { type: 'feature', description: "Added Delete Character button on the Characters page (soft-delete, with confirmation dialog)" },
    ],
  },
  {
    version: "1.1.040",
    date: "2026-03-15",
    changes: [
      { type: 'fix', description: "Re-added unlock_cost column to profiles table to fix schema cache errors on character creation" },
      { type: 'fix', description: "Dropped UNIQUE(user_id) constraint on profiles to enable multi-character support" },
      { type: 'fix', description: "Redeployed create-slot-checkout and fulfill-slot-purchase edge functions (were returning 404)" },
    ],
  },
  {
    version: "1.1.039",
    date: "2026-03-15",
    changes: [
      { type: 'fix', description: "Characters tile on Character Hub now shows an image instead of a bare icon" },
      { type: 'fix', description: "Fixed 'Could not find unlock_cost column' error when creating a new character" },
    ],
  },
  {
    version: "1.1.038",
    date: "2026-03-15",
    changes: [
      { type: 'feature', description: "Marriage & Children Phase 2 — Partner names now resolve from profiles instead of showing 'Your Partner'" },
      { type: 'feature', description: "Birth Completion Dialog — When gestation ends, a dialog prompts you to name your child with inherited potential preview" },
      { type: 'feature', description: "Family Legacy Panel now wired with live data from marriages and children tables (family tree, fame inheritance, legacy pressure)" },
      { type: 'feature', description: "Marriage StatusCard now shows partner avatar" },
      { type: 'improvement', description: "Activity feed entries now posted for proposals, marriages, divorces, and child births" },
      { type: 'improvement', description: "Ready births are highlighted with a glowing card and bounce animation" },
    ],
  },
  {
    version: "1.1.037",
    date: "2026-03-15",
    changes: [
      { type: 'fix', description: "Fixed build errors in useCharacterSlots, useCompanyShares, useCollaborationInvites, useGameData, and PersonalVehicles — added type safety workarounds for auto-generated Supabase types" },
    ],
  },
  {
    version: "1.1.036",
    date: "2026-03-14",
    changes: [
      { type: 'feature', description: "Marriage & Children System Phase 1 — Proposal, wedding, and marriage lifecycle with dual-consent child planning" },
      { type: 'feature', description: "Family Dashboard — Live family tab on Relationships page showing marriage status, children, and pending requests" },
      { type: 'feature', description: "Child Planning — Married players can plan children with controller selection, surname policy, and upbringing focus (±15% skill inheritance)" },
      { type: 'feature', description: "Child Profiles — Children appear with inherited potentials, emotional stability, and parent bond gauges; playability state (NPC/Guided/Playable) by age" },
      { type: 'feature', description: "Plan Wedding button on Romance panel when relationship reaches 'Engaged' stage" },
      { type: 'feature', description: "Marriage proposal and acceptance flow with partner confirmation" },
    ],
  },
  {
    version: "1.1.035",
    date: "2026-03-13",
    changes: [
      { type: 'fix', description: "Player Survey: Fixed admin toggle silently failing due to missing onConflict in upsert — survey can now be reliably enabled/disabled" },
      { type: 'fix', description: "Player Survey: Added AdminRoute wrapper and proper error handling to prevent false success toasts when RLS blocks writes" },
      { type: 'fix', description: "Player Survey: Hardened config parsing with fallback defaults so malformed config doesn't suppress the survey" },
      { type: 'fix', description: "Tour Travel: Fixed 'auto' travel mode defaulting to slow bus speed (56 km/h) for all legs — now picks optimal transport per leg (plane >800km, train >200km, bus otherwise)" },
      { type: 'fix', description: "Tour Travel: Manual travel mode now correctly skips creating blocking travel legs" },
      { type: 'fix', description: "Travel Completion: Fixed complete-travel edge function referencing non-existent columns (transport_mode, distance_km) causing silent failures" },
      { type: 'improvement', description: "Tour Travel: Hazard chance now scales by journey duration instead of non-existent distance column" },
    ],
  },
  {
    version: "1.1.034",
    date: "2026-03-12",
    changes: [
      { type: 'fix', description: "Companies: Fixed hiring staff, buying equipment, and upgrading subsidiary businesses (rehearsal studios, venues, recording studios, etc.) — company ID lookup now uses dual-match pattern" },
      { type: 'fix', description: "Companies: Fixed rehearsal studio management page passing URL company_id instead of actual room ID to staff/equipment/upgrade managers" },
      { type: 'improvement', description: "Staff salary is now auto-calculated based on skill level and role — higher skill = higher pay, no manual salary slider needed" },
    ],
  },
  {
    version: "1.1.033",
    date: "2026-03-12",
    changes: [
      { type: 'fix', description: "Companies: Fixed database CHECK constraint for company_type — venues and recording studios can now be created without errors" },
      { type: 'feature', description: "Companies: Added inter-company fund transfer tab in Finance dialog — move money between holding companies and subsidiaries" },
      { type: 'fix', description: "Player Survey: Fixed survey not appearing for players when enabled — resolved query caching and loading state detection issues" },
    ],
  },
  {
    version: "1.1.032",
    date: "2026-03-11",
    changes: [
      { type: 'feature', description: "Player Survey System: Admin-toggleable in-game survey with 32 questions across 8 categories (Gameplay, Music, Social, Economy, UI, Content, Performance, Progression)" },
      { type: 'feature', description: "Players are presented with 10 random questions on login when survey is enabled — completing rewards 250 XP + 25 Attribute Points" },
      { type: 'feature', description: "Admin dashboard (/admin/player-survey) with settings toggle, question list, rating bar charts, multiple choice pie charts, yes/no breakdowns, and free text response viewer" },
      { type: 'feature', description: "Survey round system prevents duplicate completions and tracks rewards per round" },
    ],
  },
  {
    version: "1.1.031",
    date: "2026-03-11",
    changes: [
      { type: 'fix', description: "Streaming: Replaced explosive power/linear fame+fan scaling with logarithmic capped formulas — fame 25M no longer produces 36M multiplier (now caps at ~25x)" },
      { type: 'fix', description: "Streaming: Fan boost changed from linear (500K fans = 1001x) to log10-based with cap (500K fans = ~12x)" },
      { type: 'fix', description: "Sales: Capped fame multiplier at 31x and popularity at 21x to prevent runaway revenue at extreme fame levels" },
      { type: 'fix', description: "Sales: Fan sales multiplier changed from sqrt-linear to log10-based with 11x cap" },
    ],
  },
  {
    version: "1.1.030",
    date: "2026-03-10",
    changes: [
      { type: 'fix', description: "Achievements: Fixed Dashboard achievements tab not showing unlocked achievements (was querying wrong column player_id instead of user_id)" },
      { type: 'feature', description: "Achievements: Added 26 new achievements across social (Twaater, DikCok, PR), performance (gigs, touring, festivals, awards), creative (releases, hype, sales), and financial (earnings, contracts) categories" },
      { type: 'improvement', description: "Achievements: Expanded requirement descriptions to display all new achievement types clearly" },
    ],
  },
  {
    version: "1.1.029",
    date: "2026-03-10",
    changes: [
      { type: 'feature', description: "Promotion Hub: Release Detail now shows hype meter and quick-action buttons for Twaater, DikCok, Media, and Radio promotion" },
      { type: 'feature', description: "Twaater: Release-linked twaats now boost the release's hype_score (+5-15 scaled by engagement)" },
      { type: 'feature', description: "DikCok: Videos can now be linked to a release via selector — creates +10-25 hype boost on creation" },
      { type: 'feature', description: "PR/Media: All media submission types (newspaper, magazine, podcast, website) now support linking to a release for +8-20 hype boost" },
    ],
  },
  {
    version: "1.1.028",
    date: "2026-03-09",
    changes: [
      { type: 'fix', description: "Charts: Sales charts now show correct all-time cumulative sales in the Total column instead of repeating weekly figures" },
      { type: 'fix', description: "Charts: All-time cumulative plays_count preserved through aggregation instead of being overwritten by weekly totals" },
    ],
  },
  {
    version: "1.1.027",
    date: "2026-03-09",
    changes: [
      { type: 'fix', description: "Charts: Album tracks no longer appear on singles/default charts — only standalone singles are shown" },
    ],
  },
  {
    version: "1.1.026",
    date: "2026-03-09",
    changes: [
      { type: 'fix', description: "Tabs: Fixed global tab overflow — all TabsList components now scroll horizontally on smaller screens instead of clipping or overlapping" },
    ],
  },
  {
    version: "1.1.025",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Character Slot Purchase: Fixed CORS headers on create-slot-checkout and fulfill-slot-purchase edge functions — purchases no longer fail with preflight errors" },
      { type: 'feature', description: "Inbox: Rent charged notification (financial, low priority) sent daily when rent is collected" },
      { type: 'feature', description: "Inbox: Rent defaulted/eviction alert (financial, urgent) when player can't afford rent" },
      { type: 'feature', description: "Inbox: Modeling contract payout notification (financial, normal) when contract completes" },
      { type: 'feature', description: "Inbox: NPC label offer notification (record_label, high) when a label scouts your band" },
      { type: 'feature', description: "Inbox: Equipment critical condition alert (system, high) when any item drops below 20%" },
      { type: 'feature', description: "Inbox: Significant fan loss warning (social, normal) when band loses 50+ fans from decay" },
      { type: 'feature', description: "Inbox: Band salary crisis alert (financial, high) when band can't afford member salaries" },
      { type: 'feature', description: "Inbox: Investment growth summary (financial, low) daily digest of portfolio growth" },
      { type: 'feature', description: "Inbox: Daily fame & fans summary (system, low) per-player digest of overnight gains" },
    ],
  },
  {
    version: "1.1.024",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Genres: Synced MUSIC_GENRES with full skill tree GENRE_LIST — now 52 genres including Funk, Soul, Gospel, Folk, Bluegrass, Celtic, Ska, Grunge, Progressive Rock, Ambient, Industrial, Dubstep, House, Techno, Trance, Drum and Bass" },
      { type: 'fix', description: "Genres: Replaced all hardcoded genre arrays across onboarding, city elections, venue filters, and genre trends with centralized MUSIC_GENRES import" },
    ],
  },
  {
    version: "1.1.023",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Holidays: Expanded from 6 to 12 destinations with stunning AI-generated photos, location details, highlights, stress/creativity ratings, and tiered pricing (Budget → Ultra Luxury)" },
      { type: 'improvement', description: "Holidays: All prices significantly increased — Staycation $150/day, Beach Resort $500/day, Tropical Island $1,200/day, Private Yacht $2,500/day" },
      { type: 'feature', description: "Holidays: 6 new destinations — Alpine Ski Chalet, Mediterranean Villa, Japanese Onsen, Safari Lodge, Desert Glamping, Private Yacht Cruise" },
      { type: 'feature', description: "Holidays: Each destination now shows location, 4 highlight badges, stress reduction rating, and creativity XP boost percentage" },
    ],
  },
  {
    version: "1.1.022",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Streaming Platforms: Removed redundant 'Release' tab — use Release Manager instead" },
      { type: 'improvement', description: "My Releases: Compact card layout — artwork, metadata, financials, formats, and actions all in a single dense row" },
    ],
  },
  {
    version: "1.1.020",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Education: Mentors tab now visible on mobile — reduced tab padding and font size so all 5 tabs fit in the scrollable area" },
    ],
  },
  {
    version: "1.1.019",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Player Profile: Add Friend / Remove Friend button with pending request states" },
      { type: 'feature', description: "Player Profile: Accept incoming friend requests directly from profile" },
      { type: 'feature', description: "Player Profile: Invite to Band dialog with band selection, instrument/vocal role, and optional message" },
    ],
  },
  {
    version: "1.1.018",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Player Profile: Fixed attributes query using wrong column names (creativity/discipline/etc → creative_insight/musical_ability/etc)" },
      { type: 'fix', description: "Player Profile: Added RLS policies so authenticated users can view other players' skill_progress and player_attributes" },
    ],
  },
  {
    version: "1.1.017",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Player Profile page now shows full details: avatar, level, fame, fans, health/energy bars, age, gender, city, VIP status, generation, attributes, and bands" },
      { type: 'feature', description: "Added Skills tab to Player Profile showing all trained skills with levels, XP progress bars, and last practiced dates" },
      { type: 'improvement', description: "Stats displayed in a grid (Level, Fame, Fans, Hours Played) with status badges for imprisoned/traveling" },
    ],
  },
  {
    version: "1.1.016",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Dashboard: Renamed 'Friends' tab to 'Chat', removed friends list section, chat channels now full-width" },
      { type: 'feature', description: "Chat channel selector: Added search/filter input to quickly find channels by name" },
    ],
  },
  {
    version: "1.1.015",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Dashboard Profile tab reorganised: hero card with vitals, location banner, stats grid, VIP, identity/reputation, then activity" },
    ],
  },
  {
    version: "1.1.014",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Charts: Daily view now shows estimated daily values (weekly/7) instead of duplicating weekly totals" },
      { type: 'fix', description: "Charts: Monthly/yearly totals now guaranteed to be at least the weekly peak, preventing weekly > monthly anomaly" },
      { type: 'fix', description: "Charts: B-sides from singles are now excluded from all chart types (streaming, sales, combined)" },
      { type: 'improvement', description: "Edge function update-music-charts: Added is_b_side filtering to prevent b-sides from charting" },
    ],
  },
  {
    version: "1.1.013",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Admin nav audit: added 7 missing pages to AdminNav (User Roles, Music Videos, Practice Tracks, Gig Viewer Demo, Random Events, Skin Collections, Stage Templates)" },
      { type: 'fix', description: "Uncommented Stage Templates admin route" },
      { type: 'improvement', description: "Removed 6 orphan admin pages with no routes (Contracts, Sponsorships, Mentorship, DikCok, CommunityFeed, SpriteManager)" },
    ],
  },
  {
    version: "1.1.012",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Updated Buy Character Slot tile image to show people holding hands" },
    ],
  },
  {
    version: "1.1.011",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Regenerated Buy Character Slot tile image with person and money theme" },
      { type: 'fix', description: "Added Current City tile image and tileImageKey override for dynamic city paths" },
    ],
  },
  {
    version: "1.1.010",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Casino system with three playable mini-games: Blackjack, Roulette, and Slot Machine" },
      { type: 'feature', description: "Blackjack: Hit, Stand, Double Down with animated card dealing and dealer AI" },
      { type: 'feature', description: "Roulette: Full number grid, outside bets (red/black, odd/even, dozens), spinning wheel animation" },
      { type: 'feature', description: "Slots: Music-themed 3-reel machine with weighted symbols, auto-spin, and jackpot system" },
      { type: 'feature', description: "Casino lobby with session stats (wins/losses) and gambling addiction integration" },
      { type: 'feature', description: "Casino transactions table tracking all bets, payouts, and game metadata" },
    ],
  },
  {
    version: "1.1.009",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Generated 70 static tile images for all hub pages — replaced broken edge function with local static files for instant loading" },
    ],
  },
  {
    version: "1.1.008",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Added image prompts to all hub tiles across Band, World, Commerce, Events, Social, Live, Media, and Career hubs for rich AI-generated tile images" },
    ],
  },
  {
    version: "1.1.007",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Buy Character Slot page: players can purchase extra character slots for £5 each via Stripe checkout" },
      { type: 'feature', description: "Slot purchase success flow with automatic fulfillment and slot activation" },
      { type: 'feature', description: "Added buy slot tile to Character Hub for easy access" },
    ],
  },
  {
    version: "1.1.006",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Admin Player Management: 'Gift Slot' button to grant extra character slots to players directly from the player table" },
    ],
  },
  {
    version: "1.1.005",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Multi-character slots: players can own multiple characters. Free players get 1 slot (up to 2), VIP players get 2 slots (up to 5). Extra slots purchasable for £5 each" },
      { type: 'feature', description: "Character permadeath: characters lose 5 health per day of inactivity. If hospitalised and player doesn't login for 10 days, the character dies" },
      { type: 'feature', description: "Hall of Immortals: memorial page for dead characters showing full bio, career stats, skills, and cause of death" },
      { type: 'feature', description: "Legacy inheritance: when a character dies, players can create a child character inheriting 10% of skills and 50% of cash, or start completely fresh" },
      { type: 'feature', description: "Character switcher: dropdown in navigation to switch between active characters. Shows slot usage and 'New Character' option when slots available" },
      { type: 'feature', description: "Daily health decay edge function (check-character-health-decay) — processes inactive profiles, drains health, and triggers permadeath when conditions are met" },
      { type: 'improvement', description: "Retirement inheritance reduced from 20% to 10% of skill levels to match permadeath legacy system" },
      { type: 'feature', description: "Login health check: active profile's last_login_at updated on each session, death screen shown if character died while offline" },
    ],
  },
  {
    version: "1.1.004",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Night Clubs system overhaul: dedicated /nightclub/:clubId detail page with DJ slot, guest actions, drink menu, NPC profiles, and quest board" },
      { type: 'feature', description: "NPC dialogue & quest system UI: branching dialogue panel, quest progress tracking, reward claiming — powered by nightclub_quests and player_nightclub_quest_progress tables" },
      { type: 'feature', description: "Interactive drink menu: buy drinks for cash, gain energy boost. Guest action cards with individual energy costs" },
      { type: 'fix', description: "Fixed nightclub data normalization on City page — raw DB rows now properly mapped through normalizeNightClubRecord (camelCase props)" },
      { type: 'improvement', description: "City nightclub cards now link to dedicated club pages via 'Enter Club' button. DJ slot and guest visit buttons retained" },
      { type: 'feature', description: "Seeded quest chains for 10+ major world cities: Berlin, New York, Ibiza, Tokyo, Lagos, São Paulo, Sydney, Amsterdam, Seoul, and Bangkok" },
    ],
  },
  {
    version: "1.1.003",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Added back-to-hub navigation on every sub-page via PageHeader backTo prop. All pages now link back to their parent hub: Music, Band & Live, World & Social, Career & Business, Character, or Dashboard" },
    ],
  },
  {
    version: "1.1.002",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Navigation simplified to hub headings only — removed all dropdown menus and collapsible sub-items from both sidebar and horizontal nav. Each section heading now navigates directly to its hub page" },
      { type: 'feature', description: "Hub tiles now support AI-generated images via Lovable AI (gemini-2.5-flash-image). Images are generated on-demand and cached in Supabase storage for instant loading on return visits" },
      { type: 'improvement', description: "Hub tile grid reduced from 5 columns to 4 on large screens to accommodate image cards. Text truncation added to prevent overflow on tile labels" },
      { type: 'improvement', description: "Layout fit fixes: consistent card sizing, proper aspect ratios on image tiles, and text overflow prevention throughout hub pages" },
    ],
  },
  {
    version: "1.1.001",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Migrated 25+ pages to use shared PageLayout and PageHeader components: Dashboard, Songwriting, Recording Studio, Gig Booking, Employment, Finances, Travel, Relationships, Band Manager, Merchandise, Schedule, Release Manager, Streaming, Awards, Housing, Education, Lottery, DikCok, Song Market, Streaming Platforms, Hall of Fame, Record Label, Festivals, Music Hub, and Inbox" },
      { type: 'improvement', description: "Standardized all page headers from mixed text-3xl/text-4xl sizes to consistent text-2xl md:text-3xl font-oswald via PageHeader component" },
      { type: 'improvement', description: "Added back-to-hub navigation on sub-pages (Recording Studio, Release Manager, Streaming, Song Market, Streaming Platforms) via PageHeader backTo prop" },
      { type: 'improvement', description: "Single point of control: changing PageLayout or PageHeader now updates layout/headers across all 25+ migrated pages simultaneously" },
    ],
  },
  {
    version: "1.1.000",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Page Layout Standardization: Created shared PageLayout and PageHeader components enforcing consistent container width (max-w-6xl), padding (px-4 py-6), spacing (space-y-6), and typography (text-2xl md:text-3xl font-oswald) across all pages" },
      { type: 'improvement', description: "Migrated 15 high-traffic pages to standardized layout: Dashboard, Songwriting, Recording Studio, Gig Booking, Employment, Finances, Travel, Relationships, Band Manager, Twaater, Streaming, Release Manager, Merchandise, Schedule, and Inbox" },
      { type: 'improvement', description: "Hub pages now display grouped tile sections with labeled headers (e.g., 'Band Management', 'Live Performance', 'Events & Competitions') for better content organization and discoverability" },
      { type: 'improvement', description: "CategoryHub component enhanced with grouped tiles support via new 'groups' prop alongside existing flat 'tiles' prop for backwards compatibility" },
    ],
  },
  {
    version: "1.0.999",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Navigation Consolidation: Reduced 12 navigation sections (~80 items) to 5 streamlined sections — Home, Music, Band & Live, World & Social, Career & Business. Full access to all features still available via hub tile pages" },
      { type: 'improvement', description: "Merged hub pages: Band + Live + Events → Band & Live Hub, World + Social + Media → World & Social Hub, Career + Commerce → Career & Business Hub. Old hub URLs redirect automatically" },
      { type: 'improvement', description: "Simplified mobile bottom bar shortcuts: Home, Music, Band, World. Desktop horizontal nav and sidebar both use the new 5-section structure" },
    ],
  },
  {
    version: "1.0.998",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Health Event Logging Final Batch: 6 remaining edge functions now log to band_health_events, completing 100% coverage. Travel hazards, company taxes, tour arrivals, merch sales, PR appearances (sentiment+reputation+morale), and release manufacturing (sentiment+reputation+morale) all record detailed health stat changes" },
      { type: 'improvement', description: "All ~25 health-modifying edge functions now have full event audit trail coverage. Players can trace every morale, reputation, and sentiment change back to its source action in the Health Event Log" },
    ],
  },
  {
    version: "1.0.997",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Health Event Logging Batch 3: 8 more edge functions now log to band_health_events. Demo review (accepted/rejected), lottery wins, university attendance/graduation, book reading, prison release, prison songwriting, teaching sessions (teacher morale+rep & student morale), and debt imprisonment all record detailed health stat changes" },
      { type: 'improvement', description: "19 of ~25 health-modifying edge functions now have full event audit trail coverage. Players can trace morale and reputation changes from nearly all game systems" },
    ],
  },
  {
    version: "1.0.996",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Health Event Logging Batch 2: 8 more edge functions now log to band_health_events. Organic followers, streaming revenue, radio acceptance/rejection, work shifts, recording sessions, media submissions (newspaper/magazine/podcast), studio bookings, and venue bookings all record detailed health stat changes" },
      { type: 'improvement', description: "11 of ~27 health-modifying edge functions now have full event audit trail coverage. Players can trace morale changes from streaming revenue, radio rejections, work shifts, recording sessions, media approvals, and business revenue" },
    ],
  },
  {
    version: "1.0.995",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Health Event Log: New band_health_events table tracks every morale, reputation, and sentiment change with source, delta, and description. Players can now see exactly what's causing their stats to change" },
      { type: 'feature', description: "BandHealthEventLog component: Compact scrollable timeline on Band Overview showing the latest 20 health stat changes, color-coded by positive/negative delta with stat icons" },
      { type: 'feature', description: "Company Payroll → Health Event Logging: Payroll success (+1 morale) and failure (-3 morale) events are now recorded to the health event log" },
      { type: 'feature', description: "Company Bankruptcy → Health Event Logging: Bankruptcy declarations (-15 morale, -10 reputation) and warnings (-5 morale) now log detailed events" },
      { type: 'feature', description: "Gig Completion → Health Event Logging: Post-gig morale, reputation, and sentiment changes are now logged with performance grade and attendance context" },
      { type: 'improvement', description: "Band Health Dashboard now has full event audit trail. Players can trace every stat fluctuation back to its source action" },
    ],
  },
  {
    version: "1.0.994",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Company Taxes → Reputation Tax Discount: Reputable company owners receive up to 10% tax reduction (1.0x toxic → 0.9x iconic). Better public image means better tax treatment" },
      { type: 'feature', description: "Company Taxes → Morale Impact: Auto-paying taxes now applies -2 morale to the owner's band. Taxes are stressful even when you can afford them" },
      { type: 'feature', description: "Venue Bookings → Reputation Revenue Scaling: All venue revenue (ticket cuts, bar sales, merch cuts, booking fees) is now scaled by the owner's band reputation (0.9x toxic → 1.1x iconic). Reputable venue owners attract premium pricing" },
      { type: 'feature', description: "Studio Bookings → Reputation Revenue Scaling: Recording session and rehearsal room revenue is now scaled by studio owner reputation (0.9x toxic → 1.1x iconic). Reputable studios attract higher-paying clients" },
      { type: 'feature', description: "Venue & Studio Bookings → Morale Boost: Successfully processing revenue from venue gigs, bookings, recording sessions, and rehearsals now awards +1 morale to the owner's band" },
      { type: 'improvement', description: "All company financial systems (taxes, venue bookings, studio bookings) now integrate with band health stats. Reputation influences revenue and tax rates; business activity feeds back into morale" },
    ],
  },
  {
    version: "1.0.993",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Company Operations → Reputation Revenue Scaling: All subsidiary activity-based revenue (security, factory, logistics, venue, rehearsal, recording) is now scaled by the owner's band reputation (0.85x toxic → 1.15x iconic). Reputable owners attract more business" },
      { type: 'feature', description: "Company Payroll → Morale Impact: Successfully paying all staff awards +1 morale to the owner's band. If payroll causes negative balance, -3 morale penalty is applied instead" },
      { type: 'feature', description: "Company Bankruptcy → Morale + Reputation Crash: Declaring bankruptcy applies -15 morale and -10 reputation to the owner's band. Bankruptcy warnings (3+ days negative) apply -5 morale" },
      { type: 'improvement', description: "All company management systems (operations, payroll, bankruptcy) now integrate with band health stats. Business performance and financial responsibility directly affect morale and reputation" },
    ],
  },
  {
    version: "1.0.992",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Promotions → Reputation + Sentiment Scaling: Paid song promotion effectiveness (streams, listeners, revenue) is now scaled by both reputation (0.8x–1.2x) and fan sentiment (0.8x–1.2x). Reputable bands with engaged fanbases see significantly higher ROI on ad spend" },
      { type: 'feature', description: "Scheduled PR → Reputation Modifier: PR activity outcomes now pass a reputation modifier (0.8x–1.2x) to the processing pipeline. Toxic bands get diminished returns from PR efforts as media is less receptive" },
      { type: 'feature', description: "Logistics Contracts → Morale Boost: Successfully completing a logistics contract now awards +2 morale to the company owner's band. Business success lifts team spirits" },
      { type: 'improvement', description: "Health stats now cross-pollinate into promotions, scheduled PR, and logistics contracts. All three core stats (Morale, Reputation, Sentiment) now influence virtually every revenue and growth system in the simulation" },
    ],
  },
  {
    version: "1.0.991",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Jam Sessions → Reputation & Sentiment: High-synergy jams (≥80) now boost band reputation +2 and fan sentiment +3. Decent jams (≥60) boost +1/+1. Jamming is now a community/creative event that builds public goodwill" },
      { type: 'feature', description: "Brand Sponsorships → Reputation Gating: Toxic bands (reputation ≤ -60) are now excluded from established and titan tier brand offers. Clean up your image to attract premium sponsors" },
      { type: 'feature', description: "Brand Sponsorships → Reputation Cash Scaling: All sponsorship cash offers are now scaled by reputation (0.8x toxic → 1.2x iconic). Better public image = better deals" },
      { type: 'feature', description: "Brand Sponsorships → Sentiment Volume Bonus: Bands with fan sentiment ≥ 30 receive +1 additional sponsorship offer slot per cycle. Brands want engaged fanbases for their campaigns" },
      { type: 'improvement', description: "Teaching sessions already integrate reputation (+4) and morale (+3/+2) from v1.0.972. All three health stats now cross-pollinate across jam sessions, brand sponsorships, and teaching in addition to all previously connected systems" },
    ],
  },
  {
    version: "1.0.990",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Morale → Live Gig Performance: Band morale now acts as a final multiplier on all gig song and performance item scores. 0.85x at 0 morale → 1.0x at 50 → 1.15x at 100. Miserable bands play worse; euphoric bands deliver exceptional shows" },
      { type: 'feature', description: "Reputation → PR Offer Generation: Band reputation now gates and scales PR media offers. Toxic bands (rep ≤ -60) are excluded from TV and film opportunities entirely. All offer compensation, fame boosts, and fan boosts are scaled by reputation (0.8x toxic → 1.2x iconic)" },
      { type: 'feature', description: "Reputation → PR Offer Volume: Respected bands (rep ≥ 40) receive +1 additional PR offer slot per generation cycle. Better reputation = more media attention" },
      { type: 'improvement', description: "Morale now affects 7 systems: gig payouts, recording quality, gig fame/fan conversion, random events, rehearsals, self-promotion, and live performance scoring. Reputation now affects 10+ systems including PR offer generation with gating, scaling, and volume bonuses" },
    ],
  },
  {
    version: "1.0.989",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Reputation → Radio Listener Engagement: Band reputation now modifies radio play hype and stream boosts (0.8x toxic → 1.2x iconic). Reputable bands get more listener attention when their songs air" },
      { type: 'feature', description: "Reputation → Organic Follower Growth: Social media organic follower acquisition is now scaled by reputation (0.8x–1.2x). Respected bands attract more organic follows; toxic bands are avoided" },
      { type: 'feature', description: "Reputation → Streaming Algorithm Favor: Daily streaming counts now include a reputation modifier (0.9x–1.1x). Streaming platforms subtly favor reputable artists in recommendation algorithms" },
      { type: 'improvement', description: "Reputation now serves as input modifier in 9+ systems: gig offers, media approval, radio acceptance, recording quality, merch sales, video views, sponsorships, radio engagement, organic followers, and streaming. Single DB queries fetch reputation alongside sentiment for all batch operations" },
    ],
  },
  {
    version: "1.0.988",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Reputation → Online Merch Sales: Band reputation now modifies daily online merch demand (0.8x toxic → 1.2x iconic). Reputable bands have stronger brand appeal that drives online purchases" },
      { type: 'feature', description: "Reputation → Video Views: Music video daily view counts are now scaled by reputation (0.8x–1.2x). Respected artists get more organic clicks; toxic artists are algorithmically deprioritized" },
      { type: 'feature', description: "Fan Sentiment → Sponsorship Attractiveness: Brands now consider fan engagement when evaluating sponsorship deals. Sentiment modifier (0.7x–1.3x) affects match score. Engaged fanbases deliver better campaign ROI" },
      { type: 'improvement', description: "All 3 health stats now cross-pollinate across merch, video, and sponsorship systems. Single DB query fetches both sentiment + reputation for merch/video functions. Sponsorship matching now uses reputation × sentiment for a more nuanced brand-fit score" },
    ],
  },
  {
    version: "1.0.987",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Fan Sentiment Daily Drift: fan_sentiment_score now passively drifts toward 0 (neutral) each day. Positive sentiment decays at -0.8/day (happy fans are fickle), negative recovers at +0.4/day (angry fans hold grudges). Bands must actively maintain fan engagement" },
      { type: 'feature', description: "Reputation → Recording Quality: Band reputation now subtly modifies recording session quality improvements. 0.9x (toxic) to 1.1x (iconic). Prestigious bands attract better energy and collaborator focus in the studio" },
      { type: 'feature', description: "Fan Sentiment → Recording Quality: Fan buzz inspires better studio work. Sentiment modifier of 0.9x–1.1x applied to recording quality gains. Bands riding a wave of fan love produce more inspired recordings" },
      { type: 'improvement', description: "All 3 core stats (Morale, Reputation, Sentiment) now have daily drift/regression AND serve as recording quality inputs alongside morale. Single DB query fetches all 3 stats for recording sessions. Fan sentiment decay creates urgency to stay visible" },
    ],
  },
  {
    version: "1.0.986",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Fan Sentiment → Merch Sales at Gigs: Merchandise purchase rate at gigs is now modified by fan_sentiment_score. Hostile fans (-100) reduce merch sales to 0.7x; fanatical fans (+100) boost to 1.3x. Fans who love you want to wear your shirt" },
      { type: 'feature', description: "Fan Sentiment → Fan Conversion at Gigs: The rate at which gig attendees become new fans is now scaled by sentiment. Range: 0.6x (hostile) to 1.4x (fanatical). Word-of-mouth from happy fans converts more newcomers" },
      { type: 'feature', description: "Fan Sentiment → Daily Physical/Digital Sales: Album and single sales (CD, vinyl, digital, cassette) are now modified by band fan sentiment. 0.7x–1.3x range. Disengaged fans stop buying; enthusiastic fans drive sales" },
      { type: 'improvement', description: "Fan sentiment now used as INPUT modifier in 6+ systems: organic follower growth, streaming loyalty, gig offers, merch sales, fan conversion, and daily sales. Creates full feedback loop: treat fans well → better sales → more revenue → invest in fans" },
    ],
  },
  {
    version: "1.0.985",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Morale → Rehearsal Effectiveness: Band morale now modifies XP earned and chemistry gained from rehearsals. 0.7x at 0 morale → 1.3x at 100 morale. Demoralized bands have distracted, unproductive rehearsals; energized bands get more out of practice" },
      { type: 'feature', description: "Morale → Self-Promotion Effectiveness: Both self-promotion functions now apply a morale modifier (0.7x–1.3x) to fame and fan gains. Enthusiastic bands promote themselves more convincingly" },
      { type: 'improvement', description: "Morale now used as INPUT modifier in 6 systems: gig payouts, recording quality, gig fame/fan conversion, random event frequency, rehearsal effectiveness, and self-promotion gains. Creates positive feedback loop: good morale → better results → more morale" },
    ],
  },
  {
    version: "1.0.984",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Reputation → Media Approval Rates: Newspaper, magazine, and podcast submission approval rates are now modified by band reputation. Toxic bands (-100 rep) see approval halved; iconic bands (+100 rep) get near-guaranteed approval. Formula: baseRate × (0.5 + repT) where repT is 0→1" },
      { type: 'feature', description: "Reputation → Radio Acceptance: Radio station playlist acceptance now factors in band reputation. Good rep (40+) adds +10% acceptance chance, bad rep (-40) subtracts -15%. Radio gatekeepers care about your public image" },
      { type: 'improvement', description: "Reputation now used as INPUT modifier in 6 systems: gig offers, sponsorship offers, talent scouting, media submissions, radio submissions. Creates meaningful gameplay loop: build reputation → unlock better opportunities" },
    ],
  },
  {
    version: "1.0.983",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Gig Performance → Fan Sentiment: Live shows now directly affect fan_sentiment_score. Amazing shows (22+ rating) give +10 sentiment, great +5, decent +2; bad shows -6, terrible -12. Oversold/overcrowded gigs (>110% capacity) cause additional -3 sentiment penalty" },
      { type: 'feature', description: "Open Mic → Fan Sentiment: Open mic performances now affect fan sentiment. 85+ rating = +5, 70+ = +2, below 40 = -4. Local fans remember how you performed" },
      { type: 'feature', description: "Self-Promotion → Fan Sentiment: Completing self-promotion activities now boosts fan sentiment alongside morale. 50+ fans gained = +3, 20+ = +2, any = +1. Staying visible keeps fans engaged" },
      { type: 'improvement', description: "Fan sentiment now integrated into 19+ functions. All three new integrations write sentiment in the same DB transaction as morale/reputation for zero extra queries" },
    ],
  },
  {
    version: "1.0.982",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Open Mic → Reputation: Performing at open mic nights now affects band reputation. 85+ rating = +3, 70+ = +1, below 40 = -2. Building your name on the local circuit matters" },
      { type: 'feature', description: "Video Release → Reputation: Releasing music videos now boosts reputation. High-hype videos (60+) give +3 rep, others +1. Professional video output builds public credibility" },
      { type: 'feature', description: "Scandals → Reputation: Random scandal events now cause -10 reputation (or -5 for non-scandal negatives). Scandals now damage morale, sentiment, AND reputation simultaneously" },
      { type: 'improvement', description: "Reputation system now integrated into 21+ functions. All three new integrations use single-transaction updates alongside existing morale/sentiment writes for efficiency" },
    ],
  },
  {
    version: "1.0.981",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Gig Performance → Reputation: Completing gigs now affects band reputation_score. Amazing shows (22+ rating) give +5 rep, great (18+) +3, decent (14+) +1. Bad shows (<12) cause -3, terrible (<8) -6. Large attendance (1000+/5000+) amplifies the effect by 1.2x/1.5x" },
      { type: 'improvement', description: "complete-gig now writes reputation_score alongside morale in the same band update transaction. Public perception is now shaped by live performance quality and audience size" },
    ],
  },
  {
    version: "1.0.980",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Morale Integration Audit Complete: 42+ edge functions now participate in the morale ecosystem. Positive events (gigs, sales, streaming, releases, awards, PR, social media, education) boost morale; negative events (debt, prison, scandals, injuries, rejections) decrease it. Daily drift ensures morale regresses toward baseline 50" },
      { type: 'improvement', description: "Morale now affects: gig payouts (generate-gig-offers), recording creativity (complete-recording-sessions), fame/fan conversion at gigs (complete-gig), random event frequency (trigger-random-events). Low morale increases drama probability; high morale improves all performance metrics" },
    ],
  },
  {
    version: "1.0.979",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Self-Promotion (individual) → Morale: Completing self-promotion activities now boosts band morale based on fans gained. 50+ fans = +3, 20+ = +2, any = +1. Hustling for your band feels rewarding" },
      { type: 'feature', description: "Daily Streaming Revenue → Morale: Accumulated streaming income now boosts band morale daily. $500+/day = +4, $100+ = +3, $20+ = +2, any revenue = +1. Seeing royalties roll in keeps spirits high" },
      { type: 'improvement', description: "process-self-promotion now fetches current band data including morale before updating, applying morale boost in the same transaction. update-daily-streams accumulates per-band revenue for efficient single morale update" },
    ],
  },
  {
    version: "1.0.977",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Daily Release Sales → Morale: Earning revenue from physical/digital release sales now boosts band morale. $1000+/day = +3, $200+/day = +2, any sales = +1. Seeing your music sell is validating" },
      { type: 'improvement', description: "generate-daily-sales now fetches morale alongside band_balance in a single query and applies the morale boost within the same update transaction for efficiency" },
    ],
  },
  {
    version: "1.0.976",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Work Shifts → Morale: Completing job shifts now affects band morale. Humiliating jobs (high fame penalty) cause -3 morale, mildly degrading jobs -1. Good earnings ($500+) give +2, decent pay ($100+) gives +1" },
      { type: 'feature', description: "Social Bot Engagement → Morale: When bots generate significant social media buzz (likes, replies, follows), bands receive a morale boost. 20+ engagements = +3, 10+ = +2, 5+ = +1" },
      { type: 'improvement', description: "Shift-clock-out now looks up band membership to apply morale shifts based on fame impact and earnings. Bot engagement aggregates total interactions across all band accounts before applying morale" },
    ],
  },
  {
    version: "1.0.975",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Media Submissions → Morale: Getting approved for newspaper (+3), magazine (+4), or podcast (+3) interviews now boosts band morale alongside reputation. Media validation lifts spirits" },
      { type: 'feature', description: "Media Rejections → Morale: Getting rejected by media outlets now causes a small -1 morale penalty. Repeated rejections accumulate and can drag morale down" },
      { type: 'feature', description: "Radio Submissions → Morale & Reputation: Getting a song accepted onto a radio station playlist now boosts morale +3 and reputation +2. Rejection causes -1 morale" },
      { type: 'improvement', description: "Media submission approval blocks now fetch both reputation_score and morale in a single query for efficient combined updates. Radio submissions now participate in the full morale/reputation ecosystem" },
    ],
  },
  {
    version: "1.0.974",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Community Service Completion → Morale & Reputation: Successfully completing community service boosts morale by +6 and reputation by +5 (redemption arc). Failing community service tanks morale by -12 and reputation by -8" },
      { type: 'feature', description: "Book Reading → Morale: Reading skill books gives +1 morale per reading day. Completing a book gives +4 morale. Self-improvement through education keeps spirits high" },
      { type: 'improvement', description: "Community service check now handles both success and failure paths with separate morale/reputation impacts. Book reading morale integrates into the existing attendance processing loop" },
    ],
  },
  {
    version: "1.0.973",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Pay Bail → Morale & Reputation: Getting bailed out boosts morale (+5 self-bail, +8 if a friend pays). Friend bail also gives +3 reputation (community support). Self-bail gives +1 rep" },
      { type: 'feature', description: "Prison Songwriting → Morale: Writing songs while imprisoned is a creative outlet. Each song written gives +1 morale (max +3/day). Channeling adversity into music keeps spirits alive" },
      { type: 'improvement', description: "Pay-bail now looks up band membership to apply morale/rep effects. Prison events process songwriting morale within the behavior bonus loop for efficiency" },
    ],
  },
  {
    version: "1.0.972",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Teaching Sessions → Morale & Reputation: Completing a teaching session boosts the teacher's band reputation by +4 (mentoring is respected) and morale by +3. Students get +2 morale from learning" },
      { type: 'feature', description: "Prison Release → Morale & Reputation: Getting released from prison gives a morale boost scaled by behavior score (exemplary +10, good +7, average +4, poor +2). Good behavior also recovers +3 reputation" },
      { type: 'feature', description: "Organic Follower Growth → Morale: Gaining 2+ organic social media followers in a cycle gives +1-2 morale. Watching your fanbase grow naturally is validating" },
      { type: 'improvement', description: "Teaching sessions now look up band membership for both teacher and student separately. Release-prisoners fetches morale alongside reputation for combined update" },
    ],
  },
  {
    version: "1.0.971",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Relationship Decay → Morale: When trust or loyalty decay below critical thresholds due to neglected relationships, band morale drops (-4 for trust, -3 for loyalty). Neglecting bandmates has consequences" },
      { type: 'feature', description: "Lottery Win → Morale: Winning the lottery now boosts band morale scaled by prize tier. Jackpot ($250k+) gives +12, big win ($10k+) gives +8, small win ($1k+) gives +5, minimum prize gives +3" },
      { type: 'feature', description: "University Attendance → Morale: Attending classes gives a small +1 morale boost per day. Graduating/completing a course gives +5 morale — investing in education feels rewarding" },
      { type: 'improvement', description: "Lottery draw now fetches user_id alongside profile data for band lookup. Relationship decay processes morale penalties within the threshold event loop for efficiency" },
    ],
  },
  {
    version: "1.0.970",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Imprisonment → Morale & Reputation: A band member getting imprisoned tanks morale by -15 and reputation by -10. Having a member in jail is devastating for the band's image and spirit" },
      { type: 'feature', description: "Morale → Gig Offers: Band morale now affects gig offer payouts via a 0.8x-1.2x modifier. Demoralized bands get worse deals; energized bands command premium payouts" },
      { type: 'feature', description: "Daily Reputation Regression: Reputation now passively drifts toward 0 each day. Positive rep decays 3% daily, negative rep recovers 2% daily — scandals linger longer than good deeds" },
      { type: 'improvement', description: "Gig offer generation now fetches morale alongside existing band fields. Daily updates now process both morale and reputation regression in the same transaction" },
    ],
  },
  {
    version: "1.0.969",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Brand Sponsorship → Morale: Accepting a brand sponsorship deal now boosts morale (+3 to +6 scaled by deal value). Landing a brand partnership feels like a career win" },
      { type: 'feature', description: "Daily Morale Regression: Morale now passively drifts toward baseline (50) each day. High morale decays 8% per day, low morale recovers 5% per day — preventing permanently maxed or tanked morale" },
      { type: 'feature', description: "Tour Travel → Morale: Arriving at a new city during a tour gives a +2 morale boost per band. The excitement of touring and seeing new places keeps spirits up" },
      { type: 'improvement', description: "Daily updates now fetch and update morale alongside existing band stats. Tour travel tracks unique band IDs to apply morale boost once per arrival" },
    ],
  },
  {
    version: "1.0.968",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Video Views → Morale: Viral music videos boost morale by +6, 10k+ daily views give +3, 1k+ give +2. Watching your video blow up is exciting" },
      { type: 'feature', description: "Streaming Charts → Morale & Reputation: Charting on streaming platforms now boosts morale (+8) and reputation (+5) alongside existing sentiment/media intensity boosts. Charting is a career-defining moment" },
      { type: 'feature', description: "Career Milestones → Morale: Achieving milestones now boosts band morale. Big milestones (first #1, 100k fans, $1M earned) give +8, regular milestones give +4" },
      { type: 'improvement', description: "Streaming charts query now fetches morale and reputation alongside sentiment/media fields. Video views update morale in the same band transaction" },
    ],
  },
  {
    version: "1.0.967",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Demo Review → Morale: Getting a demo accepted by a label now boosts band morale by +5 (exciting news!). Demo rejections reduce morale by -2 (discouraging but recoverable)" },
      { type: 'feature', description: "Merch Sales → Morale: Daily merchandise revenue now boosts band morale. $5k+ gives +4, $1k+ gives +3, $200+ gives +2, any sales give +1 — seeing fans buy your merch is motivating" },
      { type: 'feature', description: "Radio Plays → Morale: Significant radio airplay boosts morale alongside existing sentiment. 5k+ listeners give +3, 1k+ give +2, 200+ give +1 — hearing your song on the radio is thrilling" },
      { type: 'improvement', description: "All three systems now fetch and update morale alongside existing band stat transactions for efficient single-query updates" },
    ],
  },
  {
    version: "1.0.966",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Open Mic → Morale: Performing at open mics affects band morale based on rating. Great performances (85+) give +4, good (70+) give +2, decent (50+) give +1, poor performances cost -2" },
      { type: 'feature', description: "Self-Promotion → Morale: Completing self-promotion activities boosts morale (+1 to +3 based on fans gained). Hustling and growing the fanbase feels productive" },
      { type: 'feature', description: "Travel Hazards → Morale: Travel injuries and sickness now reduce band morale. Severe conditions (50+ severity) cost -6, moderate (30+) cost -3, mild cost -1" },
      { type: 'improvement', description: "Open mic and self-promotion band updates now fetch morale alongside existing stats for single-transaction updates" },
    ],
  },
  {
    version: "1.0.965",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Music Video Release → Morale & Sentiment: Releasing a music video now boosts band morale (+3 to +5) and fan sentiment (+3 to +6) based on initial hype score. High-hype videos create bigger excitement" },
      { type: 'feature', description: "Sponsorship Payments → Morale: Receiving weekly sponsorship payments boosts morale (+1 for small, +2 for $1k+, +3 for $5k+ payments). Getting paid by brands feels good" },
      { type: 'feature', description: "Recording Sessions → Morale: Completing recording sessions with quality improvement boosts morale. Big quality jumps (25+) give +5, medium (15+) give +3, otherwise +1" },
      { type: 'improvement', description: "Video production and sponsorship payment band queries now fetch morale/sentiment alongside existing fields for single-transaction updates" },
    ],
  },
  {
    version: "1.0.964",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "PR Appearances → Reputation & Morale: Completing PR activities (TV, radio, podcast, magazine, film) now boosts reputation (+2 to +6) and morale (+1 to +5) scaled by media type. TV/Film gives biggest boosts" },
      { type: 'feature', description: "Jam Sessions → Morale: Completing jam sessions boosts band morale based on synergy score. High synergy (80+) grants +4, good (60+) grants +2, otherwise +1 — jamming together strengthens the band" },
      { type: 'feature', description: "Media Submissions → Reputation: Getting approved in newspapers (+3), magazines (+4), and podcasts (+3) now boosts public reputation — media coverage builds your image" },
      { type: 'improvement', description: "PR activity now fetches morale and reputation alongside sentiment/media in a single query for efficient updates" },
    ],
  },
  {
    version: "1.0.963",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Random Event Outcomes → Band Morale: Event choices now cascade into band morale. Net-positive outcomes boost morale (+1 to +6), negative outcomes hurt it (-2 to -8), creating real consequences for event decisions" },
      { type: 'feature', description: "Random Event Health Damage → Reputation: Events that severely damage player health (≤-20) also hit public reputation by -8, while moderate damage (-10 to -20) costs -4 rep — scandals and arrests now visibly hurt your image" },
      { type: 'feature', description: "Twaater Viral Posts → Morale & Reputation: Social media posts now boost band morale (+1 normal, +3 viral). Viral posts also grant +2 reputation, rewarding an active social media presence" },
      { type: 'improvement', description: "Event outcome band lookups now include is_touring_member filter and use maybeSingle() to handle players without bands gracefully" },
    ],
  },
  {
    version: "1.0.962",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Chart Hits → Band Health: Songs in the Top 10 combined chart now boost morale, reputation, and fan sentiment. #1 = massive boost (+15/+10/+12), Top 5 = strong (+8/+5/+8), Top 10 = moderate (+4/+3/+5)" },
      { type: 'feature', description: "Major Event Performance → Band Health: Completing major events (festivals, award shows) now updates morale, reputation, and sentiment based on performance rating. Great performances (85+) give big boosts; poor ones (<55) cause penalties" },
      { type: 'improvement', description: "Chart boost logic runs after all chart entries are calculated, using the combined chart's Top 10 to identify benefiting bands in a single batch query" },
      { type: 'improvement', description: "Major event band update now fetches morale/reputation/sentiment alongside existing stats in one query for efficient single-transaction updates" },
    ],
  },
  {
    version: "1.0.961",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Rehearsal → Morale: Completing rehearsals now boosts band morale (+2 for 1hr, +3 for 2hr, +4 for 3hr+), rewarding bands that practice together" },
      { type: 'feature', description: "Song Release → Reputation: Albums boost public reputation by +5, singles by +2 — releasing music actively builds your public image" },
      { type: 'feature', description: "Song Release → Morale: Albums boost band morale by +6, singles by +3 — the excitement of putting out new music" },
      { type: 'improvement', description: "Release manufacturing now updates reputation and morale alongside existing sentiment/media effects in a single transaction" },
    ],
  },
  {
    version: "1.0.960",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Rider Fulfillment → Morale: After each gig, band's default rider is checked against venue tier. Fulfilled rider grants +5 morale, unmet rider costs -5 morale" },
      { type: 'feature', description: "Salary Affordability → Morale: Daily check if band can afford member salaries. Broke bands lose -2 to -4 morale/day; financially healthy bands gain +1/day" },
      { type: 'improvement', description: "Rider fulfillment uses venue capacity as proxy for tier (small <300, medium <1000, large <5000, arena 5000+) matched against rider tier" },
      { type: 'improvement', description: "Salary morale check runs before morale drift in daily updates, so financial stress compounds before natural normalization" },
    ],
  },
  {
    version: "1.0.959",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Morale → Drama Trigger: Low morale (<30) increases random event chance from 1-in-15 to as high as 1-in-6, making miserable bands drama magnets" },
      { type: 'feature', description: "High Morale Shield: Euphoric bands (>75 morale) have reduced random event chance (up to 1-in-20), protecting them from drama" },
      { type: 'feature', description: "Scandal → Morale Impact: Scandals now reduce band morale by 12, controversies by 8, creating a self-reinforcing downward spiral" },
      { type: 'improvement', description: "Pre-fetched band morale for all active players in trigger-random-events for efficient batch processing" },
    ],
  },
  {
    version: "1.0.958",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Morale → Gig Performance: Fame gained and fan conversion now scaled by band morale (0.7x miserable → 1.2x euphoric)" },
      { type: 'feature', description: "Morale → Recording Quality: Studio session quality improvement scaled by morale creativity modifier (0.8x → 1.15x)" },
      { type: 'feature', description: "Post-Gig Morale Update: Amazing shows boost morale +8, terrible shows drop it -10, creating a natural feedback loop" },
      { type: 'improvement', description: "Gig completion now reads and updates band morale in the same transaction for consistency" },
    ],
  },
  {
    version: "1.0.957",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Reputation → Gig Offers: Toxic bands (-40 rep) have 30% of offers rejected; payout scaled 0.7x (toxic) to 1.3x (iconic)" },
      { type: 'feature', description: "Reputation → Sponsorships: Match score now includes reputation modifier (0.3x toxic → 1.5x iconic), making toxic bands nearly unsponsorable" },
      { type: 'feature', description: "Reputation → Label Scouting: NPC label scout chance scaled by reputation — toxic bands get 80% fewer scouts, beloved bands get 30% more" },
      { type: 'improvement', description: "Gig offers, sponsorship offers, and NPC scouting now all fetch band reputation_score for decision-making" },
    ],
  },
  {
    version: "1.0.956",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Added reputation_score and morale columns to bands table — health systems now persist properly instead of relying on type casts" },
      { type: 'feature', description: "Band Morale Drift: Morale drifts ±1/day toward baseline (50), preventing permanent extremes" },
      { type: 'feature', description: "Band Reputation Drift: Reputation drifts ±0.5/day toward neutral (0), extreme reputations slowly normalize" },
      { type: 'improvement', description: "Daily updates now process morale and reputation drift before cross-system feedback for correct ordering" },
    ],
  },
  {
    version: "1.0.955",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Cross-system feedback loops: The 4 health pillars (Sentiment, Media, Reputation, Morale) now influence each other daily — toxic rep erodes sentiment, fan devotion boosts morale, media spotlight amplifies reputation (positive or negative)" },
      { type: 'feature', description: "Downward spiral detection: When 3+ systems are in crisis, decline accelerates across all metrics" },
      { type: 'feature', description: "Virtuous cycle detection: When 3+ systems are thriving, all metrics get a small daily bonus" },
      { type: 'improvement', description: "Band Health Dashboard now shows active feedback triggers explaining why metrics are shifting" },
    ],
  },
  {
    version: "1.0.954",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Band Health Dashboard: New consolidated card showing all 4 health metrics (Sentiment, Media Cycle, Public Image, Morale) with color-coded status bars and overall health percentage" },
      { type: 'feature', description: "Critical alerts: Dashboard highlights metrics in critical state with a warning banner" },
      { type: 'improvement', description: "Band overview now uses a 3-column layout on desktop: Health Dashboard + Sentiment + Media Cycle side by side" },
    ],
  },
  {
    version: "1.0.953",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Expanded Fan Sentiment model: Added radioEngagementMod (0.7–1.3x), videoViewsMod (0.6–1.4x), and followerGrowthMod (0.6–1.4x) to FanSentiment interface" },
      { type: 'improvement', description: "Fan Sentiment Widget now shows all 7 impact categories: Merch, Tickets, Streams, Radio, Video, Followers, and Viral chance" },
      { type: 'improvement', description: "Widget uses distinct icon colors per category for quick visual scanning" },
    ],
  },
  {
    version: "1.0.952",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Sentiment → Ticket Sales: Daily ticket demand now scaled 0.6x (hostile) to 1.4x (fanatical) based on band fan sentiment" },
      { type: 'feature', description: "Sentiment → Organic Followers: Twaater organic follower growth now scaled 0.6x–1.4x by band sentiment score" },
      { type: 'improvement', description: "Ticket sales simulation pre-fetches band sentiment in batch for efficiency" },
      { type: 'improvement', description: "Organic follower calculation includes sentiment in target follower formula for band-owned accounts" },
    ],
  },
  {
    version: "1.0.951",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Radio Sentiment Integration: Radio plays now boost fan sentiment for bands with significant listener reach (1k+ listeners)" },
      { type: 'feature', description: "Video Sentiment Integration: Music video views now affect sentiment — viral videos give +5 sentiment boost with increased viral chance for popular bands" },
      { type: 'improvement', description: "Sentiment-based engagement modifiers: Radio listener engagement scaled 0.7x–1.3x and video views scaled 0.6x–1.4x based on fan sentiment" },
      { type: 'improvement', description: "All radio and video sentiment events batch-logged to band_sentiment_events for timeline visibility" },
    ],
  },
  {
    version: "1.0.950",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Sentiment Trend Chart: Band overview now shows an area chart visualizing sentiment score over time from logged events" },
      { type: 'feature', description: "Daily Drift Logging: Band sentiment daily drift now logs events to band_sentiment_events with batch inserts for efficiency" },
      { type: 'improvement', description: "Band overview layout: Trend chart and event log displayed side-by-side on desktop for better monitoring" },
      { type: 'improvement', description: "Chart includes zero reference line, tooltips with event type and change values, and gradient fill" },
    ],
  },
  {
    version: "1.0.949",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Sentiment Event Logging: All 8 sentiment sources now log events to band_sentiment_events — PR, Twaater, scandals, charts, releases, music videos, gig results, and cancellations" },
      { type: 'feature', description: "Each logged event records sentiment change, media intensity change, fatigue change, resulting score, source function, and human-readable description" },
      { type: 'improvement', description: "Gig execution and cancellation hooks now insert sentiment events client-side for immediate timeline visibility" },
      { type: 'improvement', description: "Edge functions (6 total) updated to insert into band_sentiment_events after every sentiment/media modification" },
    ],
  },
  {
    version: "1.0.948",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Sentiment Event History: New band_sentiment_events table tracks every sentiment/media change with event type, source, and timestamp" },
      { type: 'feature', description: "Sentiment Event Log UI: Band overview now shows a scrollable timeline of recent sentiment events with icons, change values, and relative timestamps" },
      { type: 'improvement', description: "RLS policies on sentiment events — players can only view events for their own bands" },
      { type: 'improvement', description: "Event log displays sentiment change, media intensity change, and time-ago for each event with color-coded indicators" },
    ],
  },
  {
    version: "1.0.947",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Fan Sentiment → Merch Sales: Daily merch sales now scaled by sentiment demand modifier (0.5x hostile → 1.5x fanatical fans)" },
      { type: 'feature', description: "Media Intensity → Gig Offer Payouts: Higher media coverage increases gig offer payouts (0.8x dormant → 1.2x peak media)" },
      { type: 'feature', description: "Fan Sentiment → Ticket Pricing: Gig offers now factor in fan demand for dynamic ticket pricing (0.6x → 1.4x based on mood)" },
      { type: 'improvement', description: "Merch simulation fetches band sentiment in batch before processing, minimizing extra DB queries" },
    ],
  },
  {
    version: "1.0.946",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Twaater Posts → Sentiment + Media: Each social media post grants +3 fan sentiment and +3 media intensity to the poster's band" },
      { type: 'feature', description: "Scandal Events → Sentiment Crash: Random scandal/controversy events now inflict -20 fan sentiment while boosting media intensity +40 (scandals generate buzz)" },
      { type: 'improvement', description: "Twaater outcome engine now resolves user → band membership to apply sentiment to the correct band" },
      { type: 'improvement', description: "Scandal media fatigue +20 ensures the negative coverage saturates outlets, limiting follow-up coverage effectiveness" },
    ],
  },
  {
    version: "1.0.945",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "PR Appearances → Sentiment + Media: TV appearances grant +4 sentiment/+18 media, radio/podcasts +3/+10, print +2/+8 — each with appropriate fatigue" },
      { type: 'feature', description: "Chart Hits → Sentiment + Media: Bands with high-quality songs on streaming charts get +12 sentiment and +15 media intensity boost" },
      { type: 'improvement', description: "PR media type-specific boosts: TV/radio/podcast/magazine/newspaper/online each have tuned sentiment and media values" },
      { type: 'improvement', description: "All new hooks respect media fatigue — oversaturated bands get reduced intensity gains from PR and chart performance" },
    ],
  },
  {
    version: "1.0.944",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Gig Cancellation → Sentiment: Cancelling shows now penalizes fan sentiment (-5 to -15 based on how last-minute the cancellation is)" },
      { type: 'feature', description: "Music Video → Sentiment + Media: Completed music videos grant +6 fan sentiment, +12 media intensity, and +6 media fatigue" },
      { type: 'improvement', description: "Sentiment penalties scale with cancellation timing — early cancellations are less punishing than day-of cancellations" },
      { type: 'improvement', description: "Media fatigue reduction applied to music video intensity gains — diminishing returns for frequent video releases" },
    ],
  },
  {
    version: "1.0.943",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Equipment Repair: Gear below 85% condition now shows a Repair button with cost estimate — restores to pristine and deducts from player balance" },
      { type: 'feature', description: "Release → Sentiment Hook: Album releases grant +10 fan sentiment and +30 media intensity; singles grant +5 sentiment and +15 media intensity" },
      { type: 'feature', description: "Release → Media Fatigue: Releasing music now increases media fatigue (+15 albums, +8 singles) — frequent releases give diminishing media returns" },
      { type: 'improvement', description: "Repair costs scale with condition gap (up to 40% of original price for full restoration)" },
    ],
  },
  {
    version: "1.0.942",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Band Sentiment Drift: Band-level fan_sentiment_score now drifts toward neutral daily (±0.5/day), matching profile-level drift" },
      { type: 'feature', description: "Idle Equipment Degradation: All player equipment loses 0.2–0.5 condition per day from storage wear, humidity, and aging — even without gigs" },
      { type: 'improvement', description: "Daily updates summary log now includes band sentiment drift and equipment degradation counts for monitoring" },
    ],
  },
  {
    version: "1.0.941",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Database Migration: Added fan_sentiment_score, media_intensity, media_fatigue columns to bands table; condition column to player_equipment_inventory" },
      { type: 'feature', description: "Fan Sentiment → Streaming: Daily stream calculations now multiplied by stream loyalty modifier (0.7x hostile → 1.3x fanatical fans)" },
      { type: 'improvement', description: "All simulation systems now have real database backing — values persist across sessions and are updated by gigs, daily processing, and streaming" },
      { type: 'improvement', description: "Band Overview widgets now read live data from the new DB columns instead of defaulting to zero" },
    ],
  },
  {
    version: "1.0.940",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Fan Sentiment → Gig Pipeline: Fan mood now directly modifies ticket demand (0.6x–1.4x) and merch sales (0.5x–1.5x) during live gig execution" },
      { type: 'feature', description: "Media Cycle → Gig Pipeline: Fame gained from gigs now scaled by media coverage multiplier (0.2x dormant → 2.0x peak attention)" },
      { type: 'feature', description: "Equipment Degradation → Gig Pipeline: All equipped player gear degrades after each gig based on category (drums -2.5, keyboards -0.8, etc.)" },
      { type: 'feature', description: "Post-Gig Media Boost: Gig completion triggers media intensity event, naturally pushing bands into 'building' or 'peak' media phases" },
      { type: 'feature', description: "Post-Gig Sentiment Shift: Amazing gigs (+8 sentiment) and bad gigs (-8 sentiment) now automatically adjust fan mood" },
      { type: 'improvement', description: "All new integrations use try/catch with graceful fallbacks — missing DB columns won't break gig execution" },
    ],
  },
  {
    version: "1.0.939",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "MyGear: Equipment condition badges now display on all owned inventory items — see Pristine/Good/Worn/Damaged/Broken status at a glance" },
      { type: 'feature', description: "Band Overview: Fan Sentiment widget integrated — see fan mood, merch/ticket/stream demand multipliers, and viral chance for your band" },
      { type: 'feature', description: "Band Overview: Media Cycle widget integrated — track media phase, intensity, fatigue, and coverage multiplier in real time" },
      { type: 'improvement', description: "Band overview now shows two simulation widgets side-by-side above the main stats tabs" },
      { type: 'improvement', description: "Graceful fallbacks for bands without sentiment/media data (defaults to neutral/dormant)" },
    ],
  },
  {
    version: "1.0.938",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Equipment Condition Widget: Visual gear health display with condition bar, performance modifier, breakdown chance, and repair cost estimate" },
      { type: 'feature', description: "Fan Sentiment Widget: Shows fan mood (Hostile→Fanatical) with merch/ticket/stream demand multipliers and viral chance indicator" },
      { type: 'feature', description: "Media Cycle Widget: Displays media phase (Dormant→Oversaturated), intensity/fatigue bars, coverage multiplier, and phase shift countdown" },
      { type: 'feature', description: "Compact mode for all three widgets — badges and inline progress bars for space-constrained layouts" },
      { type: 'improvement', description: "All widgets use design system tokens and consistent 10px data-dense styling matching existing world widgets" },
    ],
  },
  {
    version: "1.0.937",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Equipment Degradation (server): Stage equipment now degrades per gig based on type (drums 2.5/gig, keyboards 0.8/gig) — condition affects performance quality" },
      { type: 'feature', description: "Media Cycle Decay (server): Daily processing decays media intensity (-3/day) and fatigue (-1.5/day) creating natural attention cycles" },
      { type: 'feature', description: "Fan Sentiment Drift (server): Daily processing drifts extreme fan sentiment scores toward neutral (-0.5/day)" },
      { type: 'feature', description: "Media Intensity Boost (server): Gig completion now increases media intensity based on performance rating (5-15 points)" },
      { type: 'improvement', description: "Equipment degradation applies per-category rates with ±20% random variance for realism" },
      { type: 'improvement', description: "All new server-side integrations use try/catch with graceful fallbacks for missing DB columns" },
    ],
  },
  {
    version: "1.0.936",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Eliminated duplicate GoTrueClient warning — consolidated all Supabase imports to single client instance" },
      { type: 'feature', description: "Equipment Degradation System: Gear wears down per gig (drums 2.5/gig, keyboards 0.8/gig) affecting performance quality and breakdown risk" },
      { type: 'feature', description: "Fan Sentiment System: Tracks how fans *feel* beyond numbers (-100 to 100) — affects merch demand, ticket demand, streaming loyalty, and viral chances" },
      { type: 'feature', description: "Media Cycle System: Media attention follows hype → peak → decline → dormant phases with fatigue mechanics (oversaturation reduces coverage effectiveness)" },
      { type: 'improvement', description: "Equipment repair costs scale with condition gap (up to 40% of original price for full restoration)" },
      { type: 'improvement', description: "Media fatigue reduces intensity gains — spamming releases gives diminishing returns on coverage" },
      { type: 'improvement', description: "Fan sentiment drifts toward neutral daily; extreme goodwill/hostility requires maintenance" },
    ],
  },
  {
    version: "1.0.935",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Gig Pipeline Integration: Weather now directly affects attendance (outdoor storms -60%, indoor rain +8%) and merch sales in real gig execution" },
      { type: 'feature', description: "Tour Fatigue in Gig Pipeline: Consecutive gigs apply fatigue modifier (1.05x fresh → 0.6x burnout) to every song performance score" },
      { type: 'feature', description: "Tour Fatigue Widget: Visual energy bar with fatigue level, injury risk, morale hit, and rest recommendations" },
      { type: 'feature', description: "Rivalry Widget: RivalryBadge and RivalryCard components showing rivalry intensity, fan/media/chart boosts, and drama risk" },
      { type: 'improvement', description: "Gig execution now fetches recent gig dates and venue type in parallel with existing queries (no extra latency)" },
      { type: 'improvement', description: "Deterministic weather selection per city per day ensures consistent gig weather across sessions" },
    ],
  },
  {
    version: "1.0.934",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Weather → Gig Impact: Weather now affects gig attendance (outdoor sunny +15%, stormy -60%), crowd mood, and merch sales with indoor/outdoor venue distinction" },
      { type: 'feature', description: "Band Rivalry System: Bands competing in the same genre/city develop rivalries (budding → legendary) — boosting fan engagement (+25%), media coverage (+30%), and chart competition" },
      { type: 'feature', description: "Tour Fatigue Mechanics: Consecutive gigs without rest degrade performance (fresh 1.05x → burnout 0.6x) with escalating injury risk and morale damage" },
      { type: 'improvement', description: "Rivalry detection auto-evaluates genre match, fame parity, and shared city activity to seed natural rivalries" },
      { type: 'improvement', description: "Fatigue system counts consecutive gig dates and calculates rest days needed for recovery (1-4 days)" },
      { type: 'improvement', description: "Weather gig impact differentiates indoor venues (rain boosts attendance) vs outdoor (rain devastates)" },
    ],
  },
  {
    version: "1.0.933",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "World Pulse: Genre Trends tab — see which genres are Hot 🔥 or Cold ❄️ with real-time trend scores" },
      { type: 'feature', description: "World Pulse: City Economies tab — view all major cities' economic phases with earnings/cost/tourism multipliers" },
      { type: 'feature', description: "UI Components: GenreTrendsWidget, CityEconomyCard, CityEconomyBadge, ReputationMoralePanel created for reuse across pages" },
      { type: 'improvement', description: "World Pulse now has 5 tabs: Trending, Genre Trends, City Economies, Charts, Activity" },
    ],
  },
  {
    version: "1.0.932",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Genre Trends → Streaming: Daily streams now multiplied by genre trend score (0.5x–1.5x) — hot genres earn more, cold genres less" },
      { type: 'feature', description: "Seasonal Streaming: Winter +25% streams (indoor listening), Summer -10% (outdoor season), Spring/Autumn moderate boosts" },
      { type: 'feature', description: "City Economy → Gig Earnings: Ticket revenue and merch sales now scale with city economic phase (boom 1.35x, recession 0.8x, depression 0.6x)" },
      { type: 'feature', description: "Fan Loyalty Decay (server): Daily processing now applies fan churn to inactive bands — 2%/day casual loss after 7-day grace period" },
      { type: 'feature', description: "Reputation Drift (server): Daily processing drifts extreme reputation scores toward neutral (-0.5/day positive, +0.5/day negative)" },
      { type: 'improvement', description: "Streaming includes band genre lookup for per-release trend multiplier application" },
      { type: 'improvement', description: "Gig completion logs city economy phase and multiplier for debugging" },
      { type: 'improvement', description: "Fan decay respects fame protection: 10k+ fame = 30% slower decay, 5k+ = 20%, 1k+ = 10%" },
    ],
  },
  {
    version: "1.0.931",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Public Image System: Reputation score (-100 to 100) with 6 tiers from Toxic to Iconic — gates sponsorships, media access, and label deals" },
      { type: 'feature', description: "Mentorship Progression: Experienced players mentor newer ones — mentor earns fame/XP, mentee gets up to 1.5x XP and +25% skill growth" },
      { type: 'feature', description: "Band Morale Mechanics: 0-100 morale score affected by events, pay, drama — low morale reduces performance (0.7x), increases drama/leave risk" },
      { type: 'feature', description: "Seasonal Gameplay Modifiers: Seasons boost genre popularity (e.g., Reggae +30% summer), outdoor gig attendance, streaming, and merch demand" },
      { type: 'feature', description: "Achievement Rewards: Achievements now grant tangible rewards — Common ($100/50XP) to Legendary ($50k/10kXP/1k fame) with category bonuses" },
      { type: 'improvement', description: "Reputation drifts daily toward neutral — scandals fade but so does goodwill without maintenance" },
      { type: 'improvement', description: "Band morale uses weighted average — lowest member drags the band down (30% weight)" },
      { type: 'improvement', description: "Mentorship requires level 15+ and at least one Professional-tier skill to qualify as mentor" },
    ],
  },
  {
    version: "1.0.930",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Genre Trend System: Genres now rise and fall in popularity on ~90-day cycles, affecting streams, fan conversion, and chart weight" },
      { type: 'feature', description: "Music Video Impact Pipeline: Completed videos now cascade fame, streaming boosts (+5-30%), chart points, and hype to the parent song" },
      { type: 'feature', description: "Cross-Band Collaborations: Bands with member friendships can create featured songs with shared fame, fan crossover (5-15%), and chart bonuses" },
      { type: 'feature', description: "Fan Loyalty Decay: Inactive bands lose casual fans (2%/day), dedicated fans downgrade (0.5%/day) after 7-day grace period; fame slows decay" },
      { type: 'feature', description: "Dynamic City Economy: Cities cycle through boom/growth/stable/recession/depression phases affecting gig earnings (0.6x-1.35x) and merch sales" },
      { type: 'improvement', description: "Genre trends are deterministic per genre+day — same player sees same trends, enabling shared meta-strategy" },
      { type: 'improvement', description: "City economies include tourism attendance bonuses during boom periods (+25% crowd)" },
      { type: 'improvement', description: "Collaboration eligibility requires cross-band friendships — encourages social gameplay" },
    ],
  },
  {
    version: "1.0.929",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Housing Buffs: Properties and rentals now affect energy recovery, health regen, and songwriting creativity based on tier" },
      { type: 'feature', description: "Wellness Habits: Completing habits now boosts health and energy stats (fitness +3 HP/+3 EN, mental +2 HP/+4 EN, etc.)" },
      { type: 'feature', description: "Crime Pipeline: Underworld drug purchases now roll for arrest — chance affected by city drug policy and player fame" },
      { type: 'feature', description: "Tattoo Buffs: Tattoos now provide fame bonuses (+2/tattoo), performance multiplier (+1% per 3), and sleeve completion bonuses" },
      { type: 'feature', description: "Mayor Law Effects: City laws now mechanically affect income tax, sales tax, travel fees, genre restrictions, and busking fees" },
      { type: 'feature', description: "Clothing Gig Bonus: Genre-matched clothing worn at gigs now boosts fan conversion (+5%/item) and merch sales (+3%/item)" },
      { type: 'improvement', description: "Song quality verified cascading through write → record → mix → master → release pipeline via recording sessions" },
      { type: 'improvement', description: "Homeless players get debuffs: -25% energy recovery, -2 health/day, -10 creativity" },
      { type: 'improvement', description: "Arrest results show bail amount, sentence length, and fame impact in toast notification" },
    ],
  },
  {
    version: "1.0.928",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Narrative Events: Created story_states and story_choices database tables — narrative branching now persists player progress" },
      { type: 'feature', description: "Talent Discovery: Created casting_calls, casting_call_roles, casting_submissions, and casting_reviews tables with RLS policies" },
      { type: 'feature', description: "Jam Sessions: Added interactive jam gameplay — 5 timed rounds of musical decisions that award XP and band chemistry" },
      { type: 'feature', description: "DikCok: Implemented virality algorithm — trending now ranks by view velocity, engagement rate, band fame, and time decay" },
      { type: 'improvement', description: "DikCok: Videos now decay from trending over ~18hr half-life; challenge videos get 1.3x boost; category multipliers affect ranking" },
      { type: 'improvement', description: "Jam Sessions: Groove meter tracks collaborative decisions; high groove awards chemistry bonuses to bands" },
      { type: 'fix', description: "Confirmed Sponsorship offer generation and Festival performance pipelines are fully wired (Items 16 & 17 verified)" },
    ],
  },
  {
    version: "1.0.927",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Side Hustles: Removed @ts-nocheck, fixed isLoading→isPending on mutation button" },
      { type: 'fix', description: "Labels API: Fixed import from deprecated supabase-client to standard client, added type safety for missing revenue columns" },
      { type: 'feature', description: "Busking: City-aware locations — spots now change based on player's current city (London, NYC, Tokyo, Paris, Berlin + fallback)" },
      { type: 'feature', description: "Teaching: Server-side XP processing — new edge function processes expired teaching sessions and awards XP via progression system" },
      { type: 'improvement', description: "Busking: Each city has 3 unique themed locations with lore-appropriate descriptions and reward scaling" },
      { type: 'improvement', description: "Teaching: XP now routed through progression edge function for proper validation and wallet integration" },
    ],
  },
  {
    version: "1.0.926",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Underworld crypto payments now functional — deducts tokens from player_token_holdings instead of throwing error" },
      { type: 'fix', description: "Admin Release Config now persists to game_config database table (was a no-op)" },
      { type: 'fix', description: "Merchandise player level now reads from actual profile instead of hardcoded level 10" },
      { type: 'fix', description: "Tour support artist picker now checks schedule availability against tour dates" },
      { type: 'improvement', description: "Support artist picker shows Available/Busy badges based on scheduling conflicts" },
      { type: 'improvement', description: "Created game_config table with RLS for admin-managed settings" },
    ],
  },
  {
    version: "1.0.925",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Teaching: Self-teaching prevention — players can no longer teach themselves" },
      { type: 'fix', description: "Teaching: Friendship validation — only accepted friends can be taught" },
      { type: 'fix', description: "Teaching: Max student cap enforced — Basic/Professional limited to 1 active student, Mastery to 2" },
      { type: 'fix', description: "Teaching: Duplicate session prevention — can't start two sessions for same skill+student combo" },
      { type: 'fix', description: "Teaching: XP calculation now deterministic based on teacher skill level (not random)" },
      { type: 'feature', description: "Teaching: Session cancellation with confirmation dialog" },
      { type: 'feature', description: "Teaching: Auto-completion of expired sessions on page load" },
      { type: 'feature', description: "Teaching: Progress bar and time remaining display for active sessions" },
      { type: 'feature', description: "Teaching: XP preview before starting a session shows per-day and total XP" },
      { type: 'feature', description: "Teaching: Real-time validation errors shown before submit" },
      { type: 'improvement', description: "Teaching: Loading states for friends and sessions data" },
      { type: 'improvement', description: "Teaching: Skill selector shows current level, sorted by highest" },
      { type: 'improvement', description: "Teaching: Role badges (Teaching/Learning) on session cards" },
      { type: 'improvement', description: "Teaching: Cancelled sessions shown separately in History tab" },
      { type: 'improvement', description: "Teaching: Tier comparison cards in unlocked state with university XP comparison" },
    ],
  },
  {
    version: "1.0.924",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Teaching skill tree — 3 tiers (Basic, Professional, Mastery) unlock ability to teach skills to friends" },
      { type: 'feature', description: "Player-to-player teaching sessions — teach any skill you know to a friend for 1-7 days" },
      { type: 'feature', description: "Teaching XP exceeds university: students earn 50-120 XP/day, teachers earn 30-60 XP/day (vs university's 15-95)" },
      { type: 'feature', description: "Teaching page with Teach, Active Sessions, and History tabs" },
      { type: 'feature', description: "Mastery Teaching tier unlocks group teaching (2 students simultaneously)" },
      { type: 'improvement', description: "Teaching added as schedulable activity type in the calendar system" },
      { type: 'improvement', description: "Navigation: Teaching entry added under Music section next to Education" },
    ],
  },
  {
    version: "1.0.923",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Daily AP hard-capped at 50 total — stipend claim capped at 30 AP, activity bonus capped at 20 AP" },
      { type: 'fix', description: "Streak milestone AP rewards reduced: 7d→+2, 14d→+3, 30d→+5, 100d→+8, 365d→+12 (was 10/20/40/100/200)" },
      { type: 'fix', description: "Base daily stipend AP reduced from 3-10 to 2-8 with same decay curve" },
      { type: 'fix', description: "Activity-derived AP now capped at 20/day (was uncapped)" },
    ],
  },
  {
    version: "1.0.922",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Player-purchased clothing now appears in avatar wardrobe — clothing marketplace purchases are queryable from the avatar system" },
      { type: 'feature', description: "Genre-matched clothing gig bonuses — wearing clothing that matches a gig's genre provides +5% fan interaction and +3% merch sales per matched item (caps at 3 items)" },
      { type: 'feature', description: "Exclusive modeling gig types: Editorial (requires Professional Styling ≥200) and Fashion Week (requires Professional Fashion Fundamentals ≥300)" },
      { type: 'feature', description: "XP rewards for clothing activities: 30-80 XP for creating items (scales with quality), 10 XP per sale, 30-80 XP per modeling gig (varies by type)" },
      { type: 'improvement', description: "Modeling gig completion now awards skill-specific XP to the relevant modeling skill (e.g., runway gigs → modeling_basic_runway)" },
      { type: 'improvement', description: "Shopping addiction already tracked in conditionSystem — clothing purchases now contribute to shopping addiction trigger checks" },
    ],
  },
  {
    version: "1.0.921",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Player Clothing Brand system — create your own fashion brand with name, genre focus, and track reputation, revenue, and total sales" },
      { type: 'feature', description: "Clothing Designer page — design and list clothing items with quality and style scores calculated from Fashion & Clothing Design skills" },
      { type: 'feature', description: "Clothing Shop marketplace — browse, filter, and purchase player-designed clothing by category, genre, and search" },
      { type: 'feature', description: "6 clothing categories (tops, bottoms, outerwear, shoes, accessories, hats) with 10 genre styles matching in-game music genres" },
      { type: 'feature', description: "Quality/Style scoring system — quality from Construction + Textile + Pattern skills, style from Aesthetics + Genre + Fundamentals skills" },
      { type: 'feature', description: "Rarity system derived from quality: Common (0-30), Uncommon (31-50), Rare (51-70), Epic (71-85), Legendary (86-100)" },
      { type: 'improvement', description: "Database tables: player_clothing_brands, player_clothing_items, player_clothing_purchases with full RLS policies" },
      { type: 'improvement', description: "Fashion Designer tile added to Career Hub navigation alongside Modeling" },
    ],
  },
  {
    version: "1.0.920",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Education seeding — 16 new skill books for modeling, fashion design, and clothing design skills with unique authors and progression-appropriate pricing" },
      { type: 'feature', description: "8 new legendary mentors: Naomi Fierce (London, posing), Karl Stein (Paris, fashion theory), Valentina Rossi (Milan, textiles), Alexander Wu (Tokyo, construction), Tyra LaRue (NYC, runway), Isabella Fontaine (Paris, styling), Marcus Blackwell (LA, branding), Yuki Shimada (Seoul, genre aesthetics)" },
      { type: 'feature', description: "20 new university courses across London, Milan, and Seoul — covering modeling fundamentals through advanced garment engineering and brand management" },
      { type: 'improvement', description: "All 45 modeling/fashion/clothing skill slugs registered in skill_definitions table for book FK compatibility" },
    ],
  },
  {
    version: "1.0.919",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Modeling skill tree — 18 new skills across 6 tracks (Posing, Runway, Camera, Commercial, Editorial, Brand) with Basic→Professional→Mastery progression" },
      { type: 'feature', description: "Fashion Design skill tree — 15 new skills (Fundamentals, Textiles, Patterns, Style, Business) gated behind modeling_basic_posing ≥100" },
      { type: 'feature', description: "Clothing Design skill tree — 12 new skills (Construction, Branding, Genre Aesthetics, Retail) gated behind fashion_basic_fundamentals ≥250" },
      { type: 'improvement', description: "Modeling career tiers now require specific skill levels: Amateur needs Basic Posing ≥50, Rising needs Basic Runway ≥100, Established needs Pro Posing ≥250, Supermodel needs Pro Runway ≥400, Fashion Icon needs Posing Mastery ≥650" },
      { type: 'improvement', description: "Modeling offers are now filtered by gig-type skill requirements (runway gigs need runway skills, cover shoots need camera skills, etc.)" },
      { type: 'improvement', description: "Career tier progress now shows skill requirement bars with lock icons for unmet requirements" },
    ],
  },
  {
    version: "1.0.918",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Player Producer Career — players with Record Production skills can register as producers, set hourly rates, and earn XP + cash when hired for recording sessions" },
      { type: 'feature', description: "Producer career page with dashboard (sessions, earnings, XP, rating), profile settings, skill impact display, and session history" },
      { type: 'feature', description: "Producer selector in recording wizard now has NPC/Player/All toggle filter — player producers must be in the same city as the studio" },
      { type: 'feature', description: "Player Producer Cards show player name, level, session count, and average rating with a 🎮 Player Producer badge" },
      { type: 'feature', description: "Producer session reviews — clients can rate player producers 1-5 stars after completed sessions, with auto-averaging" },
      { type: 'improvement', description: "Quality bonus calculated from Record Production, Mixing, DAW, Composing, and Music Theory skills (capped at 25%, below legendary NPC's 30%)" },
      { type: 'improvement', description: "Producing XP rewards: base 50/hr + quality bonuses (up to +100 XP for 900+ quality) + 20% genre match bonus" },
    ],
  },
  {
    version: "1.0.917",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Player Conditions System — unified tracking for injuries (sprained wrist, vocal strain, concussion), sicknesses (flu, food poisoning, tropical fever), and mental health (depression, anxiety, burnout, insomnia)" },
      { type: 'feature', description: "Travel Hazards — travel now carries risk of injury/sickness based on transport mode (Bus 4%, Plane 1.5%, Private Jet 0.5%), distance, and lifestyle behavior settings" },
      { type: 'feature', description: "Expanded Mental Health — depression boosts songwriting quality (+10%) but reduces XP; anxiety penalizes gig scores; burnout blocks all gigs; insomnia reduces rest effectiveness by 50%" },
      { type: 'feature', description: "New Conditions tab on Wellness page with severity bars, treatment options (Hospital, Therapy, Medication, Rest), and estimated recovery timers" },
      { type: 'feature', description: "13 travel hazard & mental health random events seeded — Food Poisoning Abroad, Bus Accident, Touring Burnout, Performance Anxiety, Insomnia Hits, and more" },
      { type: 'improvement', description: "Hospital now accepts check-in for injuries/sickness (not just health < 30) with condition-linked admission records" },
      { type: 'improvement', description: "Health activity checks now factor in blocking conditions (vocal strain blocks singing, sprained wrist blocks guitar, etc.)" },
      { type: 'improvement', description: "Added 'shopping' addiction type triggered by excessive gear purchases; active addictions now increase mental health condition risk" },
      { type: 'improvement', description: "Complete-travel edge function now rolls for travel hazards on arrival, creating conditions and inbox notifications" },
    ],
  },
  {
    version: "1.0.916",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Added Tattoos to the Character section in both sidebar and horizontal navigation with Palette icon" },
      { type: 'improvement', description: "Added tattoo translations for all 7 languages (EN, ES, FR, DE, IT, PT, TR)" },
    ],
  },
  {
    version: "1.0.915",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Seeded 46 tattoo parlours across 30 cities worldwide with quality tiers 1-5, ranging from elite studios (Sunset Strip, Shibuya Irezumi Masters) to sketchy basement shops (Tepito Ink Den, Hackney Back Alley Ink)" },
      { type: 'feature', description: "Seeded 60+ named tattoo artists with unique bios, nicknames, specialties, fame levels (5-96), and quality bonuses — scaled to parlour tier" },
      { type: 'improvement', description: "Tier 5 parlours feature Legendary artists (fame 70-96) who accept custom commissions; Tier 1 parlours have Apprentice artists with minimal bonuses" },
    ],
  },
  {
    version: "1.0.914",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Text Tattoo System — type custom text (band names, lyrics, quotes, dates) and choose from 8 font styles: Gothic, Elegant Script, Typewriter, Bold Caps, Minimal, Graffiti, Old English, and Brush Stroke" },
      { type: 'feature', description: "Font style picker with live preview showing your text rendered in each font before committing" },
      { type: 'feature', description: "Font-based pricing: each style has a unique price modifier (0.8x–1.5x), with Brush Stroke and Old English being premium options" },
      { type: 'feature', description: "Text tattoos have genre affinities — Hip Hop +5%, Punk +3%, Rock +2% with penalties to Classical and Pop" },
      { type: 'improvement', description: "Body map now shows 'Aa' marker for text tattoos instead of checkmark" },
      { type: 'improvement', description: "My Tattoos section displays custom text with font styling for text-based tattoos" },
    ],
  },
  {
    version: "1.0.913",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Tattoo Artist Reputation System — each parlour now has named artists with fame levels (1-100), specialties, quality bonuses, and price premiums" },
      { type: 'feature', description: "Artist fame tiers: Apprentice (1-20), Journeyman (21-45), Skilled (46-70), Master (71-90), Legendary (91-100) — higher tiers give better quality and accept custom commissions" },
      { type: 'feature', description: "Custom tattoo design commissions — book famous artists (fame 46+) for bespoke designs with description input, body slot selection, and instant completion with +10% quality boost" },
      { type: 'feature', description: "Artist specialty matching — selecting an artist whose specialty matches the tattoo category gives +5 bonus quality, shown with 'Artist Specialty' badge on design cards" },
      { type: 'improvement', description: "Parlour shop flow now includes artist selection step with fame bars, quality/price indicators, and 'Book Custom' buttons" },
      { type: 'improvement', description: "New 'Custom Designs' tab in Tattoo Parlour showing commission history with status, description, and quality results" },
    ],
  },
  {
    version: "1.0.912",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Tattoo Parlour System — visit city parlours (1-5 star quality tiers) to get tattoos on 13 body slots including full sleeve building (5 slots per arm)" },
      { type: 'feature', description: "Tattoos provide genre-based performance modifiers — skull/tribal boost Rock/Metal (+5-9%), penalize Pop/Classical (-3-9%); musical notes boost all genres; quality scales the effect" },
      { type: 'feature', description: "Infection risk system — cheap parlours have up to 30% infection chance; infections drain -5 health/day and -3% performance until treated ($200) or 7-day natural heal" },
      { type: 'feature', description: "Interactive SVG body map showing tattoo placement, quality color-coding, and sleeve completion progress (Left/Right arm: X/5)" },
      { type: 'feature', description: "3D avatar tattoo rendering — player tattoos from database render as per-slot mesh patterns on the avatar body with quality-based opacity" },
      { type: 'improvement', description: "Tattoo Parlour added to Character Hub navigation" },
    ],
  },
  {
    version: "1.0.911",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Stage Behavior and Lifestyle Risks are now on separate sub-tabs within the Lifestyle section for clearer navigation" },
    ],
  },
  {
    version: "1.0.910",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Stage behavior now recorded on gig outcomes — post-gig reports display which behavior was active with modifier badges showing fame, fan, crowd, chemistry, variance, and score impacts" },
      { type: 'feature', description: "Behavior fame and fan conversion multipliers now fully applied during gig execution — aggressive/legendary/provocateur styles boost fame; friendly/nervous/enigmatic boost fan conversion" },
      { type: 'feature', description: "Automated behavior unlock checker runs after every gig — unlocks Legendary (5k fame), Enigmatic (50 gigs), Chaotic (Stage Presence 15+), Virtuoso (Level 20), Provocateur (10k fame), Zen (100 gigs)" },
      { type: 'improvement', description: "Edge function crowd response thresholds now factor in behavior crowd engagement multiplier for parity with client-side calculations" },
      { type: 'improvement', description: "Gig execution return object includes stageBehavior for downstream UI consumption" },
    ],
  },
  {
    version: "1.0.909",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Stage Behavior System — players can choose from 6 starter performance styles (Standard, Aggressive, Confident, Arrogant, Friendly, Nervous) each with unique pros/cons affecting gig scores, fame, chemistry, variance, crowd engagement, and momentum" },
      { type: 'feature', description: "6 unlockable advanced behaviors (Legendary, Enigmatic, Chaotic, Virtuoso, Provocateur, Zen) earned through fame milestones, gig count, skill mastery, and player level" },
      { type: 'improvement', description: "Stage behavior modifiers integrated into both client-side and edge function performance calculators — affects base score, variance, chemistry, crowd response thresholds, event chances, fame/fan multipliers, and opening song penalties" },
      { type: 'feature', description: "New Stage Behavior selector UI in Lifestyle Settings with expandable pros/cons cards, quick modifier badges, and locked/unlocked states for advanced behaviors" },
    ],
  },
  {
    version: "1.0.908",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Fixed fullscreen gig viewer in mobile review modal by forcing the dialog container to true viewport size (inset-0, w-screen, h-screen, no transform offsets)" },
    ],
  },
  {
    version: "1.0.907",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Fixed gig viewer rendering as a thin line — added relative positioning to inner zoom container so absolute-positioned stage/crowd sections display at full height" },
    ],
  },
  {
    version: "1.0.906",
    date: "2026-03-08",
    changes: [
      { type: 'improvement', description: "Gig viewer now launches in full-screen mode (fixed overlay covering entire viewport) for an immersive concert experience" },
    ],
  },
  {
    version: "1.0.905",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Admin Gig Viewer Demo — new admin page at /admin/gig-viewer-demo allows testing all viewer features with configurable venue type, genre, crowd mood, energy, intensity, momentum, and special effects without needing a live gig" },
      { type: 'feature', description: "Stage decor system — overhead truss rigs with par cans for larger venues, band name banners, side speaker stacks, amp/cabinet stacks behind band, stage floor tape marks, and cable run details" },
      { type: 'feature', description: "Crowd details layer — security guards in yellow vests, photographers with camera flashes in pit, crowd-held signs (WE ❤️ U, MARRY ME, etc), beach balls for festivals, glow sticks for EDM, visible merch t-shirts, and detailed front row" },
      { type: 'feature', description: "Stage front LED strip — animated multi-color LED strip along stage edge that pulses with song energy" },
      { type: 'improvement', description: "Equipment scale now properly converts from theme string values (minimal/standard/large/massive) to numeric multipliers" },
    ],
  },
  {
    version: "1.0.904",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "LED screen backdrops — arena/stadium venues now display animated equalizer bars, scrolling band name, and song title on LED backdrop with pixel grid and scan line effects. Stadium gets side info screens with scrolling text. Concert hall gets a smaller overhead screen." },
      { type: 'feature', description: "Sound visualization — animated sound wave rings emanate from speaker stacks, scaling with venue size and song energy. Bass vibration floor glow effect during high-energy moments. Monitor feedback glow at stage front." },
      { type: 'feature', description: "Venue ambience decorations — EXIT signs for indoor venues, neon 'OPEN MIC' sign for bars, band posters for rock clubs, string lights for indie venues, chandelier lights for concert halls, firework launcher racks for stadiums, festival flags, and arena spotlight rigs" },
      { type: 'feature', description: "Tiered seating sections — arena/stadium/concert hall venues now have side seating tiers with individual seated attendees that react to mood. Stadium adds rear upper-tier seating. Fill rate scales with attendance percentage." },
      { type: 'feature', description: "Performance milestones — visual celebration overlays trigger at score thresholds (OUTSTANDING at 18+ avg, LEGENDARY at 22+), maximum momentum (MAXIMUM HYPE!), and ecstatic crowd (CROWD GOES WILD!) with sparkle burst animations" },
      { type: 'improvement', description: "Stage now receives song title and band name props for screen display integration" },
      { type: 'improvement', description: "Average score tracking added for milestone threshold calculations" },
    ],
  },
  {
    version: "1.0.903",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Particle effects system — genre-driven sparks (orange/gold trails for rock/metal), confetti (colorful falling pieces for pop/latin), and smoke plumes (rising haze for hip-hop/trap) reactive to song energy" },
      { type: 'feature', description: "Stage pyrotechnics — flame jets erupt during ecstatic high-energy moments, CO2 cannon bursts, firework starbursts for high scores, and massive confetti cannon + golden shower effect during gig finale" },
      { type: 'feature', description: "Weather & atmosphere for outdoor venues — starfield with twinkling stars, moon, wind streaks for festivals, tree silhouettes, grass texture, distant city glow, and ambient haze layer" },
      { type: 'feature', description: "Song transition overlays — dimming effect with animated title card showing song number and name, with special ENCORE and FINAL SONG banners when applicable" },
      { type: 'feature', description: "Audience interaction effects — lighter/phone flashlight wave during ballads (with individual flame and screen glow), clapping hands, crowd chants ('ONE MORE SONG!'), singalong note bubbles, and raised arms during peak moments" },
      { type: 'feature', description: "Encore detection — when performances exceed setlist length, triggers encore commentary and visual banners" },
      { type: 'improvement', description: "Special moments pool expanded with pyro, drummer, and bassist-specific callouts (25% trigger rate, up from 20%)" },
      { type: 'improvement', description: "Finale now triggers confetti cannon, golden glow, and delayed completion callback to let effects play out" },
      { type: 'improvement', description: "Song transitions track position changes with visual title cards instead of abrupt switches" },
    ],
  },
  {
    version: "1.0.902",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Venue-themed stage backgrounds — 8 distinct themes (Bar, Indie Venue, Rock Club, Concert Hall, Arena, Stadium, Festival Ground, Outdoor) with unique floor patterns, backdrops, curtains, and ambient glow" },
      { type: 'feature', description: "Stage equipment system — monitor wedges, amp stacks, drum risers, speaker stacks, pedalboards, mic stands, and cable runs that scale with venue size (minimal → massive)" },
      { type: 'feature', description: "Dynamic lighting rig — spotlight cones, moving head beams, laser beams, strobe effects, wash lights, fog machine, LED front strips, and overhead truss all reactive to song energy and crowd mood" },
      { type: 'feature', description: "Enhanced pixel-art band member sprites with detailed head/torso/arms/legs, instrument-specific arm animations (strumming, drumming, keys), performance glow rings, and floating vocal notes" },
      { type: 'feature', description: "Genre-reactive visuals system — 30+ genre configs mapping to unique color palettes, crowd behaviors (mosh/bounce/sway/hype), lighting styles, bass pulse effects, and particle types" },
      { type: 'feature', description: "Venue features layer — crowd barriers with security guards, photo pit with camera flashes, sound desk (FOH), merch booth, bar area, and VIP sections scaled by venue type" },
      { type: 'feature', description: "Enhanced crowd with size-varied dots by zone (front/mid/back), phone flashlights during ballads, crowd surfer animation, circle pit for metal/punk, and sequential wave effects" },
      { type: 'feature', description: "Viewer controls — playback speed (1x/2x/4x), camera zoom toggle (full venue vs stage close-up), and stats overlay toggle showing per-member scores" },
      { type: 'improvement', description: "HUD upgraded with song progress bar, momentum meter (-3 to +3), performance grade (S/A/B/C/D), and expandable setlist mini-view with per-song scores" },
      { type: 'improvement', description: "Commentary now color-coded with type icons (🎸 song, 👥 crowd, ⭐ special, 🎆 finale)" },
      { type: 'improvement', description: "Member popover now shows energy state, score bar chart, and skill contribution bar" },
    ],
  },
  {
    version: "1.0.901",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "A&R staff skill now affects demo review — higher skill scouts lower the acceptance threshold (up to -15), boost evaluation score (+10), and produce better contract terms (lower advances, slightly higher artist royalties)" },
      { type: 'feature', description: "Contract offers now use the label's preferred deal type instead of a random global one — labels with specific deal types configured will offer those to artists" },
      { type: 'improvement', description: "Demo review logs now show A&R skill percentage used during evaluation" },
      { type: 'improvement', description: "Labels without configured deal types fall back to global deal types instead of failing silently" },
    ],
  },
  {
    version: "1.0.900",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Deal-type-specific revenue rules — Distribution Deal only takes a cut on physical/digital sales (not streaming), Licensing Deal stops collecting after contract expiry, Production Deal applies to recording revenue" },
      { type: 'feature', description: "Company synergy discounts now actually applied to operating costs — Security+Venue (20%), Factory+Label (15%), Logistics+Factory (10%), capped at 35% total" },
      { type: 'feature', description: "Monthly financial reports auto-generated alongside weekly reports for all active companies" },
      { type: 'improvement', description: "Operating cost transaction descriptions now show synergy discount percentage when applied" },
      { type: 'improvement', description: "Subsidiary operating costs (Security Firms, Factories) also benefit from synergy discounts" },
      { type: 'fix', description: "Distribution Deal no longer incorrectly takes streaming royalties — now limited to max 20% on sales only" },
    ],
  },

  {
    version: "1.0.899",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "360 Deal now takes label's royalty cut from touring/gig revenue and merch sales — not just recordings" },
      { type: 'feature', description: "New Empire Dashboard on company detail page showing 30-day aggregate P&L across all subsidiaries with breakdown by type" },
      { type: 'feature', description: "Artists can now request early release from contracts by paying the termination fee (paid to label, contract terminated immediately)" },
      { type: 'feature', description: "Deal type badges with tooltip info cards show on active contract views — hover to see full deal terms and effects" },
      { type: 'improvement', description: "Label P&L now visible under Finances tab with tabbed Overview/Transactions layout" },
      { type: 'improvement', description: "Empire Dashboard shows label subsidiary balances alongside other company metrics" },
      { type: 'improvement', description: "Gig and merch earnings descriptions now indicate when 360 deal cuts were applied" },
    ],
  },
  {
    version: "1.0.898",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Subsidiary revenue is now activity-based — Security firms earn from gig events, Factories from merch orders, Logistics from tour/distribution, Venues from actual gig attendance" },
      { type: 'feature', description: "Recording studios and rehearsal rooms now earn revenue from actual session/rehearsal bookings rather than random daily income" },
      { type: 'feature', description: "New Deal Type system — 360 Deal, Standard, Distribution, Production, and Licensing deals each have unique effects on revenue streams, cost coverage, and artist freedom" },
      { type: 'feature', description: "New Label P&L Statement showing categorized revenue (royalties, sales, streaming) vs expenses (advances, manufacturing, marketing, overhead)" },
      { type: 'feature', description: "Label Finance tab redesigned with tabbed P&L Overview and Transaction History views" },
      { type: 'improvement', description: "Deal type badges now shown on artist contract cards with tooltip showing full deal terms" },
      { type: 'improvement', description: "Company transaction descriptions now show actual activity counts (e.g., '5 events serviced this week')" },
      { type: 'improvement', description: "Subsidiary revenue scales with tier/quality upgrades and actual game world activity volume" },
      { type: 'fix', description: "Removed random revenue generation from all subsidiary types — all income now tied to real game activity" },
    ],
  },
  {
    version: "1.0.897",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Label contracts now affect revenue — sales and streaming income is split between band and label based on contract royalty percentages" },
      { type: 'feature', description: "Advance recoupment is now functional — label's royalty share goes toward recouping advances until fully paid back" },
      { type: 'feature', description: "Release creation is now contract-aware — auto-detects active label contract, applies manufacturing coverage and marketing hype bonuses" },
      { type: 'feature', description: "New RecoupmentTracker component shows advance repayment progress on both artist and label management views" },
      { type: 'feature', description: "New LabelArtistRoster component for label owners showing signed artists with revenue, quota progress, and recoupment status" },
      { type: 'feature', description: "Label contract banner in release creation dialog shows deal terms, manufacturing coverage, and hype bonuses" },
      { type: 'improvement', description: "Release creation now auto-increments contract release counters (singles_completed, albums_completed, releases_completed)" },
      { type: 'improvement', description: "Label financial transactions now recorded for all revenue splits and manufacturing cost coverage" },
      { type: 'improvement', description: "Streaming revenue split now tracks per-release contract info and credits labels in batch" },
      { type: 'fix', description: "Band earnings descriptions now reflect label split deductions instead of showing full revenue" },
    ],
  },
  {
    version: "1.0.896",
    date: "2026-03-08",
    changes: [
      { type: 'fix', description: "Fixed streaming revenue writes causing ~98% failure rate — decimal-to-integer overflow resolved with Math.round" },
      { type: 'fix', description: "Fixed country charts collapsing all regions into 'all' — country now included in dedupe key" },
      { type: 'fix', description: "Fixed chart category contamination — EP/Album/Single filters now use strict scoped chart types instead of merging with base type" },
      { type: 'fix', description: "Fixed song-level sales inflation — release sales now divided across tracks instead of attributed in full to every track" },
      { type: 'fix', description: "Fixed daily chart sorting using all-time plays_count instead of period-specific weekly_plays" },
      { type: 'fix', description: "Fixed combined album/EP charts using streams-only — now includes sales units in combined score" },
      { type: 'improvement', description: "Streaming analytics now capture deterministic per-region breakdowns instead of single random bucket" },
      { type: 'improvement', description: "Increased chart query limit from 1000 to 5000 to prevent monthly/yearly data truncation" },
      { type: 'improvement', description: "High error-ratio cron runs now flagged as effectively failed with error samples in result summary" },
    ],
  },
  {
    version: "1.0.895",
    date: "2026-03-08",
    changes: [
      { type: 'feature', description: "Replaced all video/3D/text gig viewers with a new top-down 2D pixel-art stage viewer — band member sprites, animated crowd dots, live HUD, and scrolling commentary overlay" },
      { type: 'feature', description: "Clickable band member sprites show real-time performance scores and skill contributions via popover" },
      { type: 'feature', description: "Crowd dots animate based on mood — jumping, moshing, and wave effects for ecstatic/enthusiastic responses" },
      { type: 'feature', description: "Song-by-song visual progression with dynamic lighting colors and stage energy levels" },
      { type: 'improvement', description: "Removed 10 obsolete files (VideoGigViewer, TextGigViewer, POV clips, crowd sound mixer, etc.) for cleaner codebase" },
    ],
  },

  {
    version: "1.0.894",
    date: "2026-03-07",
    changes: [
      { type: 'fix', description: "Fixed pricing assessment for zero-cost digital items — $0 production cost items no longer show 'Fair Price' at any price; realistic recommended prices based on quality tier" },
      { type: 'fix', description: "Merch net revenue now deducts production costs and taxes — bands earn profit, not gross revenue" },
      { type: 'fix', description: "Added $9,999 max price cap on all merchandise to prevent unrealistic pricing" },
      { type: 'improvement', description: "Edge function caps selling_price at $9,999 for existing overpriced items during sales simulation" },
    ],
  },
  {
    version: "1.0.893",
    date: "2026-03-07",
    changes: [
      { type: 'fix', description: "Registered simulate-merch-sales edge function in config.toml so it deploys and runs correctly" },
      { type: 'fix', description: "Fixed merch sales analytics query hitting Supabase 1000-row default limit — now fetches up to 5000 orders" },
      { type: 'feature', description: "Added 'Sold Today' column to the merchandise overview table showing daily unit sales per product" },
    ],
  },
  {
    version: "1.0.892",
    date: "2026-03-06",
    changes: [
      { type: 'fix', description: "Chart time-range filters now produce distinct data: monthly sums estimated daily values across the month, yearly across the year, instead of all showing the same peak-week number" },
      { type: 'fix', description: "Weekly charts correctly use peak rolling-window value while monthly/yearly aggregate across unique chart dates to avoid double-counting" },
    ],
  },
  {
    version: "1.0.891",
    date: "2026-03-06",
    changes: [
      { type: 'fix', description: "Daily streaming now scales with band fame and fan count — famous bands with large fanbases generate dramatically more streams" },
      { type: 'improvement', description: "Stream formula uses fame^1.4 scaling and fan engagement multiplier instead of flat random base" },
    ],
  },
  {
    version: "1.0.890",
    date: "2026-03-06",
    changes: [
      { type: 'fix', description: "Re-enabled /world-map route so the tutorial 'visit_world_map' step no longer leads to a 404" },
    ],
  },
  {
    version: "1.0.889",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Added Friends tab as default view on Social & Relationships page with real player friend management" },
      { type: 'feature', description: "Integrated Direct Message panel inline — select a friend to chat in real-time without leaving the page" },
      { type: 'feature', description: "Added 'Find Players' button with friend search dialog directly on the Relationships page" },
      { type: 'feature', description: "Wired Quick Actions (Chat, Gift, Collaborate, Challenge, Flirt, Confront) to the InteractionModal with success rolls and emotional impact" },
      { type: 'improvement', description: "Pending friend request count badge on Friends tab for visibility" },
    ],
  },
  {
    version: "1.0.888",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Normalized all radio station genres to match the MUSIC_GENRES skill list (consistent casing/formatting)" },
      { type: 'feature', description: "Expanded radio station genre coverage — Hip Hop stations now accept Boom Bap, Trap, Drill, Phonk, Grime, and more subgenres" },
      { type: 'feature', description: "Rock/Metal stations now accept Punk Rock, Modern Rock, and Metalcore/Djent" },
      { type: 'feature', description: "Pop/EDM stations now accept K-Pop/J-Pop and Hyperpop; Electronic stations accept Synthwave and Lo-Fi Hip Hop" },
      { type: 'improvement', description: "Removed all streaming platform quality restrictions — any song can now be distributed to any platform" },
      { type: 'improvement', description: "Removed quality gate UI from song release flow (no more 'Min Quality' badges or disabled checkboxes)" },
    ],
  },
  {
    version: "1.0.887",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Backfilled band_id on 14 orphaned songs that were missing band attribution" },
      { type: 'fix', description: "Fixed song creation trigger to recognize 'Founder' role and fallback to any active band membership" },
    ],
  },
  {
    version: "1.0.886",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Improved admin practice-track upload UX with explicit uploading toast + stable file picker trigger" },
      { type: 'fix', description: "Reduced false full-page loading flash during background game-data refetches" },
    ],
  },
  {
    version: "1.0.885",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Added Stage Practice to the Music navigation section, Music Hub page, and horizontal navigation" },
    ],
  },
  {
    version: "1.0.883",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Admin Practice Tracks page — upload custom audio files for each default practice song (admin/practice-tracks)" },
      { type: 'improvement', description: "Stage Practice now plays admin-uploaded audio as background music instead of AI-generated tracks" },
      { type: 'feature', description: "Storage bucket 'practice-tracks' for admin audio uploads with public read access" },
    ],
  },
  {
    version: "1.0.882",
    date: "2026-03-05",
    changes: [
      { type: 'improvement', description: "Stage Practice difficulty significantly increased — faster base speeds, tighter hit windows, more hazards across all tiers" },
      { type: 'feature', description: "Daily practice XP cap raised from 200 to 500 per instrument with improved XP scaling (higher base, level, accuracy, and combo bonuses)" },
      { type: 'feature', description: "Stage Practice now uses MiniMax Music-1.5 via Replicate to generate genre-specific background music for practice tracks" },
      { type: 'feature', description: "Added 4 new default practice tracks: Hip Hop Beat, Jazz Swing, EDM Drop, Country Road" },
      { type: 'improvement', description: "Generate Background Music button on song selection screen — optional AI-generated backing tracks for default practice songs" },
    ],
  },
  {
    version: "1.0.881",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Record sales formula: switched from flat-log fame scaling (max ~4.5x) to squared-log curve (max ~27x for 15M fame) to restore realistic daily sales volumes" },
      { type: 'feature', description: "Added fan-base multiplier to daily sales — bands with more fans now generate proportionally more sales (sqrt scaling)" },
    ],
  },
  {
    version: "1.0.880",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Admin AI Song Generation page now shows ALL recorded/released songs including those without a band (previously filtered out songs with no band_id)" },
      { type: 'improvement', description: "Increased admin song list limit from 500 to 1000 to prevent missing songs" },
    ],
  },
  {
    version: "1.0.879",
    date: "2026-03-05",
    changes: [
      { type: 'improvement', description: "Stage Practice notes now speed up much faster per level — aggressive speed and spawn ramp for more intensity" },
      { type: 'feature', description: "~15% of notes now spawn as slow 'breather' notes at 35% speed, adding rhythm variety" },
      { type: 'improvement', description: "XP earned from Stage Practice is now properly applied to the practiced instrument skill with level-up support" },
    ],
  },
  {
    version: "1.0.878",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Stage Practice now plays AI-generated background music matching the selected song genre via ElevenLabs" },
      { type: 'feature', description: "Added flashing red hazard triangles that randomly appear — hitting them costs a life, but letting them pass is safe" },
      { type: 'feature', description: "Added sound effects for note hits, misses, and hazard triggers via ElevenLabs SFX" },
      { type: 'improvement', description: "Slowed down note fall speeds across all difficulty levels for better playability" },
      { type: 'feature', description: "Screen flashes red when a hazard is hit for dramatic feedback" },
      { type: 'feature', description: "Music mute toggle button added to game controls" },
    ],
  },
  {
    version: "1.0.877",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Fixed Stage Practice game canvas crash caused by invalid HSL color format in note glow rendering" },
    ],
  },
  {
    version: "1.0.876",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "New Stage Practice mini-game — a 2D vertical rhythm game where notes fall toward a hit zone. Select a recorded song or default practice track, choose an instrument from your skill tree, and hit notes for score and XP" },
      { type: 'feature', description: "Stage Practice scales difficulty based on instrument skill level — beginners get slower notes and wider hit windows, masters face faster speeds and tighter timing" },
      { type: 'feature', description: "XP reward system with diminishing returns after 3 daily sessions and a 200 XP daily cap to prevent farming" },
      { type: 'feature', description: "Full results screen with performance grade (S/A/B/C/D), hit breakdown, combo stats, accuracy percentage, and detailed XP calculation" },
      { type: 'feature', description: "Modular note system with Normal, Hold, and Bonus note types — designed for future BPM syncing and instrument-specific mechanics" },
    ],
  },
  {
    version: "1.0.875",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Fixed tour details still showing $0 revenue/tickets by decoupling gigs metrics from relational setlist joins that could fail silently; gig attendance, ticket revenue, ratings, and profit now load from gigs + gig_outcomes reliably" },
    ],
  },
  {
    version: "1.0.874",
    date: "2026-03-05",
    changes: [
      { type: 'fix', description: "Fixed tour details showing 0 attendance, no ratings, and no revenue — the gigs query was silently failing because it referenced a non-existent 'song_count' column on the setlists table, causing all gig data matching to return empty" },
    ],
  },
  {
    version: "1.0.873",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Added visual Tour Route Map to tour details — shows an SVG map with numbered city pins connected by route lines, with color coding for completed/upcoming/active stops and pulsing animation on the current gig" },
    ],
  },
  {
    version: "1.0.872",
    date: "2026-03-05",
    changes: [
      { type: 'feature', description: "Geographic Route Optimization — tour venues are now ordered by nearest-neighbor algorithm with country grouping, so world tours complete all gigs in one country before moving to the next, minimizing travel time" },
      { type: 'fix', description: "Fixed tour details showing blank ratings and income — date matching between tour venues and gig outcomes was timezone-sensitive, now uses consistent date substring comparison" },
    ],
  },
  {
    version: "1.0.871",
    date: "2026-03-04",
    changes: [
      { type: 'fix', description: "Fixed gig performance scores being too low — rehearsal level was not scaled (0-10 fed as 0-100), NPC band members were skipped instead of given baseline skills, and player attribute normalization used wrong scale" },
      { type: 'feature', description: "Added Manager's Suggestions section to post-gig analytics showing actionable tips based on weak performance factors" },
    ],
  },
  {
    version: "1.0.870",
    date: "2026-03-04",
    changes: [
      { type: 'fix', description: "Fixed record sales not generating for 3 days — restored missing helper functions (getCitySalesTaxRate, getDistributionRate, calculateRegionalSalesMultiplier) in the generate-daily-sales edge function" },
    ],
  },
  {
    version: "1.0.869",
    date: "2026-03-03",
    changes: [
      { type: 'fix', description: "Fixed mobile overflow in Recorded Songs cards — metadata, quality panel, and audio controls now stack responsively on small screens" },
      { type: 'fix', description: "Fixed mobile overflow in dashboard chat channels — channel list and realtime chat panel now stay within viewport width" },
      { type: 'improvement', description: "Improved compact audio player wrapping behavior to prevent horizontal clipping on narrow devices" },
    ],
  },
  {
    version: "1.0.868",
    date: "2026-03-03",
    changes: [
      { type: 'fix', description: "Fixed numeric overflow error when hiring label staff — widened skill_level and performance_rating DB columns from numeric(3,2) to numeric(5,2)" },
    ],
  },
  {
    version: "1.0.867",
    date: "2026-03-02",
    changes: [
      { type: 'fix', description: "Recording Studio page now fits properly on mobile screens with responsive header, smaller text, and no horizontal overflow" },
    ],
  },
  {
    version: "1.0.866",
    date: "2026-03-02",
    changes: [
      { type: 'fix', description: "Fixed chart aggregation using peak values instead of summing rolling windows across dates" },
      { type: 'fix', description: "Sales chart columns now correctly use weekly_plays (period data) instead of plays_count (all-time)" },
      { type: 'feature', description: "Per-country sales chart entries — selecting a country now shows that country's specific sales data" },
      { type: 'improvement', description: "Chart column labels now reflect the selected time period (e.g. 'This Month Sales' instead of 'Total Sales')" },
    ],
  },
  {
    version: "1.0.865",
    date: "2026-03-01",
    changes: [
      { type: 'feature', description: "Territory-Based Distribution System — choose which countries to release in with distance-based pricing (Domestic 1x, Regional 1.5x, Continental 2.5x, Intercontinental 4x for physical)" },
      { type: 'feature', description: "New Territory Selection step in the Release Wizard (now 5 steps) — countries grouped by region with per-country cost breakdown and auto-selected home country" },
      { type: 'feature', description: "Per-territory daily sales generation — sales now calculated per-country using band_country_fans fame data instead of a single global multiplier" },
      { type: 'feature', description: "Territory-aware streaming — streams weighted by country fame, listener_region now maps to actual distribution territories" },
      { type: 'feature', description: "Territory-aware streaming charts — regional charts (US, UK, etc.) only include songs distributed to that region's territories" },
      { type: 'feature', description: "Spillover system — 10% passive sales/streams in countries adjacent to active territories" },
      { type: 'improvement', description: "Streaming Distribution step now shows selected territories and platform count" },
      { type: 'improvement', description: "Release cost now includes territory distribution fees — visible in the wizard total" },
    ],
  },
  {
    version: "1.0.864",
    date: "2026-02-28",
    changes: [
      { type: 'fix', description: "Fixed songs not dropping in charts/sales over time — age decay now uses game-time days (3x real days) instead of real days, so older releases properly lose sales momentum" },
      { type: 'improvement', description: "Added more granular age decay tiers: 14-day boost window, and a 0.1x long tail for songs over 1 game year old" },
    ],
  },
  {
    version: "1.0.863",
    date: "2026-02-28",
    changes: [
      { type: 'fix', description: "Fixed tour travel not moving players — process-tour-travel now sets is_traveling, travel_arrives_at on profiles and creates player_scheduled_activities for activity blocking" },
      { type: 'fix', description: "Fixed tour travel always showing 12 hours — travel legs now calculate real duration using Haversine distance and transport mode speeds instead of spanning full days" },
      { type: 'fix', description: "Tour travel legs now include travel_duration_hours and proper arrival_date based on departure + calculated duration" },
      { type: 'improvement', description: "Tour travel departure set to 8 AM the day after a gig instead of midnight, with arrival based on actual travel time" },
    ],
  },
  {
    version: "1.0.862",
    date: "2026-02-27",
    changes: [
      { type: 'fix', description: "Fixed Recorded Songs tab filters overflowing on mobile — search, genre, and sort controls now stack and use full width on small screens" },
    ],
  },
  {
    version: "1.0.861",
    date: "2026-02-27",
    changes: [
      { type: 'fix', description: "Fixed label upgrades not applying beyond level 1 — missing RLS UPDATE policy on label_upgrades table meant money was deducted but upgrades silently failed" },
      { type: 'fix', description: "Fixed all songs having quality 100 — the create_song_from_completed_project DB trigger was capping quality at LEAST(100,...) instead of using the full 0-1000 scale from the songwriting project" },
      { type: 'fix', description: "Removed duplicate DB trigger on songwriting_projects that was firing song creation twice" },
      { type: 'fix', description: "Retroactively corrected quality scores for existing songs that were incorrectly capped at 100" },
    ],
  },
  {
    version: "1.0.860",
    date: "2026-02-26",
    changes: [
      { type: 'fix', description: "Fixed 'artist_label_contracts_status_check' constraint violation when accepting contracts — added 'accepted_by_artist' and 'negotiating' as valid contract statuses in the database" },
      { type: 'fix', description: "Physical format sales (vinyl, CD, cassette) now correctly stop when stock reaches 0 — no phantom sales until restocked" },
      { type: 'improvement', description: "Reduced restock manufacturing time from 5-14 days to 2 days for all physical formats (vinyl, CD, cassette)" },
    ],
  },
  {
    version: "1.0.859",
    date: "2026-02-26",
    changes: [
      { type: 'fix', description: "Fixed record label staff hiring failing with 'Label company not found' — labels without a parent company now deduct from label balance instead" },
      { type: 'fix', description: "Fixed gig stage skills always being default — fetchStageSkillAverage was querying profiles table instead of player_attributes where stage_presence and charisma are stored" },
      { type: 'fix', description: "Fixed gig member skills showing 0 — added player attributes (musical_ability, technical_mastery, rhythm_sense) as a baseline when skill tree progress is empty, and added instrument skill fallback for cross-skill applicability" },
      { type: 'improvement', description: "Added detailed logging to process-gig-song edge function for skill calculations to aid debugging" },
    ],
  },
  {
    version: "1.0.858",
    date: "2026-02-25",
    changes: [
      { type: 'fix', description: "Fixed contract offers not appearing for band contracts — the artist-entities query on the Record Label page failed silently with a PGRST201 FK ambiguity error between band_members and bands, causing band_id filters to be missing from contract queries" },
    ],
  },
  {
    version: "1.0.857",
    date: "2026-02-25",
    changes: [
      { type: 'fix', description: "Fixed schedule page gigs not loading due to ambiguous FK relationship (PGRST201) — disambiguated bands and tours joins in gigs query" },
      { type: 'fix', description: "Fixed tour travel not processing — edge function was using wrong column name 'travel_cost' instead of 'cost_paid' for player_travel_history, and missing required 'travel_duration_hours' field" },
      { type: 'fix', description: "Fixed tour travel edge function filter on joined table status that prevented PostgREST from matching active tours — moved to client-side filtering" },
    ],
  },
  {
    version: "1.0.856",
    date: "2026-02-24",
    changes: [
      { type: 'feature', description: "Company Financial System Overhaul — all 7 subsidiary types (Security, Merch Factory, Logistics, Venue, Rehearsal Studio, Recording Studio, Record Label) now deduct from parent company balance when hiring staff, purchasing equipment, or installing upgrades" },
      { type: 'feature', description: "Shared deductCompanyBalance utility ensures consistent balance checks, deductions, and company_transactions logging across all subsidiary actions" },
      { type: 'feature', description: "Added Security Firm Upgrades panel to the Security Firm Management page — previously missing from the UI" },
      { type: 'fix', description: "Hiring staff, buying equipment, and installing upgrades no longer succeed silently — they now require sufficient company funds and record expense transactions" },
    ],
  },
  {
    version: "1.0.855",
    date: "2026-02-23",
    changes: [
      { type: 'fix', description: "Fixed contract offer Accept/Decline/Counter buttons not working due to a Supabase relationship ambiguity error (PGRST201) in the contract-offers query" },
    ],
  },
  {
    version: "1.0.854",
    date: "2026-02-23",
    changes: [
      { type: 'feature', description: "Contracts tab now shows a pulsing badge with the number of pending contract offers so players can instantly see when action is needed" },
      { type: 'improvement', description: "Auto-switches to the Contracts tab when pending offers exist, ensuring players don't miss new contract opportunities from NPC label scouting" },
    ],
  },
  {
    version: "1.0.853",
    date: "2026-02-22",
    changes: [
      { type: 'feature', description: "Automated NPC label scouting system — NPC labels now periodically scout bands based on fame, genre compatibility, and label reputation, generating realistic contract offers" },
      { type: 'feature', description: "Scouting probability scales with band fame tier: 0.5% daily for unknowns up to 15% for megastars, with genre matching and label reputation weighting" },
      { type: 'feature', description: "Offer terms auto-calculated: advance ($500–$500K), royalty split, release quotas, territories, and deal type all scale with band fame and label prestige" },
      { type: 'improvement', description: "Offers capped at 3 pending per band to prevent inbox spam, with duplicate label-band pair prevention" },
    ],
  },
  {
    version: "1.0.852",
    date: "2026-02-22",
    changes: [
      { type: 'feature', description: "Database trigger automatically sends inbox notifications when new contract offers are inserted — covers UI offers, NPC-seeded deals, and all future insertion paths" },
      { type: 'feature', description: "Label owners now receive inbox notifications when artists submit contract requests" },
      { type: 'fix', description: "Fixed band leader role query to include Founder/founder/co-leader roles — contract activation notifications and offer notifications now reach the correct user" },
      { type: 'improvement', description: "Removed duplicate manual inbox notification from ContractDesignerDialog — the DB trigger handles it universally" },
    ],
  },
  {
    version: "1.0.851",
    date: "2026-02-21",
    changes: [
      { type: 'feature', description: "Seeded 12 NPC character relationships (rivals, mentors, partners, bandmates, nemeses, business contacts, proteges, fans, collaborators, and exes) for a rich social network" },
      { type: 'feature', description: "Auto-sync trigger: accepted friendships now automatically create bidirectional character_relationships entries" },
      { type: 'fix', description: "Fixed 0 connections showing on Relationships page — existing friendships now synced into the character_relationships system" },
    ],
  },
  {
    version: "1.0.850",
    date: "2026-02-21",
    changes: [
      { type: 'improvement', description: "Expanded VIP feature lists across all pages — VipSubscribe now showcases 12 detailed features including recording, touring, awards, PR, merch, and streaming royalties" },
      { type: 'improvement', description: "Updated VipGate, VipStatusCard, and VipSuccess pages with comprehensive feature descriptions matching actual in-game systems" },
      { type: 'improvement', description: "VIP subscribe page features grid upgraded from 4 to 12 items in a 3-column layout with icon badges" },
    ],
  },
  {
    version: "1.0.849",
    date: "2026-02-21",
    changes: [
      { type: 'fix', description: "Fixed VIP checkout error — replaced inactive Stripe product/price IDs with new active ones for Monthly, Quarterly, and Annual tiers" },
    ],
  },
  {
    version: "1.0.848",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Social & Relationships hub now fully wired to real Supabase data — character relationships from character_relationships table, drama events from social_drama_events, emotional state from character_emotional_states" },
      { type: 'feature', description: "Emotional State panel shows live happiness, loneliness, inspiration, jealousy, resentment, and obsession from the dynamic emotional engine" },
      { type: 'feature', description: "Gameplay Modifiers section displays real songwriting, performance, and interaction modifiers calculated from emotional state" },
      { type: 'feature', description: "Drama Feed tab shows real social drama events with severity styling, viral indicators, streaming multipliers, fame changes, and trending hashtags from actual data" },
      { type: 'feature', description: "Romance tab filters real character relationships by partner/ex_partner types with live score gauges" },
      { type: 'improvement', description: "Proper loading skeletons and empty states throughout the Social hub" },
      { type: 'improvement', description: "Removed all mock/hardcoded data from the Relationships page" },
    ],
  },
  {
    version: "1.0.847",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Complete Social & Relationships UI overhaul — replaced old friends-only page with full social hub featuring Network, Drama Feed, Romance, and Family tabs" },
      { type: 'feature', description: "Social Network Dashboard with filterable categories (friends, rivals, romance, bandmates, mentors, exes), search, animated relationship cards with status-based glow effects" },
      { type: 'feature', description: "Character detail panel showing 5 emotional metrics (affection, trust, attraction, loyalty, jealousy) with animated gauges and gameplay modifier previews" },
      { type: 'feature', description: "Drama & Media Feed tab with tabloid-style event cards, viral/major impact indicators, and trending hashtag sidebar" },
      { type: 'feature', description: "Romance tab with partner/ex tracking, compatibility metrics, and stage-based progression indicators" },
      { type: 'feature', description: "Embedded Emotional State widget showing 6 emotions (happiness, loneliness, inspiration, jealousy, resentment, obsession) with real-time gameplay modifiers" },
      { type: 'improvement', description: "Fixed duplicate import build error in BandChemistryDashboard component" },
    ],
  },
  {
    version: "1.0.846",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Social Drama Event Generator — 12 drama categories: public breakups, affairs exposed, diss tracks, on-stage fights, surprise weddings, custody disputes, and more" },
      { type: 'feature', description: "Auto-generated media articles from 8 outlets (The Scandal Sheet, Music Insider, Gossip Riff, etc.) with tone-specific coverage based on fame and controversy level" },
      { type: 'feature', description: "Each event modifies reputation (4 axes), fan loyalty (-50 to +50), streaming multiplier (0.5x–3.0x), chart boost, and fame — with viral amplification" },
      { type: 'feature', description: "Viral detection system: explosive events have up to 90% viral chance, boosting all impacts by 1.5x and streaming by 1.3x" },
      { type: 'feature', description: "Generated articles table for AI news/radio integration — supports breaking news, featured articles, sentiment scoring, and controversy tracking" },
      { type: 'feature', description: "Active drama streaming multiplier hook compounds all ongoing drama effects for real-time impact on streaming calculations" },
    ],
  },
  {
    version: "1.0.845",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Enhanced Band Chemistry Engine — 4-axis system: Overall Chemistry, Romantic Tension, Creative Alignment, Conflict Index" },
      { type: 'feature', description: "18 drama event presets across romantic, creative, rivalry, public, escalation, and positive categories with severity tiers" },
      { type: 'feature', description: "Gameplay modifiers auto-calculated: song quality (0.6–1.5x), performance rating (0.5–1.5x), member leave risk (0–80%), drama chance (2–60%)" },
      { type: 'feature', description: "Drama trigger engine responds dynamically to breakups, rivalries, creative disagreements, public scandals, gigs, and songwriting" },
      { type: 'feature', description: "Drama resolution system with 5 resolution types (apologize, ignore, escalate, band vote, leader decision) each with distinct chemistry impacts" },
      { type: 'feature', description: "Weekly natural drift: conflict/tension decay, creative alignment regresses toward 50, high conflict slowly erodes overall chemistry" },
    ],
  },
  {
    version: "1.0.844",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Romantic Progression System — 9-stage romance arc: Flirting → Dating → Exclusive → Public → Engaged → Married → Separated → Divorced → Secret Affair" },
      { type: 'feature', description: "Each romance stage unlocks new interactions, affects reputation, emotional state, and band chemistry if partners share a band" },
      { type: 'feature', description: "Attraction algorithm combining fame gap, genre overlap, personality match, reputation alignment, and proximity" },
      { type: 'feature', description: "Compatibility scoring from trait overlap/conflicts, genre alignment, ambition match, and lifestyle similarity" },
      { type: 'feature', description: "Affair detection probability engine — suspicion builds per interaction, influenced by fame, venue type, social media activity, and rival vigilance" },
      { type: 'feature', description: "Rejection consequences scale with relationship depth and publicity — deeper breakups cause more happiness loss, resentment, and reputation damage" },
    ],
  },
  {
    version: "1.0.843",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Dynamic Emotional Engine — each character tracks 6 emotional attributes (Happiness, Loneliness, Inspiration, Jealousy, Resentment, Obsession) that shift based on game events" },
      { type: 'feature', description: "Auto-calculated gameplay modifiers: songwriting quality (±50%), performance impact (±50%), and social interaction success (±50%) derived from emotional state via DB trigger" },
      { type: 'feature', description: "30+ event presets for relationship, gig, songwriting, chart, band, social, and news systems — each with calibrated emotional impacts" },
      { type: 'feature', description: "Modular integration hooks: useEmotionalModifiers() for songwriting/gig systems, useApplyEmotionPreset() for one-line event triggers from any game system" },
    ],
  },
  {
    version: "1.0.842",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Unified character relationship system — scalable backend for Player↔Player, Player↔NPC, and Player↔Band relationships with 5 core scores (affection, trust, attraction, loyalty, jealousy)" },
      { type: 'feature', description: "Multiple simultaneous relationship types per pair (friend, rival, bandmate, mentor, partner, etc.) with public/private/leaked visibility states" },
      { type: 'feature', description: "Interaction history logging with automatic score changes and threshold event detection (e.g. trust broken, loyalty betrayal)" },
      { type: 'feature', description: "Hybrid decay system — daily cron edge function decays scores after 3-day grace period, scaling with inactivity duration" },
      { type: 'feature', description: "React Query hooks for full CRUD, interaction logging, get-or-create patterns, and unprocessed event polling" },
    ],
  },
  {
    version: "1.0.841",
    date: "2026-02-20",
    changes: [
      { type: 'fix', description: "Charts now show correct Weekly vs Total values — sales charts display cumulative all-time sales for 'Total' and weekly sales for 'This Week' instead of showing the same number for both" },
      { type: 'improvement', description: "Old releases now decay in sales and streams over time — graduated age multiplier reduces daily output from 1.5x (first week) down to 0.2x (6+ months) to mirror real-world music economics" },
    ],
  },
  {
    version: "1.0.840",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Restock button on sold-out and low-stock merchandise items — choose quantity and reorder directly from the inventory table" },
    ],
  },
  {
    version: "1.0.839",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Full contract negotiation system — accept, reject, or counter-offer label deals with a 3-strike system where the label walks away after 3 counters" },
      { type: 'feature', description: "Acceptance likelihood bar shows risk of each counter-offer based on how aggressive your ask is and how many rounds you've used" },
      { type: 'feature', description: "Label auto-responds to counter-offers by meeting you partway (45% round 1, 30% round 2), with revised terms visible alongside original offer" },
      { type: 'feature', description: "Counter round indicator with visual dots and warnings — final counter shows destructive styling with walk-away warning" },
      { type: 'fix', description: "Contract offers now remain visible during negotiation (previously vanished after countering due to status filter only including 'offered')" },
    ],
  },
  {
    version: "1.0.838",
    date: "2026-02-20",
    changes: [
      { type: 'feature', description: "Created festival_slot_offers database table so bands can receive and respond to festival performance invitations" },
      { type: 'feature', description: "Added inbox notifications when a band receives a festival slot offer — all band members get notified with actionable deep-link to the Festival Offers tab" },
      { type: 'fix', description: "Fixed Festival Slot Offers UI to correctly reference game_events table fields (title instead of name) and guaranteed_payment" },
    ],
  },
  {
    version: "1.0.837",
    date: "2026-02-20",
    changes: [
      { type: 'fix', description: "Fixed gigs only playing partial setlists — complete-gig now processes all unplayed songs server-side before finalizing, so gigs complete properly even when browser is closed" },
    ],
  },
  {
    version: "1.0.836",
    date: "2026-02-20",
    changes: [
      { type: 'fix', description: "Fixed AI song generation failing due to lyrics exceeding MiniMax 600-char limit — all code paths now enforce truncation with a final safety net" },
    ],
  },
  {
    version: "1.0.835",
    date: "2026-02-20",
    changes: [
      { type: 'fix', description: "Fixed Release Detail 'Release not found' error — disambiguated release_songs FK (release_id vs album_release_id) in Supabase query" },
    ],
  },
  {
    version: "1.0.834",
    date: "2026-02-19",
    changes: [
      { type: 'fix', description: "Release parties now limited to one per release — Party button hidden after completion, and release_party_done flag set in database" },
    ],
  },
  {
    version: "1.0.833",
    date: "2026-02-19",
    changes: [
      { type: 'fix', description: "Fixed Release Detail page showing 'Release not found' — split embedded FK queries to avoid PostgREST ambiguity with chart_albums view" },
      { type: 'improvement', description: "Compact release card buttons — Details, Analytics, Promo, Physical, Party now fit on one row with smaller text and wrap on mobile" },
      { type: 'feature', description: "Added Promo button to released release cards for quick access to the Promotion tab" },
    ],
  },
  {
    version: "1.0.832",
    date: "2026-02-18",
    changes: [
      { type: 'fix', description: "Fixed Release Detail page not loading — resolved ambiguous FK relationships in Supabase query for song_releases, music_videos, and radio_submissions" },
      { type: 'fix', description: "Promotion tab now visible on Release Detail page with Promo Tour booking and passive campaign cards" },
    ],
  },
  {
    version: "1.0.831",
    date: "2026-02-18",
    changes: [
      { type: 'fix', description: "Fixed AI song generation failing when lyrics contain AI preamble text ('Here are your song lyrics for...') — now stripped during sanitization" },
      { type: 'fix', description: "Fixed markdown bold section markers (**Verse 1**, **Chorus**) not being recognized — now converted to standard [Verse 1], [Chorus] format" },
      { type: 'fix', description: "Fixed stage direction parentheses (e.g. '(Intro - Fast, driving guitar riff)') causing lyrics to exceed 600-char limit" },
      { type: 'improvement', description: "Lyrics sanitization now handles **Final Chorus** → [Chorus] conversion for better MiniMax compatibility" },
    ],
  },
  {
    version: "1.0.830",
    date: "2026-02-17",
    changes: [
      { type: 'feature', description: "Promo Tour system — book multi-day promotional campaigns (3/5/7 days) for releases with half-day activity blocks, health/energy drain, and escalating hype rewards" },
      { type: 'feature', description: "Three promo packages: Quick Blitz (3 days, $600), Standard Push (5 days, $1,250), Full Campaign (7 days, $2,100) with morning/afternoon time slot choice" },
      { type: 'feature', description: "Daily promo activities include Radio Call-Ins, In-Store Signings, Social Media Marathons, Press Junkets, TV Appearances, Listening Parties, and Acoustic Sessions" },
      { type: 'feature', description: "Promo days activity-block the player for 6 hours, drain health (12-22) and energy (15-28), and grant hype (25-40 per day scaled by band fame)" },
      { type: 'feature', description: "10% chance of viral moment during promo — doubles that day's hype gain with a toast notification" },
      { type: 'feature', description: "New Promotion tab on Release Detail page combining Promo Tours (active) with existing Promotional Campaigns (passive)" },
      { type: 'improvement', description: "Added release_promo to health system drain rates (4/hr) and scheduling activity types" },
    ],
  },
  {
    version: "1.0.829",
    date: "2026-02-17",
    changes: [
      { type: 'fix', description: "Gig performance scores now scale with actual skill tree levels, equipped gear bonuses, and player attributes (stage presence + charisma) instead of using a static skill_contribution value" },
      { type: 'improvement', description: "Edge function process-gig-song now fetches live skill_progress per band member role, applies gear rarity/stat multipliers, and calculates stage skill average from attributes" },
      { type: 'improvement', description: "Performance calculator weights updated to match client-side: songQuality 25%, rehearsal 20%, chemistry 15%, equipment 12%, crew 8%, member skills 10%, stage skills 10%" },
      { type: 'improvement', description: "Song quality normalization (0-1000 → 0-100) and member skill normalization (0-150 → 0-100) now applied consistently in both client and server calculations" },
      { type: 'feature', description: "Variance, momentum-style event rolls, and venue capacity multipliers now included in server-side gig processing for more dynamic outcomes" },
    ],
  },
  {
    version: "1.0.828",
    date: "2026-02-17",
    changes: [
      { type: 'feature', description: "Weather system — every city now has a realistic climate type (tropical, arid, mediterranean, oceanic, continental, subtropical, subarctic, equatorial) with seasonal weather patterns" },
      { type: 'feature', description: "Current weather (condition, emoji, temperature) displayed on dashboard LocationHeader next to season info" },
      { type: 'feature', description: "Deterministic daily weather — same game day shows same weather for all players, changes each in-game day" },
      { type: 'feature', description: "Weather-based genre popularity modifiers — rainy weather boosts Blues/Jazz, sunny boosts Pop/Reggae, stormy boosts Metal/Punk, etc." },
      { type: 'feature', description: "Weather affects travel — disruption warnings shown in travel booking dialog based on origin and destination weather" },
    ],
  },
  {
    version: "1.0.827",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Record label contract offers now have working Accept, Decline, and Counter-Offer buttons for players — counter-offer opens a dialog to propose different advance, royalty split, and quota terms" },
    ],
  },
  {
    version: "1.0.826",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Radio stations now visible again — backfilled has_performed flag for all bands with completed gigs, and gig completion now correctly marks the country as performed for future radio access" },
    ],
  },
  {
    version: "1.0.825",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Album charts now resolve album title from joined releases table instead of stale 'Unknown Album' values in chart_entries.release_title" },
    ],
  },
  {
    version: "1.0.824",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Physical chart now supports album view; album charts resolve artist name from release band when song band is missing; fixes 'Unknown Artist' on album chart entries" },
    ],
  },
  {
    version: "1.0.823",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Massively expanded How to Play guide: 8 tabs (Overview, Music, Perform, Skills, Career, Social, World, Lifestyle) covering all game systems including touring, PR, merch, equipment, housing, health/energy, minigames, achievements, and more" },
      { type: 'feature', description: "Added 18 new tutorial steps covering education, skill tree, equipment, merch, busking, tours, charts, radio, labels, travel, world map, DikCok, Gettit, PR, employment, schedule, achievements, and underworld" },
    ],
  },
  {
    version: "1.0.821",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Songwriting instrument selector now matches legacy skill slugs (guitar, bass, drums, vocals, etc.) so skill levels display correctly alongside the newer instruments_basic_* slugs" },
    ],
  },
  {
    version: "1.0.820",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed university course browser returning only ~1000 results — implemented paginated fetching to load all 23,000+ courses across all cities" },
    ],
  },
  {
    version: "1.0.819",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Added missing instrument_role field to POV clip seed templates to fix not-null constraint violation" },
    ],
  },
  {
    version: "1.0.817",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Added RLS policies for pov_clip_templates: admin INSERT, UPDATE, DELETE permissions to fix seed clips error" },
    ],
  },
  {
    version: "1.0.816",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "generate-pov-clips edge function: batch AI video generation using Gemini first-frame + Replicate MiniMax, with webhook callback for async completion" },
      { type: 'feature', description: "pov-clip-callback edge function: handles Replicate webhooks, downloads video, uploads to pov-clips storage bucket" },
      { type: 'feature', description: "Admin POV Clip Manager: Generate Batch button triggers AI clip generation, retry failed clips individually" },
      { type: 'feature', description: "POV Clip Manager added to Bands & Performance admin navigation" },
    ],
  },
  {
    version: "1.0.815",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Replaced 3D/Parallax gig viewer with video-based POV concert mode — AI-generated clips from each musician's perspective with crossfade transitions" },
      { type: 'feature', description: "~150 POV clip templates covering all skill tree instruments (guitar, keys, drums, wind, brass, electronic, world/folk, vocals) plus universal stage clips (crowd, backstage, entrance, exit)" },
      { type: 'feature', description: "Dynamic cut sequencer: clips cycle between musician POVs and crowd shots, weighted by song energy and crowd mood" },
      { type: 'feature', description: "Audio-only fallback with animated equalizer when POV clips are still generating" },
      { type: 'feature', description: "Admin POV Clip Manager page for seeding templates and monitoring generation status" },
      { type: 'improvement', description: "Removed all old 3D procedural equipment, parallax stage, POV overlay, and camera shake components" },
    ],
  },
  {
    version: "1.0.814",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Dashboard level now uses computed Combined Progress level instead of static database column — accurately reflects XP, skills, fame, and attributes" },
    ],
  },
  {
    version: "1.0.813",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Restored all player cash to $1,000,000 and set fame to 80% of their band's fame to compensate for data reset caused by v1.0.812 migration" },
    ],
  },
  {
    version: "1.0.812",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed null cash/fame/level on profiles by restoring data and adding NOT NULL constraints with defaults to prevent future nulls" },
    ],
  },
  {
    version: "1.0.811",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed type errors in progression edge function by updating database-fallback.ts with missing dual-currency wallet columns (skill_xp_balance, attribute_points_balance, stipend_claim_streak, etc.)" },
    ],
  },
  {
    version: "1.0.810",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Security: Added input validation and length limits to AI lyrics generation edge function to prevent prompt injection and abuse" },
    ],
  },
  {
    version: "1.0.809",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Removed seasonal background particle effects (falling flowers/snow/leaves)" },
    ],
  },
  {
    version: "1.0.808",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "New ResponsiveTable component ensures tables always fit on mobile with horizontal scroll and compact text sizing" },
      { type: 'improvement', description: "Applied ResponsiveTable to merchandise overview table" },
    ],
  },
  {
    version: "1.0.807",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Merchandise tabs now fit properly on mobile with smaller icons, tighter spacing, and smooth horizontal scrolling" },
    ],
  },
  {
    version: "1.0.806",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Recommended pricing system — each merch item now shows a recommended sale price based on cost and quality tier" },
      { type: 'feature', description: "Pricing impact indicators: Bargain/Underpriced/Fair/Overpriced/Rip-off with sales velocity multiplier, fame and fan effects" },
      { type: 'improvement', description: "Pricing assessment shown in catalog product config, inventory table, and manage inventory price field" },
    ],
  },
  {
    version: "1.0.805",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Moved Merchandise Manager and Operating Costs into their own dedicated tabs for cleaner navigation" },
    ],
  },
  {
    version: "1.0.804",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Merchandise images are now clickable — tap to view enlarged on mobile" },
      { type: 'improvement', description: "Generate Images buttons hidden for non-admin users on Merchandise and Housing pages" },
    ],
  },
  {
    version: "1.0.803",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Merged simulate-ticket-sales into process-daily-updates, freeing an edge function slot" },
      { type: 'feature', description: "Deployed generate-merch-image edge function — AI merch image generation now operational" },
    ],
  },
  {
    version: "1.0.802",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Improved T-Shirt Designer SVG shape — sleeves now extend properly with natural curves instead of stubby angular arms" },
    ],
  },
  {
    version: "1.0.801",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed merch sales simulation — integer type mismatch (22P02) was preventing all daily sales from being recorded since Jan 26" },
      { type: 'fix', description: "Rounded total_price and unit_price to integers before inserting into merch_orders table" },
      { type: 'fix', description: "Rounded band_earnings.amount to integer for merchandise revenue credits" },
    ],
  },
  {
    version: "1.0.800",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "AI merch image generation wired into UI — generate per product or batch 'Generate All Missing Images' from overview" },
      { type: 'feature', description: "Product table now shows AI-generated image thumbnails with inline generate button for missing images" },
      { type: 'feature', description: "Sales analytics profit breakdown: Gross Revenue − Logistics (5%) − Tax (8%) = Net Revenue" },
      { type: 'feature', description: "Catalog order form shows full cost breakdown: production cost, logistics, tax, and net profit per unit" },
      { type: 'improvement', description: "Merch Manager logistics discount now wired into Operating Costs card (3% with manager vs 5% without)" },
      { type: 'improvement', description: "Sales overview 4th stat card changed from Avg Order to Net Revenue for clearer P&L visibility" },
    ],
  },
  {
    version: "1.0.799",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "AI-generated merchandise images — each product gets a unique AI photo based on item type, band name, and quality tier" },
      { type: 'feature', description: "Realistic business costs: storage fees ($0.10/unit/day), logistics (5% of sales), and tax (8% of revenue)" },
      { type: 'feature', description: "VIP Merchandise Manager — hire an NPC who auto-restocks, reduces logistics to 3%, for $2,000/month" },
      { type: 'feature', description: "Operating costs dashboard showing estimated monthly storage, logistics, and tax expenses" },
      { type: 'feature', description: "Profit breakdown in catalog: order cost, per-unit profit after logistics and tax" },
      { type: 'feature', description: "8 new merch-themed random events: Bootleg Alert, Viral Merch Moment, Factory Delay, Fan Design Contest, Warehouse Fire, Celebrity Spotted, Tax Audit, Manager Scandal" },
      { type: 'improvement', description: "Product cards show AI-generated thumbnails with regenerate option" },
      { type: 'improvement', description: "Catalog order form now shows total upfront production cost before confirming" },
    ],
  },
  {
    version: "1.0.798",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Housing price market — per-country price multipliers fluctuate gently (±1-5%) every few hours via cron" },
      { type: 'feature', description: "Buy prices now reflect current market conditions with trend indicators (📈📉)" },
      { type: 'feature', description: "Sell prices follow market value — if the market rises, your property sells for more (70% of market value)" },
      { type: 'improvement', description: "Property cards show base vs market price and percentage change" },
      { type: 'improvement', description: "Owned properties display current market value and market-adjusted sell price" },
    ],
  },
  {
    version: "1.0.797",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Repertoire song cards redesigned for mobile — stats (fame, popularity, quality, status) now wrap below the title instead of overflowing off-screen" },
    ],
  },
  {
    version: "1.0.796",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Sell properties at 70% of purchase price — cash credited back to your balance" },
      { type: 'feature', description: "Rent out owned properties for daily passive income (~0.5% of property value/day)" },
      { type: 'feature', description: "Daily upkeep costs displayed on all owned properties (~0.1% of value/day)" },
      { type: 'improvement', description: "Buy tab now shows your cash balance and disables purchase button when you can't afford a property" },
      { type: 'improvement', description: "My Properties tab shows net daily cost/profit summary across all properties" },
    ],
  },
  {
    version: "1.0.795",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Housing image generation fixed to use Gemini Flash Image model (dall-e-3 not available on gateway)" },
    ],
  },
  {
    version: "1.0.794",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Housing image generation now uses the correct image generation API endpoint instead of chat completions, fixing 'No image in response' errors" },
    ],
  },
  {
    version: "1.0.793",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Housing country list now paginates past the 1000-row Supabase limit — all countries (including UK, USA, etc.) now appear" },
      { type: 'fix', description: "Housing types query paginated to ensure all property images are fetched correctly" },
    ],
  },
  {
    version: "1.0.792",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Festival tickets moved to dedicated 'Tickets' tab — visible to all players, not just performing bands" },
    ],
  },
  {
    version: "1.0.791",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Radio stations now only show countries the band has visited — players must perform in a country before accessing its stations" },
      { type: 'feature', description: "Batch submit wizard also filtered to visited countries only" },
      { type: 'feature', description: "Submit dialog blocks submission with clear message for unvisited countries" },
    ],
  },
  {
    version: "1.0.790",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Festival ticket prices now read from the actual festival ticket_price field instead of hardcoded fallbacks" },
      { type: 'feature', description: "Festival ticket add-ons: Early Access, VIP Camping, Glamping, and Backstage Pass with dynamic pricing based on festival tier" },
    ],
  },
  {
    version: "1.0.789",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Releases now appear on the schedule — manufacturing completion dates shown as scheduled activities" },
      { type: 'feature', description: "Festival detail page now has a ticket purchase section with day/weekend ticket options" },
    ],
  },
  {
    version: "1.0.788",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Festivals page redesigned — compact stats row, richer browse cards with poster images, click-to-detail navigation, countdown badges, cleaner mobile layout" },
      { type: 'improvement', description: "My Festivals tab redesigned with icon-prefixed rows, clickable cards linking to festival detail, and cleaner status badges" },
    ],
  },
  {
    version: "1.0.787",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed festival page — 'Perform Now' buttons replaced with 'Scheduled' badge on the actual /festivals route (pages/FestivalBrowser.tsx)" },
    ],
  },
  {
    version: "1.0.786",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Removed unused edge functions: publish-scheduled-twaats and eurovision — freed up deployment slots" },
      { type: 'fix', description: "Successfully deployed generate-festival-poster edge function (previously blocked by function limit)" },
    ],
  },
  {
    version: "1.0.785",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Festival expansion: enriched detail panel with description, stats, attendance count, security firm, and cash balance display" },
      { type: 'feature', description: "Festival Exclusive Shop: ticket holders can buy collectible wristbands, posters, t-shirts, and pins" },
      { type: 'feature', description: "Festival Merch Stand: performing bands can create and sell festival-exclusive merchandise" },
      { type: 'feature', description: "AI-generated lineup posters: admin can generate festival poster from lineup using AI image generation" },
      { type: 'feature', description: "Festival poster displayed in player-facing detail panel when available" },
      { type: 'improvement', description: "Removed instant 'Perform Now' button — replaced with 'Scheduled' badge for confirmed performers" },
      { type: 'improvement', description: "Festival lineup reorganized by day with clearer stage groupings" },
    ],
  },
  {
    version: "1.0.784",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed cluttered chart layout on mobile — responsive grid (8-col mobile / 12-col desktop), stacked weekly+total values, smaller text, and narrower filter dropdowns" },
    ],
  },
  {
    version: "1.0.782",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed security contract creation failing with check constraint violation - changed contract_type from 'festival' to 'event'" },
    ],
  },
  {
    version: "1.0.781",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed crash when assigning security firm in Festival admin due to empty string SelectItem value" },
    ],
  },
  {
    version: "1.0.780",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed crash on Festival admin page caused by SelectItem with empty string value" },
    ],
  },
  {
    version: "1.0.779",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Contract notification CTAs (e.g. 'Open contract to review', 'Approve or counter') are now clickable buttons that scroll to and highlight the relevant contract or offer card" },
    ],
  },
  {
    version: "1.0.778",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Horizontal nav items are now center-aligned except Home which stays left with yellow text" },
      { type: 'improvement', description: "RockMundo logo made larger in horizontal navigation" },
    ],
  },
  {
    version: "1.0.777",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "House Keys in Inventory now correctly reads from player_properties table instead of empty lifestyle_property_purchases table" },
    ],
  },
  {
    version: "1.0.776",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Radio Player nav item now launches the player dialog directly instead of navigating to a separate page" },
    ],
  },
  {
    version: "1.0.775",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Moved Radio Player from Dashboard to its own page under the Home navigation section" },
    ],
  },
  {
    version: "1.0.774",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Moved Radio Player from header to a dedicated section on the Dashboard home page" },
    ],
  },
  {
    version: "1.0.773",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Band popularity and cohesion score now calculated daily — were stuck at 0 because process-daily-updates never updated them" },
      { type: 'feature', description: "Days together tracked from band creation date; cohesion factors in chemistry, time, and performance count" },
      { type: 'feature', description: "Popularity calculated from fame tier, fan engagement, and recent gig activity (0-1000 scale)" },
    ],
  },
  {
    version: "1.0.772",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Record sales revenue now reliably credited to band_balance — fixed silent failures in generate-daily-sales edge function" },
      { type: 'fix', description: "Band earnings from record sales are now batch-credited once per run with full error handling, preventing missed credits" },
      { type: 'improvement', description: "Daily sales earnings show aggregated totals per band instead of per-format entries, with detailed metadata" },
    ],
  },
  {
    version: "1.0.771",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Dual approval contract flow: band must accept terms first, then label activates and pays the advance" },
      { type: 'feature', description: "Advance payment on contract activation: band balance credited, label balance debited, earnings logged" },
      { type: 'feature', description: "Contract offer inbox notification: band leader receives a high-priority inbox message when a label sends an offer" },
      { type: 'feature', description: "Contract activation inbox notification: band leader notified when the label activates and pays the advance" },
      { type: 'improvement', description: "Label contract UI shows 'Waiting for artist' badge for offered contracts, 'Activate & Pay Advance' for accepted ones" },
    ],
  },
  {
    version: "1.0.770",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Festival Career Impact System: performances now generate fame and fan growth (casual/dedicated/superfans) scaled by slot type" },
      { type: 'feature', description: "Chart & streaming multipliers applied to songs performed at festivals, lasting 3-7 days based on slot type" },
      { type: 'feature', description: "Song popularity and fame updated after festival performances, with gig play count tracking" },
      { type: 'improvement', description: "Performance outcome screen now shows detailed fan growth breakdown and active chart/streaming boosts" },
    ],
  },
  {
    version: "1.0.769",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Admin nav section is now hidden from non-admin users in both sidebar and horizontal navigation" },
      { type: 'feature', description: "Admin User Role Management page — view all users, search by username, and change roles (admin/moderator/user)" },
      { type: 'feature', description: "User Roles tile added to Admin Dashboard for quick access" },
    ],
  },
  {
    version: "1.0.768",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Category Hub pages: clicking a navigation heading now takes you to a tile-based hub page for that section" },
      { type: 'feature', description: "10 hub pages created: Character, Music, Band, Live, Events, World, Social, Career, Commerce, and Media" },
      { type: 'improvement', description: "Navigation headings are now clickable links in both desktop horizontal nav and mobile sidebar" },
    ],
  },
  {
    version: "1.0.767",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Festival Browse & Tickets: player-facing festival listing with stage lineup, quality ratings, and day/weekend ticket purchase" },
      { type: 'feature', description: "Live Festival Experience: enter active festivals, switch between stages, see live commentary and current performers" },
      { type: 'feature', description: "Festival Stage Commentary: real-time generated commentary for band performances and DJ sets with crowd reactions" },
      { type: 'feature', description: "Watch Rewards: claim XP, gifted songs, or attribute points while watching festival performances" },
      { type: 'feature', description: "Festival Voice Chat: stage-scoped voice chat — moving stages auto-switches voice channel" },
      { type: 'feature', description: "Festival attendance tracking with join/leave and per-stage attendee counts" },
      { type: 'improvement', description: "Festivals page rebuilt with Browse & Tickets and Live Festival tabs replacing the old simulation sandbox" },
    ],
  },
  {
    version: "1.0.766",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Admin Festival Management: Full stage creation wizard with auto-generated slots (6 per stage per day — 1 headliner, 2 support, 3 openers)" },
      { type: 'feature', description: "Admin can assign bands to festival slots with custom payouts or auto-fill empty slots with NPC DJ sessions" },
      { type: 'feature', description: "Festival finances dashboard: ticket revenue, sponsorship, security costs, 15% tax, and calculated band budget" },
      { type: 'feature', description: "Festival quality ratings: comfort, food, safety, lineup sliders (1-5) with overall score calculation" },
      { type: 'feature', description: "Security firm integration: assign firms to festivals, auto-calculate guard requirements and costs" },
      { type: 'feature', description: "Festival creation form now includes duration (2-4 days), start day (Thu/Fri/Sat), max stages (1-5), and ticket pricing" },
    ],
  },
  {
    version: "1.0.765",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Festival System Expansion Phase 1: Added festival_stages, festival_stage_slots, festival_tickets, festival_attendance, festival_watch_rewards, festival_finances, and festival_quality_ratings database tables" },
      { type: 'feature', description: "Festivals now support 2-4 day durations (Thu-Sun or Sat-Sun) with up to 5 stages and 6 slots per stage per day" },
      { type: 'feature', description: "Players can purchase day or weekend festival tickets — schedule is blocked for the festival duration" },
      { type: 'feature', description: "Festival attendance tracking with stage-switching — move between stages freely" },
      { type: 'feature', description: "Watch rewards system: earn XP, gifted songs (5% chance), or attribute points (3% chance) from watching performances" },
      { type: 'feature', description: "Festival finances system with ticket revenue, sponsorship, security costs, band payouts, and 15% festival tax" },
      { type: 'feature', description: "Festival quality ratings (comfort, food, safety, lineup) affecting attendee satisfaction" },
      { type: 'feature', description: "NPC DJ sessions fill empty festival slots with genre-matched, average-quality performances" },
      { type: 'feature', description: "Security firm integration for festivals via security_contracts" },
      { type: 'feature', description: "Added festival_attendance and festival_performance activity types to the scheduling system" },
    ],
  },
  {
    version: "1.0.764",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed 'null profile_id' error when accepting major event invitations — now correctly fetches player profile before creating scheduled activity" },
    ],
  },
  {
    version: "1.0.763",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Major events now have duration and datetime — accepting an event blocks the time slot on your schedule" },
      { type: 'feature', description: "Events are genre-specific (Rock, Pop, Hip Hop, etc.) — only matching bands can be invited to genre-locked events" },
      { type: 'feature', description: "Bands limited to max 2 major events per game year — forces strategic choices" },
      { type: 'feature', description: "3-year cooldown after performing at an event — cannot repeat the same event for 3 game years" },
      { type: 'improvement', description: "Event cards now show genre badge, duration, and blocked/cooldown status with tooltip reasons" },
      { type: 'improvement', description: "Band info card shows genre, event cap rules, and cooldown policy" },
    ],
  },
  {
    version: "1.0.762",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Major events fully rebuilt around the game year system — annual events appear every game year, quadrennial events (Olympics, World Cups) correctly stagger across years" },
      { type: 'improvement', description: "Upcoming events grouped by Game Year with current year indicator and month names" },
      { type: 'feature', description: "Each event now shows frequency badge (Annual / Every 4 years) and game month name" },
      { type: 'improvement', description: "Current in-game date context card shown at the top of Major Events page" },
      { type: 'improvement', description: "Event history and performance reports now display Game Year and month name instead of raw year numbers" },
    ],
  },
  {
    version: "1.0.761",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Dashboard Profile tab now shows character avatar picture, name, age, and gender at the top" },
    ],
  },
  {
    version: "1.0.760",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed 'View Outcome' button greyed out on Last Night's Gigs — RLS policy now allows all users to view gig outcomes (public performance data)" },
    ],
  },
  {
    version: "1.0.759",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Contract Designer Dialog — full term editor (advance, royalty split, quotas, territories, termination fee) opens before sending any offer" },
      { type: 'fix', description: "Scout offers now open the Contract Designer instead of silently auto-generating contracts" },
      { type: 'fix', description: "Demo acceptance now opens the Contract Designer for term review before sending an offer" },
      { type: 'feature', description: "Contracts tab now shows action buttons: Withdraw Offer, Activate Contract, and expandable View Details for active contracts" },
      { type: 'feature', description: "Active contract details show singles/albums progress, recoupment status, termination fee, and contract value" },
      { type: 'improvement', description: "Contracts tab header shows status summary badges and pending offer count on the tab" },
    ],
  },
  {
    version: "1.0.758",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Season name now displayed alongside season emoji in location header and game date widget" },
      { type: 'feature', description: "Today's News header now shows current in-game season, day, and year" },
      { type: 'improvement', description: "Confirmed gig outcome reports are viewable for all bands from Today's News" },
    ],
  },
  {
    version: "1.0.757",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Simplified in-game date display to show day number instead of month name" },
    ],
  },
  {
    version: "1.0.756",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Seasonal Events Calendar page — browse all season-specific events grouped by season with encounter tracking" },
      { type: 'improvement', description: "Seasonal background effects now fade out after 10 seconds for better performance" },
      { type: 'improvement', description: "Moved season/year info from header bar into LocationHeader alongside city and local time" },
      { type: 'feature', description: "Character profile now displays in-game age based on starting age + game years elapsed" },
    ],
  },
  {
    version: "1.0.755",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Christmas Charts Race page — live leaderboard of December sales competing for Christmas Number One" },
      { type: 'feature', description: "Christmas Charts countdown banner, progress bar, and animated sales bars for top releases" },
      { type: 'feature', description: "Christmas Number One History section showing past winners" },
    ],
  },
  {
    version: "1.0.754",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Crypto Trade button now auto-scrolls to the trading panel so it's immediately visible" },
      { type: 'fix', description: "Fixed stale holdings data in buy/sell mutations — now fetches fresh data from DB before each trade" },
    ],
  },
  {
    version: "1.0.753",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Game World Year System: fixed epoch (Jan 1, 2026) — all players now share the same in-game date" },
      { type: 'feature', description: "Season display in header bar showing current season emoji, month name, and game year" },
      { type: 'feature', description: "Global seasonal visual effects — snowfall, blossoms, leaves, and sparkles rendered on every page" },
      { type: 'feature', description: "Spring and autumn decorations added to seasonal background effects" },
      { type: 'feature', description: "Christmas sales boost — progressive multiplier (1.5x→2.5x) during in-game December" },
      { type: 'feature', description: "Christmas Number One table — records the #1 selling release on Dec 25 each game year" },
      { type: 'feature', description: "16 seasonal random events added (4 per season) — Snowbound Studio, Summer Anthem, Halloween Special, and more" },
      { type: 'improvement', description: "Player aging now uses global game year instead of per-player creation date" },
    ],
  },
  {
    version: "1.0.752",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Player Search: expanded profile details — fame, level, fans, city, hours played" },
      { type: 'feature', description: "Player Search: inline Friend Request button with status tracking (Add/Sent/Accept/Friends)" },
      { type: 'feature', description: "Player Search: inline DM dialog to message any player directly from search results" },
    ],
  },
  {
    version: "1.0.751",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Housing: country and city filter dropdowns to browse properties in any country" },
      { type: 'improvement', description: "Housing: city selector adjusts rental pricing based on local cost of living" },
      { type: 'improvement', description: "Housing: 'My Location' button to quickly reset filters to current city" },
    ],
  },
  {
    version: "1.0.750",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Admin: Release Pump — boost any release's digital sales with configurable amounts (1-100K)" },
      { type: 'feature', description: "Admin: Release Pump processes sales through standard tax & distribution pipeline, crediting band finances correctly" },
      { type: 'improvement', description: "Verified record sales correctly credit net revenue (after tax + distribution) to band_earnings and band_balance" },
    ],
  },
  {
    version: "1.0.749",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Major Events: auto-perform when game date passes event date — no manual triggering needed" },
      { type: 'feature', description: "Major Events: 3-tab layout — Upcoming, My Performances, and Event History" },
      { type: 'feature', description: "Major Events: frequency_years column — Olympics/World Cup every 4 years, others annually" },
      { type: 'improvement', description: "Major Events: history tab shows all past event instances with player performance badges" },
      { type: 'improvement', description: "Major Events: 'Watch Live' button during in-progress performances" },
    ],
  },
  {
    version: "1.0.748",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Batch housing image generator — generates all 1,260 missing property images automatically via AI" },
      { type: 'feature', description: "New 'Generate All Missing Images' button on Housing page with live progress tracking" },
    ],
  },
  {
    version: "1.0.747",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Added Major Events and Housing links to horizontal navigation (were missing)" },
    ],
  },
  {
    version: "1.0.746",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed duplicate UK/United Kingdom entries in TV networks — normalized all to 'United Kingdom'" },
    ],
  },
  {
    version: "1.0.745",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "TV Network logos — brand-styled logo badges for 50+ real-world networks (BBC, NBC, ITV, Canal+, ARD, NHK, etc.)" },
      { type: 'improvement', description: "TV Shows browser now displays network logos on each show card and in the network filter dropdown" },
      { type: 'improvement', description: "Unknown networks automatically get a deterministic color badge based on their name" },
    ],
  },
  {
    version: "1.0.744",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Song Fame system — cumulative fame score based on streams, sales, radio plays, hype, global reach, and gig plays" },
      { type: 'feature', description: "Song Popularity — dynamic hotness meter (0-1000) that grows with gig plays and hype, decays with overplay, and recovers when rested" },
      { type: 'feature', description: "Fan Favourite system — songs can randomly become fan favourites after gigs (3% base chance, boosted by crowd response and encore placement)" },
      { type: 'feature', description: "Encore fame bonus — playing a famous song (fame ≥300) as encore gives 1.15x performance multiplier; fan favourites get 1.25x" },
      { type: 'feature', description: "Fame-aware gig commentary — new commentary lines for famous songs, fan favourites, and legendary encores" },
      { type: 'improvement', description: "Repertoire cards now display fame (flame icon), popularity (trend arrow), and fan favourite (gold star) badges" },
      { type: 'feature', description: "Song Rankings now include 'Fame' as a ranking type" },
    ],
  },
  {
    version: "1.0.743",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Consolidated Songs and Repertoire tabs into a single Repertoire tab with Active/Archived sub-views" },
      { type: 'feature', description: "Songs can be archived and restored with one click — archived songs are excluded from setlists, rehearsals, and recordings" },
      { type: 'improvement', description: "Rehearsal song picker now filters out archived songs automatically" },
    ],
  },
  {
    version: "1.0.742",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Added category filter chips to university course browser — filter by Instruments, Vocals, Genres, Production, Performance, Composition, and Technology" },
      { type: 'improvement', description: "Improved course search to match against formatted skill names, university names, and cities — multi-word queries now work correctly" },
      { type: 'feature', description: "Active filter badges with one-click removal and 'Clear all' button for easy filter management" },
      { type: 'improvement', description: "Course cards now show duration and required skill level badges for better at-a-glance comparison" },
      { type: 'improvement', description: "Skill slugs now display as readable labels (e.g., 'basic_keyboard' → 'Keyboard')" },
    ],
  },
  {
    version: "1.0.741",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Added 78 new Legendary Masters covering 89 skill categories — mentors now available for all core skills, genres, instruments, production, and performance" },
      { type: 'feature', description: "New masters span 30+ cities worldwide with unique lore, discovery hints, and day-of-week availability" },
      { type: 'feature', description: "Added 344 new university courses for instrument skills — guitar, bass, drums, keyboard, singing, strings, brass, woodwinds, percussion, and electronic instruments" },
      { type: 'improvement', description: "Instrument courses now include specialized topics like Slap Bass, Jazz Drumming, Modular Synthesis, Slide Guitar, and more" },
    ],
  },
  {
    version: "1.0.739",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Added ~50 new cities across Africa (Dakar, Kinshasa, Kampala), Asia (Osaka, Hanoi, Beirut, Doha), South America (Quito, Caracas, San Juan), Eastern Europe (Kyiv, Tbilisi, Sarajevo), and more" },
      { type: 'feature', description: "Seeded 2-3 small starter venues (cafes, indie venues, clubs) for every city that had zero venues — ~170 new venues total" },
      { type: 'improvement', description: "All new venues are prestige level 1 with zero fame/fan requirements so new players can perform anywhere in the world" },
    ],
  },
  {
    version: "1.0.738",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "PR Offers: Fixed podcast/newspaper/magazine queries using wrong column names, preventing offer generation" },
      { type: 'fix', description: "Modeling: Contracts with past shoot dates no longer block new offers" },
      { type: 'feature', description: "Modeling: Daily updates now auto-complete past contracts, awarding compensation and fame to players" },
    ],
  },
  {
    version: "1.0.737",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Seeded 90+ TV shows across all countries — Australia, Brazil, Canada, France, Germany, Ireland, Italy, Japan, Netherlands, Norway, South Korea, Spain, Sweden, and global streaming platforms" },
      { type: 'feature', description: "Every TV network now has shows including realistic hosts, time slots, and viewer reach values" },
      { type: 'feature', description: "Added shows for UK networks without content (ITV4, Film4, Drama, Channel 5) and extra US shows (Austin City Limits, The Masked Singer)" },
    ],
  },
  {
    version: "1.0.735",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Inventory: Book Library now shows books from actual reading sessions instead of empty legacy table" },
      { type: 'feature', description: "Inventory: Added House Keys tab showing all owned properties with details" },
    ],
  },
  {
    version: "1.0.734",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Gear: Added 28 Harley Benton items — electric guitars (13), acoustics (4), basses (4), amps (2), effects (4), keyboard (1)" },
      { type: 'feature', description: "Gear: Added 31 items from Squier, Jackson, Cort, Chapman, Sterling, Charvel, Reverend, Gretsch, Danelectro, Kramer, Sire, and more" },
      { type: 'improvement', description: "Gear catalog expanded from 506 to 565 items across all categories" },
    ],
  },
  {
    version: "1.0.733",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Seeded 1,155 new jobs across 55 previously empty cities — all 134 cities now have 21 jobs each covering all categories" },
    ],
  },
  {
    version: "1.0.732",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed navigation dropdown menus rendering behind page content by increasing z-index stacking context" },
    ],
  },
  {
    version: "1.0.731",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed music video earnings not recording to band_earnings — amount column required integer rounding" },
      { type: 'feature', description: "Band earnings stats grid now shows all source categories: Gigs, Streaming, Merch, Music Videos, Sales, PR & Media" },
      { type: 'feature', description: "Clickable filter cards in band earnings — click any category to filter the transaction list by source type" },
      { type: 'improvement', description: "Added proper icons and color coding for music_video, release_sales, and pr_appearance source types" },
    ],
  },
  {
    version: "1.0.730",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed music charts not updating since Jan 28 — chart_type column was too narrow (varchar 20→40) causing daily failures" },
      { type: 'fix', description: "Added deduplication to chart entry generation to prevent unique constraint violations" },
      { type: 'improvement', description: "Chart updates now use batch inserts for reliability" },
    ],
  },
  {
    version: "1.0.729",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Song Marketplace: New 'Top Sales' tab showing top 100 completed sales ranked by price with gold/silver/bronze highlights" },
    ],
  },
  {
    version: "1.0.728",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Wellness page recovery program text no longer gets cut off on mobile — buttons now wrap text properly" },
    ],
  },
  {
    version: "1.0.727",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Reverted global font-size override that was breaking rem-based layouts (gear page, tabs, dropdowns) — root font-size stays at browser default 16px" },
    ],
  },
  {
    version: "1.0.726",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Reduced global text size slightly across all pages (14px mobile, 15px tablet, 16px desktop) for better content density" },
      { type: 'fix', description: "Today's News page spacing tightened so more content fits on mobile screens" },
    ],
  },
  {
    version: "1.0.725",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Advisor text no longer overflows on mobile — messages and action buttons now wrap properly" },
    ],
  },
  {
    version: "1.0.724",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Country flags now use CSS-based SVG flags (flag-icons) instead of emoji — fixes flags not displaying on Windows desktop browsers" },
    ],
  },
  {
    version: "1.0.723",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Release Hype System — hype_score (0-1000) on releases accumulates from campaigns, release parties, and activities" },
      { type: 'feature', description: "Interactive Release Parties — 5-question timed mini-game (reuses interview architecture) with 100 unique party-themed questions across 5 categories" },
      { type: 'feature', description: "Hype impacts sales — hypeMultiplier (1x at 0, 3x at 1000) applied to daily sales calculations" },
      { type: 'feature', description: "Hype impacts streams — streaming revenue now boosted by release hype score" },
      { type: 'feature', description: "First-week sales boost — 1.5x multiplier for releases within 7 days of launch, stacks with hype" },
      { type: 'feature', description: "Hype decay — 5% daily reduction after first week keeps hype from lasting forever" },
      { type: 'feature', description: "Promotional campaigns now actually apply their hypeBoost to release hype_score daily while active" },
      { type: 'feature', description: "HypeMeter component shows visual hype level (Cold → Warming Up → Building → Hot → VIRAL) on release cards" },
    ],
  },
  {
    version: "1.0.722",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Restored original user lyrics for 'Girls don't buy rounds' — AI-generated lyrics had overwritten the database field" },
      { type: 'fix', description: "Fixed song status restored to 'completed' since valid audio already exists" },
      { type: 'fix', description: "Cleaned up corrupted audio_prompt that contained duplicate Lyrics: sections" },
    ],
  },
  {
    version: "1.0.721",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed song generation failure — MiniMax Music requires lyrics ≤600 chars, now auto-truncates at section boundaries when lyrics exceed the limit" },
    ],
  },
  {
    version: "1.0.720",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Songs with existing audio no longer get stuck in 'failed' status — auto-recovery sets them back to 'completed'" },
      { type: 'fix', description: "AI-generated lyrics can no longer overwrite user-written lyrics when a song already has audio" },
      { type: 'improvement', description: "Improved lyrics sanitizer — catches duplicate Lyrics: headers, (You)/(Me) markers, and duplicate verse blocks more reliably" },
      { type: 'fix', description: "Blocked regeneration attempts on songs that already have a valid audio URL" },
    ],
  },
  {
    version: "1.0.719",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed duplicate 'Style: Style:' prefix in AI audio generation prompts" },
      { type: 'fix', description: "Fixed AI-generated lyrics being appended to existing user lyrics — now only the first/original lyrics are used" },
    ],
  },
  {
    version: "1.0.718",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed Replicate bitrate error — changed from 256 to 128000 (valid API value)" },
    ],
  },
  {
    version: "1.0.717",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "RM Radio now plays a Blondie radio host segment every 30 minutes, followed by the current #1 chart song" },
    ],
  },
  {
    version: "1.0.716",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed Replicate API error 'version is required / model not allowed' — switched to model-based predictions endpoint for AI song generation" },
    ],
  },
  {
    version: "1.0.715",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed gig_outcomes query using wrong column (user_id → band_id) causing dashboard stats to fail" },
      { type: 'fix', description: "Fixed player_equipment query using wrong column (profile_id → user_id) causing gear performance calculations to fail" },
    ],
  },
  {
    version: "1.0.714",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Investments now grow daily — growth_rate is applied to current_value each day via process-daily-updates" },
      { type: 'feature', description: "Withdraw button on investments — sell any position and return its current value to your cash balance" },
      { type: 'improvement', description: "Investment returns now visible as positions appreciate over time" },
    ],
  },
  {
    version: "1.0.713",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Admin Fame & Fans Gifting tool now supports adding money to band balances" },
      { type: 'improvement', description: "Band balance column shown in admin gifting table for quick reference" },
      { type: 'improvement', description: "Money grants logged as band_earnings for full audit trail" },
    ],
  },
  {
    version: "1.0.712",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed tax and distribution fees displaying 100x too high in My Releases (cents were shown as dollars)" },
      { type: 'fix', description: "Record sales now properly credit band balance — bands receive spendable cash from daily sales" },
      { type: 'improvement', description: "Clearer transaction labels in band finances (Record Sales, Video Revenue, Sponsorship, etc.)" },
    ],
  },
  {
    version: "1.0.711",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Housing & Rentals system — buy country-specific properties (20 tiers per country) or rent apartments (5 tiers)" },
      { type: 'feature', description: "1,280 unique housing types seeded across 64 countries with prices scaled by cost of living" },
      { type: 'feature', description: "5 rental options (1 Bed Flat to Villa) with weekly costs adjusted per country economy" },
      { type: 'feature', description: "AI-generated house images via Lovable AI Gateway, cached in Supabase Storage" },
      { type: 'feature', description: "Daily rent collection — active rentals auto-deduct from player cash; defaults end the lease" },
      { type: 'feature', description: "Property gallery showing all owned homes across countries" },
    ],
  },
  {
    version: "1.0.710",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed band debt — bands were going negative due to unchecked leader withdrawals, not record sales tax" },
      { type: 'fix', description: "Added offsetting earnings records to properly zero out 3 bands in debt (up to -$39.9M)" },
      { type: 'improvement', description: "Added database constraint preventing band_balance from ever going negative" },
      { type: 'fix', description: "Leader withdrawals now enforced at DB level — overdrafts are impossible" },
    ],
  },
  {
    version: "1.0.709",
    date: "2026-02-16",
    changes: [
      { type: 'feature', description: "Major Events system — 15 annual global events (Super Bowl, Olympics, World Cup, Grammys, etc.) invite bands to perform" },
      { type: 'feature', description: "3-song performances with live commentary and crowd reactions at major events" },
      { type: 'feature', description: "Cash, fame, and fan rewards scale with event prestige and performance quality" },
      { type: 'feature', description: "Fame-tiered invitations: Tier 1 (5000+), Tier 2 (2000+), Tier 3 (800+ fame)" },
      { type: 'feature', description: "Full outcome report with performance grade (S/A/B/C/D/F) and song-by-song breakdown" },
    ],
  },
  {
    version: "1.0.708",
    date: "2026-02-16",
    changes: [
      { type: 'fix', description: "Fixed record sales revenue display — cent values were shown as dollars (100x too high)" },
      { type: 'fix', description: "All financial fields (gross revenue, tax, distribution fees, net revenue) now correctly converted from cents to dollars" },
      { type: 'fix', description: "Reset 3 bands with negative balances (up to -$39.9M) back to $0" },
    ],
  },
  {
    version: "1.0.707",
    date: "2026-02-16",
    changes: [
      { type: 'improvement', description: "Reduced addiction trigger chances by ~40% across all partying intensities" },
      { type: 'improvement', description: "Lowered afterparty attendance addiction multipliers (2x→1.6x, 1.3x→1.2x)" },
      { type: 'feature', description: "Added 100 addiction craving events — addicted players now face temptation events matching their addiction type" },
      { type: 'feature', description: "Craving events offer Give In (short-term boost, severity increase) or Resist (health/XP reward) choices" },
      { type: 'improvement', description: "Increased all holiday destination prices (e.g. Beach Resort $80→$200/day, Tropical Island $150→$400/day)" },
      { type: 'fix', description: "Applied debt relief — players in negative cash reset to $500 minimum with debt flags cleared" },
    ],
  },
  {
    version: "1.0.706",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Removed unique constraint on lottery tickets allowing players to buy up to 10 tickets per draw as intended" },
    ],
  },
  {
    version: "1.0.705",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed lottery — number picker now resets after buying a ticket so you can immediately buy another" },
      { type: 'feature', description: "Added 'Previous Tickets' section on the Play tab showing past draw tickets with matched numbers highlighted" },
    ],
  },
  {
    version: "1.0.704",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed horizontal navigation — desktop dropdowns no longer clipped by overflow, click-to-toggle added, and mobile sheet menu now works properly" },
    ],
  },
  {
    version: "1.0.703",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed rehearsal studio upgrades — used SECURITY DEFINER function to prevent RLS recursion when checking room ownership" },
    ],
  },
  {
    version: "1.0.702",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed rehearsal studio upgrades — resolved RLS policy blocking owners from installing upgrades" },
    ],
  },
  {
    version: "1.0.701",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed label contract offers failing with 'integer out of range' — advance amounts could overflow when bands had high fame/fans" },
      { type: 'fix', description: "Clamped contract advance calculations to 3x tier maximum to prevent numeric overflow errors" },
    ],
  },
  {
    version: "1.0.700",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed 'Manage Factory' button on merch company doing nothing — removed no-op button from the management page where it was redundant" },
    ],
  },
  {
    version: "1.0.699",
    date: "2026-02-15",
    changes: [
      { type: 'feature', description: "Players can now buy up to 10 lottery tickets per weekly draw instead of 1" },
      { type: 'feature', description: "Current jackpot amount is now displayed prominently on the lottery page" },
    ],
  },
  {
    version: "1.0.698",
    date: "2026-02-15",
    changes: [
      { type: 'fix', description: "Fixed lottery ticket purchase — added missing INSERT RLS policy for lottery_draws table" },
    ],
  },
  {
    version: "1.0.697",
    date: "2026-02-15",
    changes: [
      { type: 'feature', description: "Weekly in-game lottery — pick 7 numbers (1-49) and 1 bonus number (1-10) for a chance to win up to $1,000,000 + XP + Fame" },
      { type: 'feature', description: "Number picker grid with Quick Pick random selection, $500 ticket cost, 1 ticket per player per week" },
      { type: 'feature', description: "8 prize tiers from 3 matches (free ticket refund) up to 7+Bonus (jackpot)" },
      { type: 'feature', description: "Live countdown to next Monday draw, Results tab with match highlighting, History tab with past draws" },
      { type: 'feature', description: "lottery-draw edge function generates winning numbers and auto-awards prizes weekly" },
    ],
  },
  {
    version: "1.0.696",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed label staff hiring/firing failing silently — RLS policies were comparing profile IDs (owner_id) against auth user IDs (auth.uid())" },
      { type: 'fix', description: "Fixed record label contract offers for bands not working — INSERT policy only checked created_by which is NULL for transferred labels" },
      { type: 'fix', description: "Fixed label financial transactions and distribution deals being blocked by the same owner_id vs auth.uid() mismatch" },
      { type: 'improvement', description: "All label-related RLS policies now resolve ownership through both created_by and profile-based owner_id lookup" },
    ],
  },
  {
    version: "1.0.695",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Reseeded all university courses for every skill tree skill — 23,000+ courses across all universities" },
      { type: 'improvement', description: "Major music cities (London, Nashville, Chicago, Atlanta, etc.) now offer courses for ALL skills; smaller cities offer ~40% of skills" },
      { type: 'improvement', description: "Increased XP rewards across all tiers: Basic 15-46, Professional 25-68, Mastery 40-95 per day" },
      { type: 'improvement', description: "Standardized all course durations to 14-28 days" },
    ],
  },
  {
    version: "1.0.694",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed country flags not showing for cities with abbreviated country names (USA, UAE) by adding alias resolution" },
    ],
  },
  {
    version: "1.0.693",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Added searchable all-cities list with country flags to the dashboard Location tab, grouped by country with links to each city page" },
    ],
  },
  {
    version: "1.0.692",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed inventory items not disappearing after use — missing RLS UPDATE policy on underworld_purchases was silently blocking the is_used flag update" },
    ],
  },
  {
    version: "1.0.691",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "DJ & Club Performance skill tree — 21 new skills across 7 tracks: Beatmatching, Mixing, Crowd Reading, Set Building, Scratching, Live Remixing, and Club Promotion" },
      { type: 'feature', description: "DJ performance system — Queue for DJ Slot now runs skill-based performance scoring with cash payouts, fame gains, fan gains, and XP awards" },
      { type: 'feature', description: "DJ performance dialog — shows score (0-100), outcome label, rewards grid, and addiction warnings after each set" },
      { type: 'feature', description: "DJ Scratching cross-prerequisite — requires Basic Turntablism skill from the Instruments tree" },
      { type: 'feature', description: "player_dj_performances table tracks full DJ set history per club" },
      { type: 'improvement', description: "DJ payouts scale with performance score — exceeding expectations earns more than base payout" },
    ],
  },
  {
    version: "1.0.690",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Nightlife event triggers — visiting clubs or queuing for DJ slots now rolls for addiction based on partying_intensity and afterparty_attendance behavior settings" },
      { type: 'feature', description: "New useNightlifeEvents hook with energy cost, cash cost, fame gain, and addiction roll per nightclub activity" },
      { type: 'improvement', description: "Visit as Guest and Queue for DJ Slot buttons are now functional with loading states and outcome toasts" },
    ],
  },
  {
    version: "1.0.689",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Underworld products can now be tagged with an Addiction Type (alcohol, substances, gambling, partying) from admin" },
      { type: 'feature', description: "Using items with addiction_type triggers addiction risk — 30% chance of new addiction, or increases existing severity" },
      { type: 'improvement', description: "Inventory items are consumed (single-use) and removed after use via is_used flag" },
    ],
  },
  {
    version: "1.0.688",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Hospital system — check in when health is critical, auto-hospitalization on collapse, recovery based on hospital effectiveness" },
      { type: 'feature', description: "Addiction & recovery system — alcohol, substances, gambling, partying addictions triggered by nightlife behavior" },
      { type: 'feature', description: "Three recovery paths: Therapy ($100/session), Rehab (full blocking program), Cold Turkey (free but risky)" },
      { type: 'feature', description: "Holiday system — 6 destinations with health boosts, blocks all activities except songwriting" },
      { type: 'improvement', description: "Wellness page restructured into 5 tabs: Overview, Activities, Hospital, Addictions, Holidays" },
      { type: 'fix', description: "Auto-hospitalization replaces basic rest_required_until mechanic when health hits 0" },
    ],
  },
  {
    version: "1.0.687",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Modeling now uses an incoming-offers system — offers arrive based on your looks/fame, accept or decline like media offers" },
      { type: 'feature', description: "Auto-generates 1-3 modeling offers on page visit with cooldown to prevent spam" },
      { type: 'fix', description: "Offers Dashboard now pulls real data from modeling, media, gig, and sponsorship tables instead of hardcoded placeholders" },
      { type: 'improvement', description: "Unified KPI cards, trend charts, and filterable table across all offer sources" },
    ],
  },
  {
    version: "1.0.686",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Overhauled Underworld crypto market — 100 seeded tokens across 4 volatility tiers with live price simulation" },
      { type: 'feature', description: "Added simulate-crypto-market edge function with volatility, momentum, downward drift, and player impact on prices" },
      { type: 'feature', description: "Rug-pull mechanic — micro/mid-cap tokens can randomly drop to $0 and get replaced with fresh tokens" },
      { type: 'feature', description: "Live trading UI — working buy/sell orders, portfolio panel with P&L tracking, price flash animations" },
      { type: 'feature', description: "Auto-refresh prices every 30 seconds, rug alert banners for held tokens that get rugged" },
    ],
  },
  {
    version: "1.0.685",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed cover songs failing to save to repertoire due to database constraint — added 'cover' as valid song version and restored missing 'Blue (Cover)'" },
    ],
  },
  {
    version: "1.0.684",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Covering a song now creates a copy in your band's repertoire — available for rehearsal and recording with cover quality scaling" },
    ],
  },
  {
    version: "1.0.683",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed 'Unknown Artist' on Song Rankings — now shows band artist_name with band name fallback" },
    ],
  },
  {
    version: "1.0.682",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Retroactively estimated historical sales based on days since release — unit counts and revenue display updated without adding money to player accounts" },
    ],
  },
  {
    version: "1.0.681",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Normalized all release format retail prices to standard defaults (Digital $9.99, CD $14.99, Vinyl $29.99, Cassette $12.99)" },
      { type: 'fix', description: "Recalculated all sales revenue based on corrected pricing" },
    ],
  },
  {
    version: "1.0.680",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed uuid/text type mismatch in complete_song_sale RPC for buyer_user_id and bidder_user_id columns" },
    ],
  },
  {
    version: "1.0.679",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Song Rankings sales tab now shows actual units sold (quantity_sold) instead of revenue amounts in cents" },
    ],
  },
  {
    version: "1.0.678",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed 'operator does not exist: uuid = text' error when accepting song marketplace bids — current_bidder_user_id column changed from text to uuid" },
      { type: 'fix', description: "Removed unsafe text casts in complete_song_sale and place_song_bid RPC functions" },
    ],
  },
  {
    version: "1.0.677",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Record sales rebalanced: logarithmic fame scaling replaces linear (fame 1M now gives ~4x instead of 100x+)" },
      { type: 'fix', description: "Fixed retail price unit mismatch — prices now consistently stored in cents and correctly converted for revenue calculations" },
      { type: 'fix', description: "Release unit counters (digital_sales, cd_sales, vinyl_sales, cassette_sales, total_units_sold) now properly increment with each daily sale" },
      { type: 'fix', description: "Reset all inflated release revenue and sales data to zero — sales will rebuild naturally from corrected calculations" },
      { type: 'fix', description: "Removed inflated band_earnings from release_sales source" },
    ],
  },
  {
    version: "1.0.676",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Country & city filter on recording studios — browse and book studios worldwide, defaults to your current location" },
      { type: 'feature', description: "Location validation: recording sessions now fail if band members are not in the studio's city when the session completes" },
      { type: 'improvement', description: "Failed recording sessions display reason (e.g. 'Band members were not in the studio city') with red badge" },
    ],
  },
  {
    version: "1.0.675",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Song rankings now pull streams from song_releases and sales from release_sales — no longer blank" },
      { type: 'fix', description: "Sales rankings now correctly aggregate per-song revenue across all release formats" },
    ],
  },
  {
    version: "1.0.674",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Interview modal no longer triggers back-to-back — 10-minute cooldown between prompts" },
      { type: 'improvement', description: "Added Skip Interview button so players can dismiss without completing" },
      { type: 'fix', description: "Old pending interviews (7+ days) are auto-completed to clear backlog" },
    ],
  },
  {
    version: "1.0.673",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Removed duplicate cities (Atlanta, Detroit, Nashville) — education mentor references reassigned to canonical city entries" },
      { type: 'improvement', description: "Added unique constraint on cities (name + country) to prevent future duplicates" },
    ],
  },
  {
    version: "1.0.672",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Release creation now shows per-format cost breakdown and per-song manufacturing cost estimate" },
      { type: 'feature', description: "Release cards now display full financial breakdown: manufacturing cost, gross revenue, tax paid, distribution fees, and profit/loss" },
      { type: 'feature', description: "Release analytics dialog now has a Financials tab with a full P&L statement and per-song revenue/cost breakdown" },
      { type: 'feature', description: "Stats overview now shows Total Tax Paid and Net Profit across all releases" },
    ],
  },
  {
    version: "1.0.671",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed crash on songwriting page — SongwritingInstrumentSelector now wraps itself in SkillSystemProvider" },
    ],
  },
  {
    version: "1.0.670",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "All song quality scores re-valued with ±30% variance per song — no more identical round numbers" },
      { type: 'improvement', description: "Song quality now scales with band songwriting skill: higher-skilled bands (e.g. Big Fowler avg ~351, Barbarela avg ~319) produce noticeably better songs than lower-skilled bands (avg ~150)" },
    ],
  },
  {
    version: "1.0.669",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Daily attribute points now scale with progression — new players receive 10 AP, decaying to a minimum of 3 AP as lifetime Skill XP grows (1,000–10,000 SXP range)" },
      { type: 'improvement', description: "Stipend card now shows your current scaled AP amount based on career progression" },
    ],
  },
  {
    version: "1.0.668",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "All game systems now use the Skill Tree (skill_progress) instead of the legacy player_skills table — gig performance, XP gains, career stats, and retirement inheritance all read from the modern skill system" },
      { type: 'improvement', description: "Gig skill improvements now award XP to skill_progress entries instead of updating flat player_skills columns" },
      { type: 'improvement', description: "Retirement inheritance now preserves and restores skills via skill_progress rows, supporting the full skill tree" },
      { type: 'fix', description: "Career overview skill summary now reflects actual trained skill tree levels instead of potentially stale legacy values" },
    ],
  },
  {
    version: "1.0.667",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Interactive media interviews: when a PR media offer completes, players now play through a 3-question interview mini-game with 4 response options each" },
      { type: 'feature', description: "10-second countdown timer per question — if time runs out, the worst response is auto-selected" },
      { type: 'feature', description: "Interview responses modify fame, fans, cash multipliers and reputation axes (authenticity, attitude, reliability, creativity)" },
      { type: 'feature', description: "100 seeded interview questions across 6 categories: Career, Controversy, Personal, Music, Industry, and Fan Engagement" },
      { type: 'improvement', description: "Questions are filtered by media type (podcast, TV, radio, newspaper, internet, magazine) for contextual interviews" },
    ],
  },
  {
    version: "1.0.666",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Masterpiece roll: players with near-maxed songwriting + vocal skills (combined 30+) have a rare ~2% chance to write a legendary song (quality 800-950) that bypasses the soft cap" },
      { type: 'improvement', description: "Recording soft cap relaxed for high-quality songs — a masterpiece song (800-950) with perfect recording conditions can now reach 900-1000 quality" },
      { type: 'improvement', description: "Reaching 1000 is still extraordinarily rare: requires both a masterpiece roll AND a flawless recording with top studio, producer, skills, and genre match" },
    ],
  },
  {
    version: "1.0.665",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "Song quality now has a soft cap — diminishing returns above 500 (songwriting) and 600 (recording) make reaching 1000 virtually impossible; maxed players average ~550 with exceptional luck reaching ~750" },
      { type: 'improvement', description: "Reduced skill/attribute/instrument/experience contribution scaling in songwriting formula to better reflect early-game progression" },
      { type: 'improvement', description: "Recording quality also applies a soft cap curve — stacking all bonuses no longer trivially pushes songs to max quality" },
    ],
  },
  {
    version: "1.0.664",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Deflated all existing song quality scores — songs were inflated from the 10x scale migration; scores now capped at 500 (avg ~310) to reflect early-game skill levels" },
      { type: 'improvement', description: "New songs written with trained skills will naturally score higher than legacy songs, creating a real sense of progression" },
    ],
  },
  {
    version: "1.0.663",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "Tiered skill bonuses: genre, instrument, and recording skills now scale non-linearly — early levels give small bonuses, higher levels give progressively more, and mastered skills (level 20) receive a flat +5% mastery bonus on top" },
      { type: 'improvement', description: "Genre skill bonus increased from max 20% to max 28% at mastery, with accelerating returns at higher tiers" },
      { type: 'improvement', description: "Recording skill bonuses (mixing, DAW, production, vocal, theory) now use tiered scaling — mastered categories provide significantly more bonus than mid-level ones" },
      { type: 'improvement', description: "Instrument performance skills use tiered curve — mastered instruments contribute disproportionately more to gig performance scores" },
    ],
  },
  {
    version: "1.0.662",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Genre skill tree now affects gig performance — bands trained in a song's genre get up to 20% performance boost per song" },
      { type: 'feature', description: "Genre skill tree now affects recording quality — up to 20% bonus when recording songs matching your trained genre" },
      { type: 'improvement', description: "Per-song genre matching: each song in a setlist checks the band's skill in that song's specific genre, not just the band's primary genre" },
    ],
  },
  {
    version: "1.0.661",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Gig performance now uses Skill Tree (skill_progress) instead of legacy player_skills table — trained skills finally affect gig outcomes" },
      { type: 'fix', description: "Migrated all existing song quality scores from 0-100 to 0-1000 scale so older songs no longer drag down gig ratings" },
      { type: 'feature', description: "Player attributes (stage_presence, charisma) now factor into gig performance — stage skill average uses 60% stage presence + 40% charisma" },
      { type: 'improvement', description: "Band skill calculator now calls calculatePerformanceModifiers() which includes gear bonuses — equipped instruments directly boost gig scores" },
      { type: 'improvement', description: "Gig execution uses calculateBandSkillAverage() for live skill+gear data instead of static skill_contribution column" },
    ],
  },
  {
    version: "1.0.660",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Song quality scale unified to 0-1000 — database function and all UI displays now use the full 1000-point scale instead of capping at 100" },
      { type: 'feature', description: "Instrument selection in songwriting — players now pick featured instruments when creating a project, with skill levels directly affecting song quality" },
      { type: 'feature', description: "Instrument skill bonus: each selected instrument contributes up to 30 quality points based on player skill level (diminishing returns after 4 instruments)" },
      { type: 'improvement', description: "DB auto-complete function now calculates quality on 0-1000 scale with instrument skill bonuses factored in" },
      { type: 'fix', description: "Fixed gig performance, radio submit, and jam session dialogs displaying quality out of 100 instead of 1000" },
      { type: 'improvement', description: "Song Quality Breakdown now shows 'Instrumentation' category when instruments are selected" },
    ],
  },
  {
    version: "1.0.659",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed Song Rankings page failing to load due to broken foreign key join on profiles table" },
      { type: 'fix', description: "Fixed Song Rankings showing 'nav.songRankings' instead of 'Song Rankings' in navigation — added missing translation key" },
    ],
  },
  {
    version: "1.0.658",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "Floating avatar widget now shows unread inbox count badge instead of level number — only appears when there are unread messages" },
      { type: 'improvement', description: "Clicking the floating avatar now navigates directly to the Inbox page instead of toggling an info panel" },
      { type: 'improvement', description: "Removed expanded info panel from avatar widget for a cleaner, more purposeful interaction" },
    ],
  },
  {
    version: "1.0.657",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Song Rankings: New page at /song-rankings ranking all released/recorded songs by Quality, Sales (digital + CD + vinyl + cassette), and Streams" },
      { type: 'feature', description: "Cover Songs: Bands can license songs from the rankings to add to their repertoire — choose between a flat fee or 50% royalty split" },
      { type: 'feature', description: "Cover Quality Scaling: Cover quality = original quality × band skill multiplier (20%-100%), preventing low-skill bands from exploiting top songs" },
      { type: 'feature', description: "Cover song flat fees are calculated as quality × $10 and paid to the original band. Royalty splits pay 50% of all cover revenue to the original artist" },
      { type: 'improvement', description: "Song rankings include inline audio player, genre filters, and search — cover button only appears for songs not owned by your band" },
    ],
  },
  {
    version: "1.0.656",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Contract Offers Hub: Pending offers now have an 'ACTION REQUIRED' banner with expiry countdown, plain-English obligations summary, and confirmation dialogs for accept/reject" },
      { type: 'feature', description: "Active Contract Obligations: Each active contract now shows a 'Your Obligations' dashboard with time remaining, singles/albums progress with behind/overdue warnings, and recoupment status in plain English" },
      { type: 'feature', description: "Label-Owned Studio: Signed artists recording at studios owned by their label's parent company now get FREE recording — studio shows 'FREE — Label Studio' badge and $0 cost" },
      { type: 'feature', description: "Interactive Label Directory: Label cards now expand to show current roster, recent releases, genre match indicator, and typical deal types" },
      { type: 'improvement', description: "Contract offers now expire after 7 game days with visual urgency (pulsing border when < 2 days left)" },
      { type: 'improvement', description: "Accept/reject contract buttons now require confirmation via dialog to prevent accidental clicks" },
    ],
  },
  {
    version: "1.0.655",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Recording Tiers: New 'Demo' vs 'Professional' recording type selector in the recording wizard" },
      { type: 'feature', description: "Demo recordings: Standard cost, 4-hour sessions, quality capped at 60% of studio rating with 0.7x multiplier — great for early-career testing" },
      { type: 'feature', description: "Professional recordings: 2.5x studio rate, 8-hour sessions, full quality potential with no cap" },
      { type: 'feature', description: "Label bonus: +15% quality boost when recording professionally while signed to a label" },
      { type: 'feature', description: "Independent penalty: -15% quality penalty for professional recordings without a label, reduced by fame (every 100k) and level (every 10), fully removed at 500k fame or level 50" },
    ],
  },
  {
    version: "1.0.654",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Added floating avatar widget — player avatar is now always visible in the bottom-right corner with level badge, expandable info panel showing name/level/fame, and quick link to character page" },
    ],
  },
  {
    version: "1.0.653",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed 'Edit & Regenerate' — admin-edited lyrics now passed directly to generation, bypassing priority logic that was ignoring edits and using AI/project lyrics instead" },
    ],
  },
  {
    version: "1.0.652",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Admin: Added 'Edit & Regenerate' button — opens lyrics editor dialog to review/replace lyrics before regenerating AI audio" },
    ],
  },
  {
    version: "1.0.651",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "Reverted AI music generation from YuE back to MiniMax Music-1.5 model for better quality vocal songs (up to 4 mins)" },
      { type: 'fix', description: "Fixed missing styleParts declaration in generate-song-audio edge function" },
    ],
  },
  {
    version: "1.0.650",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Restored recoverable lyrics from songwriting projects back to songs table" },
      { type: 'fix', description: "Fixed regeneration to prefer non-AI project lyrics over AI-tagged song lyrics — strips [AI Generated] prefix and prioritizes original user work" },
    ],
  },
  {
    version: "1.0.648",
    date: "2026-02-14",
    changes: [
      { type: 'fix', description: "Fixed AI song generation timeout — switched to async webhook-based Replicate API calls so long YuE model generations no longer hit the 150s edge function limit" },
      { type: 'feature', description: "Added replicate-webhook edge function to handle async audio generation completion, download, and storage" },
    ],
  },
  {
    version: "1.0.647",
    date: "2026-02-14",
    changes: [
      { type: 'feature', description: "Added admin 'Regenerate' button on completed songs — admins can now re-trigger AI audio generation to test new models on existing songs" },
    ],
  },
  {
    version: "1.0.646",
    date: "2026-02-14",
    changes: [
      { type: 'improvement', description: "Switched AI music generation from MiniMax Music-1.5 to YuE model — songs now faithfully sing your actual written lyrics instead of paraphrasing them" },
      { type: 'improvement', description: "Removed 600-character lyrics limit — full song lyrics are now sent to the AI model for complete faithful reproduction" },
    ],
  },
  {
    version: "1.0.645",
    date: "2026-02-13",
    changes: [
      { type: 'feature', description: "Added alternative horizontal top navigation with hover dropdowns — can be toggled on/off from Admin Dashboard" },
      { type: 'feature', description: "Added Navigation Style toggle switch in Admin Dashboard to switch between sidebar and horizontal nav globally" },
    ],
  },
  {
    version: "1.0.644",
    date: "2026-02-12",
    changes: [
      { type: 'fix', description: "Fixed 404 error when clicking 'Manage Label' — navigation path corrected from /label-management/:id to /labels/:id/manage" },
    ],
  },
  {
    version: "1.0.643",
    date: "2026-02-12",
    changes: [
      { type: 'fix', description: "Fixed 404 errors when navigating to record labels from company dashboard — subsidiary labels now have correct ownership data" },
      { type: 'fix', description: "Fixed artists unable to accept or reject contract offers — added RLS policy allowing artists to update their own contracts" },
      { type: 'fix', description: "Fixed label owners unable to see demo submissions — added RLS policy for label owners to view and manage demos" },
      { type: 'fix', description: "Fixed record label management page not loading for subsidiary labels — backfilled missing created_by field" },
      { type: 'improvement', description: "Contract offers from player-owned labels can now be properly reviewed, accepted, or rejected by artists" },
    ],
  },
  {
    version: "1.0.642",
    date: "2026-02-11",
    changes: [
      { type: 'fix', description: "Fixed NPC labels never reviewing demo submissions — demos are now auto-processed every 4 hours with acceptance based on song quality, fame, fans, and genre match" },
      { type: 'fix', description: "Fixed contract creation failing due to missing start/end dates and incorrect deal type lookup" },
      { type: 'feature', description: "Label owners can now scout bands and offer record deals directly from the Roster tab without waiting for demo submissions" },
      { type: 'improvement', description: "Lowered NPC label acceptance threshold so more demos get accepted, especially for newer artists" },
      { type: 'improvement', description: "Demo review wait time reduced from 24 hours to 2 hours for faster feedback" },
    ],
  },
  {
    version: "1.0.641",
    date: "2026-02-10",
    changes: [
      { type: 'feature', description: "Added 10 new rap sub-genres: Conscious Rap, Gangsta Rap, Boom Bap, Cloud Rap, Mumble Rap, Grime, Crunk, Phonk, Emo Rap, Jazz Rap" },
      { type: 'feature', description: "Added 5 new rap-focused skills: Freestyle Rap, Battle Rap, Flow & Cadence, Rap Songwriting, Ad-Libs & Vocal FX — each with 3 tiers" },
      { type: 'improvement', description: "Country flags now display next to city names on the dashboard location tab" },
      { type: 'improvement', description: "Radio stations and Mayor Dashboard now use the centralized genre list from the skill hierarchy" },
      { type: 'feature', description: "Seeded new university courses, books, and YouTube videos for rap-related skills" },
    ],
  },
  {
    version: "1.0.640",
    date: "2026-02-09",
    changes: [
      { type: 'improvement', description: "Songwriting: Songs now have more variable session counts — breakthrough sessions (skill-based chance) can dramatically speed up progress, while creative blocks slow things down" },
      { type: 'feature', description: "Songwriting: Experience bonus — the more songs you've written, the higher quality your new songs will be (diminishing returns, up to +50 quality points)" },
      { type: 'feature', description: "Songwriting: Session depth bonus — songs that take more sessions to complete get a quality bonus (up to +35 points for extra-refined work)" },
      { type: 'improvement', description: "Songwriting: Higher songwriting skills now increase the chance of breakthrough sessions (15% base → up to 35%), meaning skilled writers finish songs faster" },
      { type: 'improvement', description: "Recording: Added session luck rolls — 'Magic Takes' (8% chance, up to 2x quality boost) and 'Technical Issues' (8% chance, reduced quality) for more varied recording outcomes" },
      { type: 'improvement', description: "Gigs: Widened random performance factor from ±5 to ±8, with rare 3% chance of extreme outcomes (disaster or night-of-their-lives)" },
      { type: 'improvement', description: "Gigs: Fame and fan gains now have ±25% and ±20% random variance respectively, making each gig outcome feel more unique" },
      { type: 'improvement', description: "Songwriting: Widened quality luck swings — Terrible Days now reduce quality up to 25%, Lightning Strikes boost up to 35%" },
    ],
  },
  {
    version: "1.0.639",
    date: "2026-02-08",
    changes: [
      { type: 'feature', description: "AI Music Videos: Videos now play with the full song audio — the generated video clip loops while the song plays for its entire duration" },
      { type: 'improvement', description: "AI Music Videos: Added 'Full Song' badge and combined mode status indicator showing both video and audio are playing" },
      { type: 'improvement', description: "AI Music Videos: Equalizer visualizer overlay now appears on video during combined playback" },
    ],
  },
  {
    version: "1.0.638",
    date: "2026-02-08",
    changes: [
      { type: 'fix', description: "AI Music Videos: Fixed 422 error from Replicate — minimax/video-01-live now requires a first_frame_image; added AI-generated first frame using Lovable AI (Gemini) before video generation" },
    ],
  },
  {
    version: "1.0.637",
    date: "2026-02-08",
    changes: [
      { type: 'fix', description: "Song Marketplace: Fixed 'operator does not exist: uuid = text' error when placing bids — corrected type casting in place_song_bid RPC" },
      { type: 'fix', description: "AI Music Videos: Fixed webhook callback not receiving Replicate responses — added verify_jwt=false config so external webhooks can reach the callback endpoint" },
    ],
  },
  {
    version: "1.0.636",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Song Marketplace: Fixed song title, artist, and quality not visible to buyers — added RLS policy so marketplace-listed songs are readable by all players" },
    ],
  },
  {
    version: "1.0.635",
    date: "2026-02-07",
    changes: [
      { type: 'feature', description: "Underworld Admin: Added 'Legal Item' checkbox — items can now be flagged as legal for store visibility" },
      { type: 'feature', description: "Underworld Admin: New activity boost effects — Next Gig Quality, Gig Earnings, Recording Quality, Songwriting Quality, and Creativity boosts" },
      { type: 'improvement', description: "Underworld Admin: Replaced JSON-based effects editing with dropdown-based UI — all effects are now toggle-and-configure, no manual JSON required" },
      { type: 'improvement', description: "Underworld: New boost types (gig/recording/songwriting) are properly registered as active boosts when purchased" },
    ],
  },
  {
    version: "1.0.634",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Avatar: Camera photos now work reliably — images are auto-compressed/resized to 1024px before sending to AI, preventing size-related failures" },
      { type: 'fix', description: "Avatar: Saved avatars now persist when navigating away and returning — the component loads the current avatar from the profile on mount" },
      { type: 'improvement', description: "Avatar: Returning users see their current avatar displayed when visiting the designer, with clear option to upload a new photo" },
    ],
  },
  {
    version: "1.0.633",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Streaming: Fixed listener demographics, average listeners, completion rate, and skip rate always showing empty — data now generated with realistic values" },
      { type: 'fix', description: "Streaming: Backfilled all 1337 existing analytics rows with demographics (age groups, regions), skip rates, completion rates, and listener counts" },
      { type: 'feature', description: "Playlists: Submissions are now auto-processed by curators — acceptance based on song quality vs playlist criteria, with stream boosts on acceptance" },
      { type: 'fix', description: "Playlists: Release selector now correctly filters to the player's own songs and band songs instead of showing all releases" },
      { type: 'feature', description: "Playlists: Added 'Check Status' button to process any pending submissions that weren't auto-reviewed" },
    ],
  },
  {
    version: "1.0.632",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Charts: Fixed singles/streaming/combined charts showing empty when no chart data exists for the current week — now falls back to the latest available chart data" },
      { type: 'improvement', description: "Charts: Weekly/monthly/yearly views automatically find and display the most recent chart period when current range has no entries" },
    ],
  },
  {
    version: "1.0.631",
    date: "2026-02-07",
    changes: [
      { type: 'feature', description: "DikCok: AI-generated thumbnails — each new video gets a unique, genre-styled thumbnail via Lovable AI (Gemini image model)" },
      { type: 'feature', description: "DikCok: Thumbnails are stored permanently in Supabase Storage and displayed on video cards and detail views" },
      { type: 'improvement', description: "DikCok: Video cards now show thumbnail images instead of gradient placeholders, with hover play button overlay" },
    ],
  },
  {
    version: "1.0.630",
    date: "2026-02-07",
    changes: [
      { type: 'improvement', description: "Today's News: Gig results now show ALL bands (not just other bands), renamed to 'Today's Gig Results'" },
      { type: 'feature', description: "Today's News: Players can now view full gig outcome reports for any band's gig via a 'View' button" },
    ],
  },
  {
    version: "1.0.629",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Dashboard: Friends chat section now fits on mobile — channel list scrolls horizontally and chat uses viewport-relative height" },
    ],
  },
  {
    version: "1.0.628",
    date: "2026-02-07",
    changes: [
      { type: 'improvement', description: "Song Market: Only unrecorded draft songs can be listed — songs that have been recorded, added to a setlist, or rehearsed are now excluded" },
    ],
  },
  {
    version: "1.0.627",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Song Market: Fixed song selection — draft songs are now eligible for listing" },
      { type: 'fix', description: "Song Market: Archived songs are now excluded from the sellable songs list" },
    ],
  },
  {
    version: "1.0.626",
    date: "2026-02-07",
    changes: [
      { type: 'improvement', description: "How to Play: Complete overhaul — added new Skills tab with all 12+ categories and gameplay impact details" },
      { type: 'improvement', description: "How to Play: Updated Recording, Rehearsal, and Gig sections to explain skill-based bonuses" },
      { type: 'feature', description: "How to Play: Added sections for Employment, Labels, Relationships, Underworld, and passive growth" },
      { type: 'improvement', description: "How to Play: Refreshed tips to reflect skill-driven career progression" },
    ],
  },
  {
    version: "1.0.625",
    date: "2026-02-07",
    changes: [
      { type: 'improvement', description: "Skills: Removed 3 duplicate skill tracks (Singing → Vocal Performance, Live Looping → Loop Station, Vocal FX → Vocal Production)" },
      { type: 'feature', description: "Skills: Added Rapping Mastery tier for complete 3-tier progression" },
      { type: 'feature', description: "Skills: 5 new skill categories — Music Theory & Ear Training, Music Business & Industry, Improvisation, Audience Psychology, Music Health & Endurance" },
      { type: 'feature', description: "Recording: Player skills (mixing, DAW, production, theory) now boost recording quality by up to 30%" },
      { type: 'feature', description: "Rehearsals: Skill-based efficiency — higher instrument and theory skills mean faster familiarity gains (up to 1.6x)" },
      { type: 'feature', description: "Gigs: Stage skills (showmanship, crowd engagement, stage tech) now contribute 10% to gig performance alongside instrument skills" },
      { type: 'feature', description: "Gigs: Improvisation skill reduces chance of bad performance rolls and increases chance of great moments" },
    ],
  },
  {
    version: "1.0.624",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Underworld: Fixed items not disappearing from inventory after use — query cache invalidation mismatch corrected" },
      { type: 'fix', description: "Underworld: Items are now strictly single-use — once used, they are consumed and removed from inventory" },
      { type: 'feature', description: "Underworld: Cash effect now supported on consumable items (adds/removes cash on use)" },
      { type: 'improvement', description: "Underworld: All item effects (health, energy, XP, fame, cash, skill XP) now correctly applied on use" },
    ],
  },
  {
    version: "1.0.623",
    date: "2026-02-07",
    changes: [
      { type: 'feature', description: "Labels: Complete label management overhaul — owners can now review demos, manage contracts, release music, and hire staff." },
      { type: 'feature', description: "Labels: New Demo Submission system — send songs to labels and receive AI-generated contract offers based on your fame and song quality." },
      { type: 'feature', description: "Labels: Added AI logic for demo acceptance/rejection based on label reputation and genre fit." },
      { type: 'improvement', description: "Labels: Enhanced financial management with deposit/withdrawal and upgrade systems integrated directly into the dashboard." },
      { type: 'improvement', description: "Labels: Improved navigation and UI for the My Labels tab." },
    ],
  },
  {
    version: "1.0.622",
    date: "2026-02-07",
    changes: [
      { type: 'feature', description: "World: Added 48 new cities across UK (Leeds, Cardiff, Brighton, Sheffield, etc.), USA (Boston, Philadelphia, Denver, DC, etc.), Europe (Paris, Belgrade, Tallinn, Porto, etc.), and rest of world (Accra, Medellín, Perth, etc.)" },
      { type: 'feature', description: "World: 170+ new districts with unique vibes, safety ratings, music scene ratings, and rent costs for every new city" },
      { type: 'feature', description: "World: 60+ transport routes seeded for UK internal, US East Coast corridor, European high-speed rail, and key global connections" },
      { type: 'improvement', description: "Travel: Extended land-border connections for Baltic states, Balkans, and Central Europe (15+ new country pairs)" },
      { type: 'improvement', description: "Travel: Updated coastal city list with 20+ newly added coastal cities for ship route availability" },
      { type: 'fix', description: "World: Corrected is_coastal and has_train_network flags for 50+ existing cities" },
    ],
  },
  {
    version: "1.0.621",
    date: "2026-02-07",
    changes: [
      { type: 'feature', description: "Avatar: Added 'Save as Profile Avatar' button to persist generated avatar to profile" },
      { type: 'improvement', description: "Avatar: Removed classic avatar creator — AI avatar is now the sole creator" },
    ],
  },
  {
    version: "1.0.620",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Avatar: Fixed 'Could not find player profile' error — edge function and client now query profiles by user_id instead of id" },
    ],
  },
  {
    version: "1.0.619",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Avatar: Fixed photo upload only showing camera — now has separate 'Take Photo' and 'Upload' buttons" },
      { type: 'fix', description: "Avatar: Fixed page reload when taking a photo on mobile (removed capture attribute from upload input)" },
    ],
  },
  {
    version: "1.0.618",
    date: "2026-02-07",
    changes: [
      { type: 'improvement', description: "Infrastructure: Removed 6 unused edge functions (generate-character-sprite, generate-gig-commentary, manual-complete-gig, complete-festival-performance, create-inbox-message, grant-vip) to free deployment slots" },
      { type: 'feature', description: "Avatar: AI Photo Avatar edge function now deployed and operational" },
    ],
  },
  {
    version: "1.0.617",
    date: "2026-02-07",
    changes: [
      { type: 'feature', description: "Avatar: New AI Photo-to-Avatar system — upload a selfie to generate a stylized cartoon avatar" },
      { type: 'feature', description: "Avatar: Genre-influenced outfits — avatars wear exaggerated outfits based on your band's genre (Metal, Hip Hop, Punk, etc.)" },
      { type: 'feature', description: "Avatar: Manual genre override — pick any genre style for your avatar regardless of band genre" },
      { type: 'feature', description: "Avatar: First generation is free, subsequent re-generations cost $500 in-game cash" },
      { type: 'feature', description: "Avatar: Side-by-side preview of uploaded photo and generated avatar" },
      { type: 'improvement', description: "Avatar: Avatar Designer page now has AI Photo Avatar and Classic Creator tabs" },
      { type: 'improvement', description: "Avatar: Onboarding appearance step updated with AI avatar option and classic fallback" },
    ],
  },
  {
    version: "1.0.616",
    date: "2026-02-07",
    changes: [
      { type: 'fix', description: "Design System: Replaced all hardcoded colors (green, blue, amber, purple, pink, slate) with semantic tokens (success, warning, primary, accent, destructive) across riders, marketplace, and modeling components" },
      { type: 'fix', description: "Band Riders: Fixed overlapping quantity buttons on mobile — controls now stack below badges instead of floating right" },
      { type: 'fix', description: "Band Riders: Fixed checkbox selection not toggling properly — checkbox and card click now both work reliably" },
      { type: 'fix', description: "Modeling: Jobs no longer complete instantly — players must select a date and time slot for shoots" },
      { type: 'feature', description: "Modeling: Full booking dialog with calendar date picker, time slot selector, and duration preview" },
      { type: 'feature', description: "Modeling: Schedule conflict detection — prevents double-booking with other activities" },
      { type: 'feature', description: "Modeling: Activity locking — only one active modeling contract allowed at a time" },
      { type: 'improvement', description: "Modeling: Active contracts now display shoot date, time, and duration details" },
    ],
  },
  {
    version: "1.0.615",
    date: "2026-02-06",
    changes: [
      { type: 'feature', description: "Song Market: Full auction system — list songs with starting bid, duration, and optional buyout price" },
      { type: 'feature', description: "Song Market: Place bids on auctions with 5% minimum increment, anti-sniping extension in final 5 minutes" },
      { type: 'feature', description: "Song Market: Buy Now option for fixed-price listings and auction buyouts" },
      { type: 'feature', description: "Song Market: Atomic sale completion — money transfers from buyer to seller (10% marketplace fee), song ownership transfers" },
      { type: 'feature', description: "Song Market: Purchased Songs tab shows all acquired songs with permanent non-resale restriction" },
      { type: 'feature', description: "Song Market: Sellers can accept bids early or wait for auction to end" },
      { type: 'improvement', description: "Song Market: Completely rebuilt Browse, My Listings, and Purchased Songs tabs with real data" },
    ],
  },
  {
    version: "1.0.614",
    date: "2026-02-06",
    changes: [
      { type: 'feature', description: "Gigs: Rider selection added to gig booking dialog — pick a rider to send to venues with fulfillment preview" },
      { type: 'feature', description: "Gigs: New venue payout system — venues now pay based on band fame, fan draw power, venue capacity, and prestige level" },
      { type: 'feature', description: "Gigs: Venue payout breakdown shows base pay, fame bonus, fan draw bonus, prestige multiplier, and rider costs" },
      { type: 'improvement', description: "Gigs: Each time slot now shows estimated venue payment preview before selecting" },
      { type: 'improvement', description: "Gigs: Rider compatibility preview shows technical/hospitality/backstage fulfillment percentages and performance/morale modifiers" },
      { type: 'improvement', description: "Gigs: Total projected earnings now combines ticket revenue + venue payment for accurate forecasting" },
    ],
  },
  {
    version: "1.0.613",
    date: "2026-02-06",
    changes: [
      { type: 'improvement', description: "Navigation: Reorganized sidebar into 12 logical sections — Home, Character, Music, Band, Live, Events, World, Social, Career, Commerce, Media, Admin" },
      { type: 'improvement', description: "Navigation: Split bloated Home section into Home (essentials) and Character (avatar, gear, wellness, stats, legacy)" },
      { type: 'improvement', description: "Navigation: Created Events section for Festivals, Awards, and Eurovision" },
      { type: 'improvement', description: "Navigation: Renamed Performance → Live, Business → Career, added Commerce section for Inventory & Merchandise" },
      { type: 'improvement', description: "Navigation: Moved World Pulse to World section, Legacy to Character section, Offers to Career section" },
      { type: 'fix', description: "Navigation: Removed Song Manager, Competitive Charts, and Band Browser from sidebar" },
    ],
  },
  {
    version: "1.0.612",
    date: "2026-02-06",
    changes: [
      { type: 'feature', description: "Navigation: Added Awards, Schedule, Offers Dashboard, Song Manager, Song Market, Band Browser, Band Vehicles, Band Riders, Player Search, World Pulse, Modeling, Competitive Charts, and Legacy to the sidebar navigation" },
      { type: 'feature', description: "Modeling: Created dedicated Modeling page at /modeling wrapping the ModelingOffersPanel component" },
      { type: 'fix', description: "Navigation: Multiple major features (Awards, Modeling, Schedule, Offers) were previously inaccessible due to missing navigation entries" },
    ],
  },
  {
    version: "1.0.611",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Music Videos: Fixed 500 error from Replicate API — removed invalid 'failed' value from webhook_events_filter (only 'start', 'output', 'logs', 'completed' are valid)" },
    ],
  },
  {
    version: "1.0.610",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Music Videos: Fixed 404 'Video not found' error when generating AI videos — edge function referenced non-existent cover_art_url column on songs table" },
    ],
  },
  {
    version: "1.0.609",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Music Videos: Viewer now auto-plays audio when opened instead of requiring manual play button click" },
      { type: 'fix', description: "Music Videos: Clicking anywhere in the viewer display area now toggles play/pause" },
      { type: 'improvement', description: "Music Videos: Completely redesigned audio-only visualizer with spinning vinyl disc, pulsing rings, and shaped equalizer bars" },
      { type: 'improvement', description: "Music Videos: Removed confusing 'no video file generated' message, replaced with clean play prompt" },
      { type: 'improvement', description: "Music Videos: Video cards now show decorative waveform thumbnails, formatted view counts, and status-specific icons" },
      { type: 'improvement', description: "Music Videos: Dynamic gradient backgrounds on cards based on video status (released/production/generating)" },
    ],
  },
  {
    version: "1.0.608",
    date: "2026-02-06",
    changes: [
      { type: 'feature', description: "Modeling: Career progression component wired into the Modeling Offers panel replacing the static looks score card" },
      { type: 'improvement', description: "Modeling: Panel now shows current tier, progress to next tier, Fashion Week events, and all career tiers overview" },
    ],
  },
  {
    version: "1.0.607",
    date: "2026-02-06",
    changes: [
      { type: 'feature', description: "Festivals: Performance readiness check shows song familiarity, chemistry, gear quality before performing" },
      { type: 'feature', description: "Festivals: 2 new stage actions - Guitar Solo (+15 energy) and Dedicate Song (+6 energy)" },
      { type: 'feature', description: "Awards: Full ceremony attendance experience with red carpet, opening, categories, performance, and finale phases" },
      { type: 'feature', description: "Awards: 5 outfit choices for red carpet from Casual Rockstar to Outrageous Statement" },
      { type: 'feature', description: "Awards: Performance booking at ceremonies with 4 slot types (Opener through Closer)" },
      { type: 'feature', description: "Modeling: Career progression system with 5 tiers (Amateur to Fashion Icon)" },
      { type: 'feature', description: "Modeling: Fashion Week events unlocked at Supermodel tier (NYFW, Milan, Paris, Met Gala)" },
      { type: 'improvement', description: "Festivals: Pre-performance UI now shows readiness metrics instead of bullet list" },
      { type: 'improvement', description: "Awards: Ceremony dialog with interactive phase navigation" },
    ],
  },
  {
    version: "1.0.606",
    date: "2026-02-06",
    changes: [
      { type: 'feature', description: "Festivals: Performing now navigates to the interactive performance minigame instead of instant-completing" },
      { type: 'feature', description: "Festivals: Applications now create player_scheduled_activities entries to block the festival dates" },
      { type: 'feature', description: "Festivals: 5 new random performance events (rain, lights out, fan proposal, rival boos, shirt thrown)" },
      { type: 'feature', description: "Festivals: Stage Dive action added to performance interaction buttons" },
      { type: 'feature', description: "Modeling: Accepting gigs now blocks your schedule with a pr_appearance activity" },
      { type: 'feature', description: "Awards: Nomination dialog with category selection instead of auto-picking first category" },
      { type: 'improvement', description: "Festivals: Performance interaction UI improved with more expressive stage actions" },
      { type: 'improvement', description: "Awards: Enhanced ceremony experience with dedicated nomination flow" },
    ],
  },
  {
    version: "1.0.605",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Awards: Fixed 'Cannot find name primaryBand' build error - corrected variable reference to userBand" },
    ],
  },
  {
    version: "1.0.604",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Gig Booking: Times now correctly use venue's city timezone - booking 8 PM in Nashville stores 8 PM Nashville time, not browser local time" },
    ],
  },
  {
    version: "1.0.603",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Character: Fixed 404 error when clicking Character Identity card - added missing /my-character route" },
    ],
  },
  {
    version: "1.0.602",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "AI Songs: Reset 4 stuck songs that were permanently in 'generating' status" },
      { type: 'fix', description: "AI Songs: Retry now properly resets status to 'failed' before re-invoking generation" },
      { type: 'feature', description: "AI Songs: Added Reset button when generation has been running for 5+ minutes" },
      { type: 'improvement', description: "AI Songs: Timed-out songs (10+ min) now show both Reset and Retry buttons" },
    ],
  },
  {
    version: "1.0.601",
    date: "2026-02-06",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed song familiarity not updating - now uses database trigger + edge function with service role" },
      { type: 'fix', description: "Tours: Fixed tour gigs not showing on player schedule - activity type changed from 'tour_gig' to 'gig'" },
      { type: 'feature', description: "Rehearsals: Database trigger auto-updates familiarity when rehearsal status changes to 'completed'" },
      { type: 'feature', description: "Rehearsals: Backfilled familiarity for all rehearsals from the last 14 days" },
      { type: 'feature', description: "Tours: Backfilled missing schedule entries for all existing tour gigs" },
      { type: 'improvement', description: "Rehearsals: Edge function uses service role to bypass RLS restrictions" },
      { type: 'improvement', description: "Rehearsals: Client-side fallback with retry logic if edge function fails" },
    ],
  },
  {
    version: "1.0.600",
    date: "2026-02-05",
    changes: [
      { type: 'feature', description: "Festivals: Edge function for complete festival performance processing" },
      { type: 'feature', description: "Festivals: Auto-generated reviews from 8 publications (NME, Pitchfork, Rolling Stone, etc.)" },
      { type: 'feature', description: "Festivals: Review cards with sentiment analysis and fame impact display" },
      { type: 'feature', description: "Festivals: Merchandise sales breakdown component with item counts and revenue split" },
      { type: 'feature', description: "Festivals: Review aggregator showing overall sentiment and average score" },
      { type: 'improvement', description: "Festivals: Performance results now save detailed merch sales data (t-shirts, posters, albums)" },
      { type: 'improvement', description: "Festivals: Inbox notifications sent after each festival performance" },
    ],
  },
  {
    version: "1.0.599",
    date: "2026-02-05",
    changes: [
      { type: 'feature', description: "Festivals: New Map View tab with geographic visualization of festivals worldwide" },
      { type: 'feature', description: "Festivals: Interactive map markers with region filtering and search" },
      { type: 'feature', description: "Festivals: Dedicated Festival Detail page with lineup, sponsors, and rivalries tabs" },
      { type: 'feature', description: "Festivals: Genre match analysis showing compatibility with your band" },
      { type: 'feature', description: "Festivals: Travel cost estimates displayed on map view" },
      { type: 'improvement', description: "Festivals: Performance page now uses enhanced interactive performance loop" },
      { type: 'improvement', description: "Festivals: Weather forecast display on festival detail pages" },
    ],
  },
  {
    version: "1.0.598",
    date: "2026-02-04",
    changes: [
      { type: 'feature', description: "Festivals: Major expansion - now a core gameplay pillar" },
      { type: 'feature', description: "Festivals: Live 'Perform Now' minigame with phases (Soundcheck, Opening, Main Set, Crowd Interaction, Climax)" },
      { type: 'feature', description: "Festivals: Real-time crowd energy meter with interactive boost/slow controls" },
      { type: 'feature', description: "Festivals: Random performance events (technical issues, crowd surfers, encore requests) with choice-based scoring" },
      { type: 'feature', description: "Festivals: Performance scoring based on song familiarity, gear quality, band chemistry, setlist flow" },
      { type: 'feature', description: "Festivals: Complete performance history tracking with career stats" },
      { type: 'feature', description: "Festivals: Critic and fan scores with generated review headlines" },
      { type: 'feature', description: "Festivals: Rivalry system - compete against other bands at the same festival" },
      { type: 'feature', description: "Festivals: Sponsorship system with brand modifiers for fame, merch, and crowd mood" },
      { type: 'feature', description: "Festivals: Merch sales tracking linked to performance quality" },
      { type: 'feature', description: "Festivals: New History tab in Festival Browser with aggregated career metrics" },
    ],
  },
  {
    version: "1.0.597",
    date: "2026-02-04",
    changes: [
      { type: 'feature', description: "Modeling: New modeling offers system linked to player Looks attribute" },
      { type: 'feature', description: "Modeling: 15 modeling agencies from local to elite tier (Elite, IMG, Ford, Storm, etc.)" },
      { type: 'feature', description: "Modeling: 6 gig types - photo shoots, runway, commercial, cover shoot, brand ambassador, music video cameo" },
      { type: 'feature', description: "Fashion Events: Paris, Milan, New York, London Fashion Weeks and Met Gala" },
      { type: 'feature', description: "Fashion Brands: 30 new brands (Gucci, Versace, Louis Vuitton, Supreme, H&M, etc.)" },
      { type: 'feature', description: "Films: Enhanced lifecycle with casting, filming, premiere phases and sequel eligibility" },
      { type: 'feature', description: "Films: 15 new film studios including Netflix, A24, Universal, Warner Bros" },
    ],
  },
  {
    version: "1.0.596",
    date: "2026-02-04",
    changes: [
      { type: 'feature', description: "Companies: Major expansion - all company types now have customizable pricing settings" },
      { type: 'feature', description: "Companies: Upgrade systems for Security Firms and Merch Factories with gameplay effects" },
      { type: 'feature', description: "Companies: Quality modifiers - upgrades and equipment now affect gig/recording outcomes" },
      { type: 'feature', description: "Companies: Empire Synergies - own multiple business types for automatic discounts" },
      { type: 'feature', description: "Recording Studios: Equipment now links to unified gear catalog (25 new studio items)" },
      { type: 'feature', description: "Database: New upgrade tables for security, factory, logistics, and venues" },
    ],
  },
  {
    version: "1.0.595",
    date: "2026-02-04",
    changes: [
      { type: 'fix', description: "Companies: Fixed 'Manage' button for Record Labels - now navigates to dedicated label management page" },
      { type: 'fix', description: "Companies: Fixed Logistics Company management page not loading (dual lookup by id OR company_id)" },
      { type: 'fix', description: "Companies: Fixed Rehearsal Studio management page not loading (dual lookup pattern)" },
      { type: 'feature', description: "Labels: New dedicated label management page at /labels/:id/manage with roster, demos, contracts, and finances tabs" },
    ],
  },
  {
    version: "1.0.594",
    date: "2026-02-04",
    changes: [
      { type: 'feature', description: "Travel: Added Private Jet option - instant departure to ANY city in 3 hours for $75,000" },
      { type: 'improvement', description: "Travel: Private jet bypasses all transport restrictions (distance, schedules, regions)" },
      { type: 'improvement', description: "Travel: Private jet features VIP styling with gold accents and 100% comfort rating" },
    ],
  },
  {
    version: "1.0.593",
    date: "2026-02-04",
    changes: [
      { type: 'fix', description: "Music Videos: Fixed AI video generation - now uses Replicate's MiniMax video model with async webhook callback" },
      { type: 'feature', description: "Music Videos: Real 10-second 1080p AI videos now generated and stored permanently in Supabase Storage" },
      { type: 'improvement', description: "Music Videos: Added 'Generating' status with progress indicator and estimated time (2-5 minutes)" },
      { type: 'improvement', description: "Music Videos: Failed generations now show error message and refund $75,000 automatically" },
      { type: 'improvement', description: "Music Videos: Retry button available for failed AI video generations" },
    ],
  },
  {
    version: "1.0.592",
    date: "2026-02-04",
    changes: [
      { type: 'feature', description: "Education: Added 28 new Legendary Masters across global cities (Memphis, Kingston, Havana, Detroit, and more)" },
      { type: 'feature', description: "Masters: New genre specialists (Blues, Latin, Jazz, K-Pop, EDM) and production mentors now discoverable" },
      { type: 'feature', description: "Discovery System: Mentors can now be discovered by playing gigs at specific venues" },
      { type: 'feature', description: "Discovery Modal: Dramatic reveal animation when discovering a new master" },
      { type: 'feature', description: "Random Events: Added 5 new 'Master Encounter' events that hint at mentor discoveries" },
      { type: 'improvement', description: "Masters: Each mentor now has rich lore biography and discovery hints" },
    ],
  },
  {
    version: "1.0.591",
    date: "2026-02-04",
    changes: [
      { type: 'fix', description: "Activity XP: Added missing cron job to credit daily activity XP to wallets automatically" },
      { type: 'improvement', description: "Activity XP: Players now receive SXP and AP from activities daily at 05:00 UTC (capped at 250 SXP)" },
    ],
  },
  {
    version: "1.0.590",
    date: "2026-02-04",
    changes: [
      { type: 'fix', description: "Events: Fixed crash when displaying event effects with min/max ranges (e.g., sports theme songs)" },
      { type: 'improvement', description: "Events: Effect displays now show ranges like '+4000-10000 Cash' for variable rewards" },
    ],
  },
  {
    version: "1.0.589",
    date: "2026-02-04",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed song familiarity not updating - uses explicit update instead of upsert" },
      { type: 'fix', description: "Tours: Fixed travel legs not being created - 'auto' travel mode now defaults to 'bus'" },
      { type: 'feature', description: "Tour Manager: Added 'Regenerate Travel Schedule' button to fix tours missing travel legs" },
      { type: 'fix', description: "Tours: Travel mode type now only allows valid database values (bus, train, plane, ship, tour_bus)" },
    ],
  },
  {
    version: "1.0.588",
    date: "2026-02-03",
    changes: [
      { type: 'feature', description: "Songs: Added ability to permanently delete songs or archive them to hide from all lists" },
      { type: 'improvement', description: "Songs: Archived songs are now excluded from recording, setlist, and rehearsal selectors" },
    ],
  },
  {
    version: "1.0.587",
    date: "2026-02-03",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed song familiarity not being updated when rehearsals complete" },
      { type: 'feature', description: "Recording Studio: Added search and filters for song selection (by recorded status and rehearsal level)" },
    ],
  },
  {
    version: "1.0.586",
    date: "2026-02-02",
    changes: [
      { type: 'fix', description: "Tour Details: Correctly matches tour stops to gigs by venue + date, so tickets sold/revenue/ratings display for the right show" },
    ],
  },
  {
    version: "1.0.585",
    date: "2026-02-02",
    changes: [
      { type: 'fix', description: "Tour Details: Now displays actual tickets sold from gigs instead of tour_venues placeholder data" },
      { type: 'fix', description: "Tour Details: Gig ratings and performance grades now shown for completed shows" },
      { type: 'improvement', description: "Tour Details: Shows gig status badges (completed, scheduled, in_progress)" },
      { type: 'improvement', description: "Tour Details: Summary includes average rating across completed tour gigs" },
    ],
  },
  {
    version: "1.0.584",
    date: "2026-02-01",
    changes: [
      { type: 'feature', description: "Admin: AI Music Videos debug panel at /admin/music-videos" },
      { type: 'feature', description: "Admin: View all music videos with generation status, video URLs, and metadata" },
      { type: 'feature', description: "Admin: Trigger AI video generation for existing entries" },
      { type: 'fix', description: "Database: Added video_url column to music_videos table" },
      { type: 'improvement', description: "Admin: Reset stuck 'generating' status, clear video URLs for regeneration" },
    ],
  },
  {
    version: "1.0.583",
    date: "2026-01-31",
    changes: [
      { type: 'feature', description: "Music Videos: 'Generate AI Video' button for existing videos without video files" },
      { type: 'feature', description: "Music Videos: VIPs can regenerate AI videos for any released music video" },
      { type: 'improvement', description: "Music Videos: 'AI Video Ready' badge shown when video file exists" },
      { type: 'improvement', description: "Music Videos: Uses existing metadata (visual theme, art style, scenes) if available" },
    ],
  },
  {
    version: "1.0.582",
    date: "2026-01-31",
    changes: [
      { type: 'feature', description: "Music Videos: Real AI video generation using Lovable Video API" },
      { type: 'feature', description: "Music Videos: Generated videos stored permanently in Supabase Storage" },
      { type: 'feature', description: "Music Videos: Video player now plays actual video files when available" },
      { type: 'improvement', description: "Music Videos: Fallback to audio+visuals mode if video not generated" },
      { type: 'improvement', description: "Music Videos: 'Real Video' badge shown when actual video exists" },
      { type: 'improvement', description: "Music Videos: Fullscreen support for real video playback" },
    ],
  },
  {
    version: "1.0.581",
    date: "2026-01-30",
    changes: [
      { type: 'fix', description: "Music Videos: Added video viewer dialog - AI music videos are now watchable" },
      { type: 'feature', description: "Music Videos: Video player with audio visualizer, floating particles, and visual effects" },
      { type: 'feature', description: "Music Videos: Visual themes applied from AI metadata (Cyberpunk, Nature, Vintage, Urban)" },
      { type: 'feature', description: "Music Videos: Play/pause controls, volume slider, progress bar, fullscreen button" },
      { type: 'feature', description: "Music Videos: Watch button on video cards, hover overlay for released videos" },
      { type: 'improvement', description: "Music Videos: Scene descriptions displayed in viewer from AI storyboard" },
      { type: 'improvement', description: "Music Videos: View count increments after 10 seconds of watching" },
    ],
  },
  {
    version: "1.0.580",
    date: "2026-01-30",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed invalid stage values ('mastered', 'practicing') causing DB constraint violations" },
      { type: 'fix', description: "Rehearsals: Aligned all 3 code paths (manual, auto, edge function) to use same threshold logic" },
      { type: 'improvement', description: "Rehearsals: Reduced thresholds - 6 hours = Perfected (was 30 hours)" },
      { type: 'improvement', description: "Rehearsals: Learning=1h, Familiar=3h, Well Rehearsed=5h, Perfected=6h" },
      { type: 'improvement', description: "Rehearsals: Added setlist time-split explanation in booking dialog" },
      { type: 'improvement', description: "Rehearsals: Database percentage now aligned with 6h=100% threshold" },
    ],
  },
  {
    version: "1.0.579",
    date: "2026-01-29",
    changes: [
      { type: 'fix', description: "Character Creator: Fixed hair positioning - all 4 styles now sit on crown (Y=20-70) instead of covering eyes" },
      { type: 'feature', description: "Character Creator: 20 hair styles (was 4) - Mohawk, Liberty Spikes, Dreadlocks, Pompadour, Mullet, Viking, Cornrows, etc." },
      { type: 'feature', description: "Character Creator: 9 eye styles (was 2) - Cat Eye, Smoky, Starry, Winking, Sleepy, etc." },
      { type: 'feature', description: "Character Creator: 8 mouth styles (was 2) - Singing, Shouting, Grin, Smirk, Kiss, etc." },
      { type: 'feature', description: "Character Creator: 6 facial hair styles (was 1) - Goatee, Stubble, Handlebar, Mutton Chops, Soul Patch" },
      { type: 'feature', description: "Character Creator: 12 shirts (was 1) - Flannel, Hawaiian, Jersey, Tie-Dye, Mesh Top, etc." },
      { type: 'feature', description: "Character Creator: 8 jackets (was 2) - Varsity, Military, Trench Coat, Track Jacket, Cardigan" },
      { type: 'feature', description: "Character Creator: 8 bottoms (was 2) - Ripped Jeans, Leather Pants, Kilt, Bell Bottoms, Pleated Skirt" },
      { type: 'feature', description: "Character Creator: 8 footwear (was 2) - Platform Boots, Cowboy Boots, Creepers, Sneakers, Sandals" },
      { type: 'feature', description: "Character Creator: 8 hats (was 1) - Fedora, Cowboy Hat, Top Hat, Snapback, Beret, Bucket Hat" },
      { type: 'feature', description: "Character Creator: 6 glasses (was 1) - Round Lennons, Cat Eye, Sport Wrap, Neon Shutters" },
      { type: 'feature', description: "Character Creator: NEW 8 piercings/jewelry - Earrings, Nose Ring, Lip Ring, Chain, Choker, Headphones" },
      { type: 'improvement', description: "Character Creator: Total options expanded from 18 to 100+ across all musical genres" },
    ],
  },
  {
    version: "1.0.578",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "Gear: Added product images for all 130+ equipment items by category" },
      { type: 'feature', description: "Gear: Electric guitars, acoustic guitars, bass, drums, cymbals, keyboards, amps, effects, mics, stage equipment" },
      { type: 'improvement', description: "Gear Shop: Cards now display category-specific product images" },
      { type: 'improvement', description: "Gear Marketplace: Listings show product images for better browsing" },
    ],
  },
  {
    version: "1.0.577",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "Gear Marketplace: Player-to-player used gear trading system" },
      { type: 'feature', description: "Gear Marketplace: Condition-based pricing (100% = 70% of new value, lower condition = less)" },
      { type: 'feature', description: "Gear Marketplace: Rarity affects resale value retention (Legendary +20%, Epic +10%)" },
      { type: 'feature', description: "Gear Marketplace: Create listings from unequipped inventory items" },
      { type: 'feature', description: "Gear Marketplace: Offer/negotiation system for price haggling" },
      { type: 'feature', description: "Gear Marketplace: 5% platform fee on all sales" },
      { type: 'feature', description: "Gear Marketplace: Purchase history with savings tracking" },
      { type: 'feature', description: "Gear Marketplace: Filter by category, condition, sort by price/savings" },
      { type: 'improvement', description: "Database: gear_marketplace_listings, gear_marketplace_transactions, gear_marketplace_offers tables" },
      { type: 'improvement', description: "Database: process_gear_sale RPC for atomic transactions" },
    ],
  },
  {
    version: "1.0.576",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "Gear: Massive catalog expansion with 130+ new instruments seeded" },
      { type: 'feature', description: "Gear: Brand support added - 50+ real-world manufacturers (Fender, Gibson, PRS, Roland, Moog, etc.)" },
      { type: 'feature', description: "Gear: Color options for instruments (Sunburst, Lake Placid Blue, Candy Apple Red, etc.)" },
      { type: 'feature', description: "Gear: Skill boost linking - instruments boost matching skill tracks" },
      { type: 'feature', description: "Gear: 20 electric guitars from Squier to Gibson Custom Shop" },
      { type: 'feature', description: "Gear: 13 acoustic guitars from Yamaha to Martin D-45" },
      { type: 'feature', description: "Gear: 12 bass guitars from Ibanez to Fodera Emperor" },
      { type: 'feature', description: "Gear: 16 keyboards/synths including Nord Stage 4, Moog One, Prophet-6" },
      { type: 'feature', description: "Gear: 16 drums including DW Collectors, Roland TD-50KV2, Meinl cymbals" },
      { type: 'feature', description: "Gear: 12 wind instruments (saxophones, flutes, clarinets, harmonicas)" },
      { type: 'feature', description: "Gear: 10 brass instruments (trumpets, trombones, French horns)" },
      { type: 'feature', description: "Gear: 11 DJ/electronic items (Pioneer CDJ-3000, Technics SL-1200MK7)" },
      { type: 'feature', description: "Gear: 10 microphones (Shure SM7B, Neumann U87, AKG C414)" },
      { type: 'feature', description: "Gear: 9 audio interfaces (Focusrite Scarlett, Universal Audio Apollo)" },
      { type: 'improvement', description: "Database: Added brand, brand_logo_url, color_options, skill_boost_slug, price_cash, price_fame columns" },
    ],
  },
  {
    version: "1.0.575",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "Mentors: All 20 masters now have specific city locations and weekly availability days" },
      { type: 'feature', description: "Mentors: 2 masters discovered by playing at specific venues (Ryman Auditorium, Austin City Limits)" },
      { type: 'feature', description: "Mentors Admin: Added discovery type selection (automatic/exploration/venue_gig/studio_session)" },
      { type: 'feature', description: "Mentors Admin: Added venue and studio selection for discovery triggers" },
      { type: 'improvement', description: "Database: Added discovery_venue_id, discovery_studio_id, discovery_type columns" },
    ],
  },
  {
    version: "1.0.574",
    date: "2026-01-29",
    changes: [
      { type: 'improvement', description: "Mentors Admin: Added city location, available day, lore, and discovery hint fields" },
      { type: 'improvement', description: "Mentors Admin: Table now shows city and day columns" },
      { type: 'feature', description: "Mentors: Marcus Stone is now auto-discovered for all players (starter master in London)" },
      { type: 'improvement', description: "Mentors: Updated 5 existing masters with city locations, days, lore, and discovery hints" },
    ],
  },
  {
    version: "1.0.573",
    date: "2026-01-29",
    changes: [
      { type: 'fix', description: "Character Creator: Fixed mohawk hair alignment (shifted up 35px to sit above head)" },
      { type: 'fix', description: "Character Creator: Fixed hoodie covering face (redesigned hood to drape behind shoulders)" },
    ],
  },
  {
    version: "1.0.571",
    date: "2026-01-29",
    changes: [
      { type: 'fix', description: "City Governance: Mayor name now displays correctly (was using wrong column)" },
      { type: 'improvement', description: "Mayor Dashboard: Save button always visible, disabled when no changes" },
    ],
  },
  {
    version: "1.0.570",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "Record Sales: City sales tax deduction (uses mayor-set rate, defaults to 10%)" },
      { type: 'feature', description: "Record Sales: Format-specific distribution fees (Digital 30%, CD 20%, Vinyl/Cassette 15%)" },
      { type: 'feature', description: "Record Sales: Bands now receive net revenue after tax + distribution costs" },
      { type: 'feature', description: "Admin: Costs tab in Sales Balance Admin for configuring tax/distribution rates" },
      { type: 'improvement', description: "Sales tracking: Full breakdown stored (gross, tax, distribution, net)" },
    ],
  },
  {
    version: "1.0.569",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "RP Phase 4: Reputation UI components + Dashboard integration" },
      { type: 'feature', description: "ReputationAxisBar: Visual bar showing -100 to +100 score with center marker" },
      { type: 'feature', description: "ReputationCard: Full 4-axis reputation display with overall vibe badge" },
      { type: 'feature', description: "ReputationSummary: Compact widget showing reputation at a glance" },
      { type: 'feature', description: "ReputationEventsList: Scrollable history of reputation changes with reasons" },
      { type: 'feature', description: "CharacterIdentityCard: Shows origin archetype, traits, style, and career goal" },
      { type: 'feature', description: "CharacterBackstoryCard: Displays AI-generated backstory with scrollable text" },
      { type: 'improvement', description: "Dashboard: Added Character Identity and Reputation cards to Profile tab" },
    ],
  },
  {
    version: "1.0.568",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "RP Phase 3: Complete 8-step onboarding wizard UI" },
      { type: 'feature', description: "Onboarding: Step 1 - Welcome & name entry" },
      { type: 'feature', description: "Onboarding: Step 2 - Character appearance (integrated sprite creator)" },
      { type: 'feature', description: "Onboarding: Step 3 - Origin selection with 8 archetypes" },
      { type: 'feature', description: "Onboarding: Step 4 - Personality traits (choose 2-3 with compatibility checks)" },
      { type: 'feature', description: "Onboarding: Step 5 - Musical identity (genre selection)" },
      { type: 'feature', description: "Onboarding: Step 6 - Career path (solo/band/join)" },
      { type: 'feature', description: "Onboarding: Step 7 - Starting city selection" },
      { type: 'feature', description: "Onboarding: Step 8 - AI-generated backstory with edit/regenerate" },
      { type: 'feature', description: "Edge Function: generate-backstory for AI backstory creation" },
      { type: 'improvement', description: "First-login redirect: New players sent to /onboarding automatically" },
    ],
  },
  {
    version: "1.0.567",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "RP Phase 2: TypeScript types, API layer, and React Query hooks for RP system" },
      { type: 'feature', description: "Types: CharacterOrigin, PersonalityTrait, PlayerCharacterIdentity, PlayerReputation, NPCRelationship" },
      { type: 'feature', description: "API: Full CRUD for character identity, reputation tracking with event logging, NPC relationships" },
      { type: 'feature', description: "Hooks: useCharacterIdentity, useReputation, useNPCRelationships with pre-built reputation actions" },
      { type: 'improvement', description: "Reputation: Pre-defined actions (acceptCorporateSponsorship, cancelGigLastMinute, etc.)" },
    ],
  },
  {
    version: "1.0.566",
    date: "2026-01-29",
    changes: [
      { type: 'feature', description: "RP Phase 1: Database foundation for role-playing enhancements and new player wizard" },
      { type: 'feature', description: "Character Origins: 8 starting archetypes (Street Busker, Music School Grad, Garage Band Vet, Session Musician, Viral Sensation, Industry Insider, Classical Rebel, Local Legend)" },
      { type: 'feature', description: "Personality Traits: 16 traits across 4 categories (Creative, Social, Work Ethic, Emotional) with gameplay effects" },
      { type: 'feature', description: "Reputation System: 4-axis tracking (Authenticity, Attitude, Reliability, Creativity) from -100 to +100" },
      { type: 'feature', description: "NPC Relationships: Dynamic affinity, trust, and respect scores with relationship stages" },
      { type: 'feature', description: "Player Identity: Backstory, musical style, career goal, and onboarding progress tracking" },
    ],
  },
  {
    version: "1.0.565",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Songwriting: Collaborator invite now correctly shows friends (fixed missing FK join)" },
    ],
  },
  {
    version: "1.0.564",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Career Journal: Personal memoir system for documenting your band's story" },
      { type: 'feature', description: "Career Journal: Auto-logged milestones capture career-defining moments" },
      { type: 'feature', description: "Career Journal: Write custom notes with title, content, and category" },
      { type: 'feature', description: "Career Journal: Beautiful timeline view grouped by date" },
      { type: 'feature', description: "Career Journal: Pin important entries to the top of your journal" },
      { type: 'feature', description: "Career Journal: Filter by milestones, notes, or category" },
      { type: 'feature', description: "Career Journal: Search through all your journal entries" },
      { type: 'improvement', description: "Navigation: Added Journal to Home section for quick access" },
    ],
  },
  {
    version: "1.0.563",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Player Level: Complete revamp with combined progress (XP + Skills + Fame)" },
      { type: 'feature', description: "Player Level: Scaling XP curve - faster early levels, slower progression at high levels" },
      { type: 'feature', description: "Player Level: Level 1 = 250 XP, Level 10 ≈ 5,000 XP, Level 50 ≈ 338,000 XP" },
      { type: 'feature', description: "Player Level: Skill contribution (2 XP per skill level) and Fame contribution (1 XP per 100 fame)" },
      { type: 'feature', description: "Player Level: New PlayerLevelBadge component with progress bar and detailed tooltip" },
      { type: 'improvement', description: "Player Level: Max level 100 with attribute star bonuses (400 XP per star)" },
    ],
  },
  {
    version: "1.0.562",
    date: "2026-01-28",
    changes: [
      { type: 'improvement', description: "Releases: Realistic default retail prices (CD $14.99, Vinyl $29.99, Digital $9.99, Cassette $12.99)" },
      { type: 'improvement', description: "Releases: Price input now in dollars with decimal support (not cents)" },
      { type: 'feature', description: "Releases: Multi-currency display shows EUR (€) and GBP (£) equivalents" },
    ],
  },
  {
    version: "1.0.561",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "PR Activity: Scheduling conflicts now return 400 validation error instead of 500 server error" },
      { type: 'improvement', description: "PR Activity: Clearer conflict message shown to user when time slot is already booked" },
    ],
  },
  {
    version: "1.0.560",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Daily Sales: Fixed integer column errors by converting prices to cents before insert" },
      { type: 'fix', description: "Daily Sales: Skip formats with no retail price to prevent null constraint violations" },
      { type: 'fix', description: "Dashboard: Fixed songs query to use original_writer_id instead of non-existent writer_id column" },
    ],
  },
  {
    version: "1.0.559",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Daily Sales: Fixed missing home_country column error in generate-daily-sales edge function" },
    ],
  },
  {
    version: "1.0.558",
    date: "2026-01-28",
    changes: [
      { type: 'improvement', description: "Navigation: Removed duplicate Self PR link from Media section (already accessible via PR page)" },
    ],
  },
  {
    version: "1.0.557",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Performance skill: Now correctly calculates level from XP when stored level is 0" },
      { type: 'feature', description: "VIP Music Videos: AI-powered video generation with scene descriptions (VIP exclusive)" },
      { type: 'feature', description: "Music Video Creator: Visual theme, art style, mood, and up to 8 scene descriptions" },
      { type: 'improvement', description: "Music Video page: Added VIP AI generator button for subscribers" },
    ],
  },
  {
    version: "1.0.556",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Random event outcomes now appear in player inbox with effect details" },
      { type: 'fix', description: "Career dashboard aggregates stats across ALL bands player has been in" },
      { type: 'fix', description: "Music video earnings now create band_earnings records for tracking" },
      { type: 'fix', description: "Sponsorship clarification - PR offers include podcasts/magazines/newspapers (requires fame threshold)" },
    ],
  },
  {
    version: "1.0.555",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Setlists: Fixed position conflict errors when adding/reordering items (deferred constraints + atomic RPC)" },
      { type: 'fix', description: "Songwriting: Sessions now create scheduled activities and block player time" },
      { type: 'fix', description: "Songwriting: Fixed collaborator invite - now correctly queries friendships table columns" },
      { type: 'fix', description: "Schedule: Gigs now show reliably regardless of timezone differences" },
      { type: 'fix', description: "Mayor Dashboard: Current mayors can now update city laws (RLS policy fixed)" },
      { type: 'fix', description: "Admin: Sales balance config now saves properly (unique constraint + admin policy added)" },
    ],
  },
  {
    version: "1.0.554",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Character Creator: Complete rewrite using SVG-based sprites for perfect layer alignment" },
      { type: 'feature', description: "Character Creator: 4 hair styles (Mohawk, Afro, Emo, Pixie), 2 eye types, multiple clothing options" },
      { type: 'feature', description: "Character Creator: Proper compositing - all layers now stack correctly on 512x1024 canvas" },
      { type: 'feature', description: "Character Creator: PNG export functionality" },
      { type: 'improvement', description: "Character Creator: Local state management for instant feedback (no DB round-trip)" },
      { type: 'fix', description: "Character Creator: Layers now properly align because SVGs share exact viewBox coordinates" },
    ],
  },
  {
    version: "1.0.553",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Character Creator: Enforced aligned-only sprite filtering (subcategory LIKE 'aligned%')" },
      { type: 'fix', description: "Character Creator: Changed renderer from object-contain to object-fill for consistent layer mapping" },
      { type: 'feature', description: "Character Creator: Added debug panel with 'Apply Test Set' and 'Export PNG' buttons" },
      { type: 'improvement', description: "Character Creator: Layer debug view shows selected sprite per category" },
      { type: 'improvement', description: "Character Creator: Anchor offset support for fine-tuning layer positions" },
    ],
  },
  {
    version: "1.0.552",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Character Creator: Complete aligned sprite system with 512x1024 canvas assets" },
      { type: 'feature', description: "Character Creator: Auto-build default character on page load" },
      { type: 'feature', description: "Character Creator: 20+ new aligned assets - body, hair, eyes, clothing, accessories" },
      { type: 'improvement', description: "Character Creator: All sprite layers now stack correctly with consistent canvas coordinates" },
      { type: 'improvement', description: "Character Creator: Shoes now a separate interchangeable layer" },
      { type: 'fix', description: "Character Creator: Fixed misaligned sprite layering issue" },
    ],
  },
  {
    version: "1.0.551",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Character Creator: Updated SpriteLayerCanvas to import all new layered template assets" },
      { type: 'improvement', description: "Character Creator: Base templates and layer overlays now properly resolved in canvas" },
    ],
  },
  {
    version: "1.0.550",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Character Creator: True layered sprite system with consistent body templates" },
      { type: 'feature', description: "Character Creator: All clothing/hair layers align properly on male and female bases" },
      { type: 'feature', description: "Character Creator: 20+ new layered assets - hair, jackets, shirts, pants that composite correctly" },
      { type: 'improvement', description: "Character Creator: Replaced isolated parts with full-body layer variations" },
    ],
  },
  {
    version: "1.0.549",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Character Creator: 33 new sprite assets across all categories (bodies, hair, faces, clothing, accessories)" },
      { type: 'improvement', description: "Character Creator: Expanded beyond punk to include rock, hip-hop, grunge, and indie styles" },
    ],
  },
  {
    version: "1.0.548",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Character Creator: Added punk rock styled sprite assets (body, hair, jacket, trousers, boots)" },
      { type: 'feature', description: "Character Creator: Comic-book illustration style inspired by 80s-90s punk zines" },
      { type: 'fix', description: "Character Creator: Fixed sprite preview to show actual generated assets" },
      { type: 'improvement', description: "Character Creator: Assets now properly imported and resolved from local files" },
    ],
  },
  {
    version: "1.0.547",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Character Creator: Replaced Ready Player Me with custom 2D punk rock sprite system" },
      { type: 'feature', description: "Character Creator: Modular layered sprites - body, face, hair, clothes, accessories" },
      { type: 'feature', description: "Character Creator: 9 skin tone presets with real-time preview" },
      { type: 'feature', description: "Character Creator: Gender selection with appropriate body/facial hair options" },
      { type: 'feature', description: "Database: New character_sprite_assets table with 50+ default punk sprite options" },
      { type: 'improvement', description: "Gig Viewer: Updated to use new sprite-based character avatars" },
    ],
  },
  {
    version: "1.0.546",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Releases: Songs can now only be used in one release (single, EP, or album) - no duplicates allowed" },
      { type: 'fix', description: "Releases: Song selection now shows which release a song is already on (with type indicator)" },
      { type: 'improvement', description: "Releases: Greatest hits can still include any previously released song" },
      { type: 'improvement', description: "Releases: Added new get_songs_on_releases RPC for comprehensive release exclusivity checking" },
    ],
  },
  {
    version: "1.0.545",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Festivals: Performance outcome system with detailed reviews, highlight reel, and earnings breakdown" },
      { type: 'feature', description: "Festivals: Post-show reviews generated based on performance score with multiple sources" },
      { type: 'feature', description: "Festivals: Crowd projections with slot analysis, audience demographics, and genre matching" },
      { type: 'feature', description: "Festivals: Setlist editor with time/stamina budgets and song familiarity tracking" },
      { type: 'feature', description: "Festivals Admin: Lifecycle controls for draft/publish/postpone/cancel festival states" },
      { type: 'feature', description: "Festivals Admin: Bulk review panel with filtering, sorting, and batch approve/reject" },
      { type: 'feature', description: "Festivals Admin: Auto-scoring rubric calculates application scores (fame, slot match, setlist)" },
      { type: 'improvement', description: "Festivals Admin: Consolidated into 5-tab interface with queue, bulk review, lifecycle, player, and history" },
    ],
  },
  {
    version: "1.0.544",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Festivals: Schedule conflict detection - warns when applying to festivals with existing commitments" },
      { type: 'feature', description: "Festivals: Contract negotiation dialog with payment, merch cut, and perks sliders" },
      { type: 'feature', description: "Festivals: Acceptance probability calculator based on demands vs slot leverage" },
      { type: 'feature', description: "Festivals: Live performance page with crowd energy, phase progression, and scoring" },
      { type: 'feature', description: "Festivals: Stage move mechanic to boost crowd energy during performance" },
      { type: 'improvement', description: "Festivals: Application button disabled when schedule conflicts detected" },
    ],
  },
  {
    version: "1.0.543",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Build: Removed unused DollarSign import in LogisticsCompanyManagement to fix production build" },
    ],
  },
  {
    version: "1.0.542",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Logistics: Fixed param mismatch - company management now correctly routes using companyId" },
      { type: 'feature', description: "Venue Business: Fully wired staff management - hire, fire, view payroll" },
      { type: 'feature', description: "Venue Business: Booking calendar with create, update status, and history" },
      { type: 'feature', description: "Venue Business: Upgrade system with 9 venue improvement types" },
      { type: 'feature', description: "Venue Business: Financial tracking with revenue vs expenses breakdown" },
      { type: 'feature', description: "Recording Studio: Equipment inventory with add gear, value tracking, condition monitoring" },
      { type: 'feature', description: "Recording Studio: Upgrade system with 9 studio improvement tiers (console, monitors, mics, etc.)" },
      { type: 'improvement', description: "All business pages now properly lookup by company_id when accessed from My Companies" },
    ],
  },
  {
    version: "1.0.541",
    date: "2026-01-28",
    changes: [
      { type: 'fix', description: "Companies: Fixed subsidiary entity creation trigger (security firms, factories, logistics, labels, venues, studios now properly created)" },
      { type: 'fix', description: "Companies: Labels created as subsidiaries now correctly inherit owner_id from parent company" },
      { type: 'fix', description: "Companies: Fixed navigation from company cards to label management" },
      { type: 'fix', description: "Companies: Created missing subsidiary entities for existing companies (backfill)" },
      { type: 'feature', description: "Companies: Added recording_studio as valid company type in creation dialog" },
      { type: 'improvement', description: "Record Labels: My Labels tab now shows both directly owned and company-owned labels" },
    ],
  },
  {
    version: "1.0.540",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Progression: Split XP into Skill XP (SXP) for skills and Attribute Points (AP) for attributes" },
      { type: 'feature', description: "Progression: Daily stipend is now manual claim only (100 SXP + 10 AP base)" },
      { type: 'feature', description: "Progression: Activity XP auto-credited daily with 250 SXP cap and 40-60% AP conversion" },
      { type: 'feature', description: "Progression: Streak bonuses for 7, 14, 30, 100, and 365 consecutive claim days" },
      { type: 'feature', description: "UI: Streak display with progress toward next milestone and visual rewards breakdown" },
      { type: 'improvement', description: "Attributes now cost Attribute Points (AP) instead of XP (5 AP per training)" },
    ],
  },
  {
    version: "1.0.539",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Admin: New Sales Balance page to tune physical/digital record sales parameters" },
      { type: 'feature', description: "Admin: Configure base sales ranges, fame multipliers, regional weights, and market scarcity" },
      { type: 'feature', description: "Admin: Live preview calculator showing estimated sales based on fame values" },
      { type: 'feature', description: "Dashboard: Regional fame breakdown showing fame and fans by country with expandable cities" },
      { type: 'feature', description: "Fame: Countries show performed indicator and fame cap for unvisited regions" },
      { type: 'improvement', description: "Sales System: Edge function now reads config from database for adjustable parameters" },
    ],
  },
  {
    version: "1.0.538",
    date: "2026-01-28",
    changes: [
      { type: 'feature', description: "Lifestyle: New Behavior tab on Dashboard to configure touring lifestyle" },
      { type: 'feature', description: "Lifestyle: 7 configurable settings - travel comfort, hotel standard, partying intensity, fan interaction, media behavior, afterparty attendance, entourage size" },
      { type: 'feature', description: "Lifestyle: Risk score calculation based on behavior settings (0-100)" },
      { type: 'feature', description: "Lifestyle: Health modifiers from settings affect recovery rate and rest effectiveness" },
      { type: 'feature', description: "Random Events: 30+ new lifestyle events across hotel, partying, fan encounter, and media categories" },
      { type: 'improvement', description: "Lifestyle choices now influence which random events you encounter while touring" },
    ],
  },
  {
    version: "1.0.536",
    date: "2026-01-27",
    changes: [
      { type: 'feature', description: "Elections: Full city election page with voting booth, candidate list, and real-time vote tracking" },
      { type: 'feature', description: "Elections: Candidate registration system - players with 100+ fame can run for mayor" },
      { type: 'feature', description: "Elections: Propose policies during registration (tax rates, regulations, genre policies)" },
      { type: 'feature', description: "Mayor Dashboard: City law management for elected mayors to enact policies" },
      { type: 'feature', description: "Mayor Dashboard: Configure income/sales tax, curfews, alcohol age, busking fees" },
      { type: 'feature', description: "Mayor Dashboard: Promote or prohibit music genres, set community event funding" },
      { type: 'feature', description: "Mayor Dashboard: Law change history tracking with full audit trail" },
    ],
  },
  {
    version: "1.0.535",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "Twaater: New 'Explore' tab for discovering trending public posts (no follows required)" },
      { type: 'feature', description: "Twaater: Engagement-based ranking in Explore - likes, replies, retwaats weighted" },
      { type: 'feature', description: "Twaater: Follow suggestions inline in feed to help discover accounts" },
      { type: 'feature', description: "Twaater Admin: Bot management with enable/disable controls" },
      { type: 'feature', description: "Twaater Admin: Manual triggers for bot twaats, engagement, and follower functions" },
      { type: 'feature', description: "Twaater Admin: Platform stats overview (accounts, twaats, follows, bots)" },
      { type: 'improvement', description: "Twaater: 10 new bot personality types (radio, festival, podcast, journalist, etc.)" },
      { type: 'improvement', description: "Twaater: Recent activity feed in admin showing latest posts" },
    ],
  },
  {
    version: "1.0.534",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "Admin: Added City Governance page to appoint mayors and trigger elections" },
      { type: 'feature', description: "Admin: View and manage current mayors across all cities" },
      { type: 'feature', description: "Admin: Trigger new elections and advance election phases" },
    ],
  },
  {
    version: "1.0.533",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Songwriting: Made 'Invite' collaborator button visible on mobile by wrapping card actions and adding label" },
    ],
  },
  {
    version: "1.0.532",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "Cities: Added governance section showing current mayor with avatar and approval rating" },
      { type: 'feature', description: "Cities: Display active election status (nominations/voting phase) with countdown" },
      { type: 'feature', description: "Cities: Quick view of key local laws (taxes, curfew, alcohol age)" },
      { type: 'feature', description: "Cities: Link to view candidates or cast vote during election season" },
    ],
  },
  {
    version: "1.0.531",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "Songwriting: Added 'Invite Collaborator' button to project cards for real player co-writing" },
      { type: 'feature', description: "Songwriting: Invite band members (free) or friends (flat fee / royalty split) to collaborate" },
      { type: 'improvement', description: "Rehearsal Studio: Fully functional staff hiring, equipment rental, and upgrades management" },
      { type: 'improvement', description: "Rehearsal Studio: Financial overview with revenue/expense tracking" },
      { type: 'improvement', description: "Recording Studio: Session tracking and basic financial overview" },
      { type: 'fix', description: "Company System: Fixed placeholder content in business management pages" },
    ],
  },
  {
    version: "1.0.530",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Charts: Fixed PostgREST ambiguous relationship error for release_songs foreign key" },
      { type: 'fix', description: "Charts: Album charts now show actual album names (streaming_album, combined_album, digital_sales_album)" },
      { type: 'improvement', description: "Charts: Album entries properly aggregated with release_id and release_title" },
    ],
  },
  {
    version: "1.0.529",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Charts: Album charts now properly aggregate sales/streams by release instead of showing individual songs" },
      { type: 'fix', description: "Charts: Album entries now have correct entry_type='album' and release_title" },
      { type: 'fix', description: "Charts: Added album/EP sales chart generation for CD, vinyl, digital, and cassette formats" },
      { type: 'improvement', description: "Charts: Frontend now filters entries by entry_type when viewing album/EP charts" },
    ],
  },
  {
    version: "1.0.528",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Charts: Fixed data display by querying correct chart types (base + scoped variants)" },
      { type: 'improvement', description: "Charts: Simplified tabs to Top 50, Streaming, Digital, Physical, and Radio" },
      { type: 'feature', description: "Charts: New Physical Sales tab combining CD, Vinyl, and Cassette sales" },
      { type: 'fix', description: "Charts: Release category selector only shows for chart types with album data" },
      { type: 'fix', description: "Charts: Added radio_airplay_single chart type generation" },
    ],
  },
  {
    version: "1.0.527",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Underworld: Health effects now properly apply when using consumable items" },
      { type: 'fix', description: "Underworld: Used items now correctly disappear from inventory" },
      { type: 'fix', description: "Underworld: Added floor validation (0-100 range) for health and energy effects" },
      { type: 'improvement', description: "Underworld: Negative effects now show correct signs (-10 instead of +-10)" },
      { type: 'improvement', description: "Underworld: Color coding for effects (green positive, red negative)" },
    ],
  },
  {
    version: "1.0.526",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Charts: Album charts now aggregate all song streams into one album entry" },
      { type: 'fix', description: "Charts: Combined album chart now works correctly (was missing combined_album entries)" },
      { type: 'fix', description: "Charts: Album/EP charts now display album names instead of individual song names" },
      { type: 'improvement', description: "Charts: One entry per album instead of per-song entries for album charts" },
      { type: 'improvement', description: "Charts: Added release_title column for proper album name display" },
    ],
  },
  {
    version: "1.0.525",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "Cities: Added city governance system with mayors and elections" },
      { type: 'feature', description: "Cities: Mayors set local laws including tax rates, alcohol age, drug policy" },
      { type: 'feature', description: "Cities: Noise curfew, prohibited/promoted genres, travel tax laws" },
      { type: 'feature', description: "Cities: Annual election cycle with nomination and voting phases" },
      { type: 'feature', description: "Cities: Players can run for mayor with campaign slogans and policy proposals" },
      { type: 'feature', description: "Cities: Law history tracking with audit trail of all changes" },
    ],
  },
  {
    version: "1.0.524",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "Songwriting: Collaborative songwriting - invite band members or friends to co-write songs" },
      { type: 'feature', description: "Songwriting: Band members can join projects directly with no fee" },
      { type: 'feature', description: "Songwriting: Friends can be offered one-off writing fees ($50-$10,000)" },
      { type: 'feature', description: "Songwriting: Royalty split offers (5%-50%) for ongoing song earnings" },
      { type: 'feature', description: "Songwriting: Collaborator invitation system with accept/decline workflow" },
      { type: 'improvement', description: "Songwriting: Project cards show collaborator avatars and co-write badge" },
      { type: 'improvement', description: "Songwriting: Collaboration payments tracked and audited" },
    ],
  },
  {
    version: "1.0.523",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Setlists: Fixed race conditions when adding/removing/moving performance items" },
      { type: 'fix', description: "Setlists: Added ref guards to prevent double-click errors on item operations" },
      { type: 'fix', description: "Setlists: Fresh database queries before mutations to validate state" },
      { type: 'improvement', description: "Setlists: Better error messages for position conflicts and duplicate items" },
      { type: 'improvement', description: "Setlists: Pre-check for duplicate songs/items before attempting insert" },
    ],
  },
  {
    version: "1.0.522",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Merch: Sales now properly decrement stock_quantity from inventory" },
      { type: 'fix', description: "Merch: Sales revenue now correctly added to band earnings (net after taxes)" },
      { type: 'feature', description: "Merch: Sales tax added for US/Canada orders (5-13% depending on location)" },
      { type: 'feature', description: "Merch: VAT added for EU/international orders (10-25% depending on country)" },
      { type: 'improvement', description: "Merch: Order records now track sales_tax, vat, and net_revenue separately" },
      { type: 'improvement', description: "Merch: Band earnings metadata includes tax breakdown and stock changes" },
    ],
  },
  {
    version: "1.0.521",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Charts: Album charts now correctly show only album data (not mixed with singles)" },
      { type: 'fix', description: "Charts: EP charts now correctly show only EP data" },
      { type: 'feature', description: "Charts: Year selector added - when viewing 'This Year', can now filter by specific years (2020-current)" },
      { type: 'improvement', description: "Charts: 'All' release category now properly aggregates singles, EPs, and albums together" },
    ],
  },
  {
    version: "1.0.519",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "POV: AI-powered clip generation edge function (generate-pov-clip) using Gemini image model" },
      { type: 'feature', description: "POV: Full prompt library for all clip variants (G1, G2, B1, D1, D2, V1, C1, C2, L1, L2, H1)" },
      { type: 'feature', description: "POV: Dynamic skin and sleeve style modifiers applied to generation prompts" },
      { type: 'feature', description: "POV: usePOVClipGenerator hook with caching for efficient clip generation" },
      { type: 'feature', description: "POV: POVClipPreview component for generating and previewing AI frames with MTV2 post-processing" },
      { type: 'improvement', description: "POV: All prompts tuned for MTV2/Kerrang late-night aesthetic: grainy, high contrast, overexposed highlights" },
    ],
  },
  {
    version: "1.0.515",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "POV: InstrumentSkinOverlay (H1) - hands/instrument overlay for layering player-owned skins on base POV clips" },
      { type: 'feature', description: "POV: 7 guitar skins (classic-sunburst, midnight-black, arctic-white, cherry-red, ocean-blue, neon-green, purple-haze)" },
      { type: 'feature', description: "POV: 5 bass skins (natural-wood, jet-black, vintage-sunburst, blood-red, electric-blue)" },
      { type: 'feature', description: "POV: 5 sleeve styles (leather, denim, hoodie, bare, band-tee) for player customization" },
      { type: 'improvement', description: "POV: Animated picking hand with guitar pick or bass plucking fingers" },
      { type: 'improvement', description: "POV: MTV2/Kerrang overexposed light reflections on instrument body" },
    ],
  },
  {
    version: "1.0.514",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "POV Clip Variants: Guitar strumming (G1) and solo close-up (G2) with switchable guitar skins" },
      { type: 'feature', description: "POV Clip Variants: Bass groove (B1) with plucking animation and wristbands" },
      { type: 'feature', description: "POV Clip Variants: Drums snare POV (D1) and overhead toms POV (D2)" },
      { type: 'feature', description: "POV Clip Variants: Vocalist mic POV (V1) with crowd view and stage monitors" },
      { type: 'feature', description: "POV Clip Variants: Small venue crowd (C1) and medium/arena crowd (C2) backgrounds" },
      { type: 'feature', description: "POV Overlays: Dynamic stage lights overlay (L1) with sweeping beams and lens flares" },
      { type: 'feature', description: "POV Overlays: Cinematic camera shake overlay (L2) with motion blur" },
      { type: 'feature', description: "POV Skins: Alternate hands/sleeves (H1) with leather jacket option" },
      { type: 'improvement', description: "POV: Clip variant system with energy-based and song-section-based clip selection" },
    ],
  },
  {
    version: "1.0.513",
    date: "2026-01-26",
    changes: [
      { type: 'improvement', description: "POV: Enhanced Guitar POV - detailed strumming/solo view with visible hands, sleeves, wristbands, and custom guitar skins" },
      { type: 'improvement', description: "POV: Enhanced Bass POV - plucking groove focus with bass strings, wristbands, amp stack, and head bob motion" },
      { type: 'improvement', description: "POV: Enhanced Drummer POV - snare/hi-hat focus with drumsticks, gloved hands, wristbands, and hit flash effects" },
      { type: 'improvement', description: "POV: Enhanced Vocalist POV - mic close-up with detailed crowd, phone lights, hand gestures, and stage monitors" },
      { type: 'improvement', description: "POV: MTV2/Kerrang aesthetic upgraded - overexposed stage lights, high contrast, gritty handheld feel across all views" },
      { type: 'feature', description: "POV: Crowd silhouettes with reaching hands, phone lights, and energy-reactive animations" },
      { type: 'feature', description: "POV: Visible clothing details (jacket sleeves, leather wristbands, studded accessories) on all performers" },
    ],
  },
  {
    version: "1.0.512",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "NEW: First-Person POV Concert Mode - experience gigs from the performer's perspective" },
      { type: 'feature', description: "POV: Instrument-specific views (guitarist, drummer, vocalist, bassist, keyboardist)" },
      { type: 'feature', description: "POV: MTV2/Kerrang late-night aesthetic with film grain, high contrast, desaturation" },
      { type: 'feature', description: "POV: Handheld camera shake simulation synced to song energy" },
      { type: 'feature', description: "POV: Dynamic overlay system (lens flares, stage lights, crowd hands, pyro)" },
      { type: 'feature', description: "POV: Post-processing effects layer with vignette and scan lines" },
      { type: 'feature', description: "POV: Role selector to view from any band member's perspective" },
      { type: 'feature', description: "POV: Automatic clip cycling based on song section and energy" },
    ],
  },
  {
    version: "1.0.511",
    date: "2026-01-26",
    changes: [
      { type: 'feature', description: "NEW: Inbox page - centralized hub for all player messages and notifications" },
      { type: 'feature', description: "Inbox: Random event outcomes and pending decisions" },
      { type: 'feature', description: "Inbox: Gig results with earnings and reputation changes" },
      { type: 'feature', description: "Inbox: PR and media appearance invites" },
      { type: 'feature', description: "Inbox: Sponsorship and contract offers" },
      { type: 'feature', description: "Inbox: Daily financial summary (streaming, sales, tickets)" },
      { type: 'feature', description: "Inbox: Friend requests and band invitations" },
      { type: 'feature', description: "Inbox: Filter messages by category" },
      { type: 'feature', description: "Inbox: Mark as read and archive functionality" },
      { type: 'feature', description: "Inbox: Unread count badge in navigation" },
    ],
  },
  {
    version: "1.0.510",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "AI Music: CRITICAL FIX - User-entered lyrics from songwriting are no longer overwritten by AI generation" },
      { type: 'fix', description: "AI Music: Original lyrics in songwriting projects are now preserved and never replaced" },
    ],
  },
  {
    version: "1.0.509",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Band Manager: Fixed overlapping tab layout on mobile - main tabs now properly wrap with consistent spacing" },
      { type: 'improvement', description: "Band Manager: Shortened tab labels on mobile for better fit (Fame, Rep, History)" },
    ],
  },
  {
    version: "1.0.508",
    date: "2026-01-26",
    changes: [
      { type: 'fix', description: "Rehearsals: CRITICAL FIX - Song familiarity now updates correctly (fixed database constraint mismatch with stage values)" },
      { type: 'fix', description: "Rehearsals: Full setlist rehearsals now properly update familiarity for ALL songs in the setlist" },
      { type: 'improvement', description: "Rehearsals: Enhanced post-rehearsal report with color-coded progress bars and improved time formatting" },
      { type: 'fix', description: "Rehearsals: Retroactively fixed completed rehearsals from past 2 weeks that were missing familiarity data" },
      { type: 'improvement', description: "Rehearsals: Added shared stage calculation utility for consistency between client and server" },
    ],
  },
  {
    version: "1.0.507",
    date: "2026-01-25",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed 'Failed to schedule activity for all band members' error - now includes required profile_id in activity records" },
    ],
  },
  {
    version: "1.0.506",
    date: "2026-01-25",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed post-rehearsal completion report not displaying - now shows song progress and level-up information" },
      { type: 'fix', description: "Rehearsals: Fixed song familiarity not updating after rehearsals - corrected upsert logic with proper conflict resolution" },
      { type: 'improvement', description: "Rehearsals: Improved scheduling conflict error messages - now clearly indicates when you have a conflict" },
      { type: 'fix', description: "Rehearsals: Fixed RLS policies for band_song_familiarity to allow proper inserts by band members" },
    ],
  },
  {
    version: "1.0.505",
    date: "2026-01-24",
    changes: [
      { type: 'fix', description: "Rehearsals: Fixed availability check to only include real players (excludes touring/NPC members)" },
      { type: 'feature', description: "Rehearsals: Added post-rehearsal completion report showing song familiarity gains and time to next levels" },
      { type: 'fix', description: "Tours: Fixed auto-travel not updating player location - now completes in-progress travels when arrival time passes" },
    ],
  },
  {
    version: "1.0.504",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Companies: Fixed subsidiary creation - labels, venues, rehearsal studios now properly create their specialized business records" },
      { type: 'improvement', description: "Companies: Aligned creation costs with realistic values ($1M for labels, $750K for venues, etc.)" },
      { type: 'feature', description: "Companies: Added Recording Studio as a new subsidiary type ($400K to create)" },
      { type: 'improvement', description: "Companies: Added smart navigation to route subsidiaries to their management pages" },
      { type: 'fix', description: "Companies: Added company_id column to venues table for proper ownership tracking" },
    ],
  },
  {
    version: "1.0.503",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Offers: Registered missing cron jobs for PR, sponsorship, and daily update offer generation" },
      { type: 'fix', description: "Offers: Created missing sponsorship_entities table required for sponsorship offer generation" },
      { type: 'fix', description: "Offers: Added missing cooldown_days column to pr_media_offers table" },
      { type: 'fix', description: "Offers: Added missing entity_id/payout/terms columns to sponsorship_offers table" },
      { type: 'fix', description: "Offers: Removed 50 fame requirement for PR offers - local media now available to all bands" },
      { type: 'feature', description: "Offers: Auto-populate sponsorship entities for active bands with trigger for new bands" },
    ],
  },
  {
    version: "1.0.502",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Music Videos: Fixed critical bug where no recorded songs were found - was using wrong profile ID field" },
      { type: 'fix', description: "Music Videos: Fixed release song lookup to correctly match by release_id" },
      { type: 'fix', description: "Music Videos: Songs with 'recorded' status now properly appear in the video creation dialog" },
      { type: 'feature', description: "Companies: Added quick 'Finance' button to company cards for easier deposit/withdraw access" },
    ],
  },
  {
    version: "1.0.501",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Companies: Creating subsidiaries now auto-creates business entities (security firms, factories, logistics)" },
      { type: 'feature', description: "Companies: Added creation costs and initial starting capital by company type" },
      { type: 'feature', description: "Companies: Added deposit/withdraw funds functionality for company owners" },
      { type: 'feature', description: "Companies: Introduced monthly tax billing system with progressive rates (10-25%)" },
      { type: 'feature', description: "Companies: Added CompanyFinanceDialog for managing company funds" },
      { type: 'feature', description: "Companies: Added CompanyTaxOverview for viewing and paying taxes" },
      { type: 'improvement', description: "Companies: Added logistics company type to company system" },
    ],
  },
  {
    version: "1.0.500",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Companies: Fixed 'Company Not Found' caused by route param mismatch (companyId vs id)" },
    ],
  },
  {
    version: "1.0.499",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Company Admin: Fixed edit error - corrected column name from balance_went_negative_at to negative_balance_since" },
      { type: 'fix', description: "Companies: Fixed 404 error when clicking Manage - corrected route from /companies/:id to /company/:id" },
    ],
  },
  {
    version: "1.0.498",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Admin: Underworld product skill selection now uses dropdown with all skills from skill tree" },
      { type: 'feature', description: "Recording: Added date and time slot selection to recording session booking (mirrors rehearsal flow)" },
      { type: 'improvement', description: "Recording: Sessions now use fixed 4-hour time slots (Morning, Afternoon, Evening, Late Night)" },
    ],
  },
  {
    version: "1.0.497",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Company Admin: Full edit dialog for company name, balance, status, and bankruptcy flag" },
      { type: 'feature', description: "Company Admin: Quick fund injection buttons (+$50k, +$100k, +$500k)" },
      { type: 'feature', description: "Company Admin: Financial Overview tab with daily payroll and operating costs" },
      { type: 'feature', description: "Company Admin: Subsidiary quick links to Security Firms, Factories, Logistics, Labels" },
      { type: 'feature', description: "Company Admin: Clear bankruptcy and inject funds actions for bankrupt companies" },
    ],
  },
  {
    version: "1.0.496",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Security Firms Admin: Global management of all security firms, guards, and contracts" },
      { type: 'feature', description: "Merch Factories Admin: Global management of all factories, workers, production queues, and product catalogs" },
      { type: 'feature', description: "Logistics Companies Admin: Global management of all logistics companies, fleet vehicles, drivers, and contracts" },
      { type: 'improvement', description: "Admin Navigation: Added subsidiary admin pages under System & Configuration" },
    ],
  },
  {
    version: "1.0.495",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Underworld Admin: Added to admin navigation under Economy & Resources" },
      { type: 'feature', description: "Underworld Admin: Full edit/delete functionality for crypto tokens" },
      { type: 'feature', description: "Underworld Admin: Simulate Prices button randomizes all token prices ±10%" },
      { type: 'feature', description: "Underworld Admin: New Analytics tab with purchase history, revenue, and active boosts" },
      { type: 'feature', description: "Underworld Admin: Token transaction history view" },
    ],
  },
  {
    version: "1.0.494",
    date: "2026-01-23",
    changes: [
      { type: 'improvement', description: "Band Overview: Gifted Songs now displays below the tabs, before Band Profile" },
    ],
  },
  {
    version: "1.0.493",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Weekly fans now calculated from actual activity in last 7 days instead of stale counter" },
      { type: 'improvement', description: "Band Manager: Moved Gifted Songs and Band Profile sections to bottom of overview" },
    ],
  },
  {
    version: "1.0.492",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Donate to Project button - VIP players can donate $10 to support the project" },
      { type: 'feature', description: "Donation grants 'Project Supporter' achievement and 1000 XP reward" },
      { type: 'fix', description: "Fixed release_formats constraint errors - added 'cassette' to format_type and 'manufacturing' to manufacturing_status" },
    ],
  },
  {
    version: "1.0.491",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Fixed Songs tab returning 0 results - now queries songs by band_id directly" },
      { type: 'improvement', description: "Band Overview redesigned with tabbed layout (Quick Stats, Performance, Engagement, Profile)" },
      { type: 'improvement', description: "Improved color visibility with gradient cards and semantic color tokens" },
    ],
  },
  {
    version: "1.0.490",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Fixed setlist change not appearing - song counts now properly calculated from setlist_songs table" },
    ],
  },
  {
    version: "1.0.489",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Dashboard redesigned with sub-tabs: Quick Stats, Career, Finances, Location" },
      { type: 'feature', description: "Unified navigation - desktop now uses bottom nav bar matching mobile experience" },
      { type: 'improvement', description: "Dashboard overview shows band summary, upcoming events, weekly earnings" },
      { type: 'improvement', description: "Better color contrast and visibility using semantic design tokens" },
      { type: 'improvement', description: "Removed sidebar on desktop - maximized content area" },
    ],
  },
  {
    version: "1.0.488",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Ticket operator selection now mandatory for venues 200+ capacity" },
      { type: 'feature', description: "8 legendary historic venues added (United Center, Ryman Auditorium, Caesars Superdome, etc.)" },
      { type: 'fix', description: "Fixed fame-to-fans ratio - bands now properly gain fans based on fame level (5% for mega bands)" },
      { type: 'fix', description: "Setlist change button now shows even with single eligible setlist" },
      { type: 'improvement', description: "Ticket operator display component added for booked gigs" },
    ],
  },
  {
    version: "1.0.487",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Ticket price adjuster now available directly on PerformGig page for scheduled gigs with poor sales" },
      { type: 'improvement', description: "PerformGig page now fetches band fame and fan data for price adjustment calculations" },
    ],
  },
  {
    version: "1.0.486",
    date: "2026-01-23",
    changes: [
      { type: 'improvement', description: "Regional fame now affects daily release sales - more sales in countries where you're famous" },
      { type: 'improvement', description: "Deployed all edge functions with regional fame and ticket operator integrations" },
    ],
  },
  {
    version: "1.0.485",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Comprehensive fame system overhaul - 20 fame levels from 'bedroom' to 'legendary band'" },
      { type: 'feature', description: "Gig details dialog accessible from schedule - view ticket sales, setlist, and pricing" },
      { type: 'feature', description: "Ticket price adjustment - reduce prices up to 30% when sales are poor" },
      { type: 'feature', description: "5 ticket operators (FeeMaster, TicketHoarder, SeatSnatcher, QueueMaster, ClickFastLoseAnyway)" },
      { type: 'feature', description: "Ticket operators offer different cuts, sales boosts, and tout levels for medium+ venues" },
      { type: 'feature', description: "Tout mechanics - higher tout level means more sell-outs but fewer real fans and lower fan gains" },
      { type: 'feature', description: "Dynamic pricing option with ClickFastLoseAnyway operator - more revenue but fame/fan cost" },
      { type: 'feature', description: "Regional fame system - country-based fame with neighboring country spillover (20%)" },
      { type: 'feature', description: "Unvisited countries capped at 100 fame until you perform there" },
      { type: 'feature', description: "Ticket operator sales boost applied to daily ticket simulation" },
      { type: 'improvement', description: "Tour wizard now includes ticket operator selection on pricing step" },
      { type: 'improvement', description: "Tour manager displays band fame title instead of raw number" },
      { type: 'fix', description: "Tour manager now correctly displays band fame level with proper title" },
    ],
  },
  {
    version: "1.0.484",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Gig setlist display now shows on perform gig page with change option" },
      { type: 'feature', description: "Tour venues display setlist information for each gig" },
      { type: 'improvement', description: "Setlist changes locked 1 hour before gig starts with clear indicator" },
    ],
  },
  {
    version: "1.0.483",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Gigs now display which setlist is being used" },
      { type: 'feature', description: "Players can change gig setlists up to 1 hour before start time" },
      { type: 'improvement', description: "Setlist locked indicator shows when changes are no longer allowed" },
      { type: 'improvement', description: "GigSetlistDisplay component with compact and full modes" },
    ],
  },
  {
    version: "1.0.482",
    date: "2026-01-23",
    changes: [
      { type: 'fix', description: "Fixed tour gigs not showing on schedule - resolved timezone comparison issues" },
      { type: 'fix', description: "Music Videos: Now shows all recorded songs, not just from released albums" },
      { type: 'fix', description: "Music Videos: Removed member_status filter that was hiding songs" },
      { type: 'improvement', description: "Music Videos: Added loading state and better error messaging for song selection" },
      { type: 'improvement', description: "Physical Releases: Fallback costs now work properly when manufacturing costs not found" },
      { type: 'improvement', description: "Schedule: Added debug logging for gig fetching" },
    ],
  },
  {
    version: "1.0.481",
    date: "2026-01-23",
    changes: [
      { type: 'improvement', description: "Mobile UI: Consolidated header from 2 rows (~72px) to single row (48px) - more screen space" },
      { type: 'improvement', description: "Mobile UI: 5-tab bottom navigation with icon-only compact design (Home, Music, Band, Schedule, More)" },
      { type: 'improvement', description: "Mobile UI: Moved theme/language switchers and version history into hamburger menu" },
      { type: 'fix', description: "Fixed horizontal overflow issues - added overflow-x-hidden to body and main containers" },
      { type: 'improvement', description: "Added safe-area-inset support for devices with notches (iPhone X+)" },
      { type: 'improvement', description: "Reduced bottom nav height and adjusted spacing for better touch targets" },
    ],
  },
  {
    version: "1.0.480",
    date: "2026-01-23",
    changes: [
      { type: 'feature', description: "Band Genre Management: Leaders can now set primary genre and up to 2 secondary genres" },
      { type: 'feature', description: "Genre changes have a 30-day cooldown to prevent frequent switching" },
      { type: 'feature', description: "Added 'Travels with Band' toggle in Band Roster for tour automation" },
      { type: 'fix', description: "Fixed tour gigs created with $0 ticket price - now calculates proper pricing based on venue and fame" },
      { type: 'fix', description: "Fixed band members not automatically moving during tours - default travels_with_band to true" },
      { type: 'improvement', description: "Genre selection uses centralized genre list from skill tree" },
    ],
  },
  {
    version: "1.0.479",
    date: "2026-01-22",
    changes: [
      { type: 'feature', description: "Added Admin Debug Panel for troubleshooting player issues" },
      { type: 'feature', description: "Debug Panel shows recent edge function executions with success/failure status" },
      { type: 'feature', description: "Debug Panel includes player lookup to view game state (bands, rehearsals, travel, familiarity)" },
      { type: 'feature', description: "Debug Panel shows database stats overview (players, bands, scheduled activities)" },
      { type: 'feature', description: "Errors tab shows all failed edge function runs with error details" },
    ],
  },
  {
    version: "1.0.478",
    date: "2026-01-22",
    changes: [
      { type: 'fix', description: "Fixed rehearsal song familiarity not updating - added error logging and improved cache invalidation" },
      { type: 'fix', description: "Fixed Music Videos page not detecting recorded songs - now shows all recorded songs, not just from released albums" },
      { type: 'feature', description: "Added process-tour-travel edge function to automatically move band members during tours" },
      { type: 'fix', description: "Tour travel now creates player_travel_history entries for band members with 'travels_with_band' enabled" },
      { type: 'improvement', description: "Rehearsal completion now invalidates more query keys for immediate UI refresh" },
    ],
  },
  {
    version: "1.0.477",
    date: "2026-01-21",
    changes: [
      { type: 'fix', description: "Fixed mentor focus_skill mappings to use valid skill definition slugs" },
      { type: 'fix', description: "Added missing skill definitions for orphan education skills (vocals, guitar, bass, drums, etc.)" },
      { type: 'feature', description: "Skill Tree now shows compact list view with education source badges (university, book, video, mentor)" },
      { type: 'feature', description: "Added filter modes: Learned, Education, All, Unlearned for easier skill browsing" },
      { type: 'feature', description: "Skills gained from education (YouTube, Books, University, Mentors) now properly display in skill hierarchy" },
      { type: 'improvement', description: "Skill Tree now has scrollable container (500px max) for better viewing of large skill lists" },
      { type: 'improvement', description: "Category filtering improved with pattern matching instead of exact string matching" },
      { type: 'improvement', description: "Added skill counts per category for quick overview" },
    ],
  },
  {
    version: "1.0.476",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Chart notifications now rate-limited to once every 12 hours per song/chart type" },
      { type: 'fix', description: "Fixed underworld products RLS - admins can now add/edit/delete products" },
      { type: 'feature', description: "Seeded 20 more TV networks, 20 magazines, 20 podcasts, and 15 websites for PR system" },
      { type: 'feature', description: "Added cooldown_days column to magazines, podcasts, and websites for PR cooldowns" },
    ],
  },
  {
    version: "1.0.475",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed encore move constraint error - updated unique constraint to be per-section (setlist_id, section, position)" },
    ],
  },
  {
    version: "1.0.474",
    date: "2026-01-20",
    changes: [
      { type: 'feature', description: "Added tour cancellation button in tour details dialog with same-day refund logic" },
      { type: 'fix', description: "Fixed current tour detection to show tours where start_date <= now and end_date >= now" },
      { type: 'feature', description: "Added VIP sales pause/unpause toggle in admin VIP Management page" },
      { type: 'feature', description: "Created system_settings table for global app configuration" },
    ],
  },
  {
    version: "1.0.473",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed website feature request failing - removed non-existent user_id column from website_submissions insert" },
      { type: 'fix', description: "Fixed tour booking 'travel_mode_check' constraint error - was using 'auto' instead of valid mode like 'bus'" },
    ],
  },
  {
    version: "1.0.472",
    date: "2026-01-20",
    changes: [
      { type: 'feature', description: "Added dedicated Sales Analytics tab with revenue charts, geographic breakdown, and top products" },
      { type: 'feature', description: "Added Brand Collaboration System - brands can offer partnerships with upfront payments and royalties" },
      { type: 'feature', description: "Added 6 brand partners across 4 tiers (indie, mainstream, premium, luxury) with varying fame requirements" },
      { type: 'feature', description: "Added Active Collaborations tracking with sales boost percentages and royalty earnings" },
      { type: 'feature', description: "Added custom design preview modal for viewing saved t-shirt designs" },
      { type: 'improvement', description: "Merchandise page now has 5 tabs: Overview, Sales, Add Product, Manage Inventory, Designer" },
      { type: 'improvement', description: "Sales tab includes time range filters (Today, Week, Month, All Time)" },
    ],
  },
  {
    version: "1.0.471",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed streaming chart returning empty - removed broken nested Supabase filter, now filters status='recorded' in code" },
      { type: 'fix', description: "Fixed radio airplay chart - now queries radio_plays table (with listeners column) instead of radio_playlists" },
      { type: 'fix', description: "Radio chart aggregates individual play events and sums listeners correctly" },
    ],
  },
  {
    version: "1.0.470",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed streaming chart showing blank - corrected column references (song_release_id, daily_streams) in update-music-charts" },
      { type: 'fix', description: "Fixed song status filter from 'released' to 'recorded' in chart generation" },
      { type: 'fix', description: "Time range filters (This Week/Month/Year) now properly aggregate data across multiple chart dates" },
      { type: 'feature', description: "Country-specific charts now generated from listener_region data in streaming analytics" },
      { type: 'improvement', description: "Chart column headers now show dynamic time range labels (Today, This Week, This Month, This Year)" },
    ],
  },
  {
    version: "1.0.469",
    date: "2026-01-20",
    changes: [
      { type: 'feature', description: "VIP Payment System: Stripe integration with Monthly ($4.99), Quarterly ($12.49), and Annual ($39.99) plans" },
      { type: 'feature', description: "New /vip-subscribe page with pricing cards, feature list, and checkout flow" },
      { type: 'feature', description: "VIP days remaining now visible next to VipBadge (e.g., '14d')" },
      { type: 'feature', description: "VipStatusCard component for Dashboard showing subscription details and progress" },
      { type: 'feature', description: "Stripe Customer Portal for subscription management" },
      { type: 'improvement', description: "VipGate now redirects to /vip-subscribe instead of skin store" },
    ],
  },
  {
    version: "1.0.468",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed radio airplay stats always showing 0 - process-radio-submissions now correctly inserts to radio_playlists with week_start_date" },
      { type: 'fix', description: "Backfilled radio_playlists from 77 previously accepted submissions" },
      { type: 'improvement', description: "Radio plays will now generate correctly from songs in active playlists" },
    ],
  },
  {
    version: "1.0.467",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "VIP status now syncs automatically between vip_subscriptions and profiles.is_vip via database trigger" },
      { type: 'fix', description: "Fixed sponsorship cron job - added missing cooldown_until column to sponsorship_brands" },
      { type: 'fix', description: "Fixed process-event-outcomes edge function RPC syntax error" },
      { type: 'feature', description: "Added Radio Airplay chart type" },
      { type: 'feature', description: "Added chart history graphs - click any song to see position history" },
      { type: 'feature', description: "Added time range filters: Daily, Weekly, Monthly, Yearly views" },
      { type: 'feature', description: "Added chart achievements: Chart Topper, Week at the Top, Month of Glory, Year of Dominance" },
      { type: 'improvement', description: "Charts now default to Singles instead of All releases" },
    ],
  },
  {
    version: "1.0.466",
    date: "2026-01-20",
    changes: [
      { type: 'feature', description: "Charts now use industry-standard combined formula: (streams/150) + digital + CD + vinyl + cassette sales" },
      { type: 'feature', description: "Added weekly_plays and combined_score columns for accurate chart tracking" },
      { type: 'fix', description: "Combined chart now queries directly from database instead of client-side combining" },
      { type: 'improvement', description: "Chart table shows appropriate metrics per chart type (Chart Pts for combined, Weekly/Total for others)" },
      { type: 'improvement', description: "Added tooltip explaining the chart points formula" },
    ],
  },
  {
    version: "1.0.465",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed setlist rehearsals not updating song familiarity - added missing setlist_id column to band_rehearsals" },
      { type: 'fix', description: "Rehearsal booking now correctly stores setlist_id for setlist-based rehearsals" },
    ],
  },
  {
    version: "1.0.464",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Fixed setlist songs query using wrong table name (performance_items → performance_items_catalog)" },
    ],
  },
  {
    version: "1.0.463",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Setlist reordering now uses atomic database transaction (RPC) to prevent unique constraint collisions" },
      { type: 'fix', description: "Position logic now uses per-section numbering (main: 1-N, encore: 1-N) instead of global offsets" },
      { type: 'fix', description: "Adding songs to setlist now reliably inserts with correct position per-section" },
      { type: 'fix', description: "Move to encore/main now correctly calculates next position within target section" },
      { type: 'improvement', description: "Setlist songs query now keeps previous data while refetching to prevent UI blinking" },
      { type: 'improvement', description: "Better error messages for duplicate song constraint violations" },
    ],
  },
  {
    version: "1.0.462",
    date: "2026-01-20",
    changes: [
      { type: 'fix', description: "Setlist manager now loads songs faster with optimized parallel queries" },
      { type: 'feature', description: "Drag-and-drop reordering for setlist songs using dnd-kit library" },
      { type: 'feature', description: "Arrow buttons for manual song reordering (mobile/accessibility)" },
      { type: 'fix', description: "Performance items can now be added and removed correctly" },
      { type: 'improvement', description: "Song list caching for 2 minutes to reduce database queries" },
    ],
  },
  {
    version: "1.0.461",
    date: "2026-01-20",
    changes: [
      { type: 'feature', description: "Cron jobs configured: complete-self-promotions (every 10 min), simulate-merch-sales (daily 6 AM), trigger-random-events (every 2 hours)" },
    ],
  },
  {
    version: "1.0.460",
    date: "2026-01-19",
    changes: [
      { type: 'fix', description: "Fixed self-promotion activities not completing - new dedicated completion cron job every 10 minutes" },
      { type: 'feature', description: "Daily merchandise sales simulation - bands with fans now earn passive merch revenue" },
      { type: 'feature', description: "Merchandise orders table with sales by country, customer type, and order channel" },
      { type: 'feature', description: "Today's News now shows: earnings breakdown, merch sales, pending random events" },
      { type: 'improvement', description: "Random events trigger chance increased from 4% to 6.7% for more activity" },
      { type: 'feature', description: "New Earnings News component showing daily income by source" },
      { type: 'feature', description: "New Merchandise Sales News with top products and top markets" },
      { type: 'feature', description: "Random Events News shows pending decisions requiring attention" },
    ],
  },
  {
    version: "1.0.459",
    date: "2026-01-18",
    changes: [
      { type: 'fix', description: "Fixed self-promotion activities never completing - added missing handler in scheduled activities processor" },
    ],
  },
  {
    version: "1.0.458",
    date: "2026-01-18",
    changes: [
      { type: 'fix', description: "Fixed infinite recursion in companies RLS policies breaking gigs, venues, studios, rehearsals" },
      { type: 'fix', description: "Cleaned up all recursive policies on companies, venues, city_studios, rehearsal_rooms tables" },
      { type: 'fix', description: "Fixed gig_outcomes.overall_rating NOT NULL constraint causing auto-start failures" },
      { type: 'improvement', description: "All venue/studio/rehearsal data now loads correctly for booking and history" },
    ],
  },
  {
    version: "1.0.457",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Integration: Complete cron jobs and admin features" },
      { type: 'feature', description: "7 new cron edge functions: payroll, operations, venue/studio bookings, logistics contracts, bankruptcy, reports" },
      { type: 'feature', description: "Admin Company Management page for oversight of all player companies" },
      { type: 'feature', description: "VIP gating added to Security Firm and Merch Factory management pages" },
      { type: 'feature', description: "New management pages: Logistics, Venue, Rehearsal Studio, Recording Studio businesses" },
      { type: 'feature', description: "Automated daily payroll processing for all company employees" },
      { type: 'feature', description: "Bankruptcy detection system with 7-day grace period and warnings" },
      { type: 'feature', description: "Weekly financial report generation with KPIs and synergy detection" },
      { type: 'improvement', description: "Company-owned venues and studios now auto-credit revenue to parent company" },
    ],
  },
  {
    version: "1.0.456",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 10: Advanced Features Complete" },
      { type: 'feature', description: "Company Empire Dashboard with consolidated metrics and KPIs" },
      { type: 'feature', description: "Business Synergies system - unlock discounts when owning complementary businesses" },
      { type: 'feature', description: "Company Goals Manager - set and track business targets" },
      { type: 'feature', description: "Notifications Center for company alerts and updates" },
      { type: 'feature', description: "Internal Services Log tracking cross-business usage and savings" },
      { type: 'feature', description: "Financial reporting with revenue/expense breakdown" },
      { type: 'improvement', description: "Full 10-phase VIP Company System implementation complete" },
    ],
  },
  {
    version: "1.0.455",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 9: Logistics & Transport Companies" },
      { type: 'feature', description: "Create and manage logistics companies as company subsidiaries" },
      { type: 'feature', description: "Fleet vehicle management - vans, sprinters, box trucks, semi-trailers, flatbeds" },
      { type: 'feature', description: "Driver hiring system with license types (standard, commercial, hazmat, oversize)" },
      { type: 'feature', description: "Transport contracts - tour transport, equipment haul, merch delivery, one-way/round trips" },
      { type: 'feature', description: "Contract assignment system with vehicle and driver scheduling" },
      { type: 'feature', description: "Company upgrades - fleet capacity, GPS tracking, climate control, insurance, permits" },
      { type: 'improvement', description: "License tiers from Local Courier to Global Transport Network with fleet limits" },
    ],
  },
  {
    version: "1.0.454",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 8: Recording Studio Management" },
      { type: 'feature', description: "Recording studios can now be owned by companies as subsidiaries" },
      { type: 'feature', description: "Studio staff management - hire chief engineers, assistant engineers, producers, managers, techs" },
      { type: 'feature', description: "High-end gear inventory - microphones, preamps, compressors, EQs, reverbs, consoles" },
      { type: 'feature', description: "Studio upgrades - console, monitors, mics, preamps, outboard, live room, iso booths, mastering suite" },
      { type: 'feature', description: "Track albums recorded and hit songs produced for reputation building" },
      { type: 'improvement', description: "Studios now have console type, max tracks, isolation booths, and mastering capabilities" },
    ],
  },
  {
    version: "1.0.453",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 7: Rehearsal Room Management" },
      { type: 'feature', description: "Rehearsal rooms can now be owned by companies as subsidiaries" },
      { type: 'feature', description: "Studio staff management - hire managers, technicians, receptionists, security, maintenance" },
      { type: 'feature', description: "Rental equipment inventory - amps, drums, keyboards, PA systems, mics, recording gear" },
      { type: 'feature', description: "Studio upgrades system - soundproofing, equipment, recording gear, climate, lounge, storage, lighting" },
      { type: 'feature', description: "Financial transaction tracking for studio revenue and expenses" },
      { type: 'improvement', description: "Rehearsal rooms table extended with business metrics, reputation, and recording capabilities" },
    ],
  },
  {
    version: "1.0.452",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 6: Venue Management" },
      { type: 'feature', description: "Venues can now be owned by companies as subsidiaries" },
      { type: 'feature', description: "Venue staff management - hire managers, sound engineers, security, bartenders" },
      { type: 'feature', description: "Venue booking calendar for gigs, private events, rehearsals, recording sessions" },
      { type: 'feature', description: "Venue upgrades system - sound system, lighting, capacity, backstage, parking" },
      { type: 'feature', description: "Venue financial tracking with revenue/expense breakdown" },
      { type: 'improvement', description: "Venues table extended with business metrics and quality ratings" },
    ],
  },
  {
    version: "1.0.451",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 5: Record Label Integration" },
      { type: 'feature', description: "Labels can now be owned by companies as subsidiaries" },
      { type: 'feature', description: "Label financial transactions tracking with detailed breakdown" },
      { type: 'feature', description: "Label staff management - hire A&R scouts, marketers, producers, accountants" },
      { type: 'feature', description: "Distribution deals system with major distributors and revenue sharing" },
      { type: 'feature', description: "Operating budget, advance pool, and marketing budget tracking" },
      { type: 'improvement', description: "Labels table extended with business fields and company ownership" },
    ],
  },
  {
    version: "1.0.450",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 4: Merchandise Factories" },
      { type: 'feature', description: "Build factories with types: apparel, accessories, vinyl, CD, posters, mixed" },
      { type: 'feature', description: "Product catalog management with customizable pricing" },
      { type: 'feature', description: "Production queue system with status tracking and priority levels" },
      { type: 'feature', description: "Factory worker roster with roles: production, quality control, supervisor, maintenance" },
      { type: 'feature', description: "Quality control records and defect tracking" },
      { type: 'feature', description: "Factory contracts for bands and labels with discount tiers" },
    ],
  },
  {
    version: "1.0.449",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 3: Private Security Firms" },
      { type: 'feature', description: "Create security firm subsidiaries with license levels and equipment tiers" },
      { type: 'feature', description: "Hire and manage security guards with skill levels and salaries" },
      { type: 'feature', description: "Security contracts system for gigs, tours, and venues" },
      { type: 'feature', description: "Guard roster management with performance tracking" },
      { type: 'improvement', description: "Venues now have security requirements based on capacity" },
    ],
  },
  {
    version: "1.0.448",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 2: Holding companies and subsidiary management" },
      { type: 'feature', description: "Company Detail page with subsidiary tree visualization and financial overview" },
      { type: 'feature', description: "Transfer existing labels to company ownership via Transfer Label dialog" },
      { type: 'feature', description: "Company Settings dialog for dividend payouts and salary automation" },
      { type: 'feature', description: "Visual corporate hierarchy tree showing parent/child company relationships" },
      { type: 'improvement', description: "Added company_settings table with auto-creation trigger" },
    ],
  },
  {
    version: "1.0.447",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "VIP Company System Phase 1: Core company infrastructure for business empire management" },
      { type: 'feature', description: "VIP players can now create holding companies and manage subsidiaries" },
      { type: 'feature', description: "New My Companies page with financial dashboard and company cards" },
      { type: 'feature', description: "Company types: Holding, Record Label, Security Firm, Factory, Venue, Rehearsal Studio" },
      { type: 'feature', description: "VipGate component blocks non-VIP users with upgrade prompt" },
      { type: 'improvement', description: "Added Business section navigation link to My Companies" },
    ],
  },
  {
    version: "1.0.446",
    date: "2026-01-17",
    changes: [
      { type: 'improvement', description: "Pure 2D stage overhaul - removed problematic 3D equipment layer entirely" },
      { type: 'feature', description: "Added 2D instrument silhouettes (amps, drums, keyboard, mic stand) with role-colored glow effects" },
      { type: 'improvement', description: "Enhanced stage background with visible floor edge, cable hints, and drum rug" },
      { type: 'improvement', description: "Improved spotlight system with individual performer lights and haze effects" },
      { type: 'improvement', description: "Better avatar positioning - drummer elevated, front row spread wider" },
      { type: 'improvement', description: "Enhanced crowd with phone flashlights, raised hands, and depth layers" },
      { type: 'improvement', description: "Added stage monitors and floor details for realism" },
    ],
  },
  {
    version: "1.0.445",
    date: "2026-01-17",
    changes: [
      { type: 'improvement', description: "Full-body avatar display with taller 2:1 aspect ratio containers" },
      { type: 'improvement', description: "Role-based colored glow effects under each performer (vocalist=purple, guitarist=orange, bassist=blue, drummer=green, keyboardist=amber)" },
      { type: 'improvement', description: "3D equipment pushed further back and scaled down so it doesn't obstruct performers" },
      { type: 'improvement', description: "Camera angle adjusted higher for better stage perspective" },
      { type: 'improvement', description: "Removed front stage monitors that were blocking view" },
      { type: 'improvement', description: "Better performer spread - front members at edges, back members clearly visible" },
      { type: 'improvement', description: "Added subtle stage floor for grounding the 3D scene" },
    ],
  },
  {
    version: "1.0.444",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Audio now continues playing when Now Playing panel is minimized in gig viewer" },
      { type: 'improvement', description: "Full-body avatars on stage - increased avatar sizes (80-100% larger) for proper stage presence" },
      { type: 'improvement', description: "Removed emoji instrument overlays - 3D equipment now provides visual context" },
      { type: 'improvement', description: "Dramatically improved 3D stage lighting - brighter equipment, colored fills, rim lights, floor bounce" },
      { type: 'improvement', description: "Better stage layout - avatars spread wider, positioned higher, larger viewing area" },
    ],
  },
  {
    version: "1.0.443",
    date: "2026-01-17",
    changes: [
      { type: 'improvement', description: "Scaled up 3D stage equipment for better visibility - amps, drums, mic stands now larger and more prominent" },
      { type: 'fix', description: "Adjusted camera angle and z-index so 3D equipment layer is visible above background" },
    ],
  },
  {
    version: "1.0.442",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "Added procedural cable system with realistic sag, stage box, and snake cable running off-stage" },
      { type: 'improvement', description: "Cables automatically connect equipment to stage box based on which instruments are present" },
    ],
  },
  {
    version: "1.0.441",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "Added hybrid 2D/3D stage with procedural 3D equipment (amps, drums, keyboards, mic stands, monitors)" },
      { type: 'feature', description: "3D equipment animates based on song intensity and section (cymbal shimmer, amp vibration, LED pulses)" },
      { type: 'improvement', description: "Equipment automatically positioned based on which band members are present" },
    ],
  },
  {
    version: "1.0.440",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed RPM avatar 2D render URL generation with automatic fallback for failed loads" },
      { type: 'fix', description: "Fixed band member query to include members where is_touring_member is NULL (not just false)" },
      { type: 'improvement', description: "RPM avatars now use camera=fullbody parameter for better 2D renders on stage" },
    ],
  },
  {
    version: "1.0.439",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed gig viewer RPM avatar selection when player_avatar_config is returned as a one-to-one object (now handles both object/array shapes)" },
    ],
  },
  {
    version: "1.0.438",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed 3D avatars not displaying in gig viewer - now correctly fetches from player_avatar_config table" },
      { type: 'improvement', description: "Avatars created in Avatar Designer now properly appear on stage during gig performances" },
    ],
  },
  {
    version: "1.0.437",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Stage viewer now shows regular avatars when no 3D RPM avatar is available" },
      { type: 'feature', description: "Added minimize button to Now Playing panel in stage viewer" },
    ],
  },
  {
    version: "1.0.436",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Stage viewer now only shows RPM 3D avatars, not regular profile pictures" },
    ],
  },
  {
    version: "1.0.435",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "Added avatar status indicators to band roster (shows 3D avatar, basic avatar, or missing)" },
      { type: 'feature', description: "Added 'travels with band' setting for each band member" },
      { type: 'improvement', description: "Tour cost calculations now factor in number of traveling band members" },
      { type: 'feature', description: "Added Travel Party summary card showing who's traveling on tours" },
    ],
  },
  {
    version: "1.0.434",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed band member avatars by fetching profiles using user_id correctly" },
      { type: 'improvement', description: "Session/touring musicians no longer appear on stage - only real players with avatars" },
      { type: 'improvement', description: "Removed fallback silhouettes - stage only shows members who have uploaded avatars" },
    ],
  },
  {
    version: "1.0.433",
    date: "2026-01-17",
    changes: [
      { type: 'improvement', description: "Regular avatars now display as full images on stage instead of headshot+silhouette" },
    ],
  },
  {
    version: "1.0.432",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed band member avatars not loading - now fetches avatar_url in addition to rpm_avatar_url" },
      { type: 'improvement', description: "Regular profile avatars (headshots) now display with a silhouette body on stage" },
      { type: 'fix', description: "Fixed instrument role mapping for capitalized roles like 'Guitar', 'Drums', 'Vocals'" },
    ],
  },
  {
    version: "1.0.431",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed band avatars not showing in 3D Stage View - now displays fallback silhouettes when no avatar is set" },
      { type: 'feature', description: "Added dynamic stage themes based on venue type: club, arena, theater, outdoor festival, indoor night/day" },
      { type: 'improvement', description: "Stage backgrounds now reflect venue atmosphere with themed lighting, colors, and effects" },
      { type: 'improvement', description: "Outdoor festivals show sky with stars (night) or sun (day), arenas have moving head lights, clubs have laser effects" },
    ],
  },
  {
    version: "1.0.430",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "Gig review now plays crowd sounds (entrance, reactions, applause) synchronized with performances" },
      { type: 'feature', description: "Added 3D Stage View option when reviewing completed gigs - watch band perform with audio and visuals" },
      { type: 'improvement', description: "Unified audio controls for song playback and crowd sounds in both view modes" },
      { type: 'improvement', description: "Added play/pause and skip controls to 3D Stage View for better navigation" },
    ],
  },
  {
    version: "1.0.429",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "Underworld purchases now appear in Inventory with usable items and detail dialogs" },
      { type: 'feature', description: "Added item detail dialog to view effects and use consumables from inventory" },
      { type: 'improvement', description: "Renamed 'Underground' to 'Underworld' throughout the app" },
      { type: 'improvement', description: "Inventory Manager now has tabs for Underworld Items and Book Library" },
    ],
  },
  {
    version: "1.0.428",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed tour gigs not loading in schedule by disambiguating the gigs→venues join" },
    ],
  },
  {
    version: "1.0.426",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed tour gigs not showing on dashboard schedule - gigs now display with proper 4-hour duration" },
      { type: 'fix', description: "Fixed PerformanceBooking using wrong table name - activities now save to correct table" },
      { type: 'fix', description: "Fixed dashboard navigation buttons causing full page reloads - now uses client-side routing" },
    ],
  },
  {
    version: "1.0.425",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed Tour Manager tabs overlapping on mobile - now horizontally scrollable with shorter labels" },
    ],
  },
  {
    version: "1.0.424",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed city/country fame tracking - gigs now properly record fans and fame per city and country" },
      { type: 'fix', description: "Fixed 'Countries Visited' and 'Fans by Country' showing empty in Band Manager" },
      { type: 'fix', description: "Fixed fan demographics not being recorded after gig performances" },
      { type: 'improvement', description: "Today's News now shows location where fame/fans were gained" },
      { type: 'improvement', description: "Fame history now recorded for each gig with city/country context" },
    ],
  },
  {
    version: "1.0.423",
    date: "2026-01-17",
    changes: [
      { type: 'feature', description: "Reorganized Travel page with three tabs: Book Travel, My Travel Plans, and Past Travel" },
      { type: 'feature', description: "Added My Travel Plans tab showing upcoming manual bookings and tour travel with cancel functionality" },
      { type: 'feature', description: "Enhanced Past Travel tab with travel statistics (trips, cities, spending, time)" },
    ],
  },
  {
    version: "1.0.422",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed setlist song management duplicate key error by querying actual max position from database before inserting" },
    ],
  },
  {
    version: "1.0.421",
    date: "2026-01-17",
    changes: [
      { type: 'fix', description: "Fixed setlist creation error 'invalid input syntax for type integer' by ensuring position values are always integers" },
    ],
  },
  {
    version: "1.0.420",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Stage View Demo not displaying avatars - corrected RPM 2D render URL generation and added proper image error fallback handling" },
    ],
  },
  {
    version: "1.0.419",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Stage View Demo not showing on mobile - added collapsible controls panel and minimum height for stage preview" },
    ],
  },
  {
    version: "1.0.418",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Implemented Underworld Store with consumable products affecting player stats (health, energy, XP, fame, skills)" },
      { type: 'feature', description: "Added timed boost system for temporary stat multipliers" },
      { type: 'feature', description: "Added Underworld Products admin panel for CRUD operations" },
      { type: 'improvement', description: "Restored Underworld to navigation menu" },
      { type: 'fix', description: "Fixed Stage View Demo admin link and renamed from '3D Gig Demo'" },
    ],
  },
  {
    version: "1.0.417",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added admin Parallax Gig Demo page at /admin/parallax-gig-demo for testing the new stage viewer" },
      { type: 'improvement', description: "Enhanced session musician fallback avatars with human silhouettes and role labels" },
    ],
  },
  {
    version: "1.0.416",
    date: "2026-01-16",
    changes: [
      { type: 'improvement', description: "Replaced complex 3D gig viewer with lightweight 2D parallax stage using Ready Player Me avatar images" },
      { type: 'improvement', description: "Deleted 40+ unused 3D components (crowd, effects, camera, environments) - major codebase cleanup" },
      { type: 'feature', description: "New ParallaxGigViewer with CSS animations for band members playing instruments" },
      { type: 'feature', description: "RPM 2D Render API integration - displays player's actual avatars on stage" },
    ],
  },
  {
    version: "1.0.415",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed activity status indicator - now shows current activity based on time, not just 'in_progress' status" },
    ],
  },
  {
    version: "1.0.414",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added 15 automated cron jobs with correct authentication (gigs, travel, releases, PR, sponsorships, radio, video, prison)" },
      { type: 'fix', description: "Fixed all existing cron jobs that had placeholder API keys - now fully functional" },
    ],
  },
  {
    version: "1.0.413",
    date: "2026-01-16",
    changes: [
      { type: 'improvement', description: "Admin audit: OfferAutomation now shows real stats from database (offers generated, error rate, latency)" },
      { type: 'improvement', description: "Admin audit: AdvisorAdmin now calculates real average response time from chat messages" },
      { type: 'feature', description: "Identified 14 missing cron jobs for game automation (gigs, travel, releases, PR, radio, video, prison)" },
    ],
  },
  {
    version: "1.0.412",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed flight booking failing when travel duration is fractional (e.g. 3.9h)" },
    ],
  },
  {
    version: "1.0.411",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed flight booking - improved error handling and scheduling conflict checks" },
      { type: 'fix', description: "Fixed profile fetch errors in travel system using maybeSingle()" },
    ],
  },
  {
    version: "1.0.410",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Self-Promotion now correctly uses player's personal cash balance" },
      { type: 'fix', description: "Self-PR deducts from player wallet instead of band balance" },
    ],
  },
  {
    version: "1.0.409",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Tour Manager 'New Tour' button - auto-selects starting city" },
      { type: 'fix', description: "Fixed flight booking error on Travel page" },
      { type: 'feature', description: "Added equipment stock levels based on rarity (legendary=3, epic=10, rare=20)" },
      { type: 'feature', description: "Stock decreases when equipment is purchased" },
      { type: 'feature', description: "Added brand/make filter to Gear shop" },
      { type: 'feature', description: "Added 12 new self-promotion activities (TikTok, Discord, Patreon, etc.)" },
      { type: 'feature', description: "Added 25+ new music websites (Billboard, XXL, Metal Hammer, etc.)" },
      { type: 'feature', description: "Added 75+ new gear items (guitars, basses, drums, keyboards, mics, amps, effects, stage gear)" },
      { type: 'feature', description: "Added low stock and out-of-stock indicators on gear cards" },
      { type: 'feature', description: "Added 'Sold Out' button state for out-of-stock items" },
    ],
  },
  {
    version: "1.0.408",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added dedicated Self-Promotion page (/media/self-promotion) with full activity browser" },
      { type: 'feature', description: "Added dedicated Websites page (/media/websites) for music publication submissions" },
      { type: 'feature', description: "Added website submission system with pitch messages and tracking" },
      { type: 'improvement', description: "Navigation now links directly to new pages in Media section" },
    ],
  },
  {
    version: "1.0.407",
    date: "2026-01-16",
    changes: [
      { type: 'improvement', description: "Moved Websites navigation link to Media section" },
    ],
  },
  {
    version: "1.0.406",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Gettit upvoting/downvoting - added missing RPC functions for vote management" },
      { type: 'feature', description: "Added full Gettit comments system with voting and real-time updates" },
      { type: 'feature', description: "Music Videos: Added manual 'Release to PooTube' button when production is complete" },
      { type: 'feature', description: "Music Videos: Added TV Show placement feature (MTV, VH1, BET, etc.) for view/hype boosts" },
      { type: 'feature', description: "Music Videos: Added Promote feature with social ads, influencer campaigns, billboards" },
      { type: 'feature', description: "Music Videos: Added detailed analytics dialog with ROI, CPM, and performance metrics" },
      { type: 'feature', description: "Music Videos: Song preview playback on released video cards" },
    ],
  },
  {
    version: "1.0.405",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Gettit forum posting error - corrected RLS policy to use profile.id instead of auth.uid()" },
      { type: 'feature', description: "Added Self-PR and Websites direct navigation links in Business section" },
      { type: 'feature', description: "Added Record Deal Types explanation section on Record Labels page" },
      { type: 'fix', description: "Fixed VIP status checking - now uses vip_subscriptions table consistently" },
    ],
  },
  {
    version: "1.0.404",
    date: "2026-01-16",
    changes: [
      { type: 'improvement', description: "Updated How to Play guide with Gettit forum, DikCok videos, and recent features" },
      { type: 'improvement', description: "Completed Spanish translations for all game features" },
      { type: 'improvement', description: "Completed Turkish translations for all game features" },
      { type: 'feature', description: "Added Gettit translation keys for Spanish and Turkish" },
    ],
  },
  {
    version: "1.0.403",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Gettit forum system - Reddit-style player community with subreddits, posts, upvotes/downvotes" },
      { type: 'feature', description: "8 default communities: Rockmundo, Bands, Gig Stories, Songwriting, Newbies, Memes, Trading, Festivals" },
      { type: 'improvement', description: "Community Feed renamed to Gettit with full forum functionality" },
    ],
  },
  {
    version: "1.0.402",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed rehearsal booking error - resolved Supabase join query issue in band member details lookup" },
    ],
  },
  {
    version: "1.0.401",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed 8 sports entrance song events now properly added to database with correct schema" },
    ],
  },
  {
    version: "1.0.400",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "8 new sports entrance song random events - boxers, wrestlers, darts players, MMA fighters, esports teams, NASCAR drivers, Olympic athletes, football clubs" },
      { type: 'feature', description: "25+ global podcasts added - UK, Germany, Japan, Australia, Brazil, France, Sweden, South Korea, Canada, Spain, Mexico, South Africa" },
      { type: 'feature', description: "Random events now trigger automatically via cron jobs (every 4 hours)" },
      { type: 'feature', description: "Event outcomes processed daily with fame/fan/cash rewards" },
      { type: 'improvement', description: "Sports licensing events offer $500-$20,000+ with fame and fan bonuses" },
    ],
  },
  {
    version: "1.0.399",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Self-Promotion (DIY) tab - database tables now created with 8 activity types" },
      { type: 'fix', description: "Fixed Podcast Browser filters - podcasts now have proper country assignments" },
      { type: 'feature', description: "Added Websites as PR media type - 15 music sites (Pitchfork, NME, Rolling Stone, etc.)" },
      { type: 'feature', description: "Added process-self-promotion edge function to complete DIY activities" },
      { type: 'feature', description: "Added band_media_cooldowns table for PR outlet cooldown tracking" },
      { type: 'improvement', description: "PROffersList now supports website offers with proper icon" },
    ],
  },
  {
    version: "1.0.398",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Twaater bot posting frequency increased - 20+ posts daily guaranteed" },
      { type: 'feature', description: "Fame-based organic followers - bots follow you based on your fame/fans" },
      { type: 'feature', description: "Fame scores now sync from profiles to Twaater accounts automatically" },
      { type: 'feature', description: "Increased bot engagement - higher like/reply/follow rates" },
      { type: 'feature', description: "New sync-twaater-fame and calculate-organic-followers edge functions" },
      { type: 'improvement', description: "Bot posting templates expanded with more variety" },
      { type: 'improvement', description: "Empty feed detection forces bot posts when needed" },
    ],
  },
  {
    version: "1.0.397",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "New Self-Promotion (DIY) tab - Reddit AMA, Twitch listening parties, Instagram Live, and more" },
      { type: 'feature', description: "Websites added as new PR media type (Pitchfork, BuzzFeed, music blogs)" },
      { type: 'feature', description: "Media outlet cooldowns - can't appear on same show/outlet too frequently" },
      { type: 'feature', description: "Radio shows now have individual offers with compensation ranges" },
      { type: 'feature', description: "More low-fame PR options for emerging artists" },
      { type: 'improvement', description: "PR page now has 5 tabs: Offers, DIY, History, Film, Agent" },
    ],
  },
  {
    version: "1.0.396",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Band Rankings 404 error - route now matches navigation" },
      { type: 'fix', description: "Tour gigs now show in schedule (added 'confirmed' status)" },
      { type: 'feature', description: "Gig location warning when you're in wrong city within 6 hours of show" },
      { type: 'feature', description: "VIP charter flight option ($40k) - arrives 1 hour before show" },
      { type: 'feature', description: "Today's News shows your XP gains and skill improvements" },
      { type: 'feature', description: "Today's News shows band fame and fan gains" },
      { type: 'feature', description: "Today's News shows other bands' gig outcomes" },
    ],
  },
  {
    version: "1.0.395",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added Band Rankings link to main navigation menu under Band section" },
    ],
  },
  {
    version: "1.0.394",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Relationships page now uses tabbed layout (Friends, Pending, Find Friends)" },
      { type: 'feature', description: "Tour Manager reorganized with 5 tabs: Current Tour, Upcoming, Historic, Getting Started, Other Bands" },
      { type: 'feature', description: "Other Bands Tours now has fame and genre filters with pagination (10 per page)" },
      { type: 'feature', description: "New Band Rankings page - view all bands ranked by fame/fans with country/city/genre filters" },
      { type: 'feature', description: "Bands can now set home city for regional rankings (one-time setting)" },
      { type: 'improvement', description: "Inline friend search on Relationships page instead of dialog" },
    ],
  },
  {
    version: "1.0.393",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Band members now clickable - view skills, fame, schedule, and send friend requests" },
      { type: 'fix', description: "Dashboard friends section now shows correct profiles with fame and level" },
      { type: 'improvement', description: "Relationships page simplified - removed non-functional status/permissions cards" },
      { type: 'improvement', description: "Friends list now shows actual fame and level instead of 'Fame TBD'" },
      { type: 'feature', description: "Added 'View All' link from Dashboard friends to Relationships page" },
    ],
  },
  {
    version: "1.0.392",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Travel booking now supports scheduled departures - pick your date and time slot" },
      { type: 'feature', description: "Flights run 5 times daily (6am, 10am, 2pm, 6pm, 10pm)" },
      { type: 'feature', description: "Trains, buses, and ferries run hourly from 6am to 10pm" },
      { type: 'feature', description: "Departure time picker with date selection (up to 14 days ahead)" },
      { type: 'feature', description: "Journey summary shows departure and arrival times" },
      { type: 'improvement', description: "Next Available quick-select button for fastest departure" },
    ],
  },
  {
    version: "1.0.391",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Activities now display across all hours they span (multi-hour support)" },
      { type: 'feature', description: "Visual indicators (Starts/Continues/Ends) for multi-hour activities" },
      { type: 'fix', description: "Band gigs now block ALL band members' schedules, not just leader" },
      { type: 'fix', description: "University auto-attend now creates schedule entries for blocking" },
      { type: 'improvement', description: "Enhanced auto-attend toggle with green (ON) / red (OFF) visual states" },
      { type: 'feature', description: "Timezone support - gig times display in venue's local time" },
    ],
  },
  {
    version: "1.0.390",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Tour Manager now uses the new 9-step wizard instead of old 4-step version" },
    ],
  },
  {
    version: "1.0.389",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Complete 9-step tour wizard with full booking integration" },
      { type: 'feature', description: "Tour gigs now automatically scheduled for all band members" },
      { type: 'feature', description: "Support artist schedule blocking - avoids conflicts for both bands" },
      { type: 'improvement', description: "Enhanced venue matching with capacity and genre filters" },
      { type: 'improvement', description: "Improved cost estimation with real-time budget preview" },
    ],
  },
  {
    version: "1.0.388",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Enhanced tour wizard with starting city selection" },
      { type: 'feature', description: "Advanced venue filters - country, city, and genre preferences" },
      { type: 'feature', description: "Custom ticket pricing with sales impact preview" },
      { type: 'feature', description: "Stage setup tiers (Basic to Spectacular) with merch/fame boosts" },
      { type: 'feature', description: "Support artist invitations with automatic revenue splitting" },
      { type: 'feature', description: "Tour budget summary with detailed expense/revenue breakdown" },
      { type: 'feature', description: "Tour merch boost (+30%) for all tour shows" },
      { type: 'improvement', description: "Tour bus daily cost now static at $150/day" },
    ],
  },
  {
    version: "1.0.386",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Split lyrics and song notes into separate sections in songwriting" },
      { type: 'feature', description: "Structured lyrics editor with verse/chorus/bridge tabs and add/remove/reorder sections" },
      { type: 'feature', description: "Auto-populated song notes from genre, theme, mood, collaborators, and creative choices" },
      { type: 'feature', description: "Session luck system - 5% chance of 'Lightning Strike' (+20-30%) or 'Terrible Day' (-15-20%)" },
      { type: 'improvement', description: "Increased skill impact on song quality - tier-based scaling with higher caps" },
      { type: 'improvement', description: "AI lyrics penalty increased from 10% to 15% to encourage original writing" },
      { type: 'improvement', description: "Song quality breakdown now shows session luck factor with percentage" },
      { type: 'improvement', description: "Quality variance creates meaningful differences between songs written same day" },
    ],
  },
  {
    version: "1.0.385",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Skill hierarchy cleanup - removed legacy skills (guitar, bass, drums, etc.) in favor of new hierarchy system" },
      { type: 'feature', description: "Attribute-based learning speed - player attributes now affect skill XP gains (up to 50% bonus)" },
      { type: 'feature', description: "Added 'Skills Not Unlocked' section to SkillTree showing skills available to learn" },
      { type: 'feature', description: "Mentor seasonal availability - some mentors only available in specific seasons" },
      { type: 'feature', description: "Mentor capacity limits - mentors can now have max student caps" },
      { type: 'improvement', description: "University and book learning now apply attribute-based XP multipliers" },
      { type: 'improvement', description: "Improved skill tier detection for proper hierarchy display" },
    ],
  },
  {
    version: "1.0.384",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Job vacancy system - all jobs now have limited positions (2-10 depending on job type)" },
      { type: 'feature', description: "Atomic hiring with race condition prevention - no more 100 people getting the same job" },
      { type: 'feature', description: "Added hire_player and quit_job database functions for safe employment operations" },
      { type: 'improvement', description: "Employee counts now automatically sync when hiring/quitting" },
      { type: 'fix', description: "Fixed potential race condition where multiple players could fill the last job slot" },
    ],
  },
  {
    version: "1.0.383",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added 14 new job types per city - low-prestige jobs (Cleaner, Dishwasher, Garbage Collector, etc.) and music industry jobs (Session Musician, Roadie, etc.)" },
      { type: 'feature', description: "Dynamic fame impact - famous artists lose MORE fame working low-prestige jobs (up to 5x multiplier for major stars)" },
      { type: 'feature', description: "Band leaders receive extra fame penalty for menial work" },
      { type: 'feature', description: "Work shifts now appear on dashboard schedule and block other activities" },
      { type: 'feature', description: "Music industry jobs (Session Musician, Venue Sound Tech, Radio Station Intern) boost fame" },
      { type: 'improvement', description: "Auto-clock-in now checks for scheduled activity conflicts before starting shift" },
      { type: 'improvement', description: "Jobs properly impact health, energy, and fame with different severity tiers" },
    ],
  },
  {
    version: "1.0.382",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Blocked past-time booking - slots that have already passed are now greyed out with 'Passed' badge" },
      { type: 'feature', description: "Recording & rehearsal sessions now block ALL band members on their schedules, not just the booker" },
      { type: 'improvement', description: "Band activities now visible on every band member's scheduler dashboard" },
      { type: 'fix', description: "Added server-side validation to prevent booking activities in the past" },
      { type: 'feature', description: "Added band availability checking - shows conflicts with specific band member names" },
    ],
  },
  {
    version: "1.0.381",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed songwriting page freeze that prevented navigation - removed infinite loop in refreshActivityStatus useEffect" },
    ],
  },
  {
    version: "1.0.380",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed performance items FK to reference performance_items_catalog (resolves setlist add error)" },
      { type: 'feature', description: "Added crowd sounds system with admin interface for managing gig audio effects" },
      { type: 'feature', description: "Performance items now processed in gig outcomes with dedicated commentary" },
      { type: 'improvement', description: "Gig review now plays songs for their actual duration (capped at 5 min)" },
      { type: 'feature', description: "Added new commentary types for performance items, band entrance/exit, and more" },
      { type: 'fix', description: "Fixed DOM nesting error in RehearsalWarningDialog (div inside p tag)" },
    ],
  },
  {
    version: "1.0.379",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added remove button to repertoire song cards with confirmation dialog" },
    ],
  },
  {
    version: "1.0.378",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Increased maximum setlists per band from 3 to 5" },
      { type: 'fix', description: "Fixed performance items causing errors when added to setlists (song_id now explicitly null)" },
      { type: 'fix', description: "Fixed full setlist rehearsals - now updates familiarity for all songs in the setlist" },
      { type: 'fix', description: "Fixed tour booking setting ticket_price to 0 - now calculates proper prices based on venue/fame" },
      { type: 'fix', description: "Fixed ticket sales mismatch - gig outcomes now use actual tickets_sold when available" },
      { type: 'feature', description: "Gigs now create scheduled activities that appear on your calendar" },
      { type: 'feature', description: "Added linked_gig_id to player_scheduled_activities for gig tracking" },
      { type: 'feature', description: "Added failure_reason column to gigs table for tracking failed performances" },
    ],
  },
  {
    version: "1.0.377",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Jam sessions now require being in the same city as the session location" },
      { type: 'feature', description: "Jam sessions now create scheduled activities that appear in your schedule" },
      { type: 'feature', description: "Players can only participate in one jam session at a time" },
      { type: 'feature', description: "Activity blocking prevents joining jam sessions during other scheduled activities" },
      { type: 'improvement', description: "Leaving a jam session now cancels the scheduled activity" },
    ],
  },
  {
    version: "1.0.376",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed jam session booking dialog layout - now properly scrolls to show all fields including rehearsal room and time slots" },
    ],
  },
  {
    version: "1.0.375",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed jam session booking showing no rehearsal rooms - removed filter on non-existent 'is_available' column" },
    ],
  },
  {
    version: "1.0.374",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed complete-jam-session edge function - replaced .catch() with proper error handling" },
    ],
  },
  {
    version: "1.0.373",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed complete-jam-session edge function - column was 'jam_session_id' not 'session_id'" },
    ],
  },
  {
    version: "1.0.372",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed 'Could not find function public.join_jam_session' error - now uses direct DB insert" },
      { type: 'fix', description: "Jam Sessions page now uses enhanced component with booking/scheduling features" },
      { type: 'feature', description: "Jam sessions show scheduled start time, duration, and cost per participant" },
      { type: 'improvement', description: "Join session now properly deducts cost and adds to participants table" },
    ],
  },
  {
    version: "1.0.371",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed duplicate songs appearing in charts - now queries only base chart types when 'All' category selected" },
      { type: 'fix', description: "Fixed album charts always empty - added partial unique index and enabled album chart entry insertion" },
      { type: 'fix', description: "Fixed playlist submissions - now connects to real playlists table and inserts into playlist_submissions" },
      { type: 'fix', description: "Playlists now deduct submission cost and record submissions properly" },
      { type: 'improvement', description: "Seeded playlists and manufacturing costs tables with initial data" },
      { type: 'improvement', description: "PlaylistsTab now shows streaming releases for submission instead of raw songs" },
    ],
  },
  {
    version: "1.0.370",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added peer-to-peer voice chat for jam sessions using PeerJS WebRTC" },
      { type: 'feature', description: "Voice chat uses Supabase Realtime for peer discovery (no external accounts needed)" },
      { type: 'feature', description: "Mute/unmute controls with real-time status sync to other participants" },
      { type: 'feature', description: "Speaking detection with audio level indicators for visual feedback" },
      { type: 'feature', description: "Voice participant list shows who's in voice, muted status, and speaking activity" },
      { type: 'improvement', description: "Voice chat is completely free with no usage limits (peer-to-peer)" },
    ],
  },
  {
    version: "1.0.369",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Major Jam Sessions overhaul - now requires booking a rehearsal room with venue, date, and time" },
      { type: 'feature', description: "Jam session cost splitting - creator pays upfront, cost is shared as participants join" },
      { type: 'feature', description: "Dedicated real-time chat for each jam session with presence indicators" },
      { type: 'feature', description: "Live commentary feed during active jam sessions with dynamic events" },
      { type: 'feature', description: "Comprehensive Jam Outcome Report dialog showing detailed results for all participants" },
      { type: 'feature', description: "Early leave penalty system - reduced rewards based on time remaining when leaving" },
      { type: 'feature', description: "New JamSessionBookingDialog with city/room/slot selection similar to rehearsal booking" },
      { type: 'feature', description: "generate-jam-commentary edge function for live session commentary" },
      { type: 'improvement', description: "Jam sessions now integrate with rehearsal rooms and scheduled activities" },
    ],
  },
  {
    version: "1.0.368",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Complete Jam Sessions reward system with dynamic XP calculation" },
      { type: 'feature', description: "Jam sessions now award XP to hierarchical skill tree (instruments_basic_guitar, etc.)" },
      { type: 'feature', description: "Small chance (0.75-2.5%) to receive a 'gifted song' demo from jam sessions" },
      { type: 'feature', description: "Weekly gifted song limit (1 per participant per week)" },
      { type: 'feature', description: "New jam_session_outcomes table tracks detailed per-participant rewards" },
      { type: 'feature', description: "JamSessionResultsDialog shows XP, skill gains, synergy, mood, and gifted songs" },
      { type: 'feature', description: "InstrumentSelector component for choosing instruments when joining sessions" },
      { type: 'improvement', description: "Session duration, synergy, and mood now affect XP rewards" },
    ],
  },
  {
    version: "1.0.367",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed My Submissions showing 'Unknown Song/Station' - now handles both data formats" },
      { type: 'improvement', description: "CompactSubmissions now works with useRadioStations hook data structure" },
    ],
  },
  {
    version: "1.0.366",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added Batch Submit button to Radio Browser Stations tab with wizard" },
      { type: 'feature', description: "Added My Airplay Stats and Songs in Rotation to Airplay Stats tab" },
      { type: 'improvement', description: "Replaced My Submissions with compact filterable view" },
      { type: 'fix', description: "Fixed missing features on /media/radio page (RadioBrowser)" },
    ],
  },
  {
    version: "1.0.365",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed analytics tab hiding Songs in Rotation behind station selection" },
      { type: 'feature', description: "Added My Airplay Stats card to analytics showing total plays, listeners, hype earned, and top song" },
      { type: 'improvement', description: "Songs in Rotation and My Airplay Stats now always visible in analytics tab" },
    ],
  },
  {
    version: "1.0.364",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Radio station invitations system - stations can now invite bands for interviews and live sessions" },
      { type: 'feature', description: "New Invitations tab in Radio page with accept/decline/complete workflow" },
      { type: 'feature', description: "Invitations reward fame, fans, and XP based on station size and invitation type" },
      { type: 'feature', description: "Edge function to automatically generate invitations based on band fame and genre" },
    ],
  },
  {
    version: "1.0.363",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Compact submissions view with status/station/search filters" },
      { type: 'feature', description: "Songs in Rotation section showing total plays, weekly plays with clickable details" },
      { type: 'feature', description: "Song airplay breakdown by station, country, and city" },
      { type: 'improvement', description: "Batch submit only shows genre-matching stations" },
    ],
  },
  {
    version: "1.0.362",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added 130+ local radio stations for major cities worldwide" },
      { type: 'feature', description: "Added 5 time-slot shows per station (Morning Drive, Midday, Afternoon Drive, Evening, Late Night)" },
      { type: 'feature', description: "Radio submissions now check country-specific fame requirements" },
      { type: 'feature', description: "Gigs and radio plays now build regional fame in band_country_fans table" },
      { type: 'feature', description: "Added city filter to radio station browser" },
      { type: 'fix', description: "Fixed UK/United Kingdom country name inconsistency" },
      { type: 'improvement', description: "Submit dialog shows country fame requirement and lock status" },
      { type: 'improvement', description: "National stations require fame based on quality level (100-5000)" },
      { type: 'improvement', description: "Local stations accept region-specific genres (Latin in South America, K-Pop in Asia, etc.)" },
    ]
  },
  {
    version: "1.0.361",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed songs showing 0 streams/$0 - now aggregates from song_releases table" },
      { type: 'fix', description: "Fixed recordings tab blank - now queries recording_sessions by band_id directly" },
      { type: 'fix', description: "Fixed radio plays using wrong column (listener_count→listeners)" },
      { type: 'fix', description: "Fixed gigs using wrong columns (gig_date→scheduled_date, actual_earnings→payment)" },
      { type: 'feature', description: "Song detail dialog now shows streams and revenue from song_releases" },
      { type: 'improvement', description: "Radio plays now show hype gained from airplay" },
      { type: 'improvement', description: "Gigs now show tickets sold alongside attendance" },
    ]
  },
  {
    version: "1.0.360",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Moved Repertoire to Band Manager as a dedicated tab" },
      { type: 'feature', description: "Added band logo display next to band name in header" },
      { type: 'feature', description: "Merged Profile editing into Overview section (collapsible for leaders)" },
      { type: 'feature', description: "Added click-through song details on Songs tab" },
      { type: 'feature', description: "Added remove from repertoire functionality" },
      { type: 'fix', description: "Fixed repertoire data population with ownership backfill utility" },
    ]
  },
  {
    version: "1.0.359",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Added dedicated Band Repertoire page with tabs for Songs, Recordings, Streaming, Radio, and Gigs" },
      { type: 'feature', description: "Implemented song ownership tracking with band_song_ownership table" },
      { type: 'feature', description: "Added ownership rules: former members retain 30% royalty share, restored on rejoin" },
      { type: 'feature', description: "Added AddToRepertoireDialog for adding songs to band catalog from songwriting" },
      { type: 'feature', description: "Created royalty distribution utilities in bandRoyalties.ts" },
    ]
  },
  {
    version: "1.0.358",
    date: "2026-01-16",
    changes: [
      { type: 'fix', description: "Fixed Tour Manager 'Create Tour' button not opening the tour wizard" },
      { type: 'fix', description: "Fixed Songwriting page crash caused by infinite render loop in rehearsal unlocks" },
      { type: 'fix', description: "Fixed 406 error when checking player activity status (used maybeSingle)" },
    ]
  },
  {
    version: "1.0.357",
    date: "2026-01-16",
    changes: [
      { type: 'feature', description: "Acoustic and remix recordings now create separate song entries" },
      { type: 'feature', description: "Each song version has its own quality, audio, and play statistics" },
      { type: 'feature', description: "Version songs can be independently added to setlists" },
      { type: 'feature', description: "Added version filter in setlist manager for building acoustic/remix setlists" },
      { type: 'improvement', description: "Song cards and setlist items now display version badges (🎸 Acoustic, 🎧 Remix)" },
    ]
  },
  {
    version: "1.0.356",
    date: "2026-01-15",
    changes: [
      { type: 'feature', description: "Band fame/fan gains now sync to player characters (configurable 85-100% share)" },
      { type: 'feature', description: "Added admin-configurable band daily fame/fans growth rates (Admin > Bands > Growth tab)" },
      { type: 'improvement', description: "Increased default daily band growth from 1-5 to 5-15 fame and 5-20 fans" },
      { type: 'improvement', description: "Fame-to-fans conversion rate increased from 0.1% to 0.5% daily" },
    ]
  },
  {
    version: "1.0.355",
    date: "2026-01-14",
    changes: [
      { type: 'feature', description: "Added 27 new recording producers covering all skill tree genres" },
      { type: 'fix', description: "Updated existing producers to use valid skill tree genres (Alternative→Rock, Metal→Heavy Metal, etc.)" },
      { type: 'improvement', description: "Producer genre filter now uses full skill tree genre list (28 genres)" },
    ]
  },
  {
    version: "1.0.354",
    date: "2026-01-14",
    changes: [
      { type: 'feature', description: "Added manual audio upload for radio jingles/adverts (when AI generation fails)" },
      { type: 'fix', description: "Fixed Add Physical Format and Reorder Stock database errors (was using wrong user_id for RLS)" },
      { type: 'improvement', description: "Better error logging for radio content generation" },
      { type: 'fix', description: "Upload button now shows for failed items too, not just pending" },
    ]
  },
  {
    version: "1.0.353",
    date: "2026-01-13",
    changes: [
      { type: 'fix', description: "Fixed charts not showing physical sales - disambiguated release_songs FK relationship" },
      { type: 'fix', description: "Added cassette_sales to chart generation (was missing)" },
      { type: 'fix', description: "Fixed ReorderStockDialog manufacturing cost calculation with fallback costs" },
      { type: 'fix', description: "Improved error reporting in Release Manager dialogs (shows full Supabase error details)" },
      { type: 'improvement', description: "Better logging in update-music-charts for debugging" },
    ]
  },
  {
    version: "1.0.352",
    date: "2026-01-12",
    changes: [
      { type: 'feature', description: "Added AI jingles and joke fake adverts to RM Radio" },
      { type: 'feature', description: "Radio now plays station breaks and sponsor messages between songs" },
      { type: 'feature', description: "New admin panel for managing radio content (Radio Content Manager)" },
      { type: 'feature', description: "Pre-loaded 15+ humorous fake adverts and jingles" },
    ]
  },
  {
    version: "1.0.351",
    date: "2026-01-11",
    changes: [
      { type: 'fix', description: "Fixed Restock/Reorder Stock button - now opens dialog to order additional physical units" },
      { type: 'fix', description: "Fixed Add Physical Release dialog with fallback costs and better error handling" },
      { type: 'feature', description: "Added ReorderStockDialog component for restocking sold-out or low-stock physical formats" },
    ]
  },
  {
    version: "1.0.350",
    date: "2026-01-11",
    changes: [
      { type: 'fix', description: "Fixed AI song generation failing due to lyrics exceeding MiniMax 600-char limit" },
      { type: 'fix', description: "Lyrics now properly truncated to 580 chars with verse+chorus priority" },
      { type: 'fix', description: "Removed chord annotations (Am-F-C-G) and dialog markers (She/He) from lyrics" },
    ]
  },
  {
    version: "1.0.349",
    date: "2026-01-10",
    changes: [
      { type: 'fix', description: "Fixed duplicate songs appearing in charts by filtering to latest chart date" },
      { type: 'fix', description: "Added deduplication to prevent same song showing multiple times" },
      { type: 'improvement', description: "Added database constraints to prevent duplicate chart entries" },
      { type: 'improvement', description: "Added album chart support with release_id tracking" },
    ]
  },
  {
    version: "1.0.348",
    date: "2026-01-10",
    changes: [
      { type: 'fix', description: "Fixed AI song generation prompt corruption (Style:/Lyrics: prefix stacking)" },
      { type: 'fix', description: "Added input sanitization to prevent malformed prompts from corrupted lyrics" },
      { type: 'fix', description: "Added race condition guard to prevent duplicate generation attempts" },
      { type: 'fix', description: "Fixed placeholder lyrics being appended to real lyrics" },
    ]
  },
  {
    version: "1.0.347",
    date: "2026-01-09",
    changes: [
      { type: 'feature', description: "RM Radio now continues playing when popup is closed" },
      { type: 'improvement', description: "Moved RM Radio button to top banner next to VIP badge" },
      { type: 'improvement', description: "Attribute training now costs 50 XP (was 10)" },
      { type: 'improvement', description: "Skill training now costs 10 × current level XP (min 10)" },
      { type: 'fix', description: "Fixed songwriting not progressing - DB function was reading non-existent columns" },
    ]
  },
  {
    version: "1.0.346",
    date: "2026-01-08",
    changes: [
      { type: 'feature', description: "Added RM Radio - popup player that plays all AI-generated songs in random loop order" },
      { type: 'feature', description: "RM Radio shows Now Playing with song title, band name, and genre" },
      { type: 'feature', description: "RM Radio includes shuffle, skip, play/pause, and volume controls" },
    ]
  },
  {
    version: "1.0.345",
    date: "2026-01-08",
    changes: [
      { type: 'feature', description: "Auto-generate unique AI lyrics when songs have no lyrics during audio generation" },
      { type: 'improvement', description: "Generated lyrics are saved to song and project records for future use" },
      { type: 'fix', description: "Eliminated duplicate/generic placeholder lyrics - every song now gets unique lyrics" },
    ]
  },
  {
    version: "1.0.344",
    date: "2026-01-07",
    changes: [
      { type: 'fix', description: "Fixed Admin XP Rewards failing for other players (ledger insert no longer blocks wallet award; user_id resolved in bulk)" },
    ]
  },
  {
    version: "1.0.343",
    date: "2026-01-07",
    changes: [
      { type: 'fix', description: "Fixed update-daily-streams float-to-integer bug causing streaming analytics inserts to fail" },
      { type: 'fix', description: "Fixed Admin XP Reward showing 0 players updated (wallet upsert logic improved)" },
      { type: 'fix', description: "Fixed songs always having quality score of 1 (now calculated from skills/attributes: 30-100 range)" },
      { type: 'fix', description: "Fixed AI song generation not using lyrics from songs table (now checks song.lyrics first)" },
    ]
  },
  {
    version: "1.0.342",
    date: "2026-01-06",
    changes: [
      { type: 'fix', description: "Fixed songwriting trigger using wrong column name (recording_project_id → songwriting_project_id)" },
      { type: 'fix', description: "Fixed songwriting trigger missing user_id causing song creation to fail" },
      { type: 'fix', description: "Charts now include ALL released songs, not just player band songs" },
      { type: 'fix', description: "Charts generation now collects all entries before delete/insert (more robust)" },
      { type: 'fix', description: "Added missing cron jobs for auto-distribute-streaming, update-daily-streams, update-music-charts" },
      { type: 'fix', description: "Fixed Band Finder nav label showing translation key instead of 'Band Finder'" },
      { type: 'improvement', description: "Added better logging to update-music-charts for debugging" },
    ]
  },
  {
    version: "1.0.341",
    date: "2026-01-05",
    changes: [
      { type: 'feature', description: "Restructured Gig page with Book, Upcoming Gigs, and Gig History tabs" },
      { type: 'feature', description: "Added venue filters by country and size (defaults to player's country)" },
      { type: 'fix', description: "Added double-booking prevention - can't book same band at same date/time slot" },
      { type: 'improvement', description: "Enhanced ticket sales display in Upcoming Gigs tab" },
      { type: 'improvement', description: "Venue cards now show city and country information" },
    ]
  },
  {
    version: "1.0.340",
    date: "2026-01-04",
    changes: [
      { type: 'fix', description: "Fixed Band Finder query by specifying explicit FK relationship for band_members" },
    ]
  },
  {
    version: "1.0.339",
    date: "2026-01-04",
    changes: [
      { type: 'fix', description: "Charts now show songs from all bands (added public RLS policy for released songs)" },
      { type: 'fix', description: "Charts show proper empty state message for physical formats with no sales" },
      { type: 'fix', description: "Mental Focus attribute no longer incorrectly capped at 100 (now uses 1000 max)" },
      { type: 'fix', description: "Physical Endurance attribute no longer incorrectly capped at 100 (now uses 1000 max)" },
      { type: 'feature', description: "Added Band Finder page under Band Chemistry to search and view any band" },
    ]
  },
  {
    version: "1.0.338",
    date: "2026-01-03",
    changes: [
      { type: 'fix', description: "Fixed Country Charts query by removing invalid profiles join (schema cache PGRST200)" },
    ]
  },
  {
    version: "1.0.337",
    date: "2026-01-03",
    changes: [
      { type: 'fix', description: "Normalized gear effects in GigOutcomeReport to prevent undefined breakdown crashes" },
    ]
  },
  {
    version: "1.0.336",
    date: "2026-01-03",
    changes: [
      { type: 'fix', description: "Fixed GigOutcomeReport crash when gear breakdown array is missing" },
    ]
  },
  {
    version: "1.0.335",
    date: "2026-01-03",
    changes: [
      { type: 'fix', description: "Fixed GigOutcomeReport crash when gear_effects.breakdown is undefined" },
    ]
  },
  {
    version: "1.0.334",
    date: "2026-01-03",
    changes: [
      { type: 'fix', description: "Fixed complete-gig edge function using wrong column names for fan conversion" },
    ]
  },
  {
    version: "1.0.333",
    date: "2026-01-03",
    changes: [
      { type: 'fix', description: "Fixed charts showing blank - country filter now correctly handles 'all' vs 'Global'" },
      { type: 'feature', description: "Added Gig Review mode - watch completed gigs with live commentary" },
      { type: 'feature', description: "VIP players can hear song audio during gig review playback" },
      { type: 'feature', description: "Gig History now has 'Review Gig' and 'Full Report' options" },
      { type: 'improvement', description: "Enhanced gig metrics with song-by-song playback and progress tracking" },
    ]
  },
  {
    version: "1.0.332",
    date: "2026-01-02",
    changes: [
      { type: 'fix', description: "Fixed songs changing genre to Rock after recording - now preserves original genre" },
      { type: 'fix', description: "Fixed charts showing blank - now queries all chart type variations correctly" },
      { type: 'fix', description: "Fixed Analytics button not working - now opens analytics dialog" },
      { type: 'feature', description: "Charts now filter by all 43 game countries instead of 10" },
      { type: 'feature', description: "Release Manager now has search, type, and genre filters" },
      { type: 'feature', description: "Added Release Analytics dialog with streaming, sales, and chart data" },
    ]
  },
  {
    version: "1.0.331",
    date: "2026-01-01",
    changes: [
      { type: 'feature', description: "Players can now add physical formats (CD, Vinyl, Cassette) to already-released digital/streaming releases" },
    ]
  },
  {
    version: "1.0.330",
    date: "2026-01-01",
    changes: [
      { type: 'feature', description: "Charts now support release-type filtering: Singles / EPs / Albums" },
      { type: 'fix', description: "Charts generation no longer requires 100+ streams/views to appear" },
    ]
  },
  {
    version: "1.0.329",
    date: "2025-12-31",
    changes: [
      { type: 'fix', description: "Login page now correctly shows online player count (uses public presence)" },
    ]
  },
  {
    version: "1.0.328",
    date: "2025-12-31",
    changes: [
      { type: 'fix', description: "Radio song submission now shows released songs AND songs with upcoming releases" },
      { type: 'fix', description: "Charts now filter only player band songs (removed all simulated/NPC songs)" },
      { type: 'fix', description: "Streaming revenue now pays daily to band_earnings" },
      { type: 'feature', description: "Added Release Sales tab showing combined streaming and physical/digital revenue" },
      { type: 'fix', description: "Admin AI Songs page now shows all player band songs (up to 500)" },
    ]
  },
  {
    version: "1.0.327",
    date: "2025-12-30",
    changes: [
      { type: 'fix', description: "Charts now only show songs from real player bands (removed non-player songs)" },
      { type: 'fix', description: "Fixed radio submit button visibility - now shows for all active stations" },
      { type: 'fix', description: "Fixed chart notification links (now navigate to /country-charts)" },
      { type: 'feature', description: "Added Stream Multiplier admin tool - boost streams based on active band count" },
      { type: 'feature', description: "Added About page with beta info and Discord bug-log instructions" },
      { type: 'feature', description: "Added BETA badge to login page with link to About page" },
    ]
  },
  {
    version: "1.0.325",
    date: "2025-12-29",
    changes: [
      { type: 'fix', description: "Gig start now validates player is in correct city before performing" },
      { type: 'fix', description: "Fix Stuck Gigs now creates missing outcomes and awards fame/fans to bands" },
      { type: 'fix', description: "Stage equipment purchases now deduct cost from band balance" },
      { type: 'improvement', description: "Travel works dynamically to all 79 cities via plane, train, bus, or ship" },
      { type: 'improvement', description: "Radio submission available on Radio page > Submit tab with batch submission wizard" },
    ]
  },
  {
    version: "1.0.324",
    date: "2025-12-28",
    changes: [
      { type: 'feature', description: "Added search, genre filter, and sort options to Recording Studio recorded songs tab" },
      { type: 'feature', description: "Song Hype and Fame now visible on all song views (cards, details, streaming, manager)" },
      { type: 'improvement', description: "Song Detail Dialog now shows Performance Metrics section with Hype and Fame" },
    ]
  },
  {
    version: "1.0.323",
    date: "2025-12-28",
    changes: [
      { type: 'improvement', description: "Renamed 'Country Charts' to 'Charts' in navigation and all languages" },
      { type: 'fix', description: "Fixed 'Unknown Artist' display - now properly shows band artist_name or profile stage_name" },
      { type: 'feature', description: "Charts now display weekly sales and total sales columns" },
    ]
  },
  {
    version: "1.0.322",
    date: "2025-12-27",
    changes: [
      { type: 'feature', description: "Added gig cancellation with refund calculator and fame penalties" },
      { type: 'fix', description: "Fixed ticket sales not generating in advance (now runs daily)" },
      { type: 'fix', description: "Fixed gigs not awarding fans to band (fan conversion now integrated)" },
      { type: 'fix', description: "Fixed merchandise sales using hardcoded prices (now uses actual inventory)" },
      { type: 'fix', description: "Fixed AI song generation duplicating placeholder lyrics instead of using written lyrics" },
      { type: 'improvement', description: "Merch sales now decrement stock and use real item prices" },
    ]
  },
  {
    version: "1.0.321",
    date: "2025-12-26",
    changes: [
      { type: 'fix', description: "Fixed rehearsals not updating familiarity_percentage and rehearsal_stage" },
      { type: 'improvement', description: "Rehearsal familiarity now requires 10 hours (600 min) for 100% instead of 16+ hours" },
      { type: 'improvement', description: "Rehearsal stages now progress: learning → practicing (30%) → familiar (60%) → mastered (90%)" },
    ]
  },
  {
    version: "1.0.320",
    date: "2025-12-26",
    changes: [
      { type: 'fix', description: "Fixed broken streaming navigation links (/streaming → /streaming-platforms)" },
      { type: 'fix', description: "Fixed streaming revenue rounding to $0 (now uses decimal calculation)" },
      { type: 'fix', description: "Fixed platform stats showing no data (now queries song_releases correctly)" },
      { type: 'fix', description: "Platform charts now show real stream data instead of random simulated numbers" },
      { type: 'improvement', description: "Added redirect from /streaming to /streaming-platforms for old links" },
    ]
  },
  {
    version: "1.0.319",
    date: "2025-12-25",
    changes: [
      { type: 'fix', description: "Fixed streaming releases not showing in My Releases tab (missing release_type filter)" },
    ]
  },
  {
    version: "1.0.318",
    date: "2025-12-25",
    changes: [
      { type: 'feature', description: "Added song fame rating that grows with sales, streams, radio plays and PR" },
      { type: 'fix', description: "Fixed streaming distribution not creating song_releases for released albums" },
      { type: 'fix', description: "Fixed array filter for streaming_platforms not working correctly" },
      { type: 'improvement', description: "Streams now update song fame (1 per 1000 streams) and hype" },
      { type: 'improvement', description: "Sales now update song fame (1 per 5 physical, 1 per 10 digital)" },
    ]
  },
  {
    version: "1.0.317",
    date: "2025-12-24",
    changes: [
      { type: 'feature', description: "Travel now blocks schedule and checks for conflicts before booking" },
      { type: 'feature', description: "PR appearances now check for scheduling conflicts before accepting" },
      { type: 'improvement', description: "Added pr_appearance and film_production activity types to schedule display" },
      { type: 'fix', description: "Double-booking prevention now applies to all activity types" },
    ]
  },
  {
    version: "1.0.316",
    date: "2025-12-24",
    changes: [
      { type: 'fix', description: "Fixed completed songs not appearing in recording song selector" },
      { type: 'fix', description: "Fixed self-produce recording option causing database error" },
      { type: 'improvement', description: "Auto-completed songwriting projects now automatically create song records" },
    ]
  },
  {
    version: "1.0.315",
    date: "2025-12-23",
    changes: [
      { type: 'feature', description: "Added Version History page" },
      { type: 'feature', description: "Added reorder button for sold out/low stock releases" },
      { type: 'fix', description: "Fixed songwriting cleanup cron job failing due to missing column" },
      { type: 'fix', description: "Fixed digital sales not generating (unlimited stock)" },
      { type: 'fix', description: "Fixed streaming distribution not triggering after manufacturing" },
      { type: 'improvement', description: "Charts now use dynamic genres and countries from database" },
    ]
  },
  {
    version: "1.0.313",
    date: "2025-12-22",
    changes: [
      { type: 'fix', description: "Fixed songwriting page hanging after starting a session" },
      { type: 'improvement', description: "Reduced polling frequency and added timeout for cleanup function" },
    ]
  },
  {
    version: "1.0.312",
    date: "2025-12-22",
    changes: [
      { type: 'fix', description: "Fixed band creation error for users with orphaned band member records" },
    ]
  },
  {
    version: "1.0.311",
    date: "2025-12-22",
    changes: [
      { type: 'feature', description: "Added city filter for rehearsal room selection" },
      { type: 'improvement', description: "Default rehearsal room filter to user's current city" },
    ]
  },
  {
    version: "1.0.310",
    date: "2025-12-21",
    changes: [
      { type: 'feature', description: "Added profanity filter for song titles" },
      { type: 'fix', description: "Fixed stuck songwriting sessions not progressing" },
    ]
  },
  {
    version: "1.0.309",
    date: "2025-12-21",
    changes: [
      { type: 'improvement', description: "Multi-language support with 20 languages" },
      { type: 'feature', description: "Added Forest and Midnight color themes" },
    ]
  },
  {
    version: "1.0.308",
    date: "2025-12-20",
    changes: [
      { type: 'feature', description: "Added version display header" },
      { type: 'improvement', description: "Improved navigation with hamburger menu" },
    ]
  },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Plus className="h-3 w-3" />;
    case 'fix':
      return <Bug className="h-3 w-3" />;
    case 'improvement':
      return <Sparkles className="h-3 w-3" />;
    default:
      return <Wrench className="h-3 w-3" />;
  }
};

const getTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'feature':
      return "default";
    case 'fix':
      return "destructive";
    case 'improvement':
      return "secondary";
    default:
      return "outline";
  }
};

export default function VersionHistory() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <History className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-muted-foreground">Track all updates and changes to Rockmundo</p>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          {versionHistory.map((entry) => (
            <Card key={entry.version} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      v{entry.version}
                    </Badge>
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">{entry.date}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {entry.changes.map((change, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Badge 
                        variant={getTypeBadgeVariant(change.type) as any}
                        className="mt-0.5 flex items-center gap-1 text-xs capitalize"
                      >
                        {getTypeIcon(change.type)}
                        {change.type}
                      </Badge>
                      <span className="text-sm text-foreground">{change.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
