import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart2,
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

export default function OfferAutomation() {
  const [globalPause, setGlobalPause] = useState(false);
  const [offerFrequencyMinutes, setOfferFrequencyMinutes] = useState(45);
  const [cooldownHours, setCooldownHours] = useState(24);
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
          <Switch id="global-pause" checked={globalPause} onCheckedChange={setGlobalPause} />
          <div>
            <p className="text-sm font-semibold">Global Auto-Offers</p>
            <p className="text-xs text-muted-foreground">
              {globalPause ? "Paused for all brands" : "Running across all brands"}
            </p>
          </div>
        </div>
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
                <Switch checked={!brand.paused} onCheckedChange={() => toggleBrandPause(brand.name)} />
                <Button variant="outline" size="sm">
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
        </CardContent>
      </Card>
    </div>
  );
}
