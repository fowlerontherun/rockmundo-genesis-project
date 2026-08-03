import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CloudRain,
  Music2,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getEditionRuntime } from "./service";

const money = (minor: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(minor / 100);

const stateLabel = (state: string) => state.replaceAll("_", " ");

export function FestivalLiveControlRoom({
  companyId,
  editionId,
}: {
  companyId: string;
  editionId: string;
}) {
  const query = useQuery({
    queryKey: ["festival-edition-runtime", companyId, editionId],
    queryFn: () => getEditionRuntime(companyId, editionId),
    refetchInterval: 10_000,
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
    return (
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Festival not running yet</CardTitle>
            <CardDescription>
              Finish Plan, Line-up and Tickets &amp; budget. When the annual
              Festival launches, the game automatically generates its running
              order, staff, suppliers, operating costs and live outcome.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Automatic launch preparation
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>• Uses the Festival company's eleven upgrade levels</p>
            <p>• Calculates staff, supplier and safety costs</p>
            <p>• Creates the stage running order</p>
            <p>• Fills remaining spaces with suitable NPC acts</p>
            <p>• Applies city, weather and transport effects</p>
            <p>• Settles income, expenses and reputation after completion</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const occupancy = runtime.attendance.capacity
    ? Math.round(
        (runtime.attendance.onsite / runtime.attendance.capacity) * 100,
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
            {stateLabel(runtime.state)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The game is running the event from your company upgrades, line-up,
            tickets and annual choices.
          </p>
        </div>
        <Badge variant="secondary">
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
          detail={`${occupancy}% currently on site`}
        />
        <Metric
          title="Audience rating"
          value={`${Math.round(runtime.satisfaction.audience)} / 100`}
          detail="Live satisfaction"
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
            {runtime.attendance.onsite.toLocaleString("en-GB")} currently on
            site · {runtime.attendance.departed.toLocaleString("en-GB")} left ·{" "}
            {runtime.gates.queueSize.toLocaleString("en-GB")} arriving
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5" /> Live music
            </CardTitle>
            <CardDescription>
              The running order was generated automatically from the confirmed
              line-up and company production level.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runtime.stages.map((stage) => (
              <article key={stage.id} className="rounded border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{stage.name}</strong>
                  <Badge variant="outline" className="capitalize">
                    {stateLabel(stage.status)}
                  </Badge>
                </div>
                <p className="mt-2 font-medium">
                  {stage.currentArtist ?? "No performance currently"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Next: {stage.nextArtist ?? "No act scheduled"}
                  {stage.delayMinutes
                    ? ` · running ${stage.delayMinutes} minutes late`
                    : ""}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Automatic operations
              </CardTitle>
              <CardDescription>
                These systems are simulated from company upgrades and are not
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
                  Festival events will appear here as the simulation progresses.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

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
