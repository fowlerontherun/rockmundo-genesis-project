import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Music2,
  Play,
  Radio,
  Sparkles,
  Users,
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
import {
  getEditionRuntime,
  getFestivalRunReadiness,
  runSimplifiedFestival,
} from "./service";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
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

  if (query.isLoading) {
    return <section role="status">Loading Festival simulation…</section>;
  }

  if (query.error) {
    return (
      <section role="alert">
        <h2>Festival simulation unavailable</h2>
        <p>The annual Festival could not be loaded.</p>
      </section>
    );
  }

  const runtime = query.data;
  if (!runtime) {
    const readiness = readinessQuery.data;
    return (
      <section className="space-y-4" aria-label="Run Festival">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" /> Run Festival
            </CardTitle>
            <CardDescription>
              Once Plan, Line-up and Tickets &amp; budget are ready, one action runs
              the annual event. The game generates the stages and running order,
              fills spare slots with NPC acts, simulates attendance and operations,
              and freezes the evidence needed for Results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readinessQuery.isLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Checking Festival readiness…
              </p>
            ) : readinessQuery.isError ? (
              <div role="alert" className="rounded-md border border-destructive p-3">
                The Festival readiness check could not be loaded.
              </div>
            ) : readiness ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ReadinessMetric
                    label="Annual plan"
                    value={`${readiness.readinessScore}%`}
                    ready={readiness.readinessScore === 100}
                  />
                  <ReadinessMetric
                    label="Confirmed acts"
                    value={readiness.confirmedActs.toString()}
                    ready={readiness.confirmedActs > 0}
                  />
                  <ReadinessMetric
                    label="Generated stages"
                    value={readiness.stageCount.toString()}
                    ready={readiness.stageCount > 0}
                  />
                </div>

                {readiness.scheduledFor ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4" /> Scheduled for{" "}
                    {new Date(`${readiness.scheduledFor}T12:00:00`).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </div>
                ) : null}

                {readiness.blockers.map((blocker) => (
                  <div
                    role="alert"
                    key={blocker.code}
                    className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm"
                  >
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>{blocker.message}</span>
                  </div>
                ))}

                {readiness.canRun && readiness.blockers.length === 0 ? (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-medium">Ready to run</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This is the only launch action required. Detailed staffing,
                          suppliers, safety planning and the running order stay automatic.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {runMutation.isError ? (
                  <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
                    The Festival could not be run. Refresh the page and review the
                    readiness messages before trying again.
                  </div>
                ) : null}

                <Button
                  size="lg"
                  disabled={!readiness.canRun || readiness.blockers.length > 0 || runMutation.isPending}
                  onClick={() => runMutation.mutate(readiness.editionVersion)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {runMutation.isPending ? "Running Festival…" : "Run Festival"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Automatic Festival simulation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>• Uses the Festival company&apos;s eleven upgrade levels</p>
            <p>• Generates staff, supplier and safety readiness</p>
            <p>• Creates the stage running order automatically</p>
            <p>• Fills remaining spaces with suitable NPC acts</p>
            <p>• Applies attendance, weather and operational effects</p>
            <p>• Freezes ticket, cost and performance evidence for Results</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const occupancy = runtime.attendance.capacity
    ? Math.round(
        (runtime.attendance.admitted / runtime.attendance.capacity) * 100,
      )
    : 0;
  const automaticReadiness = [
    runtime.readiness.staff,
    runtime.readiness.suppliers,
    runtime.readiness.sponsors,
  ];
  const readyCount = automaticReadiness.reduce(
    (total, item) => total + item.ready,
    0,
  );
  const readinessTotal = automaticReadiness.reduce(
    (total, item) => total + item.total,
    0,
  );

  return (
    <section className="space-y-4" aria-label="Festival simulation">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Radio className="h-4 w-4" /> Annual Festival simulation
          </p>
          <h2 className="text-2xl font-bold capitalize">
            {runtime.state === "completed"
              ? "Festival complete"
              : stateLabel(runtime.state)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The game ran the event from your company upgrades, confirmed line-up,
            tickets and annual choices.
          </p>
        </div>
        <Badge variant={runtime.state === "completed" ? "default" : "secondary"}>
          {new Date(runtime.simulatedTime).toLocaleString("en-GB")}
        </Badge>
      </header>

      {runtime.weather.warning ? (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-950"
        >
          <CloudRain className="h-5 w-5 shrink-0" />
          {runtime.weather.warning}
        </div>
      ) : null}

      {runtime.blockers.map((blocker) => (
        <div
          role="alert"
          key={blocker.code}
          className="flex gap-2 rounded-md border border-destructive p-3"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {blocker.message}
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          title="Attendance"
          value={`${runtime.attendance.admitted.toLocaleString("en-GB")} / ${runtime.attendance.expected.toLocaleString("en-GB")}`}
          detail={`${occupancy}% of site capacity`}
        />
        <Metric
          title="Audience rating"
          value={`${Math.round(runtime.satisfaction.audience)} / 100`}
          detail="Festival satisfaction"
        />
        <Metric
          title="Artist rating"
          value={`${Math.round(runtime.satisfaction.artist)} / 100`}
          detail="Backstage satisfaction"
        />
        <Metric
          title="Extra sales"
          value={money(
            runtime.sales.foodAndDrinkMinor + runtime.sales.merchandiseMinor,
          )}
          detail="Food, drink and merchandise"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Festival attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(100, occupancy)} />
          <p className="mt-2 text-sm text-muted-foreground">
            {runtime.attendance.admitted.toLocaleString("en-GB")} attended ·{" "}
            {runtime.attendance.departed.toLocaleString("en-GB")} safely departed ·{" "}
            capacity {runtime.attendance.capacity.toLocaleString("en-GB")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5" /> Festival stages
            </CardTitle>
            <CardDescription>
              The running order was generated automatically from confirmed acts,
              NPC fill and the company&apos;s production level.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runtime.stages.length ? (
              runtime.stages.map((stage) => (
                <article key={stage.id} className="rounded border p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{stage.name}</strong>
                    <Badge variant="outline" className="capitalize">
                      {stateLabel(stage.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 font-medium">
                    {stage.currentArtist ??
                      (runtime.state === "completed"
                        ? "Running order completed"
                        : "No performance currently")}
                  </p>
                  {runtime.state !== "completed" ? (
                    <p className="text-sm text-muted-foreground">
                      Next: {stage.nextArtist ?? "No act scheduled"}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Stage details were not available for this historical runtime.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Automatic operations
              </CardTitle>
              <CardDescription>
                These systems were simulated from company upgrades and were not
                separate owner tasks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>
                Readiness: <strong>{readyCount} / {readinessTotal}</strong>
              </p>
              <Progress
                value={
                  readinessTotal ? (readyCount / readinessTotal) * 100 : 100
                }
              />
              <p className="text-sm text-muted-foreground">
                Active incidents: {runtime.incidents.length}. Weather:{" "}
                {runtime.weather.condition}, {runtime.weather.temperatureC}°C.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Festival story</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runtime.recentEvents.length ? (
                runtime.recentEvents.slice(0, 8).map((event) => (
                  <p className="text-sm" key={event.id}>
                    {new Date(event.occurredAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    — {event.message}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Festival story events were recorded for this runtime.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

const ReadinessMetric = ({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
      {ready ? <CheckCircle2 className="h-4 w-4" /> : null}
      {value}
    </p>
  </div>
);

const Metric = ({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-xl font-semibold capitalize">{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </CardContent>
  </Card>
);
