import { supabase } from "@/integrations/supabase/client";
import { supabaseArrayOrThrow } from "@/services/supabaseQuery";

export type TrendingTopic = { tag: string; count: number };

type TwaatMetrics = {
  likes?: number | null;
  retwaats?: number | null;
  replies?: number | null;
  views?: number | null;
};

type TrendingTwaatRow = {
  body?: string | null;
  created_at: string;
  is_promoted?: boolean | null;
  promoted_until?: string | null;
  account?: { verified?: boolean | null } | null;
  metrics?: TwaatMetrics[] | TwaatMetrics | null;
};

const getYesterdayIso = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString();
};

export const fetchRecentTwaatsForTrending = async (): Promise<TrendingTwaatRow[]> => {
  const { data, error } = await supabase
    .from("twaats")
    .select(`
      *,
      account:twaater_accounts!twaats_account_id_fkey(
        id,
        handle,
        display_name,
        verified,
        owner_type,
        fame_score
      ),
      metrics:twaat_metrics(
        likes,
        retwaats,
        replies,
        views
      )
    `)
    .gte("created_at", getYesterdayIso())
    .order("created_at", { ascending: false })
    .limit(100);

  return supabaseArrayOrThrow(data as TrendingTwaatRow[] | null, error, {
    scope: "twaaterTrendingService",
    action: "fetch recent twaats for trending calculations",
  });
};

export const scoreTrendingTwaats = <T extends TrendingTwaatRow>(twaats: T[]) => {
  const now = Date.now();

  return twaats
    .map((twaat) => {
      const metricsData = Array.isArray(twaat.metrics) ? twaat.metrics[0] : twaat.metrics;
      const metrics = metricsData || { likes: 0, retwaats: 0, replies: 0, views: 0 };
      const baseScore =
        (metrics.likes || 0) * 2 +
        (metrics.retwaats || 0) * 3 +
        (metrics.replies || 0) * 1.5 +
        (metrics.views || 0) * 0.1;
      const createdAtTime = new Date(twaat.created_at).getTime();
      const hoursOld = Number.isFinite(createdAtTime) ? (now - createdAtTime) / (1000 * 60 * 60) : 24;
      const timeDecay = Math.exp(-hoursOld / 12);
      const verifiedBoost = twaat.account?.verified ? 1.5 : 1;
      const promotedActive =
        Boolean(twaat.is_promoted) &&
        Boolean(twaat.promoted_until) &&
        new Date(twaat.promoted_until as string).getTime() > now;
      const promotedBoost = promotedActive ? 2 : 1;

      return { ...twaat, engagementScore: baseScore * timeDecay * verifiedBoost * promotedBoost };
    })
    .filter((twaat) => twaat.engagementScore > 0.5)
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 20);
};

export const extractTrendingTopics = (twaats: TrendingTwaatRow[]): TrendingTopic[] => {
  const hashtagCounts = new Map<string, number>();

  twaats.forEach((twaat) => {
    const hashtags = twaat.body?.match(/#[a-zA-Z0-9_]+/g) || [];
    hashtags.forEach((tag) => {
      const normalized = tag.toLowerCase();
      hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1);
    });
  });

  return Array.from(hashtagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};
