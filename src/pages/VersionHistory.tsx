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
