import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, XCircle, TrendingUp, Users, Gauge } from "lucide-react";
import type { SubmissionEvaluation, SubmissionFactor } from "@/hooks/useMediaBenchmarks";

interface SubmissionScoreBreakdownProps {
  evaluation?: SubmissionEvaluation | null;
  isLoading?: boolean;
  compact?: boolean;
}

const statusStyles: Record<SubmissionFactor["status"], string> = {
  good: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-destructive",
};

function ChanceIcon({ chance }: { chance: number }) {
  if (chance >= 70) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (chance >= 40) return <AlertCircle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export function SubmissionScoreBreakdown({
  evaluation,
  isLoading,
  compact = false,
}: SubmissionScoreBreakdownProps) {
  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!evaluation || evaluation.error) return null;

  const chance = Number(evaluation.chance ?? 0);
  const factors = Array.isArray(evaluation.factors) ? evaluation.factors : [];
  const bench = evaluation.benchmarks;
  const outlet = evaluation.station_name ?? evaluation.outlet_name;
  const tier = evaluation.station_tier ?? evaluation.outlet_tier;
  const chanceColor =
    chance >= 70 ? "text-emerald-500" : chance >= 40 ? "text-amber-500" : "text-destructive";

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{outlet ?? "Acceptance chance"}</p>
          <p className="text-[11px] text-muted-foreground">{evaluation.verdict}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ChanceIcon chance={chance} />
          <span className={`font-bold ${chanceColor}`}>{chance}%</span>
          {tier != null && (
            <Badge variant="outline" className="text-[10px]">
              Tier {tier}
            </Badge>
          )}
        </div>
      </div>

      <Progress value={chance} className="h-2" />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          Market bar {evaluation.quality_bar}
          {evaluation.song_quality != null && ` · your song ${evaluation.song_quality}`}
          {evaluation.band_avg_quality != null && ` · your catalogue ${evaluation.band_avg_quality}`}
        </span>
        {evaluation.projected_weekly_plays != null && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />~{evaluation.projected_weekly_plays} plays/week
          </span>
        )}
        {evaluation.projected_weekly_reach != null && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />~{evaluation.projected_weekly_reach.toLocaleString()} listeners
          </span>
        )}
      </div>

      {!compact && factors.length > 0 && (
        <ul className="space-y-1 pt-1">
          {factors.map((factor, index) => (
            <li key={`${factor.label}-${index}`} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{factor.label}:</span> {factor.detail}
              </span>
              <span className={`shrink-0 font-semibold ${statusStyles[factor.status] ?? ""}`}>
                {factor.delta > 0 ? `+${factor.delta}` : factor.delta}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!compact && bench && (
        <p className="border-t pt-2 text-[10px] text-muted-foreground">
          Standards scale with the world: {bench.active_bands} active bands, {bench.active_characters} characters,
          average recorded quality {bench.avg_song_quality}.
        </p>
      )}
    </div>
  );
}
