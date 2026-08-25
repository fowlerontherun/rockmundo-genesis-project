import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import {
  useAddFestivalStagePerformanceToDayPlan,
  useMyFestivalStageSchedule,
  usePreviewFestivalStagePlanItem,
} from "./useFestivalDayPlanner";

const formatFestivalDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const formatFestivalTime = (value: string, timezone: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });

const errorText = (error: Error | null) => error?.message.replaceAll("_", " ") || null;

export const FestivalModeStageSchedule = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const schedule = useMyFestivalStageSchedule(attendance.id);
  const preview = usePreviewFestivalStagePlanItem(attendance.id);
  const addPerformance = useAddFestivalStagePerformanceToDayPlan(attendance.id);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedScheduleItemId, setSelectedScheduleItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!schedule.data) return;
    if (selectedDate && schedule.data.days.some((day) => day.date === selectedDate)) return;
    const serverDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: schedule.data.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(schedule.data.serverNow));
    const currentDay = schedule.data.days.find((day) => day.date === serverDate);
    setSelectedDate(currentDay?.date || schedule.data.days[0]?.date || "");
  }, [schedule.data, selectedDate]);

  useEffect(() => {
    preview.reset();
    setSelectedScheduleItemId(null);
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(
    () => (schedule.data?.items || []).filter((item) => item.festivalDate === selectedDate),
    [schedule.data?.items, selectedDate],
  );

  const previewPerformance = (scheduleItemId: string) => {
    setSelectedScheduleItemId(scheduleItemId);
    addPerformance.reset();
    preview.mutate({ scheduleItemId });
  };

  if (schedule.isLoading) {
    return <div className="rounded-xl border bg-card p-6" role="status">Loading the Festival stages…</div>;
  }

  if (schedule.isError || !schedule.data) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-6" role="alert">
        <p>The Festival stage schedule could not be loaded.</p>
        <p className="text-sm">{schedule.error instanceof Error ? errorText(schedule.error) : null}</p>
        <Button type="button" variant="outline" onClick={() => void schedule.refetch()}>Retry</Button>
      </div>
    );
  }

  const data = schedule.data;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-slate-950 to-violet-950 p-5 text-white md:p-7">
        <Badge className="bg-white/15 text-white hover:bg-white/15">Stages</Badge>
        <h1 className="mt-3 text-3xl font-black">Build your live music day</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Choose from the Festival&apos;s published timetable. RockMundo checks clashes and walking time before anything is added to My Day.
        </p>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Festival stage schedule days">
        {data.days.map((day) => (
          <Button
            key={day.date}
            type="button"
            size="sm"
            variant={selectedDate === day.date ? "default" : "outline"}
            onClick={() => setSelectedDate(day.date)}
          >
            Day {day.dayNumber} · {formatFestivalDate(day.date)}
          </Button>
        ))}
      </div>

      {!data.scheduleAvailable ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="font-semibold">The public stage timetable is not available yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once the organiser publishes or locks the canonical schedule, performances will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>{selectedDate ? formatFestivalDate(selectedDate) : "Festival stages"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No public performances are scheduled for this day yet.
                </div>
              ) : (
                items.map((item) => (
                  <article key={item.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            {formatFestivalTime(item.startsAt, data.timezone)}–{formatFestivalTime(item.endsAt, data.timezone)}
                          </span>
                          <Badge variant="outline">{item.stageName}</Badge>
                          {item.isPlanned && <Badge>In My Day</Badge>}
                        </div>
                        <p className="mt-2 text-lg font-bold">{item.artistName}</p>
                        <p className="text-xs text-muted-foreground">{item.durationMinutes} min · canonical Festival timetable</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={item.isPlanned ? "secondary" : "outline"}
                        disabled={item.isPlanned || preview.isPending}
                        onClick={() => previewPerformance(item.id)}
                      >
                        {item.isPlanned ? "Planned" : "Check fit"}
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedScheduleItemId && !preview.isPending && (
                <p className="text-sm text-muted-foreground">
                  Pick a performance to see timetable clashes, walking time and the trade-off before committing it.
                </p>
              )}
              {preview.isPending && <p className="text-sm" role="status">Checking your Festival day…</p>}
              {preview.isError && (
                <p className="text-sm text-destructive" role="alert">{errorText(preview.error)}</p>
              )}
              {preview.data && (
                <>
                  <div>
                    <p className="font-semibold">{preview.data.artistName}</p>
                    <p className="text-sm text-muted-foreground">{preview.data.stageName}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Walk in</p>
                      <p className="font-semibold">{preview.data.travelBeforeMinutes} min</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Walk out</p>
                      <p className="font-semibold">{preview.data.travelAfterMinutes} min</p>
                    </div>
                  </div>

                  {preview.data.blockers.length > 0 && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3" role="alert">
                      <p className="text-sm font-semibold">This does not fit yet</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                        {preview.data.blockers.map((blocker) => <li key={`${blocker.code}:${blocker.message}`}>{blocker.message}</li>)}
                      </ul>
                    </div>
                  )}

                  {preview.data.warnings.length > 0 && (
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-sm font-semibold">Before you commit</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                        {preview.data.warnings.map((warning) => <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>)}
                      </ul>
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    disabled={!preview.data.feasible || addPerformance.isPending}
                    onClick={() => addPerformance.mutate({
                      scheduleItemId: preview.data.scheduleItemId,
                      idempotencyKey: crypto.randomUUID(),
                    })}
                  >
                    {addPerformance.isPending ? "Adding…" : "Add performance to My Day"}
                  </Button>
                </>
              )}

              {addPerformance.isError && (
                <p className="text-sm text-destructive" role="alert">{errorText(addPerformance.error)}</p>
              )}
              {addPerformance.isSuccess && (
                <p className="text-sm text-emerald-600" role="status">Performance added to My Day.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FestivalModeStageSchedule;
