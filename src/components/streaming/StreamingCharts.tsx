import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface StreamingChartsProps {
  releaseId?: string;
  userId?: string;
}

export function StreamingCharts({ releaseId, userId }: StreamingChartsProps) {
  const { data: analyticsData } = useQuery({
    queryKey: ["streaming-analytics-charts", releaseId, userId],
    queryFn: async () => {
      // Get streaming analytics from streaming_analytics_daily table
      const { data: analytics } = await supabase
        .from("streaming_analytics_daily")
        .select(`
          *,
          song_release:song_releases(
            song:songs(title),
            platform:streaming_platforms(platform_name)
          )
        `)
        .order("analytics_date", { ascending: true })
        .limit(90);

      return analytics || [];
    }
  });

  // Aggregate data by date using correct column names
  const dailyData = analyticsData?.reduce((acc, item) => {
    const date = new Date(item.analytics_date).toLocaleDateString();
    const existing = acc.find(d => d.date === date);
    
    if (existing) {
      existing.streams += item.daily_streams || 0;
      existing.revenue += item.daily_revenue || 0;
    } else {
      acc.push({
        date,
        streams: item.daily_streams || 0,
        revenue: item.daily_revenue || 0
      });
    }
    
    return acc;
  }, [] as Array<{ date: string; streams: number; revenue: number }>);

  // Platform breakdown using platform_name column
  const platformData = analyticsData?.reduce((acc, item) => {
    const platformName = item.platform_name || item.song_release?.platform?.platform_name || "Unknown";
    const existing = acc.find(p => p.platform === platformName);
    
    if (existing) {
      existing.streams += item.daily_streams || 0;
      existing.revenue += item.daily_revenue || 0;
    } else {
      acc.push({
        platform: platformName,
        streams: item.daily_streams || 0,
        revenue: item.daily_revenue || 0
      });
    }
    
    return acc;
  }, [] as Array<{ platform: string; streams: number; revenue: number }>);

  // Song performance
  const songData = analyticsData?.reduce((acc, item) => {
    const songTitle = item.song_release?.song?.title || "Unknown";
    const existing = acc.find(s => s.song === songTitle);
    
    if (existing) {
      existing.streams += item.daily_streams || 0;
      existing.revenue += item.daily_revenue || 0;
    } else {
      acc.push({
        song: songTitle,
        streams: item.daily_streams || 0,
        revenue: item.daily_revenue || 0
      });
    }
    
    return acc;
  }, [] as Array<{ song: string; streams: number; revenue: number }>);

  if (!analyticsData || analyticsData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-12">
          <p className="text-muted-foreground">No streaming analytics available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Streams & Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="streams" stroke="hsl(var(--primary))" name="Streams" />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" name="Revenue ($)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="streams" fill="hsl(var(--primary))" name="Streams" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance by Song</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={songData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="song" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="streams" fill="hsl(var(--chart-3))" name="Streams" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}