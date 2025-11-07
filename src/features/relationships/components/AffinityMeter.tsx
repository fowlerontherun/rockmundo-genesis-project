import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RelationshipSummary } from "../types";
import { FRIENDSHIP_TIERS } from "../config";

interface AffinityMeterProps {
  summary: RelationshipSummary;
}

export function AffinityMeter({ summary }: AffinityMeterProps) {
  const nextTier = FRIENDSHIP_TIERS.find((tier) => tier.minAffinity > summary.tierMinimum) ?? null;
  const progressPercentage = Math.round(summary.progressToNextTier * 100);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Affinity Meter</CardTitle>
          <CardDescription>Track your bond strength and upcoming perks.</CardDescription>
        </div>
        <Badge variant="secondary" className="text-sm">
          {summary.tierLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{summary.affinityScore} affinity</span>
            <span>
              {nextTier
                ? `${progressPercentage}% to ${nextTier.label}`
                : "Maxed friendship"}
            </span>
          </div>
          <Progress value={summary.progressToNextTier * 100} className="mt-2" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unlocked perks</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {FRIENDSHIP_TIERS.find((tier) => tier.id === summary.tierId)?.perks.map((perk) => (
                <li key={perk}>• {perk}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Collaboration boosts</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {FRIENDSHIP_TIERS.find((tier) => tier.id === summary.tierId)?.collabBoosts.map((boost) => (
                <li key={boost}>• {boost}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Milestones</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.milestoneProgress.map((milestone) => (
              <div key={milestone.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-semibold">{milestone.label}</p>
                  <p className="text-xs text-muted-foreground">Target {milestone.threshold} affinity</p>
                </div>
                <Badge variant={milestone.achieved ? "default" : "outline"}>
                  {milestone.achieved ? "Unlocked" : "Locked"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

