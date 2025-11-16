import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, RefreshCcw, Sparkles, Waveform, Clock3, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { AdminRoute } from "@/components/AdminRoute";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

const MAX_QUEUE_ROWS = 8;

type RecordingSessionPreview = Pick<
  Tables<"recording_sessions">,
  "id" | "stage" | "status" | "started_at" | "completed_at" | "total_takes" | "quality_gain"
>;

type PromptWithSession = Tables<"audio_generation_prompts"> & {
  session: RecordingSessionPreview | null;
};

type ResultWithRelations = Tables<"audio_generation_results"> & {
  prompt: Pick<Tables<"audio_generation_prompts">, "id" | "prompt_text" | "target_model" | "status" | "created_at"> | null;
  session: RecordingSessionPreview | null;
};

type DashboardData = {
  prompts: PromptWithSession[];
  results: ResultWithRelations[];
};

const fetchDashboardData = async (): Promise<DashboardData> => {
  const [promptResponse, resultResponse] = await Promise.all([
    supabase
      .from("audio_generation_prompts")
      .select(
        `*,
        session:session_id (
          id,
          stage,
          status,
          started_at,
          completed_at,
          total_takes,
          quality_gain
        )`
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("audio_generation_results")
      .select(
        `*,
        prompt:prompt_id (
          id,
          prompt_text,
          target_model,
          status,
          created_at
        ),
        session:session_id (
          id,
          stage,
          status,
          started_at,
          completed_at,
          total_takes,
          quality_gain
        )`
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (promptResponse.error) {
    throw promptResponse.error;
  }

  if (resultResponse.error) {
    throw resultResponse.error;
  }

  return {
    prompts: (promptResponse.data ?? []) as PromptWithSession[],
    results: (resultResponse.data ?? []) as ResultWithRelations[],
  };
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString();
};

const formatCurrency = (cents?: number | null) => {
  if (typeof cents !== "number") return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

const PromptStatusBadge = ({ status }: { status: string }) => {
  const variant = (() => {
    switch (status) {
      case "pending":
        return "outline" as const;
      case "processing":
        return "secondary" as const;
      case "completed":
        return "default" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  })();

  return <Badge variant={variant}>{status}</Badge>;
};

const AudioGenerationDashboard = () => {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audio-generation-dashboard"],
    queryFn: fetchDashboardData,
    refetchInterval: 1000 * 60,
  });
  const [activeTab, setActiveTab] = useState<"all" | "flagged">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const prompts = data?.prompts ?? [];
  const results = data?.results ?? [];

  const metrics = useMemo(() => {
    const totalPrompts = prompts.length;
    const pending = prompts.filter((prompt) => prompt.status === "pending").length;
    const processing = prompts.filter((prompt) => prompt.status === "processing").length;
    const completed = prompts.filter((prompt) => prompt.status === "completed").length;
    const failed = prompts.filter((prompt) => prompt.status === "failed").length;
    const successRateBase = completed + failed;
    const successRate = successRateBase > 0 ? (completed / successRateBase) * 100 : 0;

    const latencyValues = results.map((result) => result.latency_ms).filter((value): value is number => typeof value === "number");
    const averageLatency = latencyValues.length > 0 ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : 0;

    const totalCostCents = results.reduce((sum, result) => sum + (result.cost_cents ?? 0), 0);
    const flagged = results.filter((result) => result.is_preferred).length;

    return {
      totalPrompts,
      pending,
      processing,
      completed,
      failed,
      successRate,
      averageLatency,
      totalCostCents,
      flagged,
    };
  }, [prompts, results]);

  const pendingQueue = useMemo(() => prompts.filter((prompt) => prompt.status !== "completed").slice(0, MAX_QUEUE_ROWS), [prompts]);

  const filteredResults = useMemo(
    () => (activeTab === "flagged" ? results.filter((result) => result.is_preferred) : results),
    [results, activeTab]
  );

  const handleToggleFlag = async (result: ResultWithRelations) => {
    try {
      setUpdatingId(result.id);
      const { error: updateError } = await supabase
        .from("audio_generation_results")
        .update({ is_preferred: !result.is_preferred })
        .eq("id", result.id);

      if (updateError) {
        throw updateError;
      }

      toast.success(result.is_preferred ? "Clip unflagged" : "Clip flagged as best");
      refetch();
    } catch (updateError) {
      toast.error("Unable to update clip", {
        description: updateError instanceof Error ? updateError.message : String(updateError),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (error) {
    return (
      <AdminRoute>
        <div className="container mx-auto max-w-5xl space-y-4 p-6">
          <Alert variant="destructive">
            <AlertTitle>Unable to load audio dashboard</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Audio Generation Dashboard</h1>
            <p className="text-muted-foreground">
              Review clip batches, compare them to the originating sessions, and flag the strongest takes for the music team.
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" disabled={isFetching}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total prompts</CardTitle>
              <Waveform className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalPrompts}</div>
              <p className="text-xs text-muted-foreground">{metrics.pending} queued · {metrics.processing} processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success rate</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</div>
              <Progress value={metrics.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg latency</CardTitle>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.averageLatency} ms</div>
              <p className="text-xs text-muted-foreground">Based on last {results.length} clips</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged best takes</CardTitle>
              <Flag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.flagged}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(metrics.totalCostCents)} spent</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>Track generation performance, latency, and costs per run.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Success vs. failures</p>
              <p className="text-2xl font-semibold">
                {metrics.completed} / {metrics.completed + metrics.failed}
              </p>
              <p className="text-xs text-muted-foreground">{metrics.failed} failures total</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average latency</p>
              <p className="text-2xl font-semibold">{metrics.averageLatency} ms</p>
              <p className="text-xs text-muted-foreground">Measured from the latest responses</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total cost</p>
              <div className="flex items-center gap-2 text-2xl font-semibold">
                <DollarSign className="h-5 w-5" />
                {(metrics.totalCostCents / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">All captured clips</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Generated clips</CardTitle>
              <CardDescription>Compare outputs with the source sessions and keep the strongest takes highlighted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "flagged")}>
                <TabsList>
                  <TabsTrigger value="all">All clips</TabsTrigger>
                  <TabsTrigger value="flagged">Flagged</TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading latest clips...</p>
              ) : filteredResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clips available for review yet.</p>
              ) : (
                <div className="space-y-4">
                  {filteredResults.map((result) => (
                    <Card key={result.id} className="border border-muted">
                      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <CardTitle className="text-lg">Session {result.session?.stage ?? "unknown stage"}</CardTitle>
                          <CardDescription>
                            Generated {formatDate(result.created_at)} · Model {result.model_version}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.is_preferred && <Badge variant="default">Flagged</Badge>}
                          <Badge variant="outline">{result.prompt?.target_model ?? result.model_version}</Badge>
                          <Badge variant="secondary">Seed {result.seed ?? "auto"}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-col gap-4 md:flex-row">
                          <div className="w-full md:w-1/2">
                            <audio controls className="w-full" src={result.audio_public_url} />
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-muted-foreground">Duration</p>
                                <p className="font-medium">{result.duration_seconds}s</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Latency</p>
                                <p className="font-medium">{result.latency_ms ?? 0} ms</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Cost</p>
                                <p className="font-medium">{formatCurrency(result.cost_cents)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Prompted</p>
                                <p className="font-medium">{formatDate(result.prompt?.created_at)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="w-full space-y-3 md:w-1/2">
                            <div>
                              <p className="text-sm font-semibold">Prompt</p>
                              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                                {result.prompt?.prompt_text?.slice(0, 260) ?? "—"}
                                {result.prompt && result.prompt.prompt_text.length > 260 ? "…" : ""}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Source session</p>
                              <div className="rounded-md border p-3 text-sm">
                                <p>
                                  Stage: <span className="font-medium">{result.session?.stage ?? "Unknown"}</span>
                                </p>
                                <p>
                                  Status: <span className="font-medium">{result.session?.status ?? "Unknown"}</span>
                                </p>
                                <p>
                                  Takes captured: <span className="font-medium">{result.session?.total_takes ?? 0}</span>
                                </p>
                                <p>
                                  Quality gain: <span className="font-medium">{result.session?.quality_gain ?? 0}</span>
                                </p>
                                <p className="text-muted-foreground">Started {formatDate(result.session?.started_at)}</p>
                                <p className="text-muted-foreground">Completed {formatDate(result.session?.completed_at)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant={result.is_preferred ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => handleToggleFlag(result)}
                            disabled={updatingId === result.id}
                          >
                            <Flag className="mr-2 h-4 w-4" />
                            {result.is_preferred ? "Remove flag" : "Flag as best"}
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={result.audio_public_url} target="_blank" rel="noreferrer">
                              Download clip
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prompt queue</CardTitle>
              <CardDescription>Upcoming work-in-progress prompts and their current status.</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prompts are waiting in the queue.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingQueue.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {prompt.prompt_text}
                        </TableCell>
                        <TableCell>
                          <PromptStatusBadge status={prompt.status} />
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatDate(prompt.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default AudioGenerationDashboard;
