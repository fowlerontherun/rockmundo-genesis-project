import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Music2, DollarSign } from "lucide-react";

interface BandRehearsalsTabProps {
  bandId: string;
}

type RehearsalRoom = Database["public"]["Tables"]["rehearsal_rooms"]["Row"];
type BandRehearsal = Database["public"]["Tables"]["band_rehearsals"]["Row"] & {
  rehearsal_rooms?: Pick<RehearsalRoom, "name" | "location" | "hourly_rate"> | null;
  songs?: { title: string } | null;
};

type AggregatedCosts = {
  totalSpent: number;
  upcomingCommitment: number;
  completedSessions: number;
};

const statusColorMap: Record<string, string> = {
  scheduled: "bg-sky-500/10 text-sky-700",
  completed: "bg-emerald-500/10 text-emerald-700",
  cancelled: "bg-rose-500/10 text-rose-700",
};

function formatDateTime(value: string) {
  try {
    return format(new Date(value), "MMM d, yyyy • h:mm a");
  } catch (error) {
    console.error("Failed to format date", error);
    return value;
  }
}

function getStatusBadge(status: string) {
  const normalized = status.toLowerCase();
  const label = normalized
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
  return <Badge className={statusColorMap[normalized] ?? "bg-slate-500/10 text-slate-700"}>{label}</Badge>;
}

export function BandRehearsalsTab({ bandId }: BandRehearsalsTabProps) {
  const [loading, setLoading] = useState(true);
  const [rehearsals, setRehearsals] = useState<BandRehearsal[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchRehearsals = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("band_rehearsals")
          .select(`
            *,
            rehearsal_rooms:rehearsal_room_id (name, location, hourly_rate),
            songs:selected_song_id (title)
          `)
          .eq("band_id", bandId)
          .order("scheduled_start", { ascending: true });

        if (error) throw error;
        if (!isMounted) return;
        setRehearsals((data as BandRehearsal[]) ?? []);
      } catch (error) {
        console.error("Failed to load rehearsal schedule", error);
        if (isMounted) {
          setRehearsals([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchRehearsals();

    return () => {
      isMounted = false;
    };
  }, [bandId]);

  const now = useMemo(() => new Date(), []);

  const upcoming = useMemo(
    () =>
      rehearsals.filter((session) => {
        if (!session.scheduled_start) return false;
        const start = new Date(session.scheduled_start);
        return start >= now && session.status !== "completed";
      }),
    [rehearsals, now],
  );

  const completed = useMemo(
    () =>
      rehearsals.filter((session) => {
        if (!session.scheduled_start) return false;
        const start = new Date(session.scheduled_start);
        return start < now || session.status === "completed";
      }),
    [rehearsals, now],
  );

  const aggregatedCosts = useMemo<AggregatedCosts>(() => {
    const upcomingCommitment = upcoming.reduce((sum, rehearsal) => sum + (rehearsal.total_cost ?? 0), 0);
    const completedSessions = completed.length;
    const totalSpent = completed.reduce((sum, rehearsal) => sum + (rehearsal.total_cost ?? 0), 0);

    return {
      totalSpent,
      upcomingCommitment,
      completedSessions,
    };
  }, [upcoming, completed]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(3)].map((__, rowIndex) => (
                <div key={rowIndex} className="space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> Total spent on rehearsals
            </CardTitle>
            <CardDescription>Lifetime investment into rehearsal preparation</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${aggregatedCosts.totalSpent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="h-4 w-4 text-muted-foreground" /> Upcoming commitment
            </CardTitle>
            <CardDescription>Cost reserved for scheduled rehearsals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${aggregatedCosts.upcomingCommitment.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Music2 className="h-4 w-4 text-muted-foreground" /> Sessions completed
            </CardTitle>
            <CardDescription>Recorded rehearsals with chemistry updates</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{aggregatedCosts.completedSessions}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming rehearsals</CardTitle>
          <CardDescription>Sessions scheduled for the band in the near future.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming rehearsals scheduled.</p>
          ) : (
            upcoming.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{session.rehearsal_rooms?.name ?? "Rehearsal room"}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.rehearsal_rooms?.location ?? "Location TBC"}
                    </p>
                  </div>
                  {getStatusBadge(session.status)}
                </div>
                <Separator className="my-3" />
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Start</p>
                    <p className="text-sm font-medium">{formatDateTime(session.scheduled_start)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">{session.duration_hours} hours</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Featured song</p>
                    <p className="text-sm font-medium">{session.songs?.title ?? "Setlist rotation"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent history</CardTitle>
          <CardDescription>Completed or archived rehearsal sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rehearsals have been completed yet.</p>
          ) : (
            completed.map((session) => (
              <div key={session.id} className="rounded-lg border border-dashed border-muted bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{session.rehearsal_rooms?.name ?? "Rehearsal room"}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.rehearsal_rooms?.location ?? "Location TBC"}
                    </p>
                  </div>
                  {getStatusBadge(session.status)}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Started</p>
                    <p className="text-sm font-medium">{formatDateTime(session.scheduled_start)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Completed</p>
                    <p className="text-sm font-medium">
                      {session.completed_at ? formatDateTime(session.completed_at) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Cost</p>
                    <p className="text-sm font-medium">${(session.total_cost ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Chemistry gain</p>
                    <p className="text-sm font-medium">{session.chemistry_gain ?? 0}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BandRehearsalsTab;
