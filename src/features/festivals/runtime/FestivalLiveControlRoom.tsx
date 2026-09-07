import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Clock3,
  Music2,
  Play,
  Radio,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FestivalRuntimeProjection } from "./model";
import {
  getEditionRuntime,
  getFestivalRunReadiness,
  runSimplifiedFestival,
} from "./service";

const money = (minor: number, currencyCode: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode,
  }).format(minor / 100);

const stateLabel = (state: string) => state.replaceAll("_", " ");

const runtimeQueryKey = (companyId: string, editionId: string) => [
  "festival-edition-runtime",
  companyId,
  editionId,
];

export function FestivalLiveControlRoom({
  companyId,
  editionId,
}: {
  companyId: string;
  editionId: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: runtimeQueryKey(companyId, editionId),
    queryFn: () => getEditionRuntime(companyId, editionId),
    refetchInterval: 10_000,
  });
  const readinessQuery = useQuery({
    queryKey: ["festival-run-readiness", companyId, editionId],
    queryFn: () => getFestivalRunReadiness(companyId, editionId),
    enabled: query.isSuccess && query.data === null,
  });
  const runMutation = useMutation({
    mutationFn: (expectedEditionVersion: number) =>
      runSimplifiedFestival(companyId, editionId, expectedEditionVersion),
    onSuccess: (runtime) => {
      queryClient.setQueryData(runtimeQueryKey(companyId, editionId), runtime);
      void queryClient.invalidateQueries({
        queryKey: ["festival-run-readiness", companyId, editionId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["festival-edition-history", editionId],
      });
    },
  });

  if (query.isLoading) return <section role="status">Loading Festival Day…</section>;
  if (query.error) {
    return (
      <Card role="alert">
        <CardHeader><CardTitle>Festival Day unavailable</CardTitle></CardHeader>
        <CardContent>The live Festival state could not be loaded.</CardContent>
      </Card>
    );
  }

  const runtime = query.data;
  if (!runtime) {
    const readiness = readinessQuery.data;
    return (
      <section className="space-y-4" aria-label="Run Festival">
        <Card className="overflow-hidden border-primary/30">
          <div className="bg-gradient-to-r from-violet-950 via-slate-950 to-fuchsia-950 p-6 text-white">
            <Badge className="mb-3">Festival launch</Badge>
            <h2 className="text-3xl font-black">The gates are almost ready</h2>
            <p className="mt-2 max-w-2xl text-sm text-violet-100">
              Finish the three big decisions, then launch the event. Staffing, suppliers,
              safety and running-order detail stay automated behind the scenes.
            </p>
          </div>
          <CardContent className="space-y-5 pt-6">
            {readinessQuery.isLoading ? <p role="status">Checking Festival readiness…</p> : null}
            {readinessQuery.isError ? <p role="alert" className="text-destructive">Festival readiness could not be loaded.</p> : null}
            {readiness ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <LaunchStep label="Annual plan" ready={readiness.readinessScore === 100} value={`${readiness.readinessScore}%`} />
                  <LaunchStep label="Line-up" ready={readiness.confirmedActs > 0} value={`${readiness.confirmedActs} confirmed`} />
                  <LaunchStep label="Stages" ready={readiness.stageCount > 0} value={readiness.licensedStageLimit ? `${readiness.stageCount}/${readiness.licensedStageLimit}` : `${readiness.stageCount}`} />
                </div>

                {readiness.scheduledFor ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    Festival date {new Date(`${readiness.scheduledFor}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                ) : null}

                {readiness.blockers.map((blocker) => (
                  <div key={blocker.code} role="alert" className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>{blocker.message}</span>
                  </div>
                ))}

                {readiness.canRun && readiness.blockers.length === 0 ? (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <div>
                        <p className="font-semibold">Ready for Festival Day</p>
                        <p className="text-sm text-muted-foreground">One launch action runs the event and opens the live control view.</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {runMutation.isError ? <p role="alert" className="text-destructive">The Festival could not be launched. Review the blockers and try again.</p> : null}

                <Button size="lg" disabled={!readiness.canRun || readiness.blockers.length > 0 || runMutation.isPending} onClick={() => runMutation.mutate(readiness.editionVersion)}>
                  <Play className="mr-2 h-4 w-4" />
                  {runMutation.isPending ? "Opening Festival…" : "Open Festival gates"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> What happens automatically</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>• Stage running order and spare NPC slots</p>
            <p>• Staff, supplier and safety readiness</p>
            <p>• Attendance, queues and crowd movement</p>
            <p>• Weather and operational incidents</p>
            <p>• Food, drink and merchandise sales</p>
            <p>• Final audience and artist satisfaction</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return <FestivalDay runtime={runtime} />;
}

function FestivalDay({ runtime }: { runtime: FestivalRuntimeProjection }) {
  const occupancy = runtime.attendance.capacity
    ? Math.round((runtime.attendance.onsite / runtime.attendance.capacity) * 100)
    : 0;
  const admittedPct = runtime.attendance.expected
    ? Math.round((runtime.attendance.admitted / runtime.attendance.expected) * 100)
    : 0;
  const readiness = [runtime.readiness.staff, runtime.readiness.suppliers, runtime.readiness.sponsors];
  const readinessReady = readiness.reduce((sum, item) => sum + item.ready, 0);
  const readinessTotal = readiness.reduce((sum, item) => sum + item.total, 0);
  const activeIncidents = runtime.incidents.filter((incident) => !["resolved", "closed"].includes(incident.status));

  return (
    <section className="space-y-4" aria-label="Festival Day">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950 via-slate-950 to-fuchsia-950 p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-red-600"><Radio className="mr-1 h-3 w-3" /> FESTIVAL DAY</Badge>
              <Badge variant="secondary" className="capitalize">{stateLabel(runtime.state)}</Badge>
            </div>
            <h2 className="mt-3 text-3xl font-black">Live Festival control</h2>
            <p className="mt-2 text-sm text-violet-100">Watch the crowd arrive, follow every stage and react to what the day throws at you.</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{new Date(runtime.simulatedTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-violet-200">Festival local simulation</p>
          </div>
        </div>
      </header>

      {runtime.weather.warning ? (
        <div role="alert" className="flex gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <CloudRain className="h-5 w-5 shrink-0" />
          <div><strong>Weather alert:</strong> {runtime.weather.warning}</div>
        </div>
      ) : null}

      {runtime.blockers.map((blocker) => (
        <div key={blocker.code} role="alert" className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0" /> {blocker.message}
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Users} label="On site now" value={runtime.attendance.onsite.toLocaleString("en-GB")} detail={`${occupancy}% of capacity`} />
        <Metric icon={Users} label="Through the gates" value={runtime.attendance.admitted.toLocaleString("en-GB")} detail={`${admittedPct}% of expected crowd`} />
        <Metric icon={Sparkles} label="Crowd mood" value={`${Math.round(runtime.satisfaction.audience)}/100`} detail="Audience satisfaction" />
        <Metric icon={WalletCards} label="Extra sales" value={money(runtime.sales.foodAndDrinkMinor + runtime.sales.merchandiseMinor, runtime.currencyCode)} detail="Food, drink & merch" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Music2 className="h-5 w-5" /> Stages now</CardTitle>
            <CardDescription>The bill as it is actually unfolding.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {runtime.stages.map((stage) => (
              <div key={stage.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{stage.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{stateLabel(stage.status)}</p>
                  </div>
                  {stage.delayMinutes > 0 ? <Badge variant="destructive">+{stage.delayMinutes} min</Badge> : <Badge variant="outline">On time</Badge>}
                </div>
                <div className="mt-4 rounded-lg bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">On stage</p>
                  <p className="mt-1 text-lg font-bold">{stage.currentArtist ?? "Changeover"}</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next: {stage.nextArtist ?? "TBC"}</span>
                  <Badge variant={stage.artistReady ? "default" : "secondary"}>{stage.artistReady ? "Artist ready" : "Preparing"}</Badge>
                </div>
              </div>
            ))}
            {runtime.stages.length === 0 ? <p className="text-sm text-muted-foreground">Stage information is being prepared.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm"><span>Automatic readiness</span><span>{readinessReady}/{readinessTotal}</span></div>
              <Progress value={readinessTotal ? (readinessReady / readinessTotal) * 100 : 0} />
            </div>
            <div className="grid gap-2 text-sm">
              <Operation label="Gates" value={stateLabel(runtime.gates.status)} />
              <Operation label="Gate queue" value={`${runtime.gates.queueSize.toLocaleString("en-GB")} people`} />
              <Operation label="Wait time" value={`${Math.round(runtime.gates.waitMinutes)} min`} />
              <Operation label="Weather" value={`${runtime.weather.condition}, ${Math.round(runtime.weather.temperatureC)}°C`} />
              <Operation label="Artist mood" value={`${Math.round(runtime.satisfaction.artist)}/100`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Festival timeline</CardTitle>
            <CardDescription>Latest moments from around the site.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {runtime.recentEvents.slice().reverse().map((event) => (
                <div key={event.id} className="grid grid-cols-[5rem_1fr] gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <time className="text-sm font-medium">{new Date(event.occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time>
                  <p className="text-sm">{event.message}</p>
                </div>
              ))}
              {runtime.recentEvents.length === 0 ? <p className="text-sm text-muted-foreground">The Festival timeline will fill as the event unfolds.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidents & pressure points</CardTitle>
            <CardDescription>Problems that make this Festival feel different from the last one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeIncidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={incident.severity === "critical" || incident.severity === "high" ? "destructive" : "secondary"} className="capitalize">{incident.severity}</Badge>
                    <span className="text-sm font-medium capitalize">{stateLabel(incident.category)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{incident.location}</span>
                </div>
                <p className="mt-2 text-sm">{incident.summary}</p>
              </div>
            ))}
            {activeIncidents.length === 0 ? (
              <div className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> No unresolved incidents right now.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {runtime.state === "completed" ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle>Festival complete</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Metric icon={Users} label="Final attendance" value={runtime.attendance.admitted.toLocaleString("en-GB")} detail={`${occupancy}% peak site occupancy`} />
            <Metric icon={Sparkles} label="Audience rating" value={`${Math.round(runtime.satisfaction.audience)}/100`} detail="Final satisfaction" />
            <Metric icon={WalletCards} label="On-site sales" value={money(runtime.sales.foodAndDrinkMinor + runtime.sales.merchandiseMinor, runtime.currencyCode)} detail="Before full Results settlement" />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function LaunchStep({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span>{ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}</div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function Operation({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"><span className="text-muted-foreground">{label}</span><strong className="capitalize">{value}</strong></div>;
}
