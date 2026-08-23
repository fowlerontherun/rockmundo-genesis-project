import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { FestivalConditionPanel } from "./FestivalConditionPanel";
import { useMyFestivalDayPlan } from "./useFestivalDayPlanner";

const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "TBC";

const formatFestivalTime = (value: string, timezone: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });

export const FestivalModeHome = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const { data: plan, isLoading: planLoading } = useMyFestivalDayPlan(attendance.id);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-violet-950 to-fuchsia-900 p-5 text-white md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="bg-white/15 text-white hover:bg-white/15">Checked in</Badge>
            <h1 className="mt-3 text-3xl font-black md:text-5xl">{attendance.festivalName}</h1>
            <p className="mt-2 text-white/80">
              {formatDate(attendance.startsOn)} – {formatDate(attendance.endsOn)}
            </p>
          </div>
          {plan && (
            <div className="rounded-xl bg-black/20 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-white/60">
                Day {plan.festivalDayNumber} of {plan.totalFestivalDays}
              </p>
              <p className="text-2xl font-bold tabular-nums">{plan.festivalLocalTime.slice(0, 5)}</p>
              <p className="text-xs text-white/60">{plan.cityName} · {plan.timezone}</p>
            </div>
          )}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-white/80">
          You are inside the festival. Your normal RockMundo schedule is reserved for the remaining festival window, so incompatible activities cannot be booked until you leave or the festival completes.
        </p>
      </section>

      <FestivalConditionPanel attendanceId={attendance.id} />

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Admission</CardTitle></CardHeader>
          <CardContent>
            <p className="font-medium capitalize">{attendance.ticketType.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{attendance.ticketReference}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Access</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">Festival grounds</Badge>
            {attendance.includesCamping && <Badge variant="secondary">Camping</Badge>}
            {attendance.includesVipArea && <Badge variant="secondary">VIP</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Wristband</CardTitle></CardHeader>
          <CardContent>
            <p className="font-medium">Collected</p>
            <p className="mt-1 text-xs text-muted-foreground">Your keepsake remains in Inventory after the event.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Next plan</CardTitle></CardHeader>
          <CardContent>
            {planLoading ? (
              <p className="text-sm text-muted-foreground">Checking your day…</p>
            ) : plan?.nextActivity ? (
              <>
                <p className="font-medium">{plan.nextActivity.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatFestivalTime(plan.nextActivity.startsAt, plan.timezone)} · {plan.nextActivity.durationMinutes} min
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing planned yet. Open My Day to build your schedule.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Festival Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>My Day supports future 30, 60 or 90-minute blocks across each Festival day.</p>
          <p>Eat, Drink, Explore and Rest now resolve during their planned time window and update temporary Festival condition stats. Stages, social, campsite and the Festival map remain disabled until their authoritative systems arrive.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalModeHome;
