import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import HabitList, { HabitWithStatus } from "@/components/wellness/HabitList";
import HabitSummary from "@/components/wellness/HabitSummary";
import {
  fetchWellnessOverview,
  getDateKey,
  getHabitCompletionRate,
  setHabitCompletion,
  type HealthStat,
  type WellnessAppointment,
  type WellnessOverviewData,
} from "@/lib/api/wellness";

const statIcons: Record<string, JSX.Element> = {
  "resting-heart-rate": <HeartPulse className="h-5 w-5 text-rose-500" />,
  "sleep-quality": <ShieldCheck className="h-5 w-5 text-indigo-500" />,
  hydration: <Stethoscope className="h-5 w-5 text-cyan-500" />,
  "stress-index": <Activity className="h-5 w-5 text-amber-500" />,
};

const getStatIcon = (stat: HealthStat) => statIcons[stat.id] ?? <HeartPulse className="h-5 w-5" />;

const formatAppointmentDate = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "TBD";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const formatAppointmentStatus = (status: WellnessAppointment["status"]) => {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", variant: "default" as const };
    case "completed":
      return { label: "Completed", variant: "secondary" as const };
    case "cancelled":
      return { label: "Cancelled", variant: "destructive" as const };
    default:
      return { label: "Pending", variant: "outline" as const };
  }
};

const WellnessPage = () => {
  const [data, setData] = useState<WellnessOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const todayKey = useMemo(() => getDateKey(new Date()), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await fetchWellnessOverview();
      setData(overview);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("We couldn't load your wellness data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleHabit = useCallback(
    async (habitId: string, completed: boolean) => {
      try {
        const updated = await setHabitCompletion(habitId, todayKey, completed);
        setData(updated);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("We couldn't update your habit. Please try again.");
      }
    },
    [todayKey]
  );

  const habitsWithStatus: HabitWithStatus[] = useMemo(() => {
    if (!data) {
      return [];
    }

    const referenceDate = new Date();
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(referenceDate);
      date.setDate(referenceDate.getDate() - index);
      return getDateKey(date);
    });

    return data.habits.map(habit => {
      const completionSet = new Set(habit.completedDates);
      const weeklyCompletions = lastSevenDays.filter(dateKey => completionSet.has(dateKey)).length;
      const completionRate = getHabitCompletionRate(habit, referenceDate);

      return {
        ...habit,
        completedToday: completionSet.has(todayKey),
        completionRate,
        weeklyCompletions,
      } satisfies HabitWithStatus;
    });
  }, [data, todayKey]);

  const summaryMetrics = useMemo(() => {
    if (!habitsWithStatus.length) {
      return {
        totalHabits: 0,
        averageCompletionRate: 0,
        longestStreak: 0,
        weeklyCompletions: 0,
      };
    }

    const totalHabits = habitsWithStatus.length;
    const weeklyCompletions = habitsWithStatus.reduce(
      (sum, habit) => sum + habit.weeklyCompletions,
      0
    );
    const longestStreak = habitsWithStatus.reduce(
      (max, habit) => Math.max(max, habit.streak),
      0
    );
    const averageCompletionRate = Math.round(
      habitsWithStatus.reduce((sum, habit) => sum + habit.completionRate, 0) /
        totalHabits
    );

    return {
      totalHabits,
      averageCompletionRate,
      longestStreak,
      weeklyCompletions,
    };
  }, [habitsWithStatus]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Alert variant="destructive">
          <AlertTitle>Wellness overview unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wellness Overview</h1>
            <p className="text-muted-foreground">
              Monitor your health stats, upcoming appointments, and daily habits in one place.
            </p>
          </div>
          <Badge variant="outline">Last updated {formatAppointmentDate(data.lastUpdated)}</Badge>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Health stats</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.healthStats.map(stat => {
            const direction = stat.changeDirection === "down" ? "down" : "up";
            const Icon = direction === "down" ? ArrowDownRight : ArrowUpRight;
            const changeColor = direction === "down" ? "text-emerald-500" : "text-rose-500";

            return (
              <Card key={stat.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold">
                        {stat.value}
                        {stat.unit ? <span className="ml-1 text-base font-normal">{stat.unit}</span> : null}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full bg-muted p-2">{getStatIcon(stat)}</div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {typeof stat.change === "number" ? (
                    <div className={`flex items-center gap-1 text-xs font-medium ${changeColor}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span>
                        {direction === "down" ? "Improved" : "Changed"} {Math.abs(stat.change)}
                        {stat.unit ? stat.unit : ""}
                      </span>
                    </div>
                  ) : null}
                  {stat.description ? (
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Upcoming appointments</h2>
        </div>
        <Card>
          <CardContent className="divide-y px-0">
            {data.appointments.length ? (
              data.appointments.map(appointment => {
                const status = formatAppointmentStatus(appointment.status);
                return (
                  <div
                    key={appointment.id}
                    className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{appointment.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatAppointmentDate(appointment.date)} · {appointment.time} · {appointment.location}
                      </p>
                      <p className="text-xs text-muted-foreground">{appointment.notes}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{appointment.type}</Badge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                No appointments scheduled. Add one to stay ahead of your recovery needs.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Habit tracking</h2>
        </div>
        <HabitSummary {...summaryMetrics} />
        <HabitList habits={habitsWithStatus} onToggleHabit={handleToggleHabit} />
      </section>
    </div>
  );
};

export default WellnessPage;
