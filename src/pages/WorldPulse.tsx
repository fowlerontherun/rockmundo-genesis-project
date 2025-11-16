import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Music, Radio, Globe, Activity, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const WorldPulse = () => {
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["world-pulse-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const { data: topCharts = [] } = useQuery({
    queryKey: ["world-pulse-charts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_entries")
        .select(`
          *,
          song:songs(title, genre)
        `)
        .eq("chart_type", "global")
        .eq("chart_date", new Date().toISOString().split('T')[0])
        .order("rank", { ascending: true })
        .limit(10);
      return data || [];
    },
  });

  const { data: trendingArtists = [] } = useQuery({
    queryKey: ["world-pulse-trending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bands")
        .select("name, genre, fame, weekly_fans")
        .order("weekly_fans", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-8 w-8" />
          World Pulse
        </h1>
        <p className="text-muted-foreground">Real-time global music industry activity</p>
      </div>

      <Tabs defaultValue="trending" className="w-full">
        <TabsList>
          <TabsTrigger value="trending">Trending Now</TabsTrigger>
          <TabsTrigger value="charts">Global Charts</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending Artists
              </CardTitle>
              <CardDescription>Most active artists in the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              {trendingArtists.length > 0 ? (
                <div className="space-y-3">
                  {trendingArtists.map((artist, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{artist.name}</p>
                          <p className="text-sm text-muted-foreground">{artist.genre}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{artist.weekly_fans?.toLocaleString() || 0} fans</p>
                        <p className="text-sm text-muted-foreground">{artist.fame || 0} fame</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending artists yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Global Charts
              </CardTitle>
              <CardDescription>Top songs and albums worldwide</CardDescription>
            </CardHeader>
            <CardContent>
              {topCharts.length > 0 ? (
                <div className="space-y-3">
                  {topCharts.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {entry.rank}
                        </div>
                        <div>
                          <p className="font-medium">{(entry.song as any)?.title || 'Unknown'}</p>
                          <Badge variant="outline">{(entry.song as any)?.genre || 'Unknown'}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                        <span className="text-sm text-muted-foreground">{entry.plays_count?.toLocaleString() || 0} plays</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Charts updating...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest events from around the world</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{activity.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{activity.activity_type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.created_at || ''), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        {activity.earnings && (
                          <Badge variant="secondary">+${activity.earnings}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorldPulse;
