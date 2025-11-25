// @ts-nocheck
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchLabelRevenueDashboard,
  type LabelRevenueDashboard,
  type ReleaseRevenueReport,
} from "@/lib/api/labels";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value));

const statusVariants: Record<string, string> = {
  active: "default",
  negotiating: "secondary",
  pending: "outline",
  completed: "outline",
  expired: "destructive",
  terminated: "destructive",
};

const resolveStatusVariant = (status: string | null | undefined): "default" | "destructive" | "outline" | "secondary" => {
  if (!status) {
    return "outline";
  }
  const variant = statusVariants[status.toLowerCase()] ?? "outline";
  return variant as "default" | "destructive" | "outline" | "secondary";
};

const chartColorPalette = {
  totalRevenue: { label: "Total revenue", color: "hsl(var(--chart-1))" },
  streamingRevenue: { label: "Streaming revenue", color: "hsl(var(--chart-2))" },
  streaming: { label: "Streaming", color: "hsl(var(--chart-1))" },
  digital: { label: "Digital", color: "hsl(var(--chart-2))" },
  physical: { label: "Physical", color: "hsl(var(--chart-3))" },
  sync: { label: "Licensing & Sync", color: "hsl(var(--chart-4))" },
  other: { label: "Other", color: "hsl(var(--chart-1))" },
};

const formatReleaseDate = (release: ReleaseRevenueReport) => {
  if (!release.releaseDate) {
    return "TBD";
  }

  const parsed = new Date(release.releaseDate);
  if (Number.isNaN(parsed.getTime())) {
    return "TBD";
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const LabelBusinessDashboard = () => {
  const { labelId } = useParams<{ labelId: string }>();

  const { data, isLoading, error } = useQuery<LabelRevenueDashboard | null>({
    queryKey: ["label-revenue-dashboard", labelId],
    enabled: Boolean(labelId),
    queryFn: async () => {
      if (!labelId) {
        return null;
      }
      return fetchLabelRevenueDashboard(labelId);
    },
  });

  if (!labelId) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            A label identifier is required to view financial dashboards. Please navigate from a specific label detail view.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading label revenue intelligence...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            We were unable to load revenue analytics for this label. Please refresh the page or try again later.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No revenue data is available for this label yet. Once releases begin shipping, financial analytics will appear here.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { label, totals, channelBreakdown, timeline, releases, contracts, contractTotals, stats } = data;

  const channelTotals = channelBreakdown.map((entry) => ({
    ...entry,
    percentage: totals.totalRevenue > 0 ? entry.value / totals.totalRevenue : 0,
  }));

  const releaseChartData = [...releases]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 8)
    .map((release) => ({
      name: release.title,
      streaming: release.streamingRevenue,
      digital: release.digitalRevenue,
      physical: release.physicalRevenue,
      sync: release.syncRevenue,
      other: release.otherRevenue,
      total: release.totalRevenue,
    }));

  const topContracts = [...contracts]
    .sort((a, b) => b.lifetimeGrossRevenue - a.lifetimeGrossRevenue)
    .slice(0, 5);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{label.name} revenue command center</h1>
        <p className="text-muted-foreground">
          Track contract performance, release profitability, and revenue distribution to steer the label&apos;s growth strategy.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total revenue to date</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totals.totalRevenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net revenue after spend</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totals.netRevenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operating budget</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number((label as any).operating_budget ?? 0))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash reserves</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number((label as any).cash_reserves ?? 0))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active contracts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.activeContractCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Roster contracts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.contractCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Releases tracked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.releaseCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime label profit share</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(contractTotals.lifetimeLabelProfit)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle>Revenue momentum</CardTitle>
            <p className="text-sm text-muted-foreground">
              Monthly revenue trends across all releases with streaming performance highlighted.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {timeline.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Revenue timelines will appear once releases record sales or streaming income.
              </div>
            ) : (
              <ChartContainer config={chartColorPalette} className="h-[320px] w-full">
                <AreaChart data={timeline} margin={{ left: 12, right: 12 }}>
                  <defs>
                    <linearGradient id="totalRevenueGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <ChartTooltip cursor={{ stroke: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#totalRevenueGradient)"
                    strokeWidth={2}
                    name="Total revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="streamingRevenue"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2) / 0.15)"
                    strokeWidth={2}
                    name="Streaming revenue"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Revenue mix</CardTitle>
            <p className="text-sm text-muted-foreground">
              Compare each channel&apos;s contribution to overall earnings to adjust campaign spend.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {channelTotals.map((entry) => (
              <div key={entry.channel} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{entry.channel}</span>
                  <span className="text-sm text-muted-foreground">{formatCurrency(entry.value)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono text-muted-foreground">{percentFormatter.format(entry.percentage)}</span>
                  <span className="text-muted-foreground">share of total</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(entry.percentage * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>Release revenue comparison</CardTitle>
          <p className="text-sm text-muted-foreground">
            Stacked channel revenue across the top performing releases to surface high-value strategies.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {releaseChartData.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Launch a release to begin benchmarking channel revenue.
            </div>
          ) : (
            <ChartContainer config={chartColorPalette} className="h-[360px] w-full">
              <BarChart data={releaseChartData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={80} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted) / 0.2)" }} />
                <ChartLegend wrapperStyle={{ paddingTop: 12 }} />
                <Bar dataKey="streaming" stackId="a" fill="hsl(var(--chart-1))" name="Streaming" />
                <Bar dataKey="digital" stackId="a" fill="hsl(var(--chart-2))" name="Digital" />
                <Bar dataKey="physical" stackId="a" fill="hsl(var(--chart-3))" name="Physical" />
                <Bar dataKey="sync" stackId="a" fill="hsl(var(--chart-4))" name="Licensing & Sync" />
                <Bar dataKey="other" stackId="a" fill="hsl(var(--chart-1) / 0.6)" name="Other" />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Contract performance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review the top partners and their lifetime economics to balance roster investments.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross revenue</TableHead>
                  <TableHead className="text-right">Artist payouts</TableHead>
                  <TableHead className="text-right">Label profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Contracts will appear here once deals begin generating revenue.
                    </TableCell>
                  </TableRow>
                ) : (
                  topContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{contract.artistName}</span>
                          <span className="text-xs text-muted-foreground capitalize">{contract.entityType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={resolveStatusVariant(contract.status)}>{contract.status ?? "unknown"}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(contract.lifetimeGrossRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(contract.lifetimeArtistPayout)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(contract.lifetimeLabelProfit)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Separator className="my-4" />
            <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="font-medium text-foreground">Lifetime gross</p>
                <p className="font-mono">{formatCurrency(contractTotals.lifetimeGrossRevenue)}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Artist payouts</p>
                <p className="font-mono">{formatCurrency(contractTotals.lifetimeArtistPayout)}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Label profit</p>
                <p className="font-mono">{formatCurrency(contractTotals.lifetimeLabelProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Release profitability</CardTitle>
            <p className="text-sm text-muted-foreground">
              Monitor where marketing spend converts into net revenue across the release slate.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No releases have recorded revenue yet. Once sales or streams post, they will appear here.
                    </TableCell>
                  </TableRow>
                ) : (
                  releases.map((release) => (
                    <TableRow key={release.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{release.title}</p>
                          <p className="text-xs text-muted-foreground">{formatReleaseDate(release)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{release.contractName}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(release.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(release.expenseTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(release.netRevenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LabelBusinessDashboard;
