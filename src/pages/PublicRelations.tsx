import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const mediaCampaigns = {
  tv: {
    label: "TV",
    recentAppearances: [
      {
        program: "Morning Spotlight",
        network: "WAV8",
        airDate: "May 22",
        highlight: "Acoustic set reached 2.1M viewers",
      },
      {
        program: "Late Night Soundcheck",
        network: "NTN",
        airDate: "May 18",
        highlight: "Interview trended #2 on music Twitter",
      },
      {
        program: "City Beats Live",
        network: "MetroTV",
        airDate: "May 10",
        highlight: "Live debut of upcoming single",
      },
    ],
    appearanceOffers: [
      {
        program: "Chart Buzz",
        network: "MTV Metro",
        window: "Week of Jun 5",
        status: "Reviewing",
      },
      {
        program: "Prime Time Sessions",
        network: "ART Network",
        window: "Jun 12",
        status: "Confirmed",
      },
      {
        program: "Weekend Countdown",
        network: "WSTN",
        window: "Jun 20",
        status: "Negotiating",
      },
    ],
    results: [
      { metric: "Reach", value: "2.1M viewers", trend: "+18%" },
      { metric: "Mentions", value: "12.4K", trend: "+25%" },
      { metric: "Pre-saves", value: "5,480", trend: "+9%" },
    ],
  },
  radio: {
    label: "Radio",
    recentAppearances: [
      {
        program: "Drive Time Live",
        network: "KRMX",
        airDate: "May 19",
        highlight: "Acoustic session replayed across 6 affiliates",
      },
      {
        program: "Indie Hour",
        network: "WAVE",
        airDate: "May 14",
        highlight: "Listener call-ins spiked during interview",
      },
      {
        program: "Sunset Sessions",
        network: "Nation FM",
        airDate: "May 3",
        highlight: "Featured as Artist of the Week",
      },
    ],
    appearanceOffers: [
      {
        program: "Morning Frequency",
        network: "KRSO",
        window: "Jun 1",
        status: "Confirmed",
      },
      {
        program: "Soundwaves",
        network: "WPRX",
        window: "Jun 7",
        status: "Pending",
      },
      {
        program: "After Hours",
        network: "KRWN",
        window: "Jun 15",
        status: "Reviewing",
      },
    ],
    results: [
      { metric: "Reach", value: "680K listeners", trend: "+12%" },
      { metric: "Shoutouts", value: "2,950", trend: "+8%" },
      { metric: "Ticket Clicks", value: "1,140", trend: "+15%" },
    ],
  },
  podcasts: {
    label: "Podcasts",
    recentAppearances: [
      {
        program: "Soundscapers",
        network: "IndiePod",
        airDate: "May 17",
        highlight: "Episode hit 4.7⭐ rating in first week",
      },
      {
        program: "Tour Stories",
        network: "Backstage FM",
        airDate: "May 8",
        highlight: "Clipped to TikTok with 220K views",
      },
      {
        program: "Artists Unplugged",
        network: "Voices Co.",
        airDate: "Apr 29",
        highlight: "Featured on curated Spotify playlist",
      },
    ],
    appearanceOffers: [
      {
        program: "Release Radar",
        network: "IndieCast",
        window: "May 30",
        status: "Confirmed",
      },
      {
        program: "Stagecraft",
        network: "Circuit Media",
        window: "Jun 9",
        status: "Pending",
      },
      {
        program: "The Encore",
        network: "SceneSet",
        window: "Jun 18",
        status: "Reviewing",
      },
    ],
    results: [
      { metric: "Streams", value: "84K plays", trend: "+32%" },
      { metric: "Followers", value: "+2,310", trend: "+11%" },
      { metric: "Newsletter", value: "+480 signups", trend: "+6%" },
    ],
  },
};

const statusVariants: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  Confirmed: "secondary",
  Pending: "outline",
  Reviewing: "default",
  Negotiating: "outline",
};

const PublicRelations = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Public Relations</h1>
        <p className="text-muted-foreground">
          Placeholder media strategy hub to monitor broadcast outreach, guest bookings, and campaign traction.
        </p>
      </header>

      <Tabs defaultValue="tv" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          {Object.entries(mediaCampaigns).map(([key, channel]) => (
            <TabsTrigger key={key} value={key} className="text-base font-medium">
              {channel.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(mediaCampaigns).map(([key, channel]) => (
          <TabsContent key={key} value={key} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Appearances</CardTitle>
                <CardDescription>
                  Highlight reel of the latest {channel.label} moments to repurpose across socials.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead className="hidden sm:table-cell">Network</TableHead>
                      <TableHead className="hidden sm:table-cell">Air Date</TableHead>
                      <TableHead>Highlight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channel.recentAppearances.map((appearance) => (
                      <TableRow key={`${appearance.program}-${appearance.airDate}`}>
                        <TableCell className="font-medium">{appearance.program}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {appearance.network}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {appearance.airDate}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{appearance.highlight}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Appearance Offers</CardTitle>
                <CardDescription>
                  Track inbound requests and hold windows to prioritize the biggest reach.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {channel.appearanceOffers.map((offer) => (
                  <div
                    key={`${offer.program}-${offer.window}`}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{offer.program}</p>
                      <p className="text-sm text-muted-foreground">
                        {offer.network} · {offer.window}
                      </p>
                    </div>
                    <Badge variant={statusVariants[offer.status] ?? "default"}>{offer.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Results</CardTitle>
                <CardDescription>
                  Snapshot of performance metrics attributed to recent {channel.label} pushes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="text-right">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channel.results.map((result) => (
                      <TableRow key={`${result.metric}-${result.value}`}>
                        <TableCell className="font-medium">{result.metric}</TableCell>
                        <TableCell className="text-muted-foreground">{result.value}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-500">
                          {result.trend}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PublicRelations;
