import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth-context";
import { useVipStatus } from "@/hooks/useVipStatus";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SongVotingProps {
  songId: string;
  className?: string;
  showCounts?: boolean;
  compact?: boolean;
}

interface VoteCounts {
  upvotes: number;
  downvotes: number;
  userVote: "up" | "down" | null;
}

export const SongVoting = ({
  songId,
  className,
  showCounts = true,
  compact = false,
}: SongVotingProps) => {
  const { user } = useAuth();
  const { data: vipStatus } = useVipStatus();
  const queryClient = useQueryClient();

  const { data: voteCounts, isLoading } = useQuery<VoteCounts>({
    queryKey: ["song-votes", songId, user?.id],
    queryFn: async () => {
      // Get vote counts
      const { data: votes, error: votesError } = await supabase
        .from("song_votes")
        .select("vote_type")
        .eq("song_id", songId);

      if (votesError) throw votesError;

      const upvotes = votes?.filter((v) => v.vote_type === "up").length || 0;
      const downvotes = votes?.filter((v) => v.vote_type === "down").length || 0;

      // Get user's vote if logged in
      let userVote: "up" | "down" | null = null;
      if (user?.id) {
        const { data: userVoteData } = await supabase
          .from("song_votes")
          .select("vote_type")
          .eq("song_id", songId)
          .eq("user_id", user.id)
          .maybeSingle();

        userVote = (userVoteData?.vote_type as "up" | "down") || null;
      }

      return { upvotes, downvotes, userVote };
    },
    enabled: !!songId,
  });

  const voteMutation = useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      if (!user?.id) throw new Error("Must be logged in to vote");

      // Check if user already voted
      const { data: existing } = await supabase
        .from("song_votes")
        .select("id, vote_type")
        .eq("song_id", songId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        if (existing.vote_type === voteType) {
          // Remove vote
          const { error } = await supabase
            .from("song_votes")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
          return { action: "removed" };
        } else {
          // Change vote
          const { error } = await supabase
            .from("song_votes")
            .update({ vote_type: voteType })
            .eq("id", existing.id);
          if (error) throw error;
          return { action: "changed", voteType };
        }
      } else {
        // New vote
        const { error } = await supabase.from("song_votes").insert({
          song_id: songId,
          user_id: user.id,
          vote_type: voteType,
        });
        if (error) throw error;
        return { action: "added", voteType };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["song-votes", songId] });
      
      if (result.action === "removed") {
        toast.success("Vote removed");
      } else if (result.action === "changed") {
        toast.success(`Vote changed to ${result.voteType === "up" ? "👍" : "👎"}`);
      } else {
        toast.success(`Voted ${result.voteType === "up" ? "👍" : "👎"}`);
      }
    },
    onError: (error) => {
      console.error("Vote error:", error);
      toast.error("Failed to vote");
    },
  });

  const handleVote = (voteType: "up" | "down") => {
    if (!user) {
      toast.error("Please log in to vote");
      return;
    }
    voteMutation.mutate(voteType);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const isVip = vipStatus?.isVip;
  const buttonSize = compact ? "sm" : "default";
  const iconSize = compact ? "h-3 w-3" : "h-4 w-4";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={voteCounts?.userVote === "up" ? "default" : "outline"}
              size={buttonSize}
              onClick={() => handleVote("up")}
              disabled={voteMutation.isPending}
              className={cn(
                "gap-1",
                voteCounts?.userVote === "up" && "bg-green-600 hover:bg-green-700"
              )}
            >
              <ThumbsUp className={iconSize} />
              {showCounts && <span>{voteCounts?.upvotes || 0}</span>}
              {isVip && voteCounts?.userVote === "up" && (
                <Crown className="h-3 w-3 text-yellow-300" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Upvote this song{isVip && " (VIP vote counts 2x!)"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={voteCounts?.userVote === "down" ? "default" : "outline"}
              size={buttonSize}
              onClick={() => handleVote("down")}
              disabled={voteMutation.isPending}
              className={cn(
                "gap-1",
                voteCounts?.userVote === "down" && "bg-red-600 hover:bg-red-700"
              )}
            >
              <ThumbsDown className={iconSize} />
              {showCounts && <span>{voteCounts?.downvotes || 0}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Downvote this song</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
