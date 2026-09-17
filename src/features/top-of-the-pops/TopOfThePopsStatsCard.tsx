import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award, CalendarDays, Crown, Star, Tv2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTotpBandStats } from "./api";

interface TopOfThePopsStatsCardProps {
  bandId: string;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value || 0);
}

export function TopOfThePopsStatsCard({ bandId }: TopOfThePopsStatsCardProps) {
  const stats = useQuery({
    queryKey: ["totp", "band-stats", bandId],
    queryFn: () => getTotpBandStats(bandId),
    enabled: !!bandId,
    staleTime: 60_000,
  });

  if (stats.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (stats.isError) return null;

  const data = stats.data;
  if (!data || data.appearances === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tv2 className="h-5 w-5 text-primary" />
              Top of the Pops résumé
            </CardTitle>
            <CardDescription>
              Permanent television appearances earned from UK chart success.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/top-of-the-pops">View broadcast archive</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <Tv2 className="mx-auto mb-1 h-5 w-5 text-primary" />
            <div className="text-2xl font-bold">{data.appearances}</div>
            <div className="text-xs text-muted-foreground">Appearances</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <Award className="mx-auto mb-1 h-5 w-5 text-primary" />
            <div className="text-2xl font-bold">{data.best_chart_rank ? `#${data.best_chart_rank}` : "—"}</div>
            <div className="text-xs text-muted-foreground">Best chart rank</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <Crown className="mx-auto mb-1 h-5 w-5 text-amber-500" />
            <div className="text-2xl font-bold">{data.number_one_appearances}</div>
            <div className="text-xs text-muted-foreground">#1 appearances</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <Star className="mx-auto mb-1 h-5 w-5 text-yellow-500" />
            <div className="text-2xl font-bold">{data.top_10_appearances}</div>
            <div className="text-xs text-muted-foreground">Top 10 appearances</div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <Star className="mx-auto mb-1 h-5 w-5 text-primary" />
            <div className="text-2xl font-bold">{formatNumber(data.total_fame_awarded)}</div>
            <div className="text-xs text-muted-foreground">TOTP fame earned</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>First appearance {formatDate(data.first_appearance)}</span>
          <span aria-hidden="true">•</span>
          <span>Latest {formatDate(data.latest_appearance)}</span>
          {data.number_one_appearances > 0 && <Badge variant="secondary">UK #1 performer</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
