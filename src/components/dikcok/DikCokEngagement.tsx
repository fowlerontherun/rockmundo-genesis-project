import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Heart, Flame, Laugh, Sparkles, Send, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DikCokEngagementProps {
  videoId: string;
}

const REACTION_TYPES = [
  { type: "like", icon: Heart, label: "Like", color: "text-red-500" },
  { type: "fire", icon: Flame, label: "Fire", color: "text-orange-500" },
  { type: "laugh", icon: Laugh, label: "LOL", color: "text-yellow-500" },
  { type: "wow", icon: Sparkles, label: "Wow", color: "text-purple-500" },
];

interface Reaction {
  id: string;
  video_id: string;
  user_id: string;
  reaction_type: string;
}

interface Comment {
  id: string;
  content: string;
  likes: number;
  created_at: string;
  user?: {
    display_name: string | null;
    username: string | null;
  };
}

export const DikCokEngagement = ({ videoId }: DikCokEngagementProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  // Fetch reactions - placeholder for new table
  const { data: reactions } = useQuery({
    queryKey: ["dikcok-reactions", videoId],
    queryFn: async () => {
      // Tables being created - return empty for now
      return [] as Reaction[];
    },
  });

  // Fetch comments - simplified
  const { data: comments } = useQuery({
    queryKey: ["dikcok-comments", videoId],
    queryFn: async () => {
      // For now return empty - tables are being created
      return [] as Comment[];
    },
  });

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async (reactionType: string) => {
      if (!user?.id) throw new Error("Must be logged in");
      toast({ title: "Reactions coming soon!" });
      return { action: "pending" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-reactions", videoId] });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.id) throw new Error("Must be logged in");
      toast({ title: "Comments coming soon!" });
    },
    onSuccess: () => {
      setComment("");
    },
  });

  const getReactionCount = (type: string) => {
    return reactions?.filter(r => r.reaction_type === type).length || 0;
  };

  const hasReacted = (type: string) => {
    return reactions?.some(r => r.user_id === user?.id && r.reaction_type === type);
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      addCommentMutation.mutate(comment.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Reactions */}
      <div className="flex gap-2 flex-wrap">
        {REACTION_TYPES.map(({ type, icon: Icon, label, color }) => (
          <Button
            key={type}
            variant={hasReacted(type) ? "default" : "outline"}
            size="sm"
            onClick={() => addReactionMutation.mutate(type)}
            disabled={!user || addReactionMutation.isPending}
            className="gap-1"
          >
            <Icon className={`h-4 w-4 ${hasReacted(type) ? "" : color}`} />
            <span>{getReactionCount(type)}</span>
          </Button>
        ))}
      </div>

      {/* Comments Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">{comments?.length || 0} Comments</span>
        </div>

        {/* Comment Input */}
        {user && (
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <Input
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={280}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!comment.trim() || addCommentMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Comments List */}
        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            {comments?.map((c) => (
              <div key={c.id} className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {c.user?.display_name || c.user?.username || "Anonymous"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm">{c.content}</p>
                {c.likes > 0 && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    <Heart className="h-3 w-3 mr-1" /> {c.likes}
                  </Badge>
                )}
              </div>
            ))}
            {!comments?.length && (
              <p className="text-center text-muted-foreground text-sm py-4">
                No comments yet. Be the first!
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
