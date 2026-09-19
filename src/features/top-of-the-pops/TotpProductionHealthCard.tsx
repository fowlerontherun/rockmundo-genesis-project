import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTotpReleaseHealth, totpHealthFailures } from "./releaseHealthApi";

function formatLondonDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function StatusBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <Badge variant={ready ? "secondary" : "destructive"} className="gap-1">
      {ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

export function TotpProductionHealthCard() {
  const health = useQuery({
    queryKey: ["totp", "release-health"],
    queryFn: getTotpReleaseHealth,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (health.isLoading) {
    return (
      <Card aria-label="Checking production health">
        <CardHeader><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-full max-w-xl" /></CardHeader>
        <CardContent className="flex gap-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-6 w-28" /><Skeleton className="h-6 w-28" /></CardContent>
      </Card>
    );
  }

  if (health.isError || !health.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Production health unavailable</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{health.error instanceof Error ? health.error.message : "The show readiness check could not be loaded."}</span>
          <Button size="sm" variant="outline" onClick={() => void health.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const report = health.data;
  const failures = totpHealthFailures(report);
  return (
    <Card className={report.healthy ? "border-emerald-500/35" : "border-destructive/50"} data-totp-production-health={report.healthy ? "ready" : "attention"}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Production health</CardTitle>
            <CardDescription className="mt-1">Live checks for the chart feed, episode schedule and automatic show jobs.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={report.healthy ? "secondary" : "destructive"}>{report.healthy ? "Ready" : "Action required"}</Badge>
            <Button size="icon" variant="ghost" aria-label="Refresh production health" onClick={() => void health.refetch()} disabled={health.isFetching}>
              <RefreshCw className={`h-4 w-4 ${health.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4" aria-live="polite">
        <div className="flex flex-wrap gap-2">
          <StatusBadge ready={report.chart.fresh} label="UK charts" />
          <StatusBadge ready={report.crons.prepare} label="Episode preparation" />
          <StatusBadge ready={report.crons.uk_chart_refresh} label="Chart refresh" />
          <StatusBadge ready={report.crons.broadcast_cycle} label="Broadcast cycle" />
          <StatusBadge ready={report.invalid_totp_notifications === 0} label="Notifications" />
        </div>
        {failures.length > 0 ? (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Resolve before transmission</AlertTitle><AlertDescription>{failures.join(" · ")}</AlertDescription></Alert>
        ) : null}
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-xs font-medium text-muted-foreground">Latest UK chart snapshot</div>
            <div className="mt-1 font-semibold">{report.chart.latest_date ?? "Missing"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{report.chart.streaming_rows} streaming · {report.chart.digital_rows} digital sales</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Next episode</div>
            {report.next_episode ? <><div className="mt-1 font-semibold">Episode #{report.next_episode.episode_number} · {report.next_episode.status}</div><div className="mt-1 text-xs text-muted-foreground">{formatLondonDateTime(report.next_episode.broadcast_at)} London time · {report.next_episode.invitations} invitations</div></> : <div className="mt-1 font-semibold text-destructive">Not scheduled</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TotpProductionHealthCard;