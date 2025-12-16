import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3 } from "lucide-react";

interface PlatformComparisonChartProps {
  userId: string;
}

export function PlatformComparisonChart({ userId }: PlatformComparisonChartProps) {
  // First fetch band IDs
  const { data: userBandIds } = useQuery({
    queryKey: ['user-band-ids-platform-chart', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', userId);
      return data?.map(b => b.band_id) || [];
    }
  });

  const { data: platformData } = useQuery({
    queryKey: ['streaming-platform-comparison', userId, userBandIds],
    queryFn: async () => {
      // Build proper filter for user's releases
      let query = supabase
        .from('song_releases')
        .select('id, platform_name, total_streams, total_revenue')
        .eq('is_active', true);

      if (userBandIds && userBandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${userBandIds.join(',')})`);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data: releases } = await query;

      if (!releases || releases.length === 0) return [];

      // Aggregate by platform name directly from song_releases
      const platformMap = new Map<string, { streams: number; revenue: number }>();
      
      releases.forEach(release => {
        const platform = release.platform_name || 'Unknown';
        const existing = platformMap.get(platform) || { streams: 0, revenue: 0 };
        platformMap.set(platform, {
          streams: existing.streams + Number(release.total_streams || 0),
          revenue: existing.revenue + Number(release.total_revenue || 0),
        });
      });

      return Array.from(platformMap.entries()).map(([platform, data]) => ({
        platform,
        streams: data.streams,
        revenue: data.revenue,
      }));
    },
    enabled: userBandIds !== undefined
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
