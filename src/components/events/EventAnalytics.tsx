import { useMemo } from "react";
import { Activity, BarChart3, CalendarDays, DollarSign, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { LineupSlot, PricingStrategyState, SponsorPackage, TicketTier } from "./types";

interface EventAnalyticsProps {
  eventName: string;
  eventDate?: string;
  venue?: string;
  lineup: LineupSlot[];
  sponsors: SponsorPackage[];
  ticketTiers: TicketTier[];
  pricing: PricingStrategyState;
}

const chartConfig = {
  potential: {
    label: "Potential revenue",
    color: "hsl(var(--chart-1))",
  },
  sold: {
    label: "Confirmed revenue",
    color: "hsl(var(--chart-2))",
  },
};

export const EventAnalytics = ({ eventName, eventDate, venue, lineup, sponsors, ticketTiers, pricing }: EventAnalyticsProps) => {
  const totalSponsors = sponsors.length;
  const totalContribution = useMemo(() => sponsors.reduce((total, sponsor) => total + sponsor.contribution, 0), [sponsors]);
  const totalCapacity = useMemo(() => ticketTiers.reduce((total, tier) => total + (tier.quantity || 0), 0), [ticketTiers]);
  const soldTickets = useMemo(() => ticketTiers.reduce((total, tier) => total + (tier.tickets_sold || 0), 0), [ticketTiers]);
  const potentialRevenue = useMemo(
    () => ticketTiers.reduce((total, tier) => total + tier.price * (tier.quantity || 0), 0),
    [ticketTiers],
  );
  const confirmedRevenue = useMemo(
    () => ticketTiers.reduce((total, tier) => total + tier.price * (tier.tickets_sold || 0), 0),
    [ticketTiers],
  );

  const revenueChartData = useMemo(
    () =>
      ticketTiers.map((tier) => ({
        name: tier.name,
        potential: Number((tier.price * (tier.quantity || 0)).toFixed(2)),
        sold: Number((tier.price * (tier.tickets_sold || 0)).toFixed(2)),
      })),
    [ticketTiers],
  );

  const demandScore = pricing.demandScore;
  const lineupEnergyScore = Math.min(100, lineup.length * 12 + demandScore / 2);
  const sponsorImpactScore = Math.min(100, totalContribution / 1000 + totalSponsors * 8);
  const breakEvenCoverage = pricing.breakEvenCost
    ? Number(((totalContribution + confirmedRevenue) / pricing.breakEvenCost * 100).toFixed(1))
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl">Event analytics</CardTitle>
            <Badge variant="secondary">{lineup.length} lineup items</Badge>
            <Badge variant="outline">{totalSponsors} sponsors</Badge>
            <Badge variant="outline">{totalCapacity.toLocaleString()} tickets modelled</Badge>
          </div>
          <CardDescription>
            {eventName ? `${eventName} • ` : ""}
            {eventDate ? `Scheduled ${eventDate}` : "Date TBD"}
            {venue ? ` • ${venue}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">Potential revenue</p>
            <p className="text-2xl font-semibold">${potentialRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Includes all tiers at full allocation.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">Confirmed revenue</p>
            <p className="text-2xl font-semibold">${confirmedRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Based on reported tickets sold per tier.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">Sponsor leverage</p>
            <p className="text-2xl font-semibold">${totalContribution.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Cash and in-kind commitments currently confirmed.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">Break-even coverage</p>
            <p className="text-2xl font-semibold">{breakEvenCoverage.toLocaleString()}%</p>
            <p className="text-xs text-muted-foreground">
              Tracks how combined revenue and sponsorship offsets core production costs.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ticket revenue mix</CardTitle>
          <CardDescription>Compare the potential versus confirmed revenue across each tier.</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueChartData.length === 0 ? (
            <div className="flex h-60 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Add ticket tiers to project revenue distribution.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="potential" fill="var(--color-potential)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sold" fill="var(--color-sold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operational signals</CardTitle>
          <CardDescription>Key health indicators for programming, sponsorship, and sales velocity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Lineup energy</p>
            </div>
            <p className="mt-2 text-2xl font-semibold">{lineupEnergyScore}</p>
            <p className="text-xs text-muted-foreground">Based on lineup depth, diversity, and pricing demand.</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Sponsor impact</p>
            </div>
            <p className="mt-2 text-2xl font-semibold">{sponsorImpactScore.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Weight of partnerships and activation commitments.</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Revenue pacing</p>
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {soldTickets}/{totalCapacity} tickets
            </p>
            <p className="text-xs text-muted-foreground">Track conversion to adjust marketing spend and offers.</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Planning momentum</p>
            </div>
            <p className="mt-2 text-2xl font-semibold">{Math.min(100, lineup.length * 10 + totalSponsors * 5)}</p>
            <p className="text-xs text-muted-foreground">Mix of programming and sponsor traction across weeks.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Action checklist</CardTitle>
          <CardDescription>Next best moves to keep your event plan on pace.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                Close the loop on high-yield tiers to move break-even coverage toward 100%. Consider flash sales for slower
                segments.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                Reconfirm artist arrival windows to maintain lineup energy at {lineupEnergyScore} and avoid production gaps.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Activity className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                Align sponsor activation plans with crowd peaks to maximize the {sponsorImpactScore.toLocaleString()} impact score.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
