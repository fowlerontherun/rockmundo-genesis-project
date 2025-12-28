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
