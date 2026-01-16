import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUp, ArrowDown, MessageSquare, Plus, TrendingUp, Clock, Flame } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";

interface Subreddit {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  member_count: number;
  is_official: boolean;
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
  userVote?: 'up' | 'down' | null;
}

type SortType = 'hot' | 'new' | 'top';

const GettitPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedSubreddit, setSelectedSubreddit] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortType>('hot');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostSubreddit, setNewPostSubreddit] = useState('');

  // Fetch subreddits
  const { data: subreddits = [] } = useQuery({
    queryKey: ['gettit-subreddits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gettit_subreddits')
        .select('*')
        .order('member_count', { ascending: false });
      if (error) throw error;
      return data as Subreddit[];
    },
  });

  // Fetch posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['gettit-posts', selectedSubreddit, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('gettit_posts')
        .select(`
          *,
          author:profiles!gettit_posts_author_id_fkey(display_name, username, avatar_url),
          subreddit:gettit_subreddits(name, icon)
        `);

      if (selectedSubreddit) {
        query = query.eq('subreddit_id', selectedSubreddit);
      }

      if (sortBy === 'new') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'top') {
        query = query.order('upvotes', { ascending: false });
      } else {
        // Hot: combination of votes and recency
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      // Fetch user's votes if logged in
      if (profile?.id && data) {
        const postIds = data.map(p => p.id);
        const { data: votes } = await supabase
          .from('gettit_post_votes')
          .select('post_id, vote_type')
          .eq('user_id', profile.id)
          .in('post_id', postIds);

        const voteMap = new Map(votes?.map(v => [v.post_id, v.vote_type]) || []);
        
        return data.map(post => ({
          ...post,
          userVote: voteMap.get(post.id) || null,
        })) as GettitPost[];
      }

      return data as GettitPost[];
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Must be logged in');
      if (!newPostTitle.trim()) throw new Error('Title is required');
      if (!newPostSubreddit) throw new Error('Select a community');

      const { error } = await supabase.from('gettit_posts').insert({
        author_id: profile.id,
        subreddit_id: newPostSubreddit,
        title: newPostTitle.trim(),
        content: newPostContent.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gettit-posts'] });
      setShowCreatePost(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostSubreddit('');
      toast({ title: 'Post created!', description: 'Your post is now live.' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to create post', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ postId, voteType }: { postId: string; voteType: 'up' | 'down' }) => {
      if (!profile?.id) throw new Error('Must be logged in');

      // Check existing vote
      const { data: existingVote } = await supabase
        .from('gettit_post_votes')
        .select('id, vote_type')
        .eq('post_id', postId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          await supabase.from('gettit_post_votes').delete().eq('id', existingVote.id);
          // Update post counts
          const field = voteType === 'up' ? 'upvotes' : 'downvotes';
          await supabase.rpc('decrement_gettit_vote' as any, { post_id: postId, vote_field: field });
        } else {
          // Change vote
          await supabase.from('gettit_post_votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id);
          // Update both fields
          const oldField = existingVote.vote_type === 'up' ? 'upvotes' : 'downvotes';
          const newField = voteType === 'up' ? 'upvotes' : 'downvotes';
          await supabase.rpc('swap_gettit_vote' as any, { 
            post_id: postId, 
            old_field: oldField, 
            new_field: newField 
          });
        }
      } else {
        // New vote
        await supabase.from('gettit_post_votes').insert({
          post_id: postId,
          user_id: profile.id,
          vote_type: voteType,
        });
        const field = voteType === 'up' ? 'upvotes' : 'downvotes';
        await supabase.rpc('increment_gettit_vote' as any, { post_id: postId, vote_field: field });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gettit-posts'] });
    },
  });

  const getScore = (post: GettitPost) => post.upvotes - post.downvotes;

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === 'hot') {
      // Simple hot algorithm: score + time decay
      const aScore = getScore(a) + (new Date(a.created_at).getTime() / (1000 * 60 * 60));
      const bScore = getScore(b) + (new Date(b.created_at).getTime() / (1000 * 60 * 60));
      return bScore - aScore;
    }
    return 0;
  });

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - Subreddits */}
        <div className="lg:w-64 flex-shrink-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">🎸</span> Gettit
              </CardTitle>
              <CardDescription>Player community forums</CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                  <Button
                    variant={selectedSubreddit === null ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedSubreddit(null)}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    All Communities
                  </Button>
                  {subreddits.map((sub) => (
                    <Button
                      key={sub.id}
                      variant={selectedSubreddit === sub.id ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedSubreddit(sub.id)}
                    >
                      <span className="mr-2">{sub.icon}</span>
                      g/{sub.name}
                      {sub.is_official && (
                        <Badge variant="outline" className="ml-auto text-xs">Official</Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Feed */}
        <div className="flex-1 space-y-4">
          {/* Header with sort + create */}
          <div className="flex items-center justify-between gap-4">
            <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
              <TabsList>
                <TabsTrigger value="hot" className="gap-1">
                  <Flame className="h-4 w-4" /> Hot
                </TabsTrigger>
                <TabsTrigger value="new" className="gap-1">
                  <Clock className="h-4 w-4" /> New
                </TabsTrigger>
                <TabsTrigger value="top" className="gap-1">
                  <TrendingUp className="h-4 w-4" /> Top
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
              <DialogTrigger asChild>
                <Button disabled={!profile}>
                  <Plus className="h-4 w-4 mr-2" /> Create Post
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a Post</DialogTitle>
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
                      placeholder="An interesting title..."
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      maxLength={300}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Content (optional)</Label>
                    <Textarea
                      placeholder="Share your thoughts..."
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={() => createPostMutation.mutate()}
                    disabled={createPostMutation.isPending || !newPostTitle.trim() || !newPostSubreddit}
                  >
                    {createPostMutation.isPending ? 'Posting...' : 'Post'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Posts */}
          {postsLoading ? (
            <Card>
              <CardContent className="py-8">
                <div className="space-y-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-24 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ) : sortedPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedPosts.map((post) => (
                <Card key={post.id} className="hover:bg-accent/50 transition-colors">
                  <div className="flex">
                    {/* Vote buttons */}
                    <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-l-lg">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${post.userVote === 'up' ? 'text-orange-500' : ''}`}
                        onClick={() => voteMutation.mutate({ postId: post.id, voteType: 'up' })}
                        disabled={!profile}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <span className={`text-sm font-medium ${
                        getScore(post) > 0 ? 'text-orange-500' : 
                        getScore(post) < 0 ? 'text-blue-500' : ''
                      }`}>
                        {getScore(post)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${post.userVote === 'down' ? 'text-blue-500' : ''}`}
                        onClick={() => voteMutation.mutate({ postId: post.id, voteType: 'down' })}
                        disabled={!profile}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Post content */}
                    <div className="flex-1 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        {post.subreddit && (
                          <>
                            <span>{post.subreddit.icon}</span>
                            <span className="font-medium hover:underline cursor-pointer">
                              g/{post.subreddit.name}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>Posted by</span>
                        <span className="hover:underline cursor-pointer">
                          u/{post.author?.username || 'anonymous'}
                        </span>
                        <span>•</span>
                        <span>{formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true })}</span>
                        {post.flair && (
                          <Badge variant="secondary" className="text-xs">{post.flair}</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-2 hover:text-primary cursor-pointer">
                        {post.title}
                      </h3>
                      {post.content && (
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                          {post.content}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Button variant="ghost" size="sm" className="gap-1 h-7">
                          <MessageSquare className="h-4 w-4" />
                          {post.comment_count} Comments
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GettitPage;
