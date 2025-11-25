import { useEffect, useMemo, useState } from "react";
import {
  fetchCampaignExperiments,
  type CampaignExperiment,
  type CampaignExperimentsResponse,
} from "@/lib/api/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  BarChart3,
  Loader2,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-US", options).format(value);

const formatPercent = (value: number, fractionDigits = 1) => `${value.toFixed(fractionDigits)}%`;

const statusVariantMap: Record<CampaignExperiment["status"], string> = {
  running: "default",
  completed: "secondary",
  paused: "outline",
};

const ExperimentsAnalytics = () => {
  const [data, setData] = useState<CampaignExperimentsResponse | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | undefined>(undefined);
  const [activeVariantId, setActiveVariantId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetchCampaignExperiments();
        if (!isMounted) return;
        setData(response);
        if (response.experiments.length) {
          setSelectedExperimentId(response.experiments[0].id);
          setActiveVariantId(response.experiments[0].variants[0]?.id);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError("We couldn't load experiment analytics right now. Please try again in a moment.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const experiments = data?.experiments ?? [];
  const selectedExperiment = experiments.find((experiment) => experiment.id === selectedExperimentId);
  const activeVariant = selectedExperiment?.variants.find((variant) => variant.id === activeVariantId);
  const leadingVariant = selectedExperiment?.variants.find((variant) => variant.isWinning) ??
    selectedExperiment?.variants[0];

  const conversionTrendData = useMemo(() => {
    if (!selectedExperiment) return [];

    const byDate = new Map<string, Record<string, number | string>>();

    for (const variant of selectedExperiment.variants) {
      for (const point of variant.timeseries) {
        const existing = byDate.get(point.date) ?? { date: point.date };
        existing[variant.id] = point.conversionRate;
        byDate.set(point.date, existing);
      }
    }

    return Array.from(byDate.values()).sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
    );
  }, [selectedExperiment]);

  const variantPerformanceData = useMemo(() => {
    if (!selectedExperiment) return [];

    return selectedExperiment.variants.map((variant) => ({
      name: variant.name,
      conversions: variant.conversions,
      revenue: Number((variant.totalRevenue / 1000).toFixed(1)),
    }));
  }, [selectedExperiment]);

  const handleExperimentChange = (value: string) => {
    setSelectedExperimentId(value);
    const experiment = experiments.find((item) => item.id === value);
    setActiveVariantId(experiment?.variants[0]?.id);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center py-24">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading campaign experiments…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Analytics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!selectedExperiment || !data) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <Alert>
          <Sparkles className="h-5 w-5" />
          <AlertTitle>No experiments yet</AlertTitle>
          <AlertDescription>
            Launch your first campaign test to start benchmarking creative performance, conversion lift, and retention
            impact.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Campaign Experiments Lab</h1>
        <p className="text-muted-foreground">
          Compare creative variants, measure lift in your most important metrics, and ship the messages that keep fans coming
          back.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total experiments</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.totalExperiments)}</div>
            <p className="text-xs text-muted-foreground">Historical experiments managed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active tests</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.runningExperiments)}</div>
            <p className="text-xs text-muted-foreground">Live experiments targeting key segments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average lift</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(summary.avgConversionLift)}</div>
            <p className="text-xs text-muted-foreground">Mean conversion uplift vs control</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audience reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.activeReach, { notation: "compact" })}</div>
            <p className="text-xs text-muted-foreground">Fans touched by active experiments</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold leading-tight">{selectedExperiment.name}</h2>
            <Badge variant={(statusVariantMap[selectedExperiment.status] || "outline") as "default" | "destructive" | "outline" | "secondary"} className="capitalize">
              {selectedExperiment.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{selectedExperiment.objective}</p>
        </div>
        <div className="w-full lg:w-[280px]">
          <Select value={selectedExperimentId} onValueChange={handleExperimentChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select experiment" />
            </SelectTrigger>
            <SelectContent>
              {experiments.map((experiment) => (
                <SelectItem key={experiment.id} value={experiment.id}>
                  {experiment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Experiment overview</CardTitle>
          <CardDescription>{selectedExperiment.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Target segment</p>
              <p className="text-base font-semibold">{selectedExperiment.targetSegment}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Primary metric</p>
              <p className="text-base font-semibold">{selectedExperiment.primaryMetric}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Secondary metrics</p>
              <p className="text-base font-semibold text-muted-foreground">
                {selectedExperiment.secondaryMetrics.join(" • ")}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Statistical confidence</p>
              <Progress value={selectedExperiment.confidence} className="h-2" />
              <p className="text-xs text-muted-foreground">{formatPercent(selectedExperiment.confidence, 0)} confidence level</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/50 p-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Winning variant</p>
                <p className="text-sm text-muted-foreground">
                  {leadingVariant?.name ?? summary.bestVariantName}
                </p>
                {leadingVariant ? (
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(leadingVariant.conversionRate)} conversion rate · {formatPercent(leadingVariant.uplift)} lift
                  </p>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Timeline</p>
              <p className="font-semibold">
                {new Date(selectedExperiment.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {selectedExperiment.endDate
                  ? ` – ${new Date(selectedExperiment.endDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`
                  : " – Present"}
              </p>
              <p className="text-xs text-muted-foreground">
                Monitoring fan behavior, drop-off points, and monetization signals across the funnel.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Why it matters</p>
              <p className="text-sm text-muted-foreground">
                Each variant represents a creative bet. Track revenue per visitor, retention, and engagement to decide which
                story scales across your ecosystem.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-border/50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Secondary goals</p>
              <p className="text-sm text-muted-foreground">
                Improve subscriber capture, reduce bounce for cold traffic, and fuel downstream merch conversions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversion rate lift</CardTitle>
            <CardDescription>Compare how each variant is trending over time against the control baseline.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionTrendData} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  className="text-xs"
                />
                <YAxis
                  domain={[0, "auto"]}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}%`}
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
                <Legend />
                {selectedExperiment.variants.map((variant, index) => (
                  <Line
                    key={variant.id}
                    type="monotone"
                    dataKey={variant.id}
                    name={variant.name}
                    stroke={`hsl(var(--chart-${((index % 5) + 1) as 1 | 2 | 3 | 4 | 5}))`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Variant impact snapshot</CardTitle>
            <CardDescription>Conversions and revenue (in thousands) recorded during the test window.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={variantPerformanceData} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis yAxisId="left" orientation="left" className="text-xs" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => `$${value}k`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number, key) =>
                    key === "revenue" ? [`$${value.toFixed(1)}k`, "Revenue"] : [formatNumber(value), "Conversions"]
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="conversions" name="Conversions" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="revenue" name="Revenue (k)" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variant deep dive</CardTitle>
          <CardDescription>
            Explore audience reactions, monetization signals, and qualitative takeaways to decide how to scale each creative
            direction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeVariant?.id ?? ""} onValueChange={setActiveVariantId} className="space-y-6">
            <TabsList className="flex w-full flex-wrap gap-2">
              {selectedExperiment.variants.map((variant) => (
                <TabsTrigger key={variant.id} value={variant.id} className="flex items-center gap-2">
                  {variant.name}
                  {variant.isWinning ? <Badge variant="secondary">Leading</Badge> : null}
                </TabsTrigger>
              ))}
            </TabsList>

            {selectedExperiment.variants.map((variant) => (
              <TabsContent key={variant.id} value={variant.id} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Message focus</p>
                      <p className="text-base font-semibold">{variant.messageFocus}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sample size</p>
                        <p className="text-lg font-semibold">{formatNumber(variant.sampleSize)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conversions</p>
                        <p className="text-lg font-semibold">{formatNumber(variant.conversions)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conversion rate</p>
                        <p className="text-lg font-semibold">{formatPercent(variant.conversionRate)}</p>
                        <p className="text-xs text-muted-foreground">{formatPercent(variant.uplift)} lift vs control</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue per visitor</p>
                        <p className="text-lg font-semibold">${variant.revenuePerVisitor.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${formatNumber(variant.totalRevenue)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Retention</p>
                        <p className="text-lg font-semibold">{formatPercent(variant.retentionRate)}</p>
                        <Progress value={variant.retentionRate} className="mt-2 h-2" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Engagement</p>
                        <p className="text-lg font-semibold">{formatPercent(variant.engagementRate)}</p>
                        <Progress value={variant.engagementRate} className="mt-2 h-2" />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bounce rate</p>
                        <p className="text-lg font-semibold">{formatPercent(variant.bounceRate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Highlights</p>
                        <ul className="space-y-2 text-xs text-muted-foreground">
                          {variant.highlights.map((highlight) => (
                            <li key={highlight}>• {highlight}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">What we’re seeing</p>
                  <p>
                    {variant.description}
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance table</CardTitle>
          <CardDescription>Quantitative snapshot to help prioritize rollout plans.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead>Sample size</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Conversion rate</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Bounce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedExperiment.variants.map((variant) => (
                  <TableRow key={variant.id} className={variant.isWinning ? "bg-muted/40" : undefined}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {variant.name}
                        {variant.isWinning ? <Badge variant="secondary">Leading</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(variant.sampleSize)}</TableCell>
                    <TableCell>{formatNumber(variant.conversions)}</TableCell>
                    <TableCell>{formatPercent(variant.conversionRate)}</TableCell>
                    <TableCell>${formatNumber(variant.totalRevenue)}</TableCell>
                    <TableCell>{formatPercent(variant.retentionRate)}</TableCell>
                    <TableCell>{formatPercent(variant.engagementRate)}</TableCell>
                    <TableCell>{formatPercent(variant.bounceRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExperimentsAnalytics;

