import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTwaaterTrending = () => {
  const { data: trendingTwaats = [], isLoading } = useQuery({
    queryKey: ["twaater-trending"],
    queryFn: async () => {
      // Get twaats from the last 24 hours with high engagement
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

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
        .gte("created_at", yesterday.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate engagement score with time decay
      const now = Date.now();
      const scored = (data || []).map((twaat) => {
        const metricsData = Array.isArray(twaat.metrics) ? twaat.metrics[0] : null;
        const metrics = metricsData || { likes: 0, retwaats: 0, replies: 0, views: 0 };
        
        // Base engagement score
        const baseScore = 
          (metrics.likes || 0) * 2 + 
          (metrics.retwaats || 0) * 3 + 
          (metrics.replies || 0) * 1.5 +
          (metrics.views || 0) * 0.1;

        // Time decay: exponential decay over 24 hours
        const hoursOld = (now - new Date(twaat.created_at).getTime()) / (1000 * 60 * 60);
        const timeDecay = Math.exp(-hoursOld / 12); // Half-life of ~8.3 hours

        // Verified account boost (1.5x)
        const verifiedBoost = twaat.account?.verified ? 1.5 : 1;

        const engagementScore = baseScore * timeDecay * verifiedBoost;

        return {
          ...twaat,
          engagementScore,
        };
      });

      return scored
        .filter(t => t.engagementScore > 0.5) // Minimum threshold
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 20);
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const { data: trendingTopics = [], isLoading: topicsLoading } = useQuery({
    queryKey: ["twaater-trending-topics"],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from("twaats")
        .select("body")
        .gte("created_at", yesterday.toISOString());

      if (error) throw error;

      // Extract hashtags
      const hashtagCounts = new Map<string, number>();
      (data || []).forEach((twaat) => {
        const hashtags = twaat.body?.match(/#[a-zA-Z0-9_]+/g) || [];
        hashtags.forEach((tag) => {
          const normalized = tag.toLowerCase();
          hashtagCounts.set(normalized, (hashtagCounts.get(normalized) || 0) + 1);
        });
      });

      // Convert to array and sort
      const trending = Array.from(hashtagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return trending;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  return {
    trendingTwaats,
    trendingTopics,
    isLoading: isLoading || topicsLoading,
  };
};
