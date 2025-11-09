import { useEffect, useMemo, useState } from "react";
import {
  mediaFacilities,
  mediaShows,
  mediaSchedule,
  analyticsSnapshots,
  mediaCampaigns,
  mediaBuzzEvents,
  showFormatModules,
  type MediaType,
  type MediaFacility,
} from "@/data/mediaNetworks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PieLabelRenderProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Radio,
  Tv,
  Mic2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CalendarClock,
  Workflow,
  Layers3,
  Zap,
  DollarSign,
  Activity,
  Handshake,
  LineChart as LineChartIcon,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const sponsorTierLabels: Record<string, { label: string; variant: "outline" | "default" }> = {
  bronze: { label: "Bronze", variant: "outline" },
  silver: { label: "Silver", variant: "outline" },
  gold: { label: "Gold", variant: "default" },
  platinum: { label: "Platinum", variant: "default" },
};

const mediaTypeIcons: Record<MediaType, JSX.Element> = {
  tv: <Tv className="h-4 w-4" />,
  podcast: <Mic2 className="h-4 w-4" />,
  radio: <Radio className="h-4 w-4" />,
};

const marketingFocusLabels: Record<string, string> = {
  buzz: "Buzz",
  reach: "Reach",
  sales: "Sales",
};

const exclusivityLabels: Record<string, string> = {
  none: "Open",
  regional: "Regional",
  global: "Global",
};

const FacilitiesGrid = ({ facilities }: { facilities: MediaFacility[] }) => {
  if (facilities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No facilities match the current filters yet. Expand into new cities or upgrade an existing studio to unlock slots.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {facilities.map((facility) => (
        <Card key={facility.id} className="border-primary/10 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {facility.city}
            </div>
            <Badge variant={sponsorTierLabels[facility.sponsorTier].variant}>
              {sponsorTierLabels[facility.sponsorTier].label} Sponsor
            </Badge>
          </div>
          <CardTitle className="flex items-center gap-2 text-xl">
            {mediaTypeIcons[facility.type as MediaType]}
            {facility.name}
          </CardTitle>
          <CardDescription>{facility.specialization}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Reputation</p>
              <p className="font-medium">{facility.reputation}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Technical Level</p>
              <p className="font-medium">{facility.technicalLevel}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Reach Score</p>
              <p className="font-medium">{facility.reachScore}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Active Campaigns</p>
              <p className="font-medium">{facility.activeCampaigns.length}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signature Upgrades</p>
            <div className="flex flex-wrap gap-2">
              {facility.upgrades.map((upgrade) => (
                <Badge key={upgrade} variant="secondary" className="whitespace-nowrap">
                  {upgrade}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core Staff</p>
            <div className="flex flex-wrap gap-2">
              {facility.staff.map((role) => (
                <Badge key={role} variant="outline" className="whitespace-nowrap">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campaign Stack</p>
            <div className="flex flex-wrap gap-2">
              {facility.activeCampaigns.map((campaign) => (
                <Badge key={campaign} variant="default" className="bg-primary/10 text-primary">
                  {campaign}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
    </div>
  );
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number) => `${value.toFixed(0)}%`;

const getMediaTypeLabel = (type: MediaType) => {
  switch (type) {
    case "tv":
      return "Television";
    case "podcast":
      return "Podcast";
    case "radio":
      return "Radio";
    default:
      return String(type).toUpperCase();
  }
};

const MediaNetworks = () => {
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<MediaType | "all">("tv");
  const [selectedShowId, setSelectedShowId] = useState<string>(mediaShows[0]?.id ?? "");
  const [appearanceFee, setAppearanceFee] = useState<number>(45000);
  const [marketingSpend, setMarketingSpend] = useState<number>(20000);
  const [rehearsalQuality, setRehearsalQuality] = useState<number>(80);
  const [includeMerch, setIncludeMerch] = useState<boolean>(true);
  const [includeSyndication, setIncludeSyndication] = useState<boolean>(true);

  const availableCities = useMemo(() => {
    return ["all", ...new Set(mediaFacilities.map((facility) => facility.city))];
  }, []);

  const facilitiesByType = useMemo(() => {
    const matchesCity = (facility: (typeof mediaFacilities)[number]) => selectedCity === "all" || facility.city === selectedCity;
    return {
      tv: mediaFacilities.filter((facility) => matchesCity(facility) && facility.type === "tv"),
      podcast: mediaFacilities.filter((facility) => matchesCity(facility) && facility.type === "podcast"),
      radio: mediaFacilities.filter((facility) => matchesCity(facility) && facility.type === "radio"),
      all: mediaFacilities.filter((facility) => matchesCity(facility)),
    } satisfies Record<MediaType | "all", MediaFacility[]>;
  }, [selectedCity]);

  const facilitiesForActiveTab = useMemo(() => {
    if (activeTab === "all") {
      return facilitiesByType.all;
    }
    return facilitiesByType[activeTab];
  }, [activeTab, facilitiesByType]);

  const filteredShows = useMemo(() => {
    if (activeTab === "all") {
      return mediaShows;
    }
    return mediaShows.filter((show) => show.mediaType === activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (filteredShows.length === 0) {
      return;
    }
    const hasSelected = filteredShows.some((show) => show.id === selectedShowId);
    if (!hasSelected) {
      setSelectedShowId(filteredShows[0].id);
    }
  }, [filteredShows, selectedShowId]);

  const selectedShow = useMemo(() => {
    return mediaShows.find((show) => show.id === selectedShowId) ?? mediaShows[0];
  }, [selectedShowId]);

  const facilityStats = useMemo(() => {
    const totalReach = facilitiesForActiveTab.reduce((acc, facility) => acc + facility.reachScore, 0);
    const averageReputation =
      facilitiesForActiveTab.length > 0
        ? facilitiesForActiveTab.reduce((acc, facility) => acc + facility.reputation, 0) / facilitiesForActiveTab.length
        : 0;
    const platinumCount = facilitiesForActiveTab.filter((facility) => facility.sponsorTier === "platinum").length;
    const campaignCount = facilitiesForActiveTab.reduce((acc, facility) => acc + facility.activeCampaigns.length, 0);
    return { totalReach, averageReputation, platinumCount, campaignCount };
  }, [facilitiesForActiveTab]);

  const scheduleItems = useMemo(() => {
    return mediaSchedule.filter((slot) => {
      const facility = mediaFacilities.find((entry) => entry.id === slot.facilityId);
      if (!facility) return false;
      const matchesCity = selectedCity === "all" || facility.city === selectedCity;
      const matchesTab = activeTab === "all" || slot.mediaType === activeTab;
      return matchesCity && matchesTab;
    });
  }, [selectedCity, activeTab]);

  const negotiationOutcome = useMemo(() => {
    if (!selectedShow) {
      return { buzz: 0, revenue: 0, risk: 0, reach: 0 };
    }

    const baseBuzz = selectedShow.rating * 0.4 + selectedShow.novelty * 0.3 + selectedShow.sponsorshipHealth * 0.2;
    const marketingBoost = marketingSpend / 1000;
    const rehearsalBoost = (rehearsalQuality - 50) * 0.6;
    const merchBoost = includeMerch ? 6 : 0;
    const syndicationBoost = includeSyndication ? 9 : 0;

    const buzzScore = Math.max(0, Math.min(100, baseBuzz + marketingBoost + rehearsalBoost + merchBoost + syndicationBoost));
    const reachScore = Math.max(0, selectedShow.rating * 0.05 + marketingSpend / 8000 + (includeSyndication ? 1.8 : 0.4));

    const revenueBase = appearanceFee + marketingSpend * 0.25 + selectedShow.sponsorshipHealth * 500;
    const revenueBonus = includeMerch ? 8500 : 0;
    const revenueSyndication = includeSyndication ? selectedShow.distribution.length * 6000 : 0;
    const revenue = revenueBase + revenueBonus + revenueSyndication;

    const riskBase = Math.max(0, 100 - selectedShow.sponsorshipHealth - rehearsalQuality * 0.5);
    const risk = Math.min(100, riskBase + (marketingSpend > 40000 ? 12 : 0) - (includeMerch ? 4 : 0));

    return {
      buzz: buzzScore,
      revenue,
      risk,
      reach: reachScore,
    };
  }, [selectedShow, appearanceFee, marketingSpend, rehearsalQuality, includeMerch, includeSyndication]);

  const sponsorSatisfactionTrend = useMemo(() => {
    if (analyticsSnapshots.length < 2) return 0;
    const first = analyticsSnapshots[0].sponsorSatisfaction;
    const last = analyticsSnapshots[analyticsSnapshots.length - 1].sponsorSatisfaction;
    return last - first;
  }, []);

  const pieData = useMemo(() => {
    return [
      { name: "Television", value: mediaShows.filter((show) => show.mediaType === "tv").length },
      { name: "Podcasts", value: mediaShows.filter((show) => show.mediaType === "podcast").length },
      { name: "Radio", value: mediaShows.filter((show) => show.mediaType === "radio").length },
    ];
  }, []);

  const pieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelRenderProps) => {
    const numCx = Number(cx) || 0;
    const numCy = Number(cy) || 0;
    const numInnerRadius = Number(innerRadius) || 0;
    const numOuterRadius = Number(outerRadius) || 0;
    const numMidAngle = Number(midAngle) || 0;
    
    const radius = numInnerRadius + (numOuterRadius - numInnerRadius) * 0.6;
    const RADIAN = Math.PI / 180;
    const x = numCx + radius * Math.cos(-numMidAngle * RADIAN);
    const y = numCy + radius * Math.sin(-numMidAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > numCx ? "start" : "end"} dominantBaseline="central" className="text-xs">
        {(percent ? percent * 100 : 0).toFixed(0)}%
      </text>
    );
  };

  const sponsorHealthColor = negotiationOutcome.risk > 60 ? "text-destructive" : negotiationOutcome.risk > 40 ? "text-warning" : "text-emerald-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Media Control Center</h1>
          <p className="text-muted-foreground">
            Operate your television specials, podcast franchises, and radio tours with unified analytics, negotiation tools, and
            upgrade planning.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Label htmlFor="city-filter">City Focus</Label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger id="city-filter">
                <SelectValue placeholder="Choose city" />
              </SelectTrigger>
              <SelectContent>
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city === "all" ? "All Cities" : city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label htmlFor="show-picker">Feature Show</Label>
            <Select value={selectedShowId} onValueChange={setSelectedShowId}>
              <SelectTrigger id="show-picker">
                <SelectValue placeholder="Select show" />
              </SelectTrigger>
              <SelectContent>
                {filteredShows.map((show) => (
                  <SelectItem key={show.id} value={show.id}>
                    {show.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reach Potential</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <TrendingUp className="h-5 w-5 text-primary" />
              {facilityStats.totalReach.toFixed(0)} pts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aggregated Media Reach Score across filtered facilities.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. Facility Reputation</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {facilityStats.averageReputation.toFixed(1)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Keep reputation above 80 for premium bookings.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platinum Sponsor Hubs</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Zap className="h-5 w-5 text-primary" />
              {facilityStats.platinumCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Platinum tiers unlock premium brand missions and ad splits.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Campaigns</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Workflow className="h-5 w-5 text-primary" />
              {facilityStats.campaignCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Stack campaigns to shape distribution, sponsors, and reach.</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MediaType | "all")}>
        <TabsList className="grid grid-cols-4 md:w-[520px]">
          <TabsTrigger value="tv" className="flex items-center gap-2">
            {mediaTypeIcons.tv}
            TV Studios
          </TabsTrigger>
          <TabsTrigger value="podcast" className="flex items-center gap-2">
            {mediaTypeIcons.podcast}
            Podcasts
          </TabsTrigger>
          <TabsTrigger value="radio" className="flex items-center gap-2">
            {mediaTypeIcons.radio}
            Radio
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Layers3 className="h-4 w-4" />
            All Media
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tv" className="pt-4">
          <FacilitiesGrid facilities={facilitiesByType.tv} />
        </TabsContent>
        <TabsContent value="podcast" className="pt-4">
          <FacilitiesGrid facilities={facilitiesByType.podcast} />
        </TabsContent>
        <TabsContent value="radio" className="pt-4">
          <FacilitiesGrid facilities={facilitiesByType.radio} />
        </TabsContent>
        <TabsContent value="all" className="pt-4">
          <FacilitiesGrid facilities={facilitiesByType.all} />
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              Weekly Impact Trends
            </CardTitle>
            <CardDescription>Track media buzz, reach, conversion, and sponsor sentiment over the current campaign arc.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsSnapshots}>
                <defs>
                  <linearGradient id="colorBuzz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="mediaBuzz" stroke="hsl(var(--chart-1))" fill="url(#colorBuzz)" name="Media Buzz" />
                <Area type="monotone" dataKey="reach" stroke="hsl(var(--chart-2))" fill="url(#colorReach)" name="Reach (M)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Portfolio Mix
            </CardTitle>
            <CardDescription>Ensure balanced investments across media formats.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={90}
                  fill="hsl(var(--chart-3))"
                  dataKey="value"
                  label={pieLabel}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`slice-${entry.name}`} fill={`hsl(var(--chart-${(index % 4) + 1}))`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: `hsl(var(--chart-${(index % 4) + 1}))` }}
                  />
                  {entry.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Booking & Syndication Grid
            </CardTitle>
            <CardDescription>Monitor rehearsals, exclusivity clauses, and predicted reach per slot.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Show</TableHead>
                  <TableHead>Exclusivity</TableHead>
                  <TableHead>Rehearsal</TableHead>
                  <TableHead>Focus</TableHead>
                  <TableHead className="text-right">Reach (M)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleItems.map((item) => {
                  const facility = mediaFacilities.find((entry) => entry.id === item.facilityId);
                  const show = mediaShows.find((entry) => entry.id === item.showId);
                  if (!facility || !show) return null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.slot}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {mediaTypeIcons[item.mediaType]}
                        {getMediaTypeLabel(item.mediaType)}
                      </TableCell>
                      <TableCell>{facility.name}</TableCell>
                      <TableCell>{show.name}</TableCell>
                      <TableCell>{exclusivityLabels[item.exclusivity]}</TableCell>
                      <TableCell>
                        <Progress value={item.rehearsalRequirement} className="h-2" />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{marketingFocusLabels[item.marketingFocus]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.predictedReach.toFixed(1)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Negotiation Simulator
            </CardTitle>
            <CardDescription>Adjust fees, marketing, and clauses to preview buzz, reach, and risk outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Label className="text-sm font-semibold">Appearance Fee</Label>
              <Slider
                value={[appearanceFee]}
                min={15000}
                max={90000}
                step={5000}
                onValueChange={([value]) => setAppearanceFee(value)}
              />
              <div className="text-sm font-medium">{formatCurrency(appearanceFee)}</div>
            </div>
            <div className="grid gap-3">
              <Label className="text-sm font-semibold">Marketing Spend</Label>
              <Slider
                value={[marketingSpend]}
                min={5000}
                max={60000}
                step={5000}
                onValueChange={([value]) => setMarketingSpend(value)}
              />
              <div className="text-sm font-medium">{formatCurrency(marketingSpend)}</div>
            </div>
            <div className="grid gap-3">
              <Label className="text-sm font-semibold">Rehearsal & Media Training</Label>
              <Slider
                value={[rehearsalQuality]}
                min={40}
                max={100}
                step={5}
                onValueChange={([value]) => setRehearsalQuality(value)}
              />
              <div className="text-sm font-medium">{rehearsalQuality} Preparedness</div>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="space-y-1">
                <Label htmlFor="merch-toggle" className="font-semibold">
                  Merchandise Blitz
                </Label>
                <p className="text-xs text-muted-foreground">Cross-promote limited drops post episode.</p>
              </div>
              <Switch id="merch-toggle" checked={includeMerch} onCheckedChange={setIncludeMerch} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="syndication-toggle" className="font-semibold">
                  Syndication Add-on
                </Label>
                <p className="text-xs text-muted-foreground">Allows multi-city rebroadcast & streaming rights.</p>
              </div>
              <Switch id="syndication-toggle" checked={includeSyndication} onCheckedChange={setIncludeSyndication} />
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Predicted Buzz</span>
                <span className="font-semibold">{formatPercent(negotiationOutcome.buzz)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Projected Reach</span>
                <span className="font-semibold">{negotiationOutcome.reach.toFixed(1)}M viewers</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Revenue Forecast</span>
                <span className="font-semibold">{formatCurrency(negotiationOutcome.revenue)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Risk Profile</span>
                <span className={`font-semibold ${sponsorHealthColor}`}>{formatPercent(negotiationOutcome.risk)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Format Modules & Unlocks
            </CardTitle>
            <CardDescription>Invest in modules to differentiate content and deliver Popmundo-beating variety.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {showFormatModules.map((module) => (
              <div key={module.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">{module.label}</h3>
                  <Badge variant="secondary">Lvl {module.unlocksAt}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {module.mediaTypes.map((type) => (
                    <Badge key={`${module.id}-${type}`} variant="outline" className="flex items-center gap-1">
                      {mediaTypeIcons[type]}
                      {getMediaTypeLabel(type)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Campaign Roadmap
            </CardTitle>
            <CardDescription>Coordinate label, manager, and facility campaigns for stacked bonuses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mediaCampaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-md border border-dashed p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{campaign.label}</p>
                    <p className="text-xs text-muted-foreground">Unlock: {campaign.unlockRequires}</p>
                  </div>
                  <Badge variant="secondary" className="uppercase">
                    {campaign.type}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{campaign.durationWeeks} week program</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                  {campaign.bonuses.map((bonus) => (
                    <li key={bonus}>{bonus}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs font-semibold">Cost: {formatCurrency(campaign.costPerWeek)} / week</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Buzz Events & Mitigation
            </CardTitle>
            <CardDescription>Respond to viral surges and crises before they reshape ratings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              {mediaBuzzEvents.map((event) => (
                <AccordionItem key={event.id} value={event.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant={event.impact === "positive" ? "default" : "destructive"}>
                        {event.impact === "positive" ? "Positive" : "Negative"}
                      </Badge>
                      <span className="font-medium">{event.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm">
                    <p>{event.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Impact magnitude</span>
                      <Badge variant="secondary">{event.magnitude} pts</Badge>
                    </div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Mitigation</p>
                    <p>{event.mitigation}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Sponsor Sentiment
            </CardTitle>
            <CardDescription>Track satisfaction trends and align new placements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Trend since Week 1</span>
              <span className="font-semibold">{formatPercent(sponsorSatisfactionTrend)}</span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsSnapshots}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" domain={[60, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="sponsorSatisfaction" stroke="hsl(var(--chart-4))" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MediaNetworks;
