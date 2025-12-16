import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VoteScore {
  songId: string;
  upvotes: number;
  downvotes: number;
  weightedScore: number;
  vipUpvotes: number;
  vipDownvotes: number;
}

export const useVoteWeightedScore = (songIds: string[]) => {
  return useQuery({
    queryKey: ["vote-weighted-scores", songIds],
    queryFn: async (): Promise<Record<string, VoteScore>> => {
      if (!songIds.length) return {};

      // Fetch all votes for these songs
      const { data: votes, error } = await supabase
        .from("song_votes")
        .select("song_id, vote_type, user_id")
        .in("song_id", songIds);

      if (error) throw error;

      // Fetch VIP status for all voters
      const voterIds = [...new Set(votes?.map(v => v.user_id) || [])];
      const { data: vipData } = await supabase
        .from("vip_subscriptions")
        .select("user_id")
        .in("user_id", voterIds)
        .eq("status", "active");

      const vipUserIds = new Set(vipData?.map(v => v.user_id) || []);

      // Calculate weighted scores
      const scores: Record<string, VoteScore> = {};
      
      for (const songId of songIds) {
        const songVotes = votes?.filter(v => v.song_id === songId) || [];
        
        let upvotes = 0;
        let downvotes = 0;
        let vipUpvotes = 0;
        let vipDownvotes = 0;

        for (const vote of songVotes) {
          const isVip = vipUserIds.has(vote.user_id);
          const weight = isVip ? 2 : 1;

          if (vote.vote_type === "up") {
            upvotes += weight;
            if (isVip) vipUpvotes++;
          } else {
            downvotes += weight;
            if (isVip) vipDownvotes++;
          }
        }

        scores[songId] = {
          songId,
          upvotes,
          downvotes,
          weightedScore: upvotes - downvotes,
          vipUpvotes,
          vipDownvotes,
        };
      }

      return scores;
    },
    enabled: songIds.length > 0,
  });
};
