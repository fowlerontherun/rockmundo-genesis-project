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
