import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Archive,
  AudioLines,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  FlaskConical,
  LockKeyhole,
  Radio,
  Settings2,
  Tv2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  adminBuildTotpBroadcastArchive,
  adminCompleteTotpPerformance,
  adminLockTotpRunningOrder,
  getTotpBroadcastArchive,
  getTotpEpisode,
  getTotpPublicHistory,
} from "@/features/top-of-the-pops/api";
import { resolveTotpPresenter, totpVariantLabel } from "@/features/top-of-the-pops/presenters";
import { TotpTestEpisodeCard } from "@/features/top-of-the-pops/TotpTestEpisodeCard";
import { TotpMediaManager } from "@/features/top-of-the-pops/TotpMediaManager";
import { TotpAudioStudio } from "@/features/top-of-the-pops/TotpAudioStudio";
import { TotpProductionHealthCard } from "@/features/top-of-the-pops/TotpProductionHealthCard";
import { TotpRunningSheetCard } from "@/features/top-of-the-pops/TotpRunningSheetCard";
import { TotpControlRoomCard } from "@/features/top-of-the-pops/TotpControlRoomCard";
import { TotpRenderQueueCard } from "@/features/top-of-the-pops/TotpRenderQueueCard";
import { TotpRehearsalCard } from "@/features/top-of-the-pops/TotpRehearsalCard";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function AdminTabsList() {
  return (
    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
      <TabsTrigger value="overview" className="gap-1.5"><Tv2 className="h-4 w-4" /> Overview</TabsTrigger>
      <TabsTrigger value="production" className="gap-1.5"><Settings2 className="h-4 w-4" /> Production</TabsTrigger>
      <TabsTrigger value="audio" className="gap-1.5"><AudioLines className="h-4 w-4" /> Audio & media</TabsTrigger>
      <TabsTrigger value="demo" className="gap-1.5"><FlaskConical className="h-4 w-4" /> Demo</TabsTrigger>
      <TabsTrigger value="broadcast" className="col-span-2 gap-1.5 md:col-span-1"><Radio className="h-4 w-4" /> Broadcast</TabsTrigger>
    </TabsList>
  );
}

export default function TopOfThePopsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const episode = useQuery({
    queryKey: ["totp", "episode", "admin-current"],
    queryFn: () => getTotpEpisode(),
  });
  const currentId = episode.data?.id ?? null;
  const archive = useQuery({
    queryKey: ["totp", "archive", currentId],
    queryFn: () => getTotpBroadcastArchive(currentId),
    enabled: !!currentId,
  });
  const history = useQuery({
    queryKey: ["totp", "history", "admin-current"],
    queryFn: () => getTotpPublicHistory(null, 200),
    enabled: !!currentId,
  });

  const lockOrder = useMutation({
    mutationFn: adminLockTotpRunningOrder,
    onSuccess: (count) => {
      toast({ title: "Running order locked", description: `${count} checked-in act${count === 1 ? "" : "s"} added to the broadcast.` });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => toast({ title: "Could not lock running order", description: error.message, variant: "destructive" }),
  });

  const buildArchive = useMutation({
    mutationFn: adminBuildTotpBroadcastArchive,
    onSuccess: (count) => {
      toast({ title: "Broadcast archive locked", description: `${count} canonical performance replay${count === 1 ? "" : "s"} are now stored.` });
      void queryClient.invalidateQueries({ queryKey: ["totp", "archive"] });
    },
    onError: (error: Error) => toast({ title: "Could not build archive", description: error.message, variant: "destructive" }),
  });

  const completePerformance = useMutation({
    mutationFn: (performanceId: string) => adminCompleteTotpPerformance(performanceId),
    onSuccess: (result) => {
      toast({
        title: result.status === "already_completed" ? "Already settled" : "Performance completed",
        description: `Appearance #${result.appearance_number} · ${result.fame_awarded.toLocaleString()} fame awarded.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => toast({ title: "Could not complete performance", description: error.message, variant: "destructive" }),
  });

  if (episode.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading Top of the Pops episode…</div>;
  }

  if (episode.isError) {
    return <div className="p-6 text-sm text-destructive">{(episode.error as Error).message}</div>;
  }

  const current = episode.data;

  if (!current) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Tv2 className="h-4 w-4" /> Television administration</div>
            <h1 className="text-3xl font-bold">Top of the Pops</h1>
            <p className="text-muted-foreground">No real episode is currently scheduled. Set the next show, manage reusable audio, or run a full safe demo.</p>
          </div>
          <Button asChild size="sm">
            <Link to="/admin/top-of-the-pops/schedule">
              <CalendarDays className="mr-1 h-4 w-4" /> Schedule / reschedule show
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <AdminTabsList />
          <TabsContent value="overview" className="space-y-4">
            <TotpProductionHealthCard />
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No scheduled Top of the Pops episode found. Use the schedule button above to create the next broadcast.</CardContent></Card>
          </TabsContent>
          <TabsContent value="production" className="space-y-4">
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Schedule an episode before production planning, rehearsal and render controls become available.</CardContent></Card>
          </TabsContent>
          <TabsContent value="audio" className="space-y-4">
            <TotpAudioStudio episode={null} />
            <TotpMediaManager presenterKey="alex_rayne" />
          </TabsContent>
          <TabsContent value="demo" className="space-y-4">
            <TotpTestEpisodeCard />
          </TabsContent>
          <TabsContent value="broadcast" className="space-y-4">
            <Card><CardContent className="p-6 text-sm text-muted-foreground">There is no scheduled broadcast to settle or archive.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const presenter = resolveTotpPresenter(current.presenter_key);
  const variantLabel = totpVariantLabel(current.show_variant);
  const completedByPerformance = new Map(
    (history.data ?? []).filter((row) => row.episode_number === current.episode_number).map((row) => [row.performance_id, row]),
  );
  const allPerformancesSettled = current.performances.length > 0 && completedByPerformance.size === current.performances.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Tv2 className="h-4 w-4" /> Television administration</div>
          <h1 className="text-3xl font-bold">Top of the Pops</h1>
          <p className="text-muted-foreground">Episode #{current.episode_number} · {formatDateTime(current.broadcast_at)} · {presenter.displayName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {variantLabel && <Badge variant="outline">{variantLabel}</Badge>}
          <Badge variant="secondary">{current.status}</Badge>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/top-of-the-pops/schedule">
              <CalendarDays className="mr-1 h-4 w-4" /> Schedule / reschedule
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/top-of-the-pops/control-room">
              <Radio className="mr-1 h-4 w-4" /> Control room
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <AdminTabsList />

        <TabsContent value="overview" className="space-y-4">
          <TotpProductionHealthCard />
          <Card>
            <CardHeader>
              <CardTitle>Current show</CardTitle>
              <CardDescription>At-a-glance status for the next Top of the Pops broadcast.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Presenter</div><div className="font-semibold">{presenter.displayName}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Acts</div><div className="font-semibold">{current.performances.length}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Settled</div><div className="font-semibold">{completedByPerformance.size}/{current.performances.length}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Archived</div><div className="font-semibold">{archive.data?.replays.length ?? 0}/{current.performances.length}</div></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <TotpControlRoomCard episode={current} />
          <TotpRunningSheetCard episode={current} />
          <TotpRehearsalCard episode={current} />
          <TotpRenderQueueCard episode={current} />
        </TabsContent>

        <TabsContent value="audio" className="space-y-4">
          <TotpAudioStudio episode={current} />
          <TotpMediaManager presenterKey={current.presenter_key ?? "alex_rayne"} />
        </TabsContent>

        <TabsContent value="demo" className="space-y-4">
          <TotpTestEpisodeCard />
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clapperboard className="h-5 w-5" /> Broadcast controls</CardTitle>
              <CardDescription>
                Lock the running order, settle every performance, then freeze the canonical archive. Replay never settles rewards.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                onClick={() => lockOrder.mutate(current.id)}
                disabled={lockOrder.isPending || current.status === "completed" || current.status === "cancelled"}
              >
                <LockKeyhole className="mr-2 h-4 w-4" /> Lock running order
              </Button>
              <Button
                variant="outline"
                onClick={() => buildArchive.mutate(current.id)}
                disabled={buildArchive.isPending || !allPerformancesSettled}
                title={allPerformancesSettled ? "Build the immutable television replay" : "Settle every performance before archiving"}
              >
                <Archive className="mr-2 h-4 w-4" /> Build canonical archive
              </Button>
              <Badge variant="secondary" className="self-center">{archive.data?.replays.length ?? 0}/{current.performances.length} archived</Badge>
              <Badge variant="secondary" className="self-center">{completedByPerformance.size}/{current.performances.length} settled</Badge>
              {!allPerformancesSettled && current.performances.length > 0 && (
                <span className="self-center text-xs text-muted-foreground">Archive unlocks after every act is settled.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Published running order</CardTitle>
              <CardDescription>{current.performances.length} act{current.performances.length === 1 ? "" : "s"} currently in the show.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {current.performances.length === 0 && <p className="text-sm text-muted-foreground">No acts have been locked into the broadcast yet.</p>}
              {current.performances.map((performance) => {
                const archived = archive.data?.replays.some((replay) => replay.performance_id === performance.performance_id) ?? false;
                const settled = completedByPerformance.get(performance.performance_id);
                return (
                  <div key={performance.performance_id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold">{performance.running_order}. {performance.band_name}</div>
                        <div className="text-sm text-muted-foreground">{performance.song_title} · chart #{performance.qualifying_rank}</div>
                        {performance.presenter_intro && <div className="mt-2 text-sm italic">“{performance.presenter_intro}”</div>}
                        {settled && (
                          <div className="mt-2 text-sm font-medium text-emerald-600">
                            Appearance #{settled.appearance_number} · +{settled.fame_awarded.toLocaleString()} fame
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{performance.stage_key.replaceAll("_", " ")}</Badge>
                        {archived && <Badge variant="secondary">archived</Badge>}
                        {settled ? (
                          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> settled</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => completePerformance.mutate(performance.performance_id)}
                            disabled={completePerformance.isPending}
                          >
                            Complete & settle
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
