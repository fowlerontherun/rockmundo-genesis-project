import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Users, TrendingUp, Music, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface RetentionAnalytics {
  tracking_since: string | null;
  total_accounts: number;
  signups_7d: number;
  signups_30d: number;
  dau: number;
  wau: number;
  mau: number;
  established_active_7d: number;
  cohorts: {
    d1_eligible: number;
    d1_returned: number;
    d7_eligible: number;
    d7_returned: number;
    d30_eligible: number;
    d30_returned: number;
  };
  funnel_30d: {
    signups: number;
    characters_created: number;
    projects_started: number;
    songs_created: number;
    activities_scheduled: number;
    band_members: number;
  };
  daily_activity: Array<{ date: string; accounts: number }>;
}

const countLabel = (value?: number) => value == null ? "—" : value.toLocaleString();
const retentionRate = (returned: number, eligible: number) =>
  eligible > 0 ? `${Math.round((returned / eligible) * 100)}%` : "Not available yet";

export default function Analytics() {
  const { data: retention, error: retentionError, isLoading: retentionLoading } = useQuery({
    queryKey: ["admin-player-retention"],
    queryFn: async (): Promise<RetentionAnalytics> => {
      const { data, error } = await (supabase.rpc as any)("admin_get_player_retention_analytics");
      if (error) throw error;
      return data as RetentionAnalytics;
    },
    staleTime: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [bandsRes, gigsRes, songsRes, revenueRes] = await Promise.all([
        supabase.from("bands").select("id", { count: "exact" }),
        supabase.from("gigs").select("id", { count: "exact" }),
        supabase.from("songs").select("id", { count: "exact" }),
        supabase.from("gig_outcomes").select("total_revenue"),
      ]);

      const totalRevenue = revenueRes.data?.reduce((sum, g) => sum + (g.total_revenue || 0), 0) || 0;

      return {
        totalBands: bandsRes.count || 0,
        totalGigs: gigsRes.count || 0,
        totalSongs: songsRes.count || 0,
        totalRevenue,
      };
    },
  });

  const { data: activityFeed = [] } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_feed")
        .select(`
          *,
          profiles:user_id(display_name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">Account-based player engagement, retention and game activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{countLabel(retention?.total_accounts)}</div>
            <p className="text-xs text-muted-foreground">Registered accounts, not characters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Bands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalBands || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Music className="h-4 w-4" />
              Total Songs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSongs || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Gigs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalGigs || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Gig Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalRevenue || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Player retention</CardTitle>
          <CardDescription>
            Unique accounts opening the game on a UTC calendar day. Activity measurement begins with the first visit recorded after deployment; historical retention cannot be reconstructed from last-login timestamps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {retentionError ? (
            <p role="alert" className="text-sm text-destructive">Retention analytics are unavailable. Check that the player-retention database migration is deployed and your account has the admin role.</p>
          ) : retentionLoading ? (
            <p className="text-sm text-muted-foreground">Loading retention metrics…</p>
          ) : retention ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Daily active", retention.dau],
                  ["Weekly active", retention.wau],
                  ["30-day active", retention.mau],
                  ["Established active · 7d", retention.established_active_7d],
                  ["New accounts · 7d", retention.signups_7d],
                  ["New accounts · 30d", retention.signups_30d],
                ].map(([label, count]) => (
                  <div className="rounded-md border p-3" key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold">{countLabel(count as number)}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-1 font-semibold">Signup cohort return rates</h3>
                <p className="mb-3 text-xs text-muted-foreground">Exact D1, D7 and D30: opened the game on the 1st, 7th or 30th UTC day after signup. Only signups after tracking started and old enough to qualify are counted.</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Return day</TableHead><TableHead>Eligible accounts</TableHead><TableHead>Returned</TableHead><TableHead>Rate</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {([1, 7, 30] as const).map(day => {
                      const eligible = retention.cohorts[`d${day}_eligible`];
                      const returned = retention.cohorts[`d${day}_returned`];
                      return <TableRow key={day}><TableCell>D{day}</TableCell><TableCell>{eligible}</TableCell><TableCell>{returned}</TableCell><TableCell>{retentionRate(returned, eligible)}</TableCell></TableRow>;
                    })}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="mb-3 font-semibold">Daily active accounts · last 14 UTC days</h3>
                <div className="flex h-32 items-end gap-1" role="img" aria-label={`Daily active accounts: ${retention.daily_activity.map(d => `${d.date}: ${d.accounts}`).join(", ")}`}>
                  {retention.daily_activity.map((day) => {
                    const max = Math.max(1, ...retention.daily_activity.map(d => d.accounts));
                    return <div key={day.date} className="flex-1 rounded-t bg-primary/75" style={{ height: `${day.accounts ? Math.max(4, day.accounts / max * 100) : 1}%` }} title={`${day.date}: ${day.accounts} active accounts`} />;
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{retention.tracking_since ? `Recording since ${format(new Date(retention.tracking_since), "MMM d, yyyy")}` : "Waiting for the first tracked game visit"}</p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {retention?.funnel_30d && (
        <Card>
          <CardHeader>
            <CardTitle>New-player activation · last 30 days</CardTitle>
            <CardDescription>Of accounts registered in the past 30 days, how many have ever completed each action. These milestones overlap and are not sequential.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ["Registered", retention.funnel_30d.signups],
              ["Made character", retention.funnel_30d.characters_created],
              ["Started a song", retention.funnel_30d.projects_started],
              ["Created song", retention.funnel_30d.songs_created],
              ["Scheduled activity", retention.funnel_30d.activities_scheduled],
              ["Joined a band", retention.funnel_30d.band_members],
            ].map(([label, count]) => (
              <div className="rounded-md border p-3" key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-semibold">{countLabel(count as number)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest player actions across the game</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityFeed.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    {(activity.profiles as any)?.display_name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{activity.activity_type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {activity.message}
                  </TableCell>
                  <TableCell>
                    {activity.earnings ? `$${activity.earnings}` : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(activity.created_at), "MMM d, HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
