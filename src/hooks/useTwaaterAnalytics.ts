import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TwaaterAnalytics {
  totals: {
    twaats: number;
    likes: number;
    retwaats: number;
    replies: number;
    views: number;
    followers: number;
  };
  engagementRate: number;
  topTwaats: Array<{
    id: string;
    body: string;
    created_at: string;
    likes: number;
    retwaats: number;
    replies: number;
    views: number;
    score: number;
  }>;
  followerGrowth: Array<{ date: string; followers: number }>;
  bestHourToPost: number | null;
  hourlyEngagement: Array<{ hour: number; avgEngagement: number; posts: number }>;
}

export const useTwaaterAnalytics = (accountId?: string) => {
  return useQuery({
    queryKey: ["twaater-analytics", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<TwaaterAnalytics> => {
      // Last 30 days of twaats with metrics
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data: twaats } = await supabase
        .from("twaats")
        .select(`id, body, created_at, metrics:twaat_metrics(likes, retwaats, replies, views)`)
        .eq("account_id", accountId!)
        .is("deleted_at", null)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      const { count: followers } = await supabase
        .from("twaater_follows")
        .select("*", { count: "exact", head: true })
        .eq("followed_account_id", accountId!);

      const { data: followsRows } = await supabase
        .from("twaater_follows")
        .select("created_at")
        .eq("followed_account_id", accountId!)
        .order("created_at", { ascending: true });

      const totals = { twaats: 0, likes: 0, retwaats: 0, replies: 0, views: 0, followers: followers || 0 };
      const hourBuckets: Record<number, { sum: number; count: number }> = {};
      const scored: TwaaterAnalytics["topTwaats"] = [];

      (twaats || []).forEach((t: any) => {
        const m = Array.isArray(t.metrics) ? t.metrics[0] : t.metrics;
        const likes = m?.likes || 0;
        const retwaats = m?.retwaats || 0;
        const replies = m?.replies || 0;
        const views = m?.views || 0;
        totals.twaats += 1;
        totals.likes += likes;
        totals.retwaats += retwaats;
        totals.replies += replies;
        totals.views += views;
        const score = likes * 2 + retwaats * 3 + replies * 1.5;
        scored.push({ id: t.id, body: t.body, created_at: t.created_at, likes, retwaats, replies, views, score });

        const hour = new Date(t.created_at).getHours();
        if (!hourBuckets[hour]) hourBuckets[hour] = { sum: 0, count: 0 };
        hourBuckets[hour].sum += score;
        hourBuckets[hour].count += 1;
      });

      const engagementRate = totals.views > 0
        ? ((totals.likes + totals.retwaats + totals.replies) / totals.views) * 100
        : 0;

      const topTwaats = scored.sort((a, b) => b.score - a.score).slice(0, 5);

      // Follower growth: cumulative count by day
      const growthMap: Record<string, number> = {};
      (followsRows || []).forEach((f: any) => {
        const day = (f.created_at || "").slice(0, 10);
        if (!day) return;
        growthMap[day] = (growthMap[day] || 0) + 1;
      });
      const sortedDays = Object.keys(growthMap).sort();
      let cumulative = 0;
      const followerGrowth = sortedDays.map((day) => {
        cumulative += growthMap[day];
        return { date: day, followers: cumulative };
      });

      const hourlyEngagement = Array.from({ length: 24 }, (_, h) => {
        const b = hourBuckets[h];
        return {
          hour: h,
          avgEngagement: b ? b.sum / b.count : 0,
          posts: b ? b.count : 0,
        };
      });
      const best = hourlyEngagement
        .filter((h) => h.posts >= 2)
        .sort((a, b) => b.avgEngagement - a.avgEngagement)[0];

      return {
        totals,
        engagementRate,
        topTwaats,
        followerGrowth,
        bestHourToPost: best ? best.hour : null,
        hourlyEngagement,
      };
    },
  });
};
