import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlatformComparisonChart } from "./PlatformComparisonChart";

interface DetailedAnalyticsTabProps {
  userId: string;
}

export function DetailedAnalyticsTab({ userId }: DetailedAnalyticsTabProps) {
  const { data: analyticsData } = useQuery({
    queryKey: ['streaming-analytics-detailed', userId],
    queryFn: async () => {
      // Get user's song releases
      const { data: releases } = await supabase
        .from('song_releases')
        .select(`
          id,
          songs (title, user_id, band_id)
        `)
        .or(`songs.user_id.eq.${userId},songs.band_id.in.(select band_id from band_members where user_id = ${userId})`);

      if (!releases || releases.length === 0) return null;

      const releaseIds = releases.map(r => r.id);

      // Get daily analytics for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: dailyAnalytics } = await supabase
        .from('streaming_analytics_daily')
        .select('*')
        .in('song_release_id', releaseIds)
        .gte('analytics_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('analytics_date', { ascending: true });

      // Aggregate by date
      const dateMap = new Map<string, { streams: number; revenue: number; listeners: number }>();
      
      dailyAnalytics?.forEach(record => {
        const existing = dateMap.get(record.analytics_date) || { streams: 0, revenue: 0, listeners: 0 };
        dateMap.set(record.analytics_date, {
          streams: existing.streams + (record.daily_streams || 0),
          revenue: existing.revenue + (record.daily_revenue || 0),
          listeners: existing.listeners + (record.unique_listeners || 0),
        });
      });

      const chartData = Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        streams: data.streams,
        revenue: data.revenue,
        listeners: data.listeners,
      }));

      // Calculate totals
      const totalStreams = chartData.reduce((sum, d) => sum + d.streams, 0);
      const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
      const avgListeners = chartData.length > 0 
        ? Math.round(chartData.reduce((sum, d) => sum + d.listeners, 0) / chartData.length)
        : 0;

      return { chartData, totalStreams, totalRevenue, avgListeners };
    },
  });

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No analytics data available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Streams (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalStreams.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analyticsData.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Avg Daily Listeners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgListeners.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Streams Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => value.toLocaleString()}
              />
              <Legend />
              <Line type="monotone" dataKey="streams" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    <PlatformComparisonChart userId={userId} />
  </div>
);
}
