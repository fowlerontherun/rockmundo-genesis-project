import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminRoute } from "@/components/AdminRoute";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, Music, Mic2, BarChart3, DollarSign, Activity, 
  AlertCircle, CheckCircle2, Clock, TrendingUp, Settings, Wrench
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface GameStats {
  total_players: number;
  active_today: number;
  active_week: number;
  total_bands: number;
  total_songs: number;
  completed_gigs: number;
  total_releases: number;
  total_economy: number;
  activities_today: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-game-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_game_stats")
        .select("*")
        .single();
      if (error) throw error;
      return data as GameStats;
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["admin-recent-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: cronJobs } = useQuery({
    queryKey: ["admin-cron-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cron_job_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const quickActions = [
    { label: "Game Balance", path: "/admin/game-balance", icon: Settings },
    { label: "Player Management", path: "/admin/players", icon: Users },
    { label: "Release Admin", path: "/admin/releases", icon: Music },
    { label: "Cron Monitor", path: "/admin/cron-monitor", icon: Clock },
    { label: "Tutorials", path: "/admin/tutorials", icon: Wrench },
  ];

  const statCards = [
    { label: "Total Players", value: stats?.total_players, icon: Users, color: "text-blue-500" },
    { label: "Active Today", value: stats?.active_today, icon: Activity, color: "text-green-500" },
    { label: "Active This Week", value: stats?.active_week, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Total Bands", value: stats?.total_bands, icon: Mic2, color: "text-purple-500" },
    { label: "Total Songs", value: stats?.total_songs, icon: Music, color: "text-pink-500" },
    { label: "Completed Gigs", value: stats?.completed_gigs, icon: BarChart3, color: "text-orange-500" },
    { label: "Released Albums", value: stats?.total_releases, icon: Music, color: "text-cyan-500" },
    { label: "Total Economy", value: `$${(stats?.total_economy || 0).toLocaleString()}`, icon: DollarSign, color: "text-yellow-500" },
  ];

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Game overview and quick actions</p>
          </div>
          <Badge variant="outline" className="w-fit">
            <Activity className="h-4 w-4 mr-2" />
            {stats?.activities_today || 0} activities today
          </Badge>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.path}
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(action.path)}
                  className="gap-2"
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-20 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value ?? 0}</p>
                    )}
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest game activities logged</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {recentLogs?.length ? (
                  recentLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                      <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{log.activity_type}</p>
                        <p className="text-xs text-muted-foreground truncate">{log.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                      {log.amount && (
                        <Badge variant="secondary" className="shrink-0">
                          {log.amount > 0 ? '+' : ''}{log.amount}
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Health</CardTitle>
              <CardDescription>Recent cron job status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cronJobs?.length ? (
                  cronJobs.map((job: any) => (
                    <div key={job.id} className="flex items-center gap-3 text-sm">
                      {job.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : job.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{job.job_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.started_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={job.status === 'success' ? 'default' : 'destructive'}>
                        {job.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent cron jobs</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default AdminDashboard;