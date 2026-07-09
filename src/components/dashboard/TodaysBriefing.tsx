import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow, isAfter } from "date-fns";
import { AlertTriangle, Bell, CalendarClock, HeartPulse, Inbox, Music2, Radio, TrendingUp, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { supabase } from "@/integrations/supabase/client";

interface TodaysBriefingProps {
  profile: any;
  userId?: string;
}

type BriefingItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  tone?: "default" | "warning" | "good";
  icon: typeof CalendarClock;
};

const todayIso = () => new Date().toISOString();
const dateOnly = (date: Date) => date.toISOString().split("T")[0];

export function TodaysBriefing({ profile, userId }: TodaysBriefingProps) {
  const profileId = profile?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["todays-briefing", userId, profileId],
    enabled: !!userId && !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const inSevenDays = addDays(now, 7);
      const thirtyDaysAgo = addDays(now, -30);
      const today = dateOnly(now);

      const bandIdsResult = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      if (bandIdsResult.error) throw bandIdsResult.error;
      const bandIds = (bandIdsResult.data ?? []).map((row: any) => row.band_id).filter(Boolean);

      const [activitiesResult, inboxResult, notificationsResult, releasesResult, activityLogResult, chartResult] = await Promise.all([
        supabase
          .from("player_scheduled_activities")
          .select("id, title, activity_type, scheduled_start, location, status, linked_recording_id")
          .eq("profile_id", profileId)
          .gte("scheduled_start", todayIso())
          .lte("scheduled_start", inSevenDays.toISOString())
          .order("scheduled_start", { ascending: true })
          .limit(4),
        supabase
          .from("player_inbox")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false)
          .eq("is_archived", false),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null),
        supabase
          .from("song_releases")
          .select("id, release_date, release_type, platform_name, total_streams, band_id, user_id")
          .gte("release_date", today)
          .lte("release_date", dateOnly(inSevenDays))
          .order("release_date", { ascending: true })
          .limit(4),
        bandIds.length > 0
          ? supabase
              .from("game_activity_logs")
              .select("id, description, created_at, band_id")
              .in("band_id", bandIds)
              .gte("created_at", thirtyDaysAgo.toISOString())
              .order("created_at", { ascending: false })
              .limit(2)
          : Promise.resolve({ data: [], error: null }),
        bandIds.length > 0
          ? (supabase as any)
              .from("chart_entries")
              .select("id, rank, previous_rank, trend, chart_date, country, song_id, songs(title, band_id, user_id)")
              .eq("chart_date", today)
              .order("rank", { ascending: true })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const results = [activitiesResult, inboxResult, notificationsResult, releasesResult, activityLogResult, chartResult];
      const failed = results.find((result: any) => result.error);
      if (failed?.error) throw failed.error;

      return {
        activities: activitiesResult.data ?? [],
        unreadInbox: inboxResult.count ?? 0,
        unreadNotifications: notificationsResult.count ?? 0,
        releases: (releasesResult.data ?? []).filter((release: any) =>
          release.user_id === userId || (release.band_id && bandIds.includes(release.band_id))
        ),
        bandActivity: activityLogResult.data ?? [],
        chartEntries: (chartResult.data ?? []).filter((entry: any) => {
          const song = Array.isArray(entry.songs) ? entry.songs[0] : entry.songs;
          return song?.user_id === userId || (song?.band_id && bandIds.includes(song.band_id));
        }),
      };
    },
  });

  const items = useMemo<BriefingItem[]>(() => {
    const next: BriefingItem[] = [];
    if ((profile?.health ?? 100) <= 35) next.push({ id: "health", title: "Health needs attention", description: `Health is at ${profile.health}%. Rest before booking high-pressure work.`, href: "/wellness", tone: "warning", icon: HeartPulse });
    if ((profile?.energy ?? 100) <= 35) next.push({ id: "energy", title: "Energy is low", description: `Energy is at ${profile.energy}%. Sleep or recover before rehearsals and gigs.`, href: "/wellness", tone: "warning", icon: Zap });

    data?.activities?.slice(0, 3).forEach((activity: any) => {
      const start = new Date(activity.scheduled_start);
      next.push({
        id: `activity-${activity.id}`,
        title: activity.linked_recording_id ? "Recording session coming up" : activity.title,
        description: `${format(start, "EEE, MMM d h:mm a")}${activity.location ? ` · ${activity.location}` : ""}`,
        href: "/schedule",
        icon: activity.linked_recording_id ? Music2 : CalendarClock,
      });
    });

    if ((data?.unreadInbox ?? 0) > 0) next.push({ id: "inbox", title: "Unread inbox", description: `${data?.unreadInbox} unread message${data?.unreadInbox === 1 ? "" : "s"} waiting.`, href: "/inbox", icon: Inbox });
    if ((data?.unreadNotifications ?? 0) > 0) next.push({ id: "notifications", title: "New notifications", description: `${data?.unreadNotifications} unread notification${data?.unreadNotifications === 1 ? "" : "s"}.`, href: "/notifications", icon: Bell });

    data?.chartEntries?.slice(0, 2).forEach((entry: any) => {
      const song = Array.isArray(entry.songs) ? entry.songs[0] : entry.songs;
      const movement = entry.previous_rank ? entry.previous_rank - entry.rank : 0;
      next.push({
        id: `chart-${entry.id}`,
        title: `${song?.title ?? "Your track"} is charting`,
        description: `#${entry.rank} in ${entry.country ?? "the chart"}${movement !== 0 ? ` · ${movement > 0 ? "up" : "down"} ${Math.abs(movement)}` : ""}.`,
        href: "/country-charts",
        tone: movement > 0 ? "good" : movement < 0 ? "warning" : "default",
        icon: TrendingUp,
      });
    });

    data?.releases?.slice(0, 2).forEach((release: any) => {
      const releaseDate = new Date(release.release_date);
      next.push({
        id: `release-${release.id}`,
        title: isAfter(releaseDate, new Date()) ? "Release scheduled" : "Release day reminder",
        description: `${release.release_type} on ${release.platform_name ?? "streaming"} · ${format(releaseDate, "MMM d")}`,
        href: "/releases",
        icon: Radio,
      });
    });

    data?.bandActivity?.slice(0, 2).forEach((activity: any) => {
      next.push({ id: `band-${activity.id}`, title: "Band activity", description: `${activity.description} · ${formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}`, href: "/band", icon: Users });
    });

    return next.slice(0, 8);
  }, [data, profile]);

  if (isLoading) return <PageLoadingState title="Loading today’s briefing" description="Checking your schedule, inbox, charts, releases, and band activity..." />;
  if (error) return <PageErrorState title="Today’s Briefing could not be loaded" description="The dashboard is still available, but the briefing data could not be refreshed." onRetry={() => void refetch()} />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" />Today’s Briefing</CardTitle>
            <CardDescription>Context from your schedule, messages, charts, releases, vitals, and band.</CardDescription>
          </div>
          {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <PageEmptyState title="Nothing urgent today" description="No upcoming activity, unread messages, health warnings, chart moves, or release reminders need attention." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {items.map((item) => {
              const Icon = item.icon;
              const row = <div className={`flex h-full items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/40 ${item.tone === "warning" ? "border-warning/40 bg-warning/5" : item.tone === "good" ? "border-green-500/30 bg-green-500/5" : "bg-card/50"}`}>
                <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${item.tone === "warning" ? "text-warning" : item.tone === "good" ? "text-green-500" : "text-primary"}`} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-tight">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div>
                {item.tone === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              </div>;
              return item.href ? <Link key={item.id} to={item.href}>{row}</Link> : <div key={item.id}>{row}</div>;
            })}
          </div>
        )}
        {items.length > 0 && <div className="mt-3 flex justify-end"><Button asChild size="sm" variant="outline"><Link to="/schedule">Open schedule</Link></Button></div>}
      </CardContent>
    </Card>
  );
}
