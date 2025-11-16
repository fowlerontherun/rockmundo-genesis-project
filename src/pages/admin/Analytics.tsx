import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Users, TrendingUp, Music, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [playersRes, bandsRes, gigsRes, songsRes, revenueRes] = await Promise.all([
        supabase.from("profiles").select("id, created_at", { count: "exact" }),
        supabase.from("bands").select("id", { count: "exact" }),
        supabase.from("gigs").select("id", { count: "exact" }),
        supabase.from("songs").select("id", { count: "exact" }),
        supabase.from("gig_outcomes").select("total_revenue"),
      ]);

      const totalRevenue = revenueRes.data?.reduce((sum, g) => sum + (g.total_revenue || 0), 0) || 0;

      return {
        totalPlayers: playersRes.count || 0,
        totalBands: bandsRes.count || 0,
        totalGigs: gigsRes.count || 0,
        totalSongs: songsRes.count || 0,
        totalRevenue,
        recentPlayers: playersRes.data?.slice(0, 10) || [],
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
        <p className="text-muted-foreground">Overview of game statistics and player activity</p>
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
            <div className="text-2xl font-bold">{stats?.totalPlayers || 0}</div>
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
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalRevenue || 0}</div>
          </CardContent>
        </Card>
      </div>

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
