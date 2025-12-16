import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";

export function WellnessTrends() {
  const { user } = useAuth();

  const { data: trends } = useQuery({
    queryKey: ["wellness-trends", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get activities from the last 7 days
      const startDate = subDays(new Date(), 7);
      const { data: activities } = await supabase
        .from("experience_ledger")
        .select("activity_type, xp_amount, created_at")
        .eq("user_id", user.id)
        .in("activity_type", ["rest", "exercise", "meditation", "therapy", "nutrition", "yoga"])
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      // Create daily aggregates
      const days = eachDayOfInterval({ start: startDate, end: new Date() });
      const dailyData = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayActivities = activities?.filter((a) =>
          a.created_at.startsWith(dayStr)
        ) || [];

        const exerciseXp = dayActivities
          .filter((a) => a.activity_type === "exercise")
          .reduce((sum, a) => sum + a.xp_amount, 0);

        const restXp = dayActivities
          .filter((a) => a.activity_type === "rest")
          .reduce((sum, a) => sum + a.xp_amount, 0);

        const mentalXp = dayActivities
          .filter((a) => ["meditation", "therapy"].includes(a.activity_type))
          .reduce((sum, a) => sum + a.xp_amount, 0);

        return {
          date: format(day, "MMM d"),
          exercise: exerciseXp,
          rest: restXp,
          mental: mentalXp,
          total: exerciseXp + restXp + mentalXp,
        };
      });

      return dailyData;
    },
    enabled: !!user?.id,
  });

  const totalXp = trends?.reduce((sum, d) => sum + d.total, 0) || 0;
  const avgDaily = trends?.length ? Math.round(totalXp / trends.length) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Wellness Trends
        </CardTitle>
        <CardDescription>
          Your wellness activity over the past week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{totalXp}</p>
            <p className="text-xs text-muted-foreground">Total Wellness XP</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{avgDaily}</p>
            <p className="text-xs text-muted-foreground">Daily Average</p>
          </div>
        </div>

        {trends && trends.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="exercise"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Exercise"
                />
                <Line
                  type="monotone"
                  dataKey="rest"
                  stroke="hsl(142.1 76.2% 36.3%)"
                  strokeWidth={2}
                  name="Rest"
                />
                <Line
                  type="monotone"
                  dataKey="mental"
                  stroke="hsl(262.1 83.3% 57.8%)"
                  strokeWidth={2}
                  name="Mental"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No wellness activity data yet. Start exercising and resting to see trends!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
