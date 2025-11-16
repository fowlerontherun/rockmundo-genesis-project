import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, TrendingUp, Users, BarChart3 } from "lucide-react";

const BandLearning = () => {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("week");

  // Fetch education engagement stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-learning-stats", timeRange],
    queryFn: async () => {
      const cutoffDate = new Date();
      if (timeRange === "week") {
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (timeRange === "month") {
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      }

      // Fetch mentor session stats
      const { data: mentorData, error: mentorError } = await supabase
        .from("experience_ledger")
        .select("*")
        .eq("activity_type", "mentor_session")
        .gte("created_at", timeRange === "all" ? "2000-01-01" : cutoffDate.toISOString());

      if (mentorError) throw mentorError;

      // Fetch book reading stats
      const { data: bookData, error: bookError } = await supabase
        .from("experience_ledger")
        .select("*")
        .eq("activity_type", "book_reading")
        .gte("created_at", timeRange === "all" ? "2000-01-01" : cutoffDate.toISOString());

      if (bookError) throw bookError;

      // Fetch university attendance stats
      const { data: uniData, error: uniError } = await supabase
        .from("experience_ledger")
        .select("*")
        .eq("activity_type", "university_attendance")
        .gte("created_at", timeRange === "all" ? "2000-01-01" : cutoffDate.toISOString());

      if (uniError) throw uniError;

      const totalXp = [...(mentorData || []), ...(bookData || []), ...(uniData || [])].reduce(
        (sum, entry) => sum + (entry.xp_amount || 0),
        0
      );

      const uniquePlayers = new Set([
        ...(mentorData || []).map((e) => e.user_id),
        ...(bookData || []).map((e) => e.user_id),
        ...(uniData || []).map((e) => e.user_id),
      ]).size;

      return {
        mentorSessions: mentorData?.length || 0,
        booksRead: bookData?.length || 0,
        universityAttendances: uniData?.length || 0,
        totalXpEarned: totalXp,
        uniquePlayers,
      };
    },
  });

  // Fetch top learners
  const { data: topLearners = [] } = useQuery({
    queryKey: ["admin-top-learners", timeRange],
    queryFn: async () => {
      const cutoffDate = new Date();
      if (timeRange === "week") {
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (timeRange === "month") {
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
      }

      const { data, error } = await supabase
        .from("experience_ledger")
        .select(`
          user_id,
          xp_amount,
          profiles!experience_ledger_user_id_fkey (
            display_name,
            username
          )
        `)
        .in("activity_type", ["mentor_session", "book_reading", "university_attendance"])
        .gte("created_at", timeRange === "all" ? "2000-01-01" : cutoffDate.toISOString());

      if (error) throw error;

      // Aggregate by user
      const userXp = (data || []).reduce((acc: any, entry: any) => {
        const userId = entry.user_id;
        if (!acc[userId]) {
          acc[userId] = {
            userId,
            displayName: entry.profiles?.display_name || entry.profiles?.username || "Unknown",
            totalXp: 0,
          };
        }
        acc[userId].totalXp += entry.xp_amount || 0;
        return acc;
      }, {});

      return Object.values(userXp)
        .sort((a: any, b: any) => b.totalXp - a.totalXp)
        .slice(0, 10);
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Band Learning Analytics</h1>
          <p className="text-muted-foreground">Track player engagement with educational features</p>
        </div>
      </div>

      <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
        <TabsList>
          <TabsTrigger value="week">Last 7 Days</TabsTrigger>
          <TabsTrigger value="month">Last 30 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value={timeRange} className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mentor Sessions</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.mentorSessions || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Books Read</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.booksRead || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">University Classes</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.universityAttendances || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total XP Earned</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.totalXpEarned?.toLocaleString() || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Learners</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stats?.uniquePlayers || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Learners */}
          <Card>
            <CardHeader>
              <CardTitle>Top Learners</CardTitle>
              <CardDescription>Players who earned the most educational XP</CardDescription>
            </CardHeader>
            <CardContent>
              {topLearners.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No learning activity in this time range
                </p>
              ) : (
                <div className="space-y-3">
                  {topLearners.map((learner: any, index: number) => (
                    <div
                      key={learner.userId}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={index < 3 ? "default" : "secondary"}>
                          #{index + 1}
                        </Badge>
                        <span className="font-medium">{learner.displayName}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {learner.totalXp.toLocaleString()} XP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BandLearning;
