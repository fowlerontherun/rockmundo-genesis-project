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
