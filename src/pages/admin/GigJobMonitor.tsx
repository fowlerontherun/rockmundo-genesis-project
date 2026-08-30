import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Loader2, PlayCircle, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GIG_JOBS = ["auto-complete-gigs", "auto-start-gigs"] as const;

interface JobRun {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  duration_ms: number | null;
  processed_count: number | null;
  error_count: number | null;
  error_message: string | null;
  result_summary: unknown;
  triggered_by: string | null;
}

interface GigRow {
  id: string;
  status: string;
  scheduled_date: string | null;
  started_at: string | null;
  current_song_position: number | null;
  setlist_id: string | null;
  band_id: string | null;
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  return `${format(date, "d MMM yyyy HH:mm:ss")} (${formatDistanceToNow(date, { addSuffix: true })})`;
};

const formatDuration = (durationMs?: number | null) =>
  !durationMs ? "—" : durationMs < 1000 ? `${durationMs} ms` : `${(durationMs / 1000).toFixed(1)} s`;

const statusBadge = (status?: string | null) => {
  if (!status) return <Badge variant="outline">No runs</Badge>;
  if (status === "success") return <Badge variant="secondary">Success</Badge>;
  if (status === "error" || status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge>{status}</Badge>;
};

export default function GigJobMonitor() {
  const { toast } = useToast();
  const [triggering, setTriggering] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ["admin-gig-job-runs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cron_job_runs")
        .select("*")
        .in("job_name", GIG_JOBS as unknown as string[])
        .order("started_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as JobRun[];
    },
    refetchInterval: 30000,
  });

  const configQuery = useQuery({
    queryKey: ["admin-gig-job-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cron_job_config")
        .select("job_name, display_name, edge_function_name, schedule, is_active, description")
        .in("edge_function_name", GIG_JOBS as unknown as string[]);
      if (error) throw error;
      return (data ?? []) as Array<{
        job_name: string;
        display_name: string;
        edge_function_name: string;
        schedule: string | null;
        is_active: boolean | null;
        description: string | null;
      }>;
    },
  });

  const pipelineQuery = useQuery({
    queryKey: ["admin-gig-pipeline"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gigs")
        .select("id, status, scheduled_date, started_at, current_song_position, setlist_id, band_id")
        .in("status", ["scheduled", "in_progress", "ready_for_completion", "processing_outcome", "failed"])
        .order("scheduled_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as GigRow[];
    },
    refetchInterval: 30000,
  });

  const runsByJob = useMemo(() => {
    const grouped: Record<string, JobRun[]> = {};
    for (const run of runsQuery.data ?? []) {
      grouped[run.job_name] = grouped[run.job_name] ?? [];
      grouped[run.job_name].push(run);
    }
    return grouped;
  }, [runsQuery.data]);

  const overdue = useMemo(() => {
    const now = Date.now();
    const rows = pipelineQuery.data ?? [];
    return {
      overdueScheduled: rows.filter(
        (g) => g.status === "scheduled" && g.scheduled_date && new Date(g.scheduled_date).getTime() < now,
      ),
      stuckInProgress: rows.filter((g) => g.status === "in_progress"),
      awaitingCompletion: rows.filter(
        (g) => g.status === "ready_for_completion" || g.status === "processing_outcome",
      ),
      failed: rows.filter((g) => g.status === "failed"),
    };
  }, [pipelineQuery.data]);

  const refreshAll = async () => {
    await Promise.all([runsQuery.refetch(), configQuery.refetch(), pipelineQuery.refetch()]);
    toast({ title: "Refreshed", description: "Gig job data reloaded." });
  };

  const trigger = async (functionName: string) => {
    setTriggering(functionName);
    try {
      const { error } = await supabase.functions.invoke(functionName, {
        headers: { "x-triggered-by": "admin_manual_trigger" },
        body: { triggeredBy: "admin_manual_trigger" },
      });
      if (error) throw error;
      toast({ title: "Job triggered", description: `${functionName} ran. Reloading results…` });
      await Promise.all([runsQuery.refetch(), pipelineQuery.refetch()]);
    } catch (error) {
      toast({
        title: "Trigger failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTriggering(null);
    }
  };

  const isRefreshing = runsQuery.isFetching || pipelineQuery.isFetching;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Gig Job Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Last run time, status and logs for the automated gig start/complete workers.
          </p>
        </div>
        <Button variant="outline" onClick={refreshAll} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {runsQuery.error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load job runs</AlertTitle>
          <AlertDescription>{(runsQuery.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {GIG_JOBS.map((jobName) => {
          const config = (configQuery.data ?? []).find((c) => c.edge_function_name === jobName);
          const runs = runsByJob[jobName] ?? [];
          const last = runs[0];
          const failures = runs.filter((r) => r.status === "error" || r.status === "failed").length;
          return (
            <Card key={jobName}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{config?.display_name ?? jobName}</CardTitle>
                    <CardDescription className="text-xs">{jobName}</CardDescription>
                  </div>
                  {statusBadge(last?.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="font-mono text-xs">{config?.schedule ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Active</span>
                  <span>{config?.is_active === false ? "Disabled" : "Enabled"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Last run</span>
                  <span className="text-right text-xs">{formatTimestamp(last?.started_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{formatDuration(last?.duration_ms)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Items processed (last run)</span>
                  <span>{last?.processed_count ?? 0}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Failures (last {runs.length} runs)</span>
                  <span>{failures}</span>
                </div>
                {last?.error_message && (
                  <Alert variant="destructive">
                    <AlertTitle className="text-xs">Last error</AlertTitle>
                    <AlertDescription className="break-words text-xs">{last.error_message}</AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => trigger(jobName)}
                  disabled={triggering === jobName}
                >
                  {triggering === jobName ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  Run now
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gig pipeline health</CardTitle>
          <CardDescription>
            The workers only act on gigs in the right state — these counts show where gigs are stuck.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pipelineQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Overdue, still scheduled", value: overdue.overdueScheduled.length, warn: true },
                { label: "In progress", value: overdue.stuckInProgress.length, warn: false },
                { label: "Awaiting completion", value: overdue.awaitingCompletion.length, warn: true },
                { label: "Failed", value: overdue.failed.length, warn: true },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card p-3">
                  <div
                    className={`text-2xl font-bold ${stat.warn && stat.value > 0 ? "text-destructive" : ""}`}
                  >
                    {stat.value}
                  </div>
                  <div className="text-[11px] leading-tight text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {overdue.overdueScheduled.length > 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Gigs past their start time are still &ldquo;scheduled&rdquo;</AlertTitle>
              <AlertDescription className="text-xs">
                <code>auto-complete-gigs</code> only touches gigs with status <code>in_progress</code>. If these
                never move to <code>in_progress</code>, the problem is in <code>auto-start-gigs</code>, not the
                completion worker.
              </AlertDescription>
            </Alert>
          )}

          {(overdue.overdueScheduled.length > 0 ||
            overdue.stuckInProgress.length > 0 ||
            overdue.awaitingCompletion.length > 0) && (
            <ScrollArea className="mt-4 max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gig</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Song pos.</TableHead>
                    <TableHead>Setlist</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...overdue.overdueScheduled,
                    ...overdue.stuckInProgress,
                    ...overdue.awaitingCompletion,
                    ...overdue.failed,
                  ].map((gig) => (
                    <TableRow key={gig.id}>
                      <TableCell className="font-mono text-[11px]">{gig.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant={gig.status === "in_progress" ? "default" : "outline"}>{gig.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {gig.scheduled_date ? format(new Date(gig.scheduled_date), "d MMM HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {gig.started_at ? format(new Date(gig.started_at), "d MMM HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{gig.current_song_position ?? "—"}</TableCell>
                      <TableCell className="text-xs">{gig.setlist_id ? "Yes" : "Missing"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Run log</CardTitle>
          <CardDescription>Most recent 60 worker executions with their result payloads</CardDescription>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (runsQuery.data ?? []).length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> No runs recorded yet.
            </div>
          ) : (
            <ScrollArea className="max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Result / error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runsQuery.data ?? []).map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="text-xs">{run.job_name}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(run.started_at), "d MMM HH:mm:ss")}
                      </TableCell>
                      <TableCell>{statusBadge(run.status)}</TableCell>
                      <TableCell className="text-xs">{formatDuration(run.duration_ms)}</TableCell>
                      <TableCell className="text-xs">{run.processed_count ?? 0}</TableCell>
                      <TableCell className="text-xs">{run.triggered_by ?? "cron"}</TableCell>
                      <TableCell className="max-w-[280px]">
                        {run.error_message ? (
                          <span className="break-words text-xs text-destructive">{run.error_message}</span>
                        ) : (
                          <code className="break-words text-[11px] text-muted-foreground">
                            {run.result_summary ? JSON.stringify(run.result_summary) : "—"}
                          </code>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
