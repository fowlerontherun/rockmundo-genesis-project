import {
  apiEndpoints,
  backgroundJobs,
  calculators,
  demandFactors,
  dataModelTables,
  festivalCostProfiles,
  festivalLicenseDetails,
  festivalSizeTiers,
  festivalTracks,
  lifecycleBeats,
  pricingTiers,
  profitStreams,
  systemsInterplay,
} from "@/data/festivals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo } from "react";
import { CalendarDays, LineChart, Network, ShieldAlert, Ticket, TrendingUp } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});

function formatPriceRange([low, high]: [number, number]) {
  return `${currencyFormatter.format(low)}–${currencyFormatter.format(high)}`;
}

function formatDayRange([min, max]: [number, number]) {
  return min === max ? `${min} day` : `${min}-${max} days`;
}

const tierLabelLookup = Object.fromEntries(festivalSizeTiers.map((tier) => [tier.id, tier.label]));
type PricingCategory = typeof pricingTiers[number]["category"];
type PricingTierEntry = typeof pricingTiers[number];

export default function Festivals() {
  const pricingByCategory = useMemo(() => {
    return pricingTiers.reduce<Record<PricingCategory, PricingTierEntry[]>>(
      (acc, tier) => {
        acc[tier.category].push(tier);
        return acc;
      },
      { food: [], drink: [], merch: [] },
    );
  }, []);

  return (
    <div className="container mx-auto px-4 py-10 space-y-12">
      <section className="space-y-4 text-center md:text-left">
        <Badge variant="secondary" className="text-sm uppercase tracking-wide">
          Festival Systems Blueprint
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Festival Operations & Simulation Hub</h1>
        <p className="mx-auto max-w-4xl text-muted-foreground md:mx-0 md:text-base">
          RockMundo's next evolution brings a deep festival simulation featuring dual ownership models, elastic pricing,
          granular P&amp;L accounting, and the sentiment-driven Festival Score. This page outlines how the foundational data
          model, services, and player flows interlock.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {festivalTracks.map((track) => (
          <Card key={track.id} className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-primary">
                {track.ownerType === "admin" ? <ShieldAlert className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                <span>{track.ownerType === "admin" ? "National Programme" : "Licensed Entrepreneurship"}</span>
              </div>
              <CardTitle className="text-2xl">{track.title}</CardTitle>
              <CardDescription>{track.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core Beats</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {track.coreBeats.map((beat) => (
                    <li key={beat} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span>{beat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation Highlights</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {track.automationHighlights.map((note) => (
                    <li key={note} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/80" aria-hidden />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unique Systems</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {track.uniqueSystems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/40" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Size tiers &amp; difficulty bands</h2>
            <p className="text-sm text-muted-foreground">
              Capacity ceilings, staffing expectations, and pricing bands inform difficulty curves across the four license tiers.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <Ticket className="h-3.5 w-3.5" /> Tier tuning ready
          </Badge>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tier</TableHead>
                  <TableHead>Capacity cap</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Staffing</TableHead>
                  <TableHead>Recommended ticket</TableHead>
                  <TableHead>Base acts/day</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {festivalSizeTiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-semibold">{tier.label}</TableCell>
                    <TableCell>{tier.capacityCap.toLocaleString()}</TableCell>
                    <TableCell>{formatDayRange(tier.dayRange)}</TableCell>
                    <TableCell className="capitalize">{tier.staffLevel}</TableCell>
                    <TableCell>{formatPriceRange(tier.recommendedTicketPrice)}</TableCell>
                    <TableCell>{tier.baseActsPerDay}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tier.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Licensing &amp; setup costs</CardTitle>
            <CardDescription>
              Licenses unlock per-tier capacity and determine the annual upkeep; staffing outlay must be paid before booking.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">License unlock</TableHead>
                  <TableHead className="text-right">Annual renewal</TableHead>
                  <TableHead className="text-right">Staffing (one-off)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {festivalLicenseDetails.map((detail) => (
                  <TableRow key={detail.sizeTier}>
                    <TableCell className="font-medium">{tierLabelLookup[detail.sizeTier]}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(detail.unlockCost)}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(detail.annualRenewal)}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(detail.oneOffStaffingCost)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{detail.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Operational cost coefficients</CardTitle>
            <CardDescription>
              Admin balance sheet tools can tweak these coefficients; they seed festival_costs rows each edition.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Security / day</TableHead>
                  <TableHead className="text-right">Insurance</TableHead>
                  <TableHead className="text-right">Stage / day</TableHead>
                  <TableHead className="text-right">Waste &amp; permits</TableHead>
                  <TableHead className="text-right">Marketing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {festivalCostProfiles.map((profile) => (
                  <TableRow key={profile.sizeTier}>
                    <TableCell className="font-medium">{tierLabelLookup[profile.sizeTier]}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(profile.securityPerDay)}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(profile.insuranceFlat)}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(profile.stagePerDay)}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(profile.wastePermits)}</TableCell>
                    <TableCell className="text-right">{currencyFormatter.format(profile.marketingFlat)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Profit &amp; loss anatomy</h2>
            <p className="text-sm text-muted-foreground">
              Every revenue stream and cost bucket ties directly into forecast guidance and final settlement.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <LineChart className="h-3.5 w-3.5" /> Full-stack P&amp;L
          </Badge>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {profitStreams.map((stream) => (
            <Card key={stream.id} className="h-full border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">{stream.title}</CardTitle>
                <CardDescription>{stream.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {stream.levers.map((lever) => (
                    <li key={lever} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span>{lever}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Pricing &amp; demand signals</h2>
            <p className="text-sm text-muted-foreground">
              Ticket elasticity feeds demand forecasts, while F&amp;B and merch tiers influence secondary spend and sentiment.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <TrendingUp className="h-3.5 w-3.5" /> Elastic modelling
          </Badge>
        </div>
        <Tabs defaultValue="ticketing" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="ticketing" className="text-xs sm:text-sm">Demand factors</TabsTrigger>
            <TabsTrigger value="spend" className="text-xs sm:text-sm">F&amp;B &amp; merch tiers</TabsTrigger>
            <TabsTrigger value="interplay" className="text-xs sm:text-sm">Systems interplay</TabsTrigger>
          </TabsList>
          <TabsContent value="ticketing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily demand index</CardTitle>
                <CardDescription>
                  Demand is capped at 115% of capacity and blends hype, lineup, pricing, sentiment, and weather modifiers.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factor</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demandFactors.map((factor) => (
                      <TableRow key={factor.id}>
                        <TableCell className="font-medium">{factor.label}</TableCell>
                        <TableCell className="text-right">{percentageFormatter.format(factor.weight)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="space-y-1">
                            <p>{factor.description}</p>
                            {factor.notes ? <p className="text-xs text-muted-foreground/80">{factor.notes}</p> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="spend" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-3">
              {Object.entries(pricingByCategory).map(([category, tiers]) => (
                <Card key={category} className="h-full">
                  <CardHeader>
                    <CardTitle className="capitalize">{category}</CardTitle>
                    <CardDescription>Per-head spend assumptions with attach modifiers.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tier</TableHead>
                          <TableHead className="text-right">Spend/head</TableHead>
                          <TableHead className="text-right">Attach Δ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tiers.map((tier) => (
                          <TableRow key={`${category}-${tier.tier}`}>
                            <TableCell className="capitalize font-medium">{tier.tier}</TableCell>
                            <TableCell className="text-right">{currencyFormatter.format(tier.spendPerHead)}</TableCell>
                            <TableCell className="text-right">
                              {tier.attachRateModifier === 1
                                ? "±0%"
                                : `${tier.attachRateModifier > 1 ? "+" : ""}${Math.round((tier.attachRateModifier - 1) * 100)}%`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="space-y-2 px-4 pb-4 text-xs text-muted-foreground">
                      {tiers.map((tier) => (
                        <p key={`${category}-${tier.tier}-notes`}>
                          <span className="capitalize font-semibold">{tier.tier}:</span> {tier.notes}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="interplay" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {systemsInterplay.map((system) => (
                <Card key={system.id} className="h-full">
                  <CardHeader>
                    <CardTitle>{system.title}</CardTitle>
                    <CardDescription>{system.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{system.impact}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Lifecycle &amp; progression</h2>
            <p className="text-sm text-muted-foreground">
              From license purchase through settlement, each stage updates the data model and drives Next Year Preview logic.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <CalendarDays className="h-3.5 w-3.5" /> Multi-year readiness
          </Badge>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {lifecycleBeats.map((beat) => (
            <Card key={beat.id} className="h-full border-dashed">
              <CardHeader>
                <CardTitle>{beat.title}</CardTitle>
                <CardDescription>{beat.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {beat.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Data model &amp; services</h2>
            <p className="text-sm text-muted-foreground">
              SQLite-first schema is ready to expand; API endpoints and background jobs complete the lifecycle orchestration.
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2 text-xs uppercase">
            <Network className="h-3.5 w-3.5" /> Service mesh draft
          </Badge>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Core tables</CardTitle>
            <CardDescription>Key tables grouped by domain (core, booking, operations, reporting).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Key fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataModelTables.map((table) => (
                  <TableRow key={table.name}>
                    <TableCell className="font-medium">{table.name}</TableCell>
                    <TableCell className="capitalize">{table.scope}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{table.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground/80">
                      {table.keyFields.join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>API surface</CardTitle>
              <CardDescription>FastAPI-friendly endpoints connect admin tooling, player flow, and background automation.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiEndpoints.map((endpoint) => (
                    <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                      <TableCell className="font-medium">{endpoint.method}</TableCell>
                      <TableCell className="font-mono text-xs">{endpoint.path}</TableCell>
                      <TableCell className="capitalize">{endpoint.focus}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{endpoint.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Background jobs &amp; calculators</CardTitle>
              <CardDescription>Nightly and hourly jobs keep forecasts fresh while calculators drive UI hints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background jobs</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {backgroundJobs.map((job) => (
                    <li key={job.id} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span>
                        <span className="font-medium capitalize">{job.cadence}:</span> {job.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculators</p>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {calculators.map((calc) => (
                    <li key={calc.id} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden />
                      <span>
                        <span className="font-medium">{calc.title}:</span> {calc.summary}
                        <br />
                        <span className="text-xs text-muted-foreground/80">Inputs: {calc.keyInputs.join(", ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
        Festival intel now spans hype, pricing, sponsors, and sentiment in one place. As live data feeds come online, this hub
        will evolve from blueprint to operational console, mirroring the end-to-end flow players and admins will use to run
        unforgettable seasons.
      </footer>
    </div>
  );
}
