import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Flame,
  HandHeart,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Subreddit {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  member_count: number;
  is_official: boolean;
}

interface StarterTopic {
  id: string;
  subreddit_id: string;
  title: string;
  body: string | null;
  flair: string | null;
  sort_order: number;
  subreddit?: {
    name: string;
    display_name: string;
    icon: string;
  };
}

interface GettitPost {
  id: string;
  subreddit_id: string | null;
  author_id: string;
  title: string;
  content: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  flair: string | null;
  created_at: string;
  author?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  subreddit?: {
    name: string;
    icon: string;
  };
  userVote?: "up" | "down" | null;
}

interface GettitComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_id: string | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  author?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  userVote?: "up" | "down" | null;
}

interface ImpactLog {
  id: string;
  score_at_event: number;
  fame_delta: number;
  happiness_delta: number;
  created_at: string;
}

type SortType = "hot" | "new" | "top";

const GettitPage = () => {
  const { profile } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const untypedSupabase = supabase as any;

  const [selectedSubreddit, setSelectedSubreddit] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortType>("hot");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostSubreddit, setNewPostSubreddit] = useState("");
  const [selectedPost, setSelectedPost] = useState<GettitPost | null>(null);
  const [newComment, setNewComment] = useState("");

  const { data: subreddits = [] } = useQuery({
    queryKey: ["gettit-subreddits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gettit_subreddits")
        .select("*")
        .order("is_official", { ascending: false })
        .order("member_count", { ascending: false })
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data as Subreddit[];
    },
  });

  const { data: starterTopics = [] } = useQuery({
    queryKey: ["gettit-starter-topics", selectedSubreddit],
    queryFn: async () => {
      let query = untypedSupabase
        .from("gettit_seed_topics")
        .select(`
          id,
          subreddit_id,
          title,
          body,
          flair,
          sort_order,
          subreddit:gettit_subreddits(name, display_name, icon)
        `)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (selectedSubreddit) query = query.eq("subreddit_id", selectedSubreddit);

      const { data, error } = await query.limit(selectedSubreddit ? 6 : 8);
      if (error) throw error;
      return (data || []) as StarterTopic[];
    },
  });

  const { data: impactLog = [] } = useQuery({
    queryKey: ["gettit-impact", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await untypedSupabase
        .from("gettit_post_impact_log")
        .select("id, score_at_event, fame_delta, happiness_delta, created_at")
        .eq("author_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as ImpactLog[];
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["gettit-posts", selectedSubreddit, sortBy, profile?.id],
    queryFn: async () => {
      let query = supabase.from("gettit_posts").select(`
        *,
        author:profiles!gettit_posts_author_id_fkey(display_name, username, avatar_url),
        subreddit:gettit_subreddits(name, icon)
      `);

      if (selectedSubreddit) query = query.eq("subreddit_id", selectedSubreddit);

      if (sortBy === "new") query = query.order("created_at", { ascending: false });
      else if (sortBy === "top") query = query.order("upvotes", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      const { data, error } = await query.limit(50);
      if (error) throw error;

      if (!profile?.id || !data?.length) return (data || []) as GettitPost[];

      const postIds = data.map((post) => post.id);
      const { data: votes } = await supabase
        .from("gettit_post_votes")
        .select("post_id, vote_type")
        .eq("user_id", profile.id)
        .in("post_id", postIds);

      const voteMap = new Map(votes?.map((vote) => [vote.post_id, vote.vote_type]) || []);
      return data.map((post) => ({ ...post, userVote: voteMap.get(post.id) || null })) as GettitPost[];
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["gettit-comments", selectedPost?.id, profile?.id],
    enabled: !!selectedPost,
    queryFn: async () => {
      if (!selectedPost) return [];
      const { data, error } = await supabase
        .from("gettit_comments")
        .select(`
          *,
          author:profiles!gettit_comments_author_id_fkey(display_name, username, avatar_url)
        `)
        .eq("post_id", selectedPost.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      if (!profile?.id || !data?.length) return (data || []) as GettitComment[];

      const commentIds = data.map((comment) => comment.id);
      const { data: votes } = await supabase
        .from("gettit_comment_votes")
        .select("comment_id, vote_type")
        .eq("user_id", profile.id)
        .in("comment_id", commentIds);
      const voteMap = new Map(votes?.map((vote) => [vote.comment_id, vote.vote_type]) || []);
      return data.map((comment) => ({ ...comment, userVote: voteMap.get(comment.id) || null })) as GettitComment[];
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("You need an active character to post");
      if (!newPostTitle.trim()) throw new Error("Title is required");
      if (!newPostSubreddit) throw new Error("Choose a community");

      const { error } = await supabase.from("gettit_posts").insert({
        author_id: profile.id,
        subreddit_id: newPostSubreddit,
        title: newPostTitle.trim(),
        content: newPostContent.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gettit-posts"] });
      setShowCreatePost(false);
      setNewPostTitle("");
      setNewPostContent("");
      setNewPostSubreddit("");
      toast({
        title: "Posted to Gettit",
        description: "Community reaction can now affect your fame — for better or worse.",
      });
    },
    onError: (error) =>
      toast({
        title: "Could not create post",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: "up" | "down" }) => {
      if (!profile?.id) throw new Error("You need an active character to vote");

      const { data: existingVote } = await supabase
        .from("gettit_post_votes")
        .select("id, vote_type")
        .eq("post_id", postId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (existingVote?.vote_type === voteType) {
        const { error } = await supabase.from("gettit_post_votes").delete().eq("id", existingVote.id);
        if (error) throw error;
        const field = voteType === "up" ? "upvotes" : "downvotes";
        const { error: rpcError } = await supabase.rpc("decrement_gettit_vote", { post_id: postId, vote_field: field });
        if (rpcError) throw rpcError;
        return;
      }

      if (existingVote) {
        const { error } = await supabase
          .from("gettit_post_votes")
          .update({ vote_type: voteType })
          .eq("id", existingVote.id);
        if (error) throw error;
        const oldField = existingVote.vote_type === "up" ? "upvotes" : "downvotes";
        const newField = voteType === "up" ? "upvotes" : "downvotes";
        const { error: rpcError } = await supabase.rpc("swap_gettit_vote", {
          post_id: postId,
          old_field: oldField,
          new_field: newField,
        });
        if (rpcError) throw rpcError;
        return;
      }

      const { error } = await supabase.from("gettit_post_votes").insert({
        post_id: postId,
        user_id: profile.id,
        vote_type: voteType,
      });
      if (error) throw error;
      const field = voteType === "up" ? "upvotes" : "downvotes";
      const { error: rpcError } = await supabase.rpc("increment_gettit_vote", { post_id: postId, vote_field: field });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gettit-posts"] });
      queryClient.invalidateQueries({ queryKey: ["gettit-impact"] });
    },
    onError: (error) =>
      toast({
        title: "Vote failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !selectedPost) throw new Error("No active post or character");
      if (!newComment.trim()) throw new Error("Comment cannot be empty");

      const { error } = await supabase.from("gettit_comments").insert({
        post_id: selectedPost.id,
        author_id: profile.id,
        content: newComment.trim(),
      });
      if (error) throw error;

      const { error: countError } = await supabase
        .from("gettit_posts")
        .update({ comment_count: (selectedPost.comment_count || 0) + 1 })
        .eq("id", selectedPost.id);
      if (countError) throw countError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gettit-comments", selectedPost?.id] });
      queryClient.invalidateQueries({ queryKey: ["gettit-posts"] });
      setNewComment("");
      toast({ title: "Comment added" });
    },
    onError: (error) =>
      toast({
        title: "Could not add comment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const commentVoteMutation = useMutation({
    mutationFn: async ({ commentId, voteType }: { commentId: string; voteType: "up" | "down" }) => {
      if (!profile?.id) throw new Error("You need an active character to vote");

      const { data: existingVote } = await supabase
        .from("gettit_comment_votes")
        .select("id, vote_type")
        .eq("comment_id", commentId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (existingVote?.vote_type === voteType) {
        const { error } = await supabase.from("gettit_comment_votes").delete().eq("id", existingVote.id);
        if (error) throw error;
        const field = voteType === "up" ? "upvotes" : "downvotes";
        const { error: rpcError } = await supabase.rpc("decrement_gettit_comment_vote", { comment_id: commentId, vote_field: field });
        if (rpcError) throw rpcError;
        return;
      }

      if (existingVote) {
        const { error } = await supabase
          .from("gettit_comment_votes")
          .update({ vote_type: voteType })
          .eq("id", existingVote.id);
        if (error) throw error;
        const oldField = existingVote.vote_type === "up" ? "upvotes" : "downvotes";
        const newField = voteType === "up" ? "upvotes" : "downvotes";
        const { error: rpcError } = await supabase.rpc("swap_gettit_comment_vote", {
          comment_id: commentId,
          old_field: oldField,
          new_field: newField,
        });
        if (rpcError) throw rpcError;
        return;
      }

      const { error } = await supabase.from("gettit_comment_votes").insert({
        comment_id: commentId,
        user_id: profile.id,
        vote_type: voteType,
      });
      if (error) throw error;
      const field = voteType === "up" ? "upvotes" : "downvotes";
      const { error: rpcError } = await supabase.rpc("increment_gettit_comment_vote", { comment_id: commentId, vote_field: field });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gettit-comments", selectedPost?.id] }),
    onError: (error) =>
      toast({
        title: "Vote failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const getScore = (post: GettitPost) => post.upvotes - post.downvotes;
  const getCommentScore = (comment: GettitComment) => comment.upvotes - comment.downvotes;

  const sortedPosts = useMemo(() => {
    if (sortBy !== "hot") return [...posts];
    const nowHours = Date.now() / 3_600_000;
    return [...posts].sort((a, b) => {
      const hotScore = (post: GettitPost) => {
        const ageHours = Math.max(1, nowHours - new Date(post.created_at).getTime() / 3_600_000);
        const engagement = getScore(post) * 2 + post.comment_count * 0.75;
        return engagement / Math.pow(ageHours + 2, 1.15);
      };
      return hotScore(b) - hotScore(a);
    });
  }, [posts, sortBy]);

  const todayImpact = useMemo(() => {
    const today = new Date();
    return impactLog.reduce(
      (total, event) => {
        const eventDate = new Date(event.created_at);
        if (eventDate.toDateString() !== today.toDateString()) return total;
        total.fame += event.fame_delta;
        total.happiness += event.happiness_delta;
        return total;
      },
      { fame: 0, happiness: 0 },
    );
  }, [impactLog]);

  const openStarterTopic = (topic: StarterTopic) => {
    setNewPostSubreddit(topic.subreddit_id);
    setNewPostTitle(topic.title);
    setNewPostContent(topic.body || "");
    setShowCreatePost(true);
  };

  return (
    <FMPageScaffold
      title="Gettit"
      subtitle="The front page of RockMundo"
      icon={HandHeart}
      backTo="/hub/world-social"
    >
      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">🎸</span> Communities
              </CardTitle>
              <CardDescription>Pick your corner of the RockMundo scene.</CardDescription>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-1">
                  <Button
                    variant={selectedSubreddit === null ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedSubreddit(null)}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Front page
                  </Button>
                  {subreddits.map((sub) => (
                    <Button
                      key={sub.id}
                      variant={selectedSubreddit === sub.id ? "secondary" : "ghost"}
                      className="h-auto w-full justify-start px-2 py-2 text-left"
                      onClick={() => setSelectedSubreddit(sub.id)}
                    >
                      <span className="mr-2 text-lg">{sub.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">g/{sub.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{sub.display_name}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 space-y-4">
          <Card className="overflow-hidden border-primary/20">
            <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Share something worth talking about</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Good posts can build fame. Getting buried can damage it — and serious backlash can hit happiness too.
                  </p>
                </div>
                <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
                  <DialogTrigger asChild>
                    <Button disabled={!profile}>
                      <Plus className="mr-2 h-4 w-4" /> Create post
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a Gettit post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Community</Label>
                        <Select value={newPostSubreddit} onValueChange={setNewPostSubreddit}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a community" />
                          </SelectTrigger>
                          <SelectContent>
                            {subreddits.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.icon} g/{sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={newPostTitle}
                          onChange={(event) => setNewPostTitle(event.target.value)}
                          placeholder="An interesting title..."
                          maxLength={300}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Post</Label>
                        <Textarea
                          value={newPostContent}
                          onChange={(event) => setNewPostContent(event.target.value)}
                          placeholder="Share the story, question, opinion or advice..."
                          rows={6}
                        />
                      </div>
                      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        Fame thresholds: +5, +15 and +40 net score. Backlash thresholds: −5, −15 and −40. Gettit fame movement is capped at 10 per day in either direction.
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createPostMutation.mutate()}
                        disabled={createPostMutation.isPending || !newPostTitle.trim() || !newPostSubreddit}
                      >
                        {createPostMutation.isPending ? "Posting..." : "Post to Gettit"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={sortBy} onValueChange={(value) => setSortBy(value as SortType)}>
              <TabsList>
                <TabsTrigger value="hot" className="gap-1"><Flame className="h-4 w-4" /> Hot</TabsTrigger>
                <TabsTrigger value="new" className="gap-1"><Clock className="h-4 w-4" /> New</TabsTrigger>
                <TabsTrigger value="top" className="gap-1"><TrendingUp className="h-4 w-4" /> Top</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-muted-foreground">{posts.length} posts in this feed</span>
          </div>

          {postsLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Loading Gettit...</CardContent></Card>
          ) : sortedPosts.length === 0 ? (
            <Card>
              <CardContent className="space-y-4 py-10 text-center">
                <p className="text-muted-foreground">Nothing has hit this feed yet.</p>
                {starterTopics[0] && (
                  <Button variant="outline" onClick={() => openStarterTopic(starterTopics[0])}>
                    Start with: {starterTopics[0].title}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedPosts.map((post) => {
                const score = getScore(post);
                const isOwnPost = profile?.id === post.author_id;
                return (
                  <Card key={post.id} className="overflow-hidden transition-colors hover:border-primary/30">
                    <div className="flex">
                      <div className="flex w-12 flex-col items-center gap-1 bg-muted/50 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${post.userVote === "up" ? "text-orange-500" : ""}`}
                          onClick={() => voteMutation.mutate({ postId: post.id, voteType: "up" })}
                          disabled={!profile || isOwnPost || voteMutation.isPending}
                          title={isOwnPost ? "You cannot vote on your own post" : "Upvote"}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <span className={`text-sm font-semibold ${score > 0 ? "text-orange-500" : score < 0 ? "text-blue-500" : ""}`}>
                          {score}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${post.userVote === "down" ? "text-blue-500" : ""}`}
                          onClick={() => voteMutation.mutate({ postId: post.id, voteType: "down" })}
                          disabled={!profile || isOwnPost || voteMutation.isPending}
                          title={isOwnPost ? "You cannot vote on your own post" : "Downvote"}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="min-w-0 flex-1 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {post.subreddit && <span className="font-semibold text-foreground">{post.subreddit.icon} g/{post.subreddit.name}</span>}
                          <span>•</span>
                          <span>u/{post.author?.username || "anonymous"}</span>
                          <span>•</span>
                          <span>{formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true })}</span>
                          {post.flair && <Badge variant="secondary" className="ml-1 text-[10px]">{post.flair}</Badge>}
                          {isOwnPost && <Badge variant="outline" className="ml-1 text-[10px]">Your post</Badge>}
                        </div>
                        <h3 className="text-lg font-semibold leading-snug">{post.title}</h3>
                        {post.content && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">{post.content}</p>}
                        <div className="mt-3 flex items-center gap-3">
                          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => setSelectedPost(post)}>
                            <MessageSquare className="h-4 w-4" /> {post.comment_count} comments
                          </Button>
                          {isOwnPost && score >= 5 && <Badge className="gap-1"><TrendingUp className="h-3 w-3" /> Fame momentum</Badge>}
                          {isOwnPost && score <= -5 && <Badge variant="destructive" className="gap-1"><TrendingDown className="h-3 w-3" /> Backlash</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Gettit impact</CardTitle>
              <CardDescription>Today’s career effect from posts crossing vote thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Fame today</div>
                  <div className={`text-xl font-bold ${todayImpact.fame > 0 ? "text-emerald-500" : todayImpact.fame < 0 ? "text-destructive" : ""}`}>
                    {todayImpact.fame > 0 ? "+" : ""}{todayImpact.fame}
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">Happiness</div>
                  <div className={`text-xl font-bold ${todayImpact.happiness < 0 ? "text-destructive" : ""}`}>
                    {todayImpact.happiness > 0 ? "+" : ""}{todayImpact.happiness}
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><strong className="text-foreground">Positive:</strong> +1 fame at 5, +2 at 15, +4 at 40 net score.</p>
                <p><strong className="text-foreground">Negative:</strong> −1 fame at −5, −2 at −15, −4 at −40; larger pile-ons also hurt happiness.</p>
                <p>Each threshold pays once per post, with a ±10 fame daily cap.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Starter discussions</CardTitle>
              <CardDescription>Seed the community with a real player post.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {starterTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Choose a community to see discussion ideas.</p>
              ) : (
                starterTopics.slice(0, 6).map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => openStarterTopic(topic)}
                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{topic.subreddit?.icon}</span>
                      <span>g/{topic.subreddit?.name}</span>
                      {topic.flair && <Badge variant="outline" className="ml-auto text-[9px]">{topic.flair}</Badge>}
                    </div>
                    <p className="text-sm font-medium leading-snug">{topic.title}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="flex max-h-[82vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> {selectedPost?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {selectedPost?.content && <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{selectedPost.content}</div>}
            <Separator className="my-4" />
            {profile && (
              <div className="mb-4 flex gap-2">
                <Textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Join the discussion..." rows={2} />
                <Button size="icon" onClick={() => createCommentMutation.mutate()} disabled={!newComment.trim() || createCommentMutation.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {commentsLoading ? (
                <p className="py-6 text-center text-muted-foreground">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No comments yet. Start the thread.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 rounded-lg bg-accent/30 p-3">
                    <div className="flex flex-col items-center gap-1">
                      <Button variant="ghost" size="icon" className={`h-6 w-6 ${comment.userVote === "up" ? "text-orange-500" : ""}`} onClick={() => commentVoteMutation.mutate({ commentId: comment.id, voteType: "up" })} disabled={!profile}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <span className="text-xs font-semibold">{getCommentScore(comment)}</span>
                      <Button variant="ghost" size="icon" className={`h-6 w-6 ${comment.userVote === "down" ? "text-blue-500" : ""}`} onClick={() => commentVoteMutation.mutate({ commentId: comment.id, voteType: "down" })} disabled={!profile}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={comment.author?.avatar_url || ""} />
                          <AvatarFallback>{comment.author?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">u/{comment.author?.username || "anonymous"}</span>
                        <span>•</span>
                        <span>{formatDistanceToNowStrict(new Date(comment.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </FMPageScaffold>
  );
};

export default GettitPage;
