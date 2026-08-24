import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import type { FestivalExecutableActivityType } from "./festivalConditions";
import { FestivalConditionPanel } from "./FestivalConditionPanel";
import { useMyFestivalDayPlan, useResolveFestivalPlanActivity } from "./useFestivalDayPlanner";

const hubConfig = {
  "food-drink": {
    title: "Food & Drink",
    description: "Use the Eat and Drink blocks you planned for today. Commercial stalls, prices and alcohol choices arrive in a later economy slice.",
    types: new Set<FestivalExecutableActivityType>(["eat", "drink"]),
  },
  activities: {
    title: "Activities",
    description: "Explore the site or take a proper rest break when that block is active in My Day.",
    types: new Set<FestivalExecutableActivityType>(["explore", "rest"]),
  },
} as const;

type HubKind = keyof typeof hubConfig;

const formatTime = (value: string, timezone: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });

export const FestivalModeActivityHub = ({
  attendance,
  kind,
}: {
  attendance: FestivalPlayerAttendance;
  kind: HubKind;
}) => {
  const config = hubConfig[kind];
  const { data: plan, isLoading, isError } = useMyFestivalDayPlan(attendance.id);
  const resolver = useResolveFestivalPlanActivity(attendance.id);
  const serverNow = plan ? Date.parse(plan.serverNow) : 0;
  const relevantItems = (plan?.items || []).filter(
    (item) => config.types.has(item.activityType as FestivalExecutableActivityType) && item.status !== "cancelled",
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 md:p-7">
        <Badge variant="secondary">Festival Mode</Badge>
        <h1 className="mt-3 text-3xl font-black">{config.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{config.description}</p>
      </section>

      <FestivalConditionPanel attendanceId={attendance.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your planned {config.title.toLowerCase()} blocks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">Loading your Festival plan…</p>
          ) : isError || !plan ? (
            <p className="text-sm text-destructive" role="alert">Your Festival plan could not be loaded.</p>
          ) : relevantItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing planned here yet. Add an Eat, Drink, Explore or Rest block from My Day.</p>
          ) : (
            relevantItems.map((item) => {
              const startsAt = Date.parse(item.startsAt);
              const endsAt = Date.parse(item.endsAt);
              const active = item.status === "planned" && serverNow >= startsAt && serverNow < endsAt;
              return (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <Badge variant={item.status === "completed" ? "default" : "outline"} className="capitalize">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTime(item.startsAt, plan.timezone)}–{formatTime(item.endsAt, plan.timezone)} · {item.durationMinutes} min
                    </p>
                  </div>
                  {item.status === "planned" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!active || resolver.isPending}
                      onClick={() => resolver.mutate({ planItemId: item.id })}
                    >
                      {resolver.isPending ? "Doing…" : active ? "Do now" : serverNow < startsAt ? "Not started" : "Window passed"}
                    </Button>
                  )}
                </article>
              );
            })
          )}

          {resolver.isError && (
            <p className="text-sm text-destructive" role="alert">{resolver.error.message.replaceAll("_", " ")}</p>
          )}
          {resolver.data?.status === "completed" && (
            <p className="text-sm text-emerald-600" role="status">
              Activity completed. Your Festival condition has been updated.
            </p>
          )}
          {resolver.data?.status === "missed" && (
            <p className="text-sm text-amber-600" role="status">
              That activity window has passed and is now recorded as missed.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalModeActivityHub;
