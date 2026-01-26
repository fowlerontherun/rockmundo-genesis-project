import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ExploreTwaat {
  id: string;
  body: string;
  created_at: string;
  linked_type?: string;
  linked_id?: string;
  parent_twaat_id?: string;
  quoted_twaat_id?: string;
  account: {
    id: string;
    handle: string;
    display_name: string;
    verified: boolean;
    owner_type: string;
    fame_score?: number;
  };
  metrics: {
    likes: number;
    replies: number;
    retwaats: number;
    views: number;
  };
  engagement_score?: number;
}

export const useTwaaterExploreFeed = (excludeAccountId?: string) => {
  return useQuery({
    queryKey: ["twaater-explore-feed", excludeAccountId],
    queryFn: async () => {
      // Fetch public twaats from last 14 days with engagement data
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data, error } = await (supabase as any)
        .from("twaats")
        .select(`
          id,
          body,
          created_at,
          linked_type,
          linked_id,
          parent_twaat_id,
          quoted_twaat_id,
          account:twaater_accounts(id, handle, display_name, verified, owner_type, fame_score),
          metrics:twaat_metrics(likes, replies, retwaats, views)
        `)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Calculate engagement score and sort
      const scoredTwaats = (data || []).map((twaat: any) => {
        const metrics = twaat.metrics?.[0] || twaat.metrics || { likes: 0, replies: 0, retwaats: 0, views: 0 };
        const likes = metrics.likes || 0;
        const replies = metrics.replies || 0;
        const retwaats = metrics.retwaats || 0;
        const views = metrics.views || 1;

        // Engagement score: likes * 1 + replies * 2 + retwaats * 3
        let engagementScore = (likes * 1) + (replies * 2) + (retwaats * 3);

        // Boost verified accounts
        if (twaat.account?.verified) {
          engagementScore *= 1.5;
        }

        // Boost high-fame accounts
        const fameScore = twaat.account?.fame_score || 0;
        if (fameScore > 1000) {
          engagementScore *= 1.3;
        } else if (fameScore > 500) {
          engagementScore *= 1.15;
        }

        // Recency boost - posts from last 6 hours get a boost
        const hoursAgo = (Date.now() - new Date(twaat.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 6) {
          engagementScore *= 1.5;
        } else if (hoursAgo < 24) {
          engagementScore *= 1.2;
        }

        return {
          ...twaat,
          metrics: {
            likes,
            replies,
            retwaats,
            views,
          },
          engagement_score: engagementScore,
        };
      });

      // Filter out own posts if excludeAccountId provided
      const filtered = excludeAccountId 
        ? scoredTwaats.filter((t: any) => t.account?.id !== excludeAccountId)
        : scoredTwaats;

      // Sort by engagement score descending
      filtered.sort((a: any, b: any) => (b.engagement_score || 0) - (a.engagement_score || 0));

      // Return top 50
      return filtered.slice(0, 50) as ExploreTwaat[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};
