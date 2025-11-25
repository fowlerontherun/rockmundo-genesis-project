import type React from "react";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Clock,
  PauseCircle,
  PlayCircle,
  Radar,
  Settings,
  Sparkles,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FameTier {
  name: string;
  min: number;
  max: number;
  offerMultiplier: number;
}

interface BrandControl {
  name: string;
  paused: boolean;
  dailyOfferTarget: number;
  lastRunMinutesAgo: number;
  queueLatencyMs: number;
}

interface JobMetric {
  label: string;
  value: number;
  target: number;
  description: string;
}

interface OfferLog {
  id: string;
  timestamp: string;
  message: string;
  type: "success" | "error" | "info";
  offersGenerated?: number;
  failures?: number;
  cooldownsApplied?: number;
}

interface OfferStats {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}

export default function OfferAutomation() {
  const [globalPause, setGlobalPause] = useState(false);
  const [offerFrequencyMinutes, setOfferFrequencyMinutes] = useState(45);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [brandCooldownDays, setBrandCooldownDays] = useState(3);
  const [payoutVariance, setPayoutVariance] = useState(15);
  const [fameTiers, setFameTiers] = useState<FameTier[]>([
    { name: "Street", min: 0, max: 499, offerMultiplier: 0.8 },
    { name: "Rising", min: 500, max: 1999, offerMultiplier: 1 },
    { name: "Regional", min: 2000, max: 4999, offerMultiplier: 1.25 },
    { name: "National", min: 5000, max: 9999, offerMultiplier: 1.5 },
    { name: "Global", min: 10000, max: 25000, offerMultiplier: 2 },
  ]);
  const [brands, setBrands] = useState<BrandControl[]>([
    { name: "Neon Nights", paused: false, dailyOfferTarget: 120, lastRunMinutesAgo: 12, queueLatencyMs: 420 },
    { name: "Starlight Syndicate", paused: false, dailyOfferTarget: 90, lastRunMinutesAgo: 28, queueLatencyMs: 980 },
    { name: "Indie Forge", paused: true, dailyOfferTarget: 60, lastRunMinutesAgo: 75, queueLatencyMs: 1640 },
  ]);

  const offerStats: OfferStats[] = useMemo(
    () => [
      {
        label: "Offers Generated (24h)",
        value: "162",
        helper: "Includes all bands and brands with cooldown applied",
        icon: <Activity className="h-4 w-4" />,
      },
      {
        label: "Average Queue Latency",
        value: "840 ms",
        helper: "Time between cron start and first insert",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        label: "Error Rate",
        value: "1.3%",
        helper: "Failures recorded by job logger in the last day",
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      },
      {
        label: "Cooldown Skips Prevented",
        value: "42",
        helper: "Bands skipped because cooldowns are still active",
        icon: <Timer className="h-4 w-4" />,
      },
    ],
    [],
  );

  const jobMetrics: JobMetric[] = useMemo(
    () => [
      {
        label: "Success Rate",
        value: 97,
        target: 99,
        description: "Completed offer jobs without runtime errors",
      },
      {
        label: "Queue Latency (ms)",
        value: 820,
        target: 1000,
        description: "Average time waiting in queue before execution",
      },
      {
        label: "Cooldown Compliance",
        value: 93,
        target: 95,
        description: "Runs skipping bands still on cooldown",
      },
    ],
    [],
  );

  const successRate = jobMetrics.find((metric) => metric.label === "Success Rate")?.value ?? 0;

  const offerLogs: OfferLog[] = useMemo(
    () => [
      {
        id: "log-1",
        timestamp: "2m ago",
        message: "Generated 42 offers across 3 brands",
        type: "success",
        offersGenerated: 42,
        cooldownsApplied: 7,
      },
      {
        id: "log-2",
        timestamp: "18m ago",
        message: "Queue latency spike detected for Indie Forge",
        type: "error",
        failures: 2,
        cooldownsApplied: 3,
      },
      {
        id: "log-3",
        timestamp: "42m ago",
        message: "Applied fame tier recalibration (Regional → National)",
        type: "info",
        offersGenerated: 18,
      },
    ],
    [],
  );

  const errorLogs = offerLogs.filter((log) => log.type === "error");
  const averageQueueLatency = Math.round(
    brands.reduce((sum, brand) => sum + brand.queueLatencyMs, 0) / brands.length,
  );
  const pausedBrands = brands.filter((brand) => brand.paused).length;

  const handleFameTierChange = (index: number, field: keyof FameTier, value: number) => {
    setFameTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as FameTier;
      return updated;
    });
  };

  const toggleBrandPause = (brandName: string) => {
    setBrands((prev) =>
      prev.map((brand) =>
        brand.name === brandName ? { ...brand, paused: !brand.paused } : brand,
      ),
    );
  };

  const toggleAllBrands = (paused: boolean) => {
    setGlobalPause(paused);
    setBrands((prev) => prev.map((brand) => ({ ...brand, paused })));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Offer Automation Controls</h1>
          <p className="text-muted-foreground">
            Tune generation frequency, cooldown policies, payout variance, and fame tier thresholds while
            monitoring operational health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="global-pause" checked={globalPause} onCheckedChange={toggleAllBrands} />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Global Auto-Offers</p>
              <Badge variant={globalPause ? "destructive" : "secondary"}>
                {globalPause ? "Paused" : "Active"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {globalPause ? "Paused for all brands" : "Running across all brands"}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleAllBrands(false)}>
                <PlayCircle className="mr-1 h-4 w-4" /> Resume all
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleAllBrands(true)}>
                <PauseCircle className="mr-1 h-4 w-4" /> Pause all
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {offerStats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{stat.label}</span>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Offer Generation Configuration</CardTitle>
              <CardDescription>
                Control how frequently offers are generated, cooldown durations, and payout variance.
              </CardDescription>
            </div>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="frequency">Offer Frequency (minutes)</Label>
              <Input
                id="frequency"
                type="number"
                min={5}
                value={offerFrequencyMinutes}
                onChange={(e) => setOfferFrequencyMinutes(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Controls how often the engine schedules new offers per brand.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown Duration (hours)</Label>
              <Input
                id="cooldown"
                type="number"
                min={1}
                value={cooldownHours}
                onChange={(e) => setCooldownHours(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Prevents duplicate outreach to bands that recently received offers.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-cooldown">Brand Cooldown (days)</Label>
              <Input
                id="brand-cooldown"
                type="number"
                min={1}
                value={brandCooldownDays}
                onChange={(e) => setBrandCooldownDays(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Controls how often a brand can send repeat offers to the same band.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variance">Payout Variance (%)</Label>
              <Input
                id="variance"
                type="number"
                min={0}
                max={50}
                value={payoutVariance}
                onChange={(e) => setPayoutVariance(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Adds controlled randomness to base payouts to avoid monotony.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Offer Reason Variants</Label>
              <div className="rounded-lg border p-3 text-sm text-muted-foreground bg-muted/30">
                Using {Math.max(4, Math.floor(offerFrequencyMinutes / 10))} reason templates rotated per brand
                with cooldown-aware throttling.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offer Generation Health</CardTitle>
            <CardDescription>Job success rates, latency, and cooldown compliance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobMetrics.map((metric) => {
              const progress = Math.min((metric.value / metric.target) * 100, 120);
              const isLatency = metric.label.includes("Latency");
              const isHealthy = isLatency ? metric.value <= metric.target : metric.value >= metric.target;

              return (
                <div key={metric.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {isLatency ? <Clock className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                      <span className="font-medium">{metric.label}</span>
                    </div>
                    <Badge variant={isHealthy ? "secondary" : "destructive"}>{metric.value}{isLatency ? " ms" : "%"}</Badge>
                  </div>
                  <Progress value={Math.min(progress, 100)} />
                  <p className="text-xs text-muted-foreground">{metric.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Monitoring & Diagnostics</CardTitle>
            <CardDescription>Job success rates, queue latency, and recent failures</CardDescription>
          </div>
          <Badge variant={pausedBrands > 0 ? "destructive" : "secondary"}>
            {pausedBrands > 0 ? `${pausedBrands} brand(s) paused` : "All brands active"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Job success rate</p>
                <p className="text-xs text-muted-foreground">Based on the last 50 cron executions</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-lg font-semibold">{successRate}%</span>
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Queue latency by brand</p>
                  <p className="text-xs text-muted-foreground">Average {averageQueueLatency} ms</p>
                </div>
                <Badge variant="outline">Targets: &lt; 1000 ms</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Last Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow key={brand.name}>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell className="text-sm">{brand.queueLatencyMs} ms</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {brand.lastRunMinutesAgo} minutes ago
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Offer generation logs</p>
                <p className="text-xs text-muted-foreground">Success and error snapshots from the last hour</p>
              </div>
              <Badge variant={errorLogs.length ? "destructive" : "secondary"}>
                {errorLogs.length ? `${errorLogs.length} error(s)` : "Healthy"}
              </Badge>
            </div>
            <div className="space-y-3">
              {offerLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-1">
                    {log.type === "success" && <Activity className="h-4 w-4 text-green-600" />}
                    {log.type === "error" && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    {log.type === "info" && <Timer className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{log.message}</p>
                      <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
                      {typeof log.offersGenerated === "number" && <Badge variant="outline">{log.offersGenerated} offers</Badge>}
                      {typeof log.cooldownsApplied === "number" && <Badge variant="outline">{log.cooldownsApplied} cooldowns</Badge>}
                      {typeof log.failures === "number" && <Badge variant="destructive">{log.failures} failures</Badge>}
                      <Badge variant={log.type === "error" ? "destructive" : "secondary"}>{log.type}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fame Tier Thresholds</CardTitle>
            <CardDescription>Control when bands graduate into higher-paying offer pools.</CardDescription>
          </div>
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Min Fame</TableHead>
                <TableHead>Max Fame</TableHead>
                <TableHead>Payout Multiplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fameTiers.map((tier, index) => (
                <TableRow key={tier.name}>
                  <TableCell className="font-medium">{tier.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={tier.min}
                      onChange={(e) => handleFameTierChange(index, "min", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={tier.max}
                      onChange={(e) => handleFameTierChange(index, "max", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.05"
                      value={tier.offerMultiplier}
                      onChange={(e) => handleFameTierChange(index, "offerMultiplier", Number(e.target.value))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Brand-Level Controls</CardTitle>
            <CardDescription>Pause/resume auto-offers per brand and inspect queue latency.</CardDescription>
          </div>
          <Radar className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{brand.name}</p>
                  {brand.paused ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <PauseCircle className="h-3 w-3" /> Paused
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <PlayCircle className="h-3 w-3" /> Active
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Targeting {brand.dailyOfferTarget} offers/day · Last run {brand.lastRunMinutesAgo}m ago
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span>Queue latency: {brand.queueLatencyMs} ms</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={!brand.paused}
                  disabled={globalPause}
                  onCheckedChange={() => toggleBrandPause(brand.name)}
                />
                <Button variant="outline" size="sm" disabled={brand.paused || globalPause}>
                  Run now
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Offer Generation Logs</CardTitle>
            <CardDescription>Track offer counts, cooldown enforcement, and error spikes.</CardDescription>
          </div>
          <BarChart2 className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {errorLogs.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-semibold">No errors detected</p>
                <p className="text-xs text-green-800">Offer pipeline has not reported new failures in the last hour.</p>
              </div>
            </div>
          ) : (
            errorLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="mt-1">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{log.message}</p>
                    <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
                    {typeof log.failures === "number" && <Badge variant="destructive">{log.failures} failures</Badge>}
                    {typeof log.cooldownsApplied === "number" && <Badge variant="outline">{log.cooldownsApplied} cooldowns</Badge>}
                    <Badge variant="destructive">Error</Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
