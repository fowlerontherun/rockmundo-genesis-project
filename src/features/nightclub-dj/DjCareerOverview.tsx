import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Disc3, ExternalLink, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeDjCareer, type DjCareerPerformance } from "./djCareer";

type ClubLabel = { id: string; name: string; cityName: string };
type DjCityFanPopulation = { city_id: string; total_fans: number; total_attendance: number; sets_played: number };
type DjBookingAudience = { booking_id: string; attendance: number; venue_capacity: number; new_local_fans: number; satisfaction: number };

type DjCareerBooking = {
  id: string;
  club_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

/**
 * Selected-character DJ career overview. All queries remain read-only and
 * subject to the database's owner RLS; no browser outcome or payout writes.
 */
export function DjCareerOverview({
  profileId, clubs,
}: {
  profileId: string;
  clubs: ClubLabel[];
}) {
  const navigate = useNavigate();
  const clubNames = useMemo(() => new Map(clubs.map((club) =>
    [club.id, `${club.name} · ${club.cityName}`])), [clubs]);

  const { data: history, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ["dj-performances", profileId, "career"],
    queryFn: async () => {
      // The booked-set booking_id column is newer than the generated database types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, count, error } = await (supabase as any).from("player_dj_performances")
        .select("id,booking_id,performance_score,cash_earned,fame_gained,xp_gained", { count: "exact" })
        .eq("profile_id", profileId)
        .not("booking_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return { rows: (data ?? []) as DjCareerPerformance[], count };
    },
    staleTime: 30_000,
  });

  const { data: legacyCount, isError: legacyError } = useQuery({
    queryKey: ["dj-legacy-performances", profileId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error } = await (supabase as any).from("player_dj_performances")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId).is("booking_id", null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const { data: bookings = [], isLoading: bookingsLoading, isError: bookingsError } = useQuery<DjCareerBooking[]>({
    queryKey: ["dj-bookings", profileId, "career"],
    queryFn: async () => {
      // DJ booking table has not yet been regenerated in frontend database types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_bookings")
        .select("id,club_id,starts_at,ends_at,status")
        .eq("profile_id", profileId)
        .in("status", ["booked", "ready", "live", "resolving"])
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as DjCareerBooking[];
    },
    refetchInterval: 60_000,
  });

  const { data: localFans = [], isError: localFansError } = useQuery<DjCityFanPopulation[]>({
    queryKey: ["dj-city-fans", profileId],
    queryFn: async () => {
      // New RLS-protected character-city table is not yet in generated DB types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("profile_city_dj_fans")
        .select("city_id,total_fans,total_attendance,sets_played")
        .eq("profile_id", profileId).limit(250);
      if (error) throw error;
      return (data ?? []) as DjCityFanPopulation[];
    },
    staleTime: 30_000,
  });
  const { data: audiences = [], isError: audiencesError } = useQuery<DjBookingAudience[]>({
    queryKey: ["dj-booking-audiences", profileId],
    queryFn: async () => {
      // Immutable audience data is written only at server-verified settlement.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("dj_booking_audiences")
        .select("booking_id,attendance,venue_capacity,new_local_fans,satisfaction")
        .eq("profile_id", profileId)
        .order("settled_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as DjBookingAudience[];
    },
    staleTime: 30_000,
  });
  const totalLocalFans = localFans.reduce((total, city) => total + city.total_fans, 0);
  const totalDjAttendance = localFans.reduce((total, city) => total + city.total_attendance, 0);
  const firstCrowd = audiences[0];

  const summary = useMemo(
    () => summarizeDjCareer(history?.rows ?? [], history?.count ?? null),
    [history],
  );
  const sampledLabel = `Most recent ${summary.sampled} verified set${summary.sampled === 1 ? "" : "s"}`;

  return (
    <Card data-testid="dj-career-overview">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Disc3 className="h-5 w-5 text-primary" /> My DJ Career
          <Badge variant="outline">Booked sets only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {historyLoading && <p className="text-sm text-muted-foreground">Loading verified DJ history…</p>}
        {historyError ? (
          <p className="text-sm text-destructive" role="alert">Could not load DJ career history. Try refreshing.</p>
        ) : !historyLoading && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Verified DJ sets</p>
                <p className="text-lg font-semibold tabular-nums">{integer.format(summary.verifiedTotal)}</p></div>
              <div><p className="text-xs text-muted-foreground">Set earnings</p>
                <p className="text-lg font-semibold tabular-nums">{money.format(summary.recentCash)}</p></div>
              <div><p className="text-xs text-muted-foreground">DJ fame gained</p>
                <p className="text-lg font-semibold tabular-nums">{integer.format(summary.recentFame)}</p></div>
              <div><p className="text-xs text-muted-foreground">Average set score</p>
                <p className="text-lg font-semibold tabular-nums">{summary.averageScore === null ? "—" : `${summary.averageScore}/100`}</p></div>
            </div>
            <p className="text-xs text-muted-foreground">
              {sampledLabel} · {integer.format(summary.recentXp)} XP earned.
              {summary.isPartial
                ? " Earnings, fame, XP and score above describe only these recent sets, not your entire career."
                : " Earnings, fame, XP and score are from these verified booked sets."}
            </p>
            {summary.verifiedTotal === 0 && (
              <p className="text-sm text-muted-foreground">
                No server-verified DJ gigs yet. Prepare a setlist in a nightclub mixing studio;
                practice does not earn money, fame or XP.
              </p>
            )}
          </>
        )}
        <div className="border-t pt-3 space-y-2" data-testid="dj-local-fans-and-crowds">
          <h3 className="text-sm font-medium">My DJ audience and local following</h3>
          {(localFansError || audiencesError) ? (
            <p className="text-xs text-destructive" role="alert">
              Could not load verified DJ crowd or city follower totals.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Local DJ fans</p>
                  <p className="text-lg font-semibold tabular-nums">{integer.format(totalLocalFans)}</p>
                </div>
                <div><p className="text-xs text-muted-foreground">Total DJ attendance</p>
                  <p className="text-lg font-semibold tabular-nums">{integer.format(totalDjAttendance)}</p>
                </div>
                <div><p className="text-xs text-muted-foreground">Latest verified crowd</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {firstCrowd
                      ? `${integer.format(firstCrowd.attendance)} / ${integer.format(firstCrowd.venue_capacity)}`
                      : "—"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Followers are tracked separately for each city and grow only from settled,
                server-verified DJ performances. Crowds never exceed club capacity.
                Legacy practice and missed sets do not create followers.
              </p>
            </>
          )}
        </div>
        {typeof legacyCount === "number" && legacyCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {integer.format(legacyCount)} older instant DJ set{legacyCount === 1 ? "" : "s"} recorded separately;
            these are not included in verified booked-gig totals.
          </p>
        )}
        {legacyError && <p className="text-xs text-muted-foreground">Older DJ history could not be checked.</p>}

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Upcoming / live DJ sets</h3>
          </div>
          {bookingsLoading && <p className="text-sm text-muted-foreground">Loading bookings…</p>}
          {bookingsError && <p className="text-sm text-destructive" role="alert">Could not load DJ bookings.</p>}
          {!bookingsLoading && !bookingsError && bookings.length === 0 && (
            <p className="text-sm text-muted-foreground">No active bookings. Open a nightclub to prepare a DJ set.</p>
          )}
          {bookings.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <div>
                <p className="text-sm font-medium">{clubNames.get(booking.club_id) ?? "Nightclub"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(booking.starts_at).toLocaleString()} · {booking.status}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => navigate(`/nightclub/${booking.club_id}`)}>
                <ExternalLink className="h-3 w-3 mr-1" /> Open club
              </Button>
            </div>
          ))}
          {!bookingsLoading && bookings.length === 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Music2 className="h-3 w-3" /> Mixing practice is always reward-free.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
