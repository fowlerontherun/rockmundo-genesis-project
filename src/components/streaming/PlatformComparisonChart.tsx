import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3 } from "lucide-react";

interface PlatformComparisonChartProps {
  userId: string;
}

export function PlatformComparisonChart({ userId }: PlatformComparisonChartProps) {
  const { data: platformData } = useQuery({
    queryKey: ['streaming-platform-comparison', userId],
    queryFn: async () => {
      // Get user's song releases
      const { data: releases } = await supabase
        .from('song_releases')
        .select('id, songs(user_id, band_id)')
        .or(`songs.user_id.eq.${userId},songs.band_id.in.(select band_id from band_members where user_id = ${userId})`);

      if (!releases || releases.length === 0) return [];

      const releaseIds = releases.map(r => r.id);

      // Get analytics by platform
      const { data: analytics } = await supabase
        .from('streaming_analytics_daily')
        .select('platform_name, daily_streams, daily_revenue')
        .in('song_release_id', releaseIds)
        .not('platform_name', 'is', null);

      // Aggregate by platform
      const platformMap = new Map<string, { streams: number; revenue: number }>();
      
      analytics?.forEach(record => {
        const platform = record.platform_name || 'Unknown';
        const existing = platformMap.get(platform) || { streams: 0, revenue: 0 };
        platformMap.set(platform, {
          streams: existing.streams + (record.daily_streams || 0),
          revenue: existing.revenue + (record.daily_revenue || 0),
        });
      });

      return Array.from(platformMap.entries()).map(([platform, data]) => ({
        platform,
        streams: data.streams,
        revenue: data.revenue,
      }));
    },
  });

  if (!platformData || platformData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Platform Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={platformData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => value.toLocaleString()} />
            <Legend />
            <Bar yAxisId="left" dataKey="streams" fill="hsl(var(--primary))" name="Streams" />
            <Bar yAxisId="right" dataKey="revenue" fill="hsl(var(--secondary))" name="Revenue ($)" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
