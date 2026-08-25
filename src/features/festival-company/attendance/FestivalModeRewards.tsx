import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { useMyFestivalRewardSummary } from "./useFestivalRewards";

export const FestivalModeRewards = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const { data, isLoading, isError, error } = useMyFestivalRewardSummary(attendance.id);

  if (isLoading) return <div className="rounded-xl border bg-card p-6" role="status">Loading Festival progress…</div>;
  if (isError || !data) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6" role="alert">Festival progress could not be loaded. {error instanceof Error ? error.message.replaceAll("_", " ") : ""}</div>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-violet-950 to-fuchsia-900 p-5 text-white md:p-7">
        <Badge className="bg-white/15 text-white hover:bg-white/15">Rewards & memories</Badge>
        <h1 className="mt-3 text-3xl font-black">Your Festival story</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Meaningful participation builds a bounded completion reward. Refreshing or repeating actions cannot increase the same settled reward indefinitely.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Skill XP</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{data.skillXp}</p><p className="text-xs text-muted-foreground">Maximum 600 per attendance</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Attribute Points</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{data.attributePoints}</p><p className="text-xs text-muted-foreground">Completion-weighted, capped at 2</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Inspiration</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{data.inspiration}</p><p className="text-xs text-muted-foreground">Festival condition snapshot</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader><CardContent><Badge variant={data.settled ? "default" : "secondary"}>{data.settled ? "Settled" : "Building"}</Badge><p className="mt-2 text-xs text-muted-foreground">{data.settled ? "Reward locked and replay-safe" : "Final reward settles when attendance ends"}</p></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Festival recap</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-2xl font-bold">{data.completedActivities}</p><p className="text-xs text-muted-foreground">Completed activities</p></div>
          <div><p className="text-2xl font-bold">{data.watchedActs}</p><p className="text-xs text-muted-foreground">Acts watched</p></div>
          <div><p className="text-2xl font-bold">{data.resolvedMoments}</p><p className="text-xs text-muted-foreground">Moments resolved</p></div>
          <div><p className="text-2xl font-bold">{data.distinctActivityTypes}</p><p className="text-xs text-muted-foreground">Different activity types</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>How rewards work</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Only authoritative completed activities, watched timetable acts, resolved Festival moments and the final attendance state count.</p>
          <p>Each category has a contribution cap, and one attendance can create only one reward settlement. Completing the whole Festival earns more than leaving early.</p>
          <p>A completed Festival also creates a permanent recap memory and can unlock the Festival Survivor recognition badge.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalModeRewards;
