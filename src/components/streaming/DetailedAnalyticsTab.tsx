import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, DollarSign, Users, BarChart3, SkipForward, PlayCircle, Calendar, Globe } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PlatformComparisonChart } from "./PlatformComparisonChart";

interface DetailedAnalyticsTabProps {
  userId: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function DetailedAnalyticsTab({ userId }: DetailedAnalyticsTabProps) {
  // First fetch band IDs
  const { data: userBandIds } = useQuery({
    queryKey: ['user-band-ids-detailed-analytics', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', userId);
      return data?.map(b => b.band_id) || [];
    }
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['streaming-analytics-detailed', userId, userBandIds],
    queryFn: async () => {
      // Get user's song releases with proper filtering
      let query = supabase
        .from('song_releases')
        .select('id')
        .eq('is_active', true);

      if (userBandIds && userBandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${userBandIds.join(',')})`);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data: releases } = await query;

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
      const dateMap = new Map<string, { streams: number; revenue: number; listeners: number; skipRate: number; completionRate: number; count: number }>();
      
      dailyAnalytics?.forEach(record => {
        const existing = dateMap.get(record.analytics_date) || { streams: 0, revenue: 0, listeners: 0, skipRate: 0, completionRate: 0, count: 0 };
        dateMap.set(record.analytics_date, {
          streams: existing.streams + (record.daily_streams || 0),
          revenue: existing.revenue + (record.daily_revenue || 0),
          listeners: existing.listeners + (record.unique_listeners || 0),
          skipRate: existing.skipRate + (Number(record.skip_rate) || 0),
          completionRate: existing.completionRate + (Number(record.completion_rate) || 0),
          count: existing.count + 1,
        });
      });

      const chartData = Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        streams: data.streams,
        revenue: data.revenue,
        listeners: data.listeners,
        skipRate: data.count > 0 ? Math.round(data.skipRate / data.count) : 0,
        completionRate: data.count > 0 ? Math.round(data.completionRate / data.count) : 0,
      }));

      // Calculate totals
      const totalStreams = chartData.reduce((sum, d) => sum + d.streams, 0);
      const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
      const avgListeners = chartData.length > 0 
        ? Math.round(chartData.reduce((sum, d) => sum + d.listeners, 0) / chartData.length)
        : 0;
      const avgSkipRate = chartData.length > 0
        ? Math.round(chartData.reduce((sum, d) => sum + d.skipRate, 0) / chartData.length)
        : 0;
      const avgCompletionRate = chartData.length > 0
        ? Math.round(chartData.reduce((sum, d) => sum + d.completionRate, 0) / chartData.length)
        : 0;

      // Aggregate demographics
      const ageGroups = new Map<string, number>();
      const regions = new Map<string, number>();
      
      dailyAnalytics?.forEach(record => {
        if (record.listener_age_group) {
          const current = ageGroups.get(record.listener_age_group) || 0;
          ageGroups.set(record.listener_age_group, current + (record.daily_streams || 0));
        }
        if (record.listener_region) {
          const current = regions.get(record.listener_region) || 0;
          regions.set(record.listener_region, current + (record.daily_streams || 0));
        }
      });

      const ageGroupData = Array.from(ageGroups.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
        
      const regionData = Array.from(regions.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Revenue projections
      const avgDailyRevenue = chartData.length > 0 ? totalRevenue / chartData.length : 0;
      const projectedWeekly = Math.round(avgDailyRevenue * 7);
      const projectedMonthly = Math.round(avgDailyRevenue * 30);
      const projectedYearly = Math.round(avgDailyRevenue * 365);

      return { 
        chartData, 
        totalStreams, 
        totalRevenue, 
        avgListeners,
        avgSkipRate,
        avgCompletionRate,
        ageGroupData,
        regionData,
        projectedWeekly,
        projectedMonthly,
        projectedYearly
      };
    },
    enabled: userBandIds !== undefined
  });

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-12">
            No analytics data available yet. Release songs to streaming platforms to start tracking performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Total Streams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalStreams.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${analyticsData.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Avg Listeners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgListeners.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <SkipForward className="h-3 w-3" />
              Skip Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgSkipRate}%</div>
            <Progress value={100 - analyticsData.avgSkipRate} className="h-1 mt-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <PlayCircle className="h-3 w-3" />
              Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{analyticsData.avgCompletionRate}%</div>
            <Progress value={analyticsData.avgCompletionRate} className="h-1 mt-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              30d Projected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${analyticsData.projectedMonthly.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Streams Over Time */}
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
              <Line type="monotone" dataKey="streams" stroke="hsl(var(--primary))" strokeWidth={2} name="Streams" />
              <Line type="monotone" dataKey="listeners" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Unique Listeners" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue & Demographics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analyticsData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Demographics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Listener Demographics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.ageGroupData.length > 0 || analyticsData.regionData.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {/* Age Groups */}
                {analyticsData.ageGroupData.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Age Groups</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie
                          data={analyticsData.ageGroupData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={50}
                          label={({ name }) => name}
                        >
                          {analyticsData.ageGroupData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top Regions */}
                {analyticsData.regionData.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Top Regions</p>
                    <div className="space-y-2">
                      {analyticsData.regionData.map((region, idx) => (
                        <div key={region.name} className="flex items-center justify-between text-sm">
                          <span className="truncate">{region.name}</span>
                          <span className="font-medium">{region.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Demographics data will appear as you gain more streams
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Projections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Revenue Projections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">7 Day Projection</p>
              <p className="text-2xl font-bold text-green-500">${analyticsData.projectedWeekly.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">30 Day Projection</p>
              <p className="text-2xl font-bold text-green-500">${analyticsData.projectedMonthly.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">1 Year Projection</p>
              <p className="text-2xl font-bold text-green-500">${analyticsData.projectedYearly.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Based on your average daily revenue of ${(analyticsData.totalRevenue / (analyticsData.chartData.length || 1)).toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Platform Comparison */}
      <PlatformComparisonChart userId={userId} />
    </div>
  );
}