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

interface CommentRow {
  id: string;
  body: string;
  likes: number | null;
  created_at: string | null;
  user_id: string;
  author?: { display_name: string | null; username: string | null } | null;
}

export const DikCokEngagement = ({ videoId }: DikCokEngagementProps) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: reactions } = useQuery({
    queryKey: ["dikcok-reactions", videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_reactions")
        .select("id, video_id, user_id, reaction_type")
        .eq("video_id", videoId);
      if (error) throw error;
      return (data ?? []) as Reaction[];
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["dikcok-comments", videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dikcok_comments")
        .select("id, body, likes, created_at, user_id")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as CommentRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id))).filter(Boolean);
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", userIds);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        rows.forEach((r) => {
          r.author = (map.get(r.user_id) as any) ?? null;
        });
      }
      return rows;
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: async (reactionType: string) => {
      if (!userId) throw new Error("Must be logged in");
      const existing = reactions?.find(
        (r) => r.user_id === userId && r.reaction_type === reactionType,
      );
      if (existing) {
        const { error } = await supabase
          .from("dikcok_reactions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const };
      }
      const { error } = await supabase
        .from("dikcok_reactions")
        .insert({ video_id: videoId, user_id: userId, reaction_type: reactionType });
      if (error) throw error;
      return { action: "added" as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dikcok-reactions", videoId] });
    },
    onError: (e: any) => toast({ title: "Reaction failed", description: e.message, variant: "destructive" }),
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!userId) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("dikcok_comments")
        .insert({ video_id: videoId, user_id: userId, body: content });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["dikcok-comments", videoId] });
    },
    onError: (e: any) => toast({ title: "Comment failed", description: e.message, variant: "destructive" }),
  });

  const getReactionCount = (type: string) =>
    reactions?.filter((r) => r.reaction_type === type).length || 0;

  const hasReacted = (type: string) =>
    reactions?.some((r) => r.user_id === userId && r.reaction_type === type) ?? false;

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) addCommentMutation.mutate(comment.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {REACTION_TYPES.map(({ type, icon: Icon, label, color }) => (
          <Button
            key={type}
            variant={hasReacted(type) ? "default" : "outline"}
            size="sm"
            onClick={() => addReactionMutation.mutate(type)}
            disabled={!userId || addReactionMutation.isPending}
            className="gap-1"
            aria-label={label}
          >
            <Icon className={`h-4 w-4 ${hasReacted(type) ? "" : color}`} />
            <span>{getReactionCount(type)}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">{comments?.length || 0} Comments</span>
        </div>

        {userId && (
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <Input
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={280}
            />
            <Button type="submit" size="icon" disabled={!comment.trim() || addCommentMutation.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}

        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            {comments?.map((c) => (
              <div key={c.id} className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {c.author?.display_name || c.author?.username || "Anonymous"}
                  </span>
                  {c.created_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className="text-sm">{c.body}</p>
                {(c.likes ?? 0) > 0 && (
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
