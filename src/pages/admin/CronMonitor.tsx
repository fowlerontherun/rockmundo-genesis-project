import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/lib/supabase-types";
import type { PostgrestError } from "@supabase/supabase-js";

type CronJobSummary = Tables<"admin_cron_job_summary">;
type CronJobRun = Tables<"admin_cron_job_runs">;

const numberFormatter = new Intl.NumberFormat();

const formatTimestamp = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  return `${formatDistanceToNow(date, { addSuffix: true })}`;
};

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
};

const isMissingRpcFunctionError = (error: PostgrestError) =>
  typeof error?.message === "string" &&
  error.message.includes("Could not find the function") &&
  error.message.includes("schema cache");

export default function CronMonitor() {
  const { toast } = useToast();
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const {
    data: jobSummary,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["admin_cron_job_summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_cron_job_summary");
      if (error) {
        if (isMissingRpcFunctionError(error)) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("admin_cron_job_summary")
            .select("*")
            .order("display_name");
          if (fallbackError) throw fallbackError;
          return (fallbackData ?? []) as CronJobSummary[];
        }
        throw error;
      }
      return (data ?? []) as CronJobSummary[];
    },
    refetchInterval: 60000,
  });

  const {
    data: recentRuns,
    isLoading: isRunsLoading,
    isFetching: isRunsFetching,
    error: runsError,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ["admin_cron_job_runs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_cron_job_runs", { _limit: 50 });
      if (error) {
        if (isMissingRpcFunctionError(error)) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("admin_cron_job_runs")
            .select("*")
            .order("started_at", { ascending: false })
            .limit(50);
          if (fallbackError) throw fallbackError;
          return (fallbackData ?? []) as CronJobRun[];
        }
        throw error;
      }
      return (data ?? []) as CronJobRun[];
    },
    refetchInterval: 60000,
  });

  const runsByJob = useMemo(() => {
    const grouped: Record<string, CronJobRun[]> = {};
    for (const run of recentRuns || []) {
      if (!grouped[run.job_name]) {
        grouped[run.job_name] = [];
      }
      grouped[run.job_name].push(run);
    }
    return grouped;
  }, [recentRuns]);

  const manualJobs = useMemo(
    () =>
      (jobSummary || []).filter(
        (job) => job.allow_manual_trigger && (job.edge_function_name || job.job_name)
      ),
    [jobSummary]
  );

  const handleRefresh = async () => {
    await Promise.all([refetchSummary(), refetchRuns()]);
    toast({
      title: "Data refreshed",
      description: "Cron job metrics have been updated",
    });
  };

  const handleManualTrigger = async (job: CronJobSummary) => {
    const functionName = job.edge_function_name || job.job_name;
    setTriggeringJob(job.job_name);
    try {
      const { error } = await supabase.functions.invoke(functionName, {
        headers: { "x-triggered-by": "admin_manual_trigger" },
        body: {
          triggeredBy: "admin_manual_trigger",
          jobName: job.job_name,
        },
      });
      if (error) throw error;

      toast({
        title: "Function triggered",
        description: `${job.display_name} ran successfully`,
      });
      await Promise.all([refetchSummary(), refetchRuns()]);
    } catch (error: any) {
      toast({
        title: "Error triggering function",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTriggeringJob(null);
    }
  };

  const isRefreshing = isSummaryFetching || isRunsFetching;

  const renderJobStatusBadge = (job: CronJobSummary) => {
    const status = job.last_run_status;
    if (!status) return <Badge variant="outline">No Runs</Badge>;
    if (status === "success") return <Badge variant="secondary">Success</Badge>;
    if (status === "error") return <Badge variant="destructive">Failed</Badge>;
    return <Badge>Running</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Cron Job Monitor</h1>
          <p className="text-muted-foreground">Monitor and manage automated background tasks</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {summaryError && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load job summary</AlertTitle>
          <AlertDescription>{summaryError.message}</AlertDescription>
        </Alert>
      )}

      {runsError && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load recent runs</AlertTitle>
          <AlertDescription>{runsError.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job Overview</CardTitle>
          <CardDescription>Execution history and health for registered cron jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {isSummaryLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Total Runs</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Avg Duration</TableHead>
                  <TableHead>Last Manual Trigger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(jobSummary || []).map((job) => {
                  const successRate =
                    job.total_runs && job.total_runs > 0
                      ? `${Math.round(((job.success_runs || 0) / job.total_runs) * 1000) / 10}%`
                      : "—";
                  return (
                    <TableRow key={job.job_name}>
                      <TableCell>
                        <div className="font-medium">{job.display_name}</div>
                        <div className="text-xs text-muted-foreground">{job.description}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.schedule || "—"}</TableCell>
                      <TableCell>{renderJobStatusBadge(job)}</TableCell>
                      <TableCell className="text-sm">{formatTimestamp(job.last_run_started_at)}</TableCell>
                      <TableCell className="text-sm">
                        {job.total_runs !== null && job.total_runs !== undefined
                          ? numberFormatter.format(job.total_runs)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{successRate}</TableCell>
                      <TableCell className="text-sm">{formatDuration(job.avg_duration_ms || undefined)}</TableCell>
                      <TableCell className="text-sm">{formatTimestamp(job.last_manual_trigger_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {manualJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Edge Function Controls</CardTitle>
            <CardDescription>Trigger background jobs immediately for debugging or catch-up</CardDescription>
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {manualJobs.map((job) => (
                  <Card key={job.job_name}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{job.display_name}</CardTitle>
                          <CardDescription className="text-sm mt-1">{job.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {job.schedule || "—"}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManualTrigger(job)}
                          disabled={triggeringJob === job.job_name}
                        >
                          {triggeringJob === job.job_name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Trigger Now"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>Latest executions across all cron jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {isRunsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Triggered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentRuns || []).slice(0, 15).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="font-medium">{run.job_name}</div>
                      {run.error_message && (
                        <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                          {run.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {run.status === "success" && <Badge variant="secondary">Success</Badge>}
                      {run.status === "error" && <Badge variant="destructive">Failed</Badge>}
                      {run.status === "running" && <Badge>Running</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{formatTimestamp(run.started_at)}</TableCell>
                    <TableCell className="text-sm">{formatDuration(run.duration_ms || undefined)}</TableCell>
                    <TableCell className="text-sm">
                      {run.processed_count !== null && run.processed_count !== undefined
                        ? numberFormatter.format(run.processed_count)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.error_count !== null && run.error_count !== undefined
                        ? numberFormatter.format(run.error_count)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.triggered_by || "cron"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
