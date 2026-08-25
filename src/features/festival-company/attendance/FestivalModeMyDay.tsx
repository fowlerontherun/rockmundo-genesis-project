import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import type { FestivalExecutableActivityType } from "./festivalConditions";
import type {
  FestivalManualDuration,
  FestivalPlanActivityType,
  PreviewFestivalPlanItemInput,
} from "./festivalDayPlanner";
import { FestivalConditionPanel } from "./FestivalConditionPanel";
import {
  useCancelFestivalDayPlanItem,
  useCreateFestivalDayPlanItem,
  useMyFestivalDayPlan,
  usePreviewFestivalDayPlanItem,
  useResolveFestivalPlanActivity,
} from "./useFestivalDayPlanner";

const baseActivityOptions: Array<{ value: FestivalPlanActivityType; label: string; defaultTitle: string }> = [
  { value: "eat", label: "Food", defaultTitle: "Get some food" },
  { value: "drink", label: "Drink", defaultTitle: "Get a drink" },
  { value: "explore", label: "Explore", defaultTitle: "Explore the festival" },
  { value: "rest", label: "Rest", defaultTitle: "Take a break" },
  { value: "vendor", label: "Vendor / merch", defaultTitle: "Browse the stalls" },
  { value: "free_time", label: "Free time", defaultTitle: "Free time" },
];
const executableTypes = new Set<FestivalExecutableActivityType>(["eat", "drink", "explore", "rest"]);

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

export const FestivalModeMyDay = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const { data: plan, isLoading, isError, error } = useMyFestivalDayPlan(attendance.id);
  const preview = usePreviewFestivalDayPlanItem();
  const createItem = useCreateFestivalDayPlanItem();
  const cancelItem = useCancelFestivalDayPlanItem(attendance.id);
  const resolver = useResolveFestivalPlanActivity(attendance.id);
  const [selectedDate, setSelectedDate] = useState("");
  const [localStart, setLocalStart] = useState("12:00");
  const [durationMinutes, setDurationMinutes] = useState<FestivalManualDuration>(60);
  const [activityType, setActivityType] = useState<FestivalPlanActivityType>("eat");
  const [title, setTitle] = useState("Get some food");
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const activityOptions = useMemo(() => {
    const options = [...baseActivityOptions];
    if (attendance.includesCamping) {
      options.push({ value: "camping", label: "Campsite", defaultTitle: "Head back to camp" });
    }
    if (attendance.includesVipArea) {
      options.push({ value: "vip", label: "VIP area", defaultTitle: "Spend time in VIP" });
    }
    return options;
  }, [attendance.includesCamping, attendance.includesVipArea]);

  useEffect(() => {
    if (!plan) return;
    if (selectedDate && plan.days.some((day) => day.date === selectedDate)) return;
    const currentDay = plan.days.find((day) => day.date === plan.festivalLocalDate);
    setSelectedDate(currentDay?.date || plan.days[0]?.date || "");
  }, [plan, selectedDate]);

  const selectedItems = useMemo(
    () => (plan?.items || []).filter((item) => item.festivalDate === selectedDate),
    [plan?.items, selectedDate],
  );

  const currentPreviewKey = `${selectedDate}:${localStart}:${durationMinutes}:${activityType}`;
  const currentPreview = previewKey === currentPreviewKey ? preview.data : undefined;

  const clearPreview = () => {
    setPreviewKey(null);
    preview.reset();
    createItem.reset();
  };

  const changeActivityType = (next: FestivalPlanActivityType) => {
    setActivityType(next);
    const option = activityOptions.find((candidate) => candidate.value === next);
    setTitle(option?.defaultTitle || "Festival plan");
    clearPreview();
  };

  const previewPlan = () => {
    if (!selectedDate) return;
    const input: PreviewFestivalPlanItemInput = {
      attendanceId: attendance.id,
      festivalDate: selectedDate,
      localStart,
      durationMinutes,
      activityType,
    };
    const key = currentPreviewKey;
    preview.mutate(input, { onSuccess: () => setPreviewKey(key) });
  };

  const submitPlan = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDate || !title.trim() || !currentPreview?.feasible) return;
    createItem.mutate({
      attendanceId: attendance.id,
      festivalDate: selectedDate,
      localStart,
      durationMinutes,
      activityType,
      title: title.trim(),
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: () => {
        setPreviewKey(null);
        preview.reset();
      },
    });
  };

  if (isLoading) {
    return <div className="rounded-xl border bg-card p-6" role="status">Loading your Festival day…</div>;
  }

  if (isError || !plan) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6" role="alert">
        Your Festival day could not be loaded. {error instanceof Error ? errorText(error) : ""}
      </div>
    );
  }

  const serverNow = Date.parse(plan.serverNow);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-violet-950 to-fuchsia-900 p-5 text-white md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="bg-white/15 text-white hover:bg-white/15">My Day</Badge>
            <h1 className="mt-3 text-3xl font-black">Plan your festival</h1>
            <p className="mt-2 text-sm text-white/75">
              Day {plan.festivalDayNumber} of {plan.totalFestivalDays} · {plan.cityName}
            </p>
          </div>
          <div className="rounded-xl bg-black/20 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-white/60">Festival local time</p>
            <p className="text-2xl font-bold tabular-nums">{plan.festivalLocalTime.slice(0, 5)}</p>
            <p className="text-xs text-white/60">{plan.timezone}</p>
          </div>
        </div>
      </section>

      <FestivalConditionPanel attendanceId={attendance.id} />

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Festival days">
        {plan.days.map((day) => (
          <Button
            key={day.date}
            type="button"
            size="sm"
            variant={selectedDate === day.date ? "default" : "outline"}
            onClick={() => {
              setSelectedDate(day.date);
              clearPreview();
            }}
          >
            Day {day.dayNumber} · {formatFestivalDate(day.date)}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{selectedDate ? formatFestivalDate(selectedDate) : "Festival day"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing planned yet. Add a practical block here or choose performances from Stages.
              </div>
            ) : (
              selectedItems.map((item) => {
                const startsAt = Date.parse(item.startsAt);
                const endsAt = Date.parse(item.endsAt);
                const executable = executableTypes.has(item.activityType as FestivalExecutableActivityType);
                const active = item.status === "planned" && serverNow >= startsAt && serverNow < endsAt;
                const removable = item.status === "planned" && serverNow < startsAt;

                return (
                  <article key={item.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            {formatFestivalTime(item.startsAt, plan.timezone)}–{formatFestivalTime(item.endsAt, plan.timezone)}
                          </span>
                          <Badge variant={item.status === "completed" ? "default" : item.status === "planned" ? "secondary" : "outline"} className="capitalize">
                            {item.status}
                          </Badge>
                          {item.source === "stage_schedule" && <Badge variant="outline">Stage timetable</Badge>}
                        </div>
                        <p className="mt-1 font-medium">{item.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {item.activityType.replaceAll("_", " ")} · {item.durationMinutes} min · {item.locationLabel}
                        </p>
                        {(item.travelBeforeMinutes > 0 || item.travelAfterMinutes > 0) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Walking allowance: {item.travelBeforeMinutes} min before · {item.travelAfterMinutes} min after
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {item.status === "planned" && executable && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={!active || resolver.isPending}
                            onClick={() => resolver.mutate({ planItemId: item.id })}
                          >
                            {resolver.isPending ? "Doing…" : active ? "Do now" : serverNow < startsAt ? "Not started" : "Window passed"}
                          </Button>
                        )}
                        {removable && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={cancelItem.isPending}
                            onClick={() => cancelItem.mutate({ itemId: item.id })}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}

            {cancelItem.isError && (
              <p className="text-sm text-destructive" role="alert">{errorText(cancelItem.error)}</p>
            )}
            {resolver.isError && (
              <p className="text-sm text-destructive" role="alert">{errorText(resolver.error)}</p>
            )}
            {resolver.data?.status === "completed" && (
              <p className="text-sm text-emerald-600" role="status">Activity completed and your Festival condition was updated.</p>
            )}
            {resolver.data?.status === "missed" && (
              <p className="text-sm text-amber-600" role="status">That activity window passed before completion and is recorded as missed.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a practical block</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitPlan}>
              <p className="text-xs text-muted-foreground">
                Performances are selected from Stages so their real times and stages cannot be invented here.
              </p>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Start time</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  type="time"
                  step={1800}
                  value={localStart}
                  onChange={(event) => {
                    setLocalStart(event.target.value);
                    clearPreview();
                  }}
                  required
                />
                <span className="text-xs text-muted-foreground">Half-hour slots in {plan.timezone}.</span>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Duration</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={durationMinutes}
                  onChange={(event) => {
                    setDurationMinutes(Number(event.target.value) as FestivalManualDuration);
                    clearPreview();
                  }}
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Plan</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={activityType}
                  onChange={(event) => changeActivityType(event.target.value as FestivalPlanActivityType)}
                >
                  {activityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Label</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2"
                  maxLength={120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Grab lunch by the main arena"
                  required
                />
              </label>

              <Button
                className="w-full"
                type="button"
                variant="outline"
                disabled={preview.isPending || !selectedDate}
                onClick={previewPlan}
              >
                {preview.isPending ? "Checking…" : "Check plan"}
              </Button>

              {preview.isError && (
                <p className="text-sm text-destructive" role="alert">{errorText(preview.error)}</p>
              )}

              {currentPreview && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">Feasibility</span>
                    <Badge variant={currentPreview.feasible ? "default" : "destructive"}>
                      {currentPreview.feasible ? "Fits your day" : "Conflict"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Walking allowance: {currentPreview.travelBeforeMinutes} min before · {currentPreview.travelAfterMinutes} min after
                  </p>
                  {currentPreview.blockers.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-sm text-destructive" role="alert">
                      {currentPreview.blockers.map((blocker) => <li key={`${blocker.code}:${blocker.message}`}>{blocker.message}</li>)}
                    </ul>
                  )}
                  {currentPreview.warnings.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {currentPreview.warnings.map((warning) => <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <Button className="w-full" type="submit" disabled={createItem.isPending || !currentPreview?.feasible}>
                {createItem.isPending ? "Adding…" : "Add to My Day"}
              </Button>

              {createItem.isError && (
                <p className="text-sm text-destructive" role="alert">{errorText(createItem.error)}</p>
              )}
              {createItem.isSuccess && (
                <p className="text-sm text-emerald-600" role="status">Plan updated.</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Eat, Drink, Explore and Rest still use the existing bounded Festival condition resolver. Campsite, VIP, vendor and free-time blocks reserve your timetable only until C6 adds their condition effects.
      </p>
    </div>
  );
};

export default FestivalModeMyDay;
