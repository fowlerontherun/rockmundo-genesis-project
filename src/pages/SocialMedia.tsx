import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Repeat2, Share, TrendingUp, Users, Eye } from "lucide-react";

type SocialPostRow = Database["public"]["Tables"]["social_posts"]["Row"];

interface SocialPost {
  id: string;
  content: string;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  timestamp: string;
  engagement: number;
}

const calculateEngagement = (likes: number, comments: number, reposts: number, views: number) => {
  if (!views) return 0;
  const engagementRate = ((likes + comments + reposts) / views) * 100;
  return Number(engagementRate.toFixed(1));
};

const formatPostTimestamp = (timestamp: string) => {
  if (!timestamp) return "Just now";
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Just now";
  }
};

const mapPost = (post: SocialPostRow): SocialPost => {
  const likes = post.likes ?? 0;
  const comments = post.comments ?? 0;
  const reposts = post.reposts ?? post.shares ?? 0;
  const views = post.views ?? 0;
  const timestamp = post.timestamp ?? post.created_at ?? new Date().toISOString();

  return {
    id: post.id,
    content: post.content,
    likes,
    comments,
    reposts,
    views,
    timestamp,
    engagement: calculateEngagement(likes, comments, reposts, views),
  };
};

const SocialMedia = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [newPost, setNewPost] = useState("");
  const [followers] = useState(24500);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadPosts = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setPosts([]);
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);

    try {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      setPosts((data ?? []).map(mapPost));
    } catch (error) {
      console.error("Error loading social posts:", error);
      toast({
        variant: "destructive",
        title: "Error loading posts",
        description: "We couldn't load your recent social updates.",
      });
    } finally {
      setLoadingPosts(false);
    }
  }, [authLoading, toast, user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const campaigns = [
    {
      id: 1,
      name: "New Single Launch",
      platform: "All Platforms",
      budget: 5000,
      reach: 150000,
      engagement: 8.5,
      status: "Active",
      startDate: "Nov 1, 2024",
      endDate: "Nov 15, 2024"
    },
    {
      id: 2,
      name: "Tour Announcement",
      platform: "Instagram + TikTok",
      budget: 3000,
      reach: 89000,
      engagement: 12.2,
      status: "Completed",
      startDate: "Oct 15, 2024",
      endDate: "Oct 30, 2024"
    }
  ];

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "You need to be signed in to create a post.",
      });
      return;
    }

    const content = newPost.trim();
    setPosting(true);

    try {
      const initialViews = Math.max(500, Math.round(content.length * (8 + Math.random() * 4)));
      const { data, error } = await supabase
        .from("social_posts")
        .insert({
          user_id: user.id,
          platform: "all",
          content,
          likes: 0,
          comments: 0,
          reposts: 0,
          shares: 0,
          views: initialViews,
          timestamp: new Date().toISOString(),
          fan_growth: 0,
        })
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        setPosts((prev) => [mapPost(data as SocialPostRow), ...prev]);
      }

      setNewPost("");
      toast({
        title: "Post Published!",
        description: "Your post has been shared across all platforms.",
      });
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        variant: "destructive",
        title: "Unable to publish post",
        description: "Please try again later.",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "You need to be signed in to like posts.",
      });
      return;
    }

    const existingPost = posts.find((post) => post.id === postId);
    if (!existingPost) return;

    const updatedLikes = existingPost.likes + 1;
    const optimisticPost: SocialPost = {
      ...existingPost,
      likes: updatedLikes,
      engagement: calculateEngagement(updatedLikes, existingPost.comments, existingPost.reposts, existingPost.views),
    };

    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? optimisticPost : post))
    );

    const { error } = await supabase
      .from("social_posts")
      .update({ likes: updatedLikes })
      .eq("id", postId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating likes:", error);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...existingPost } : post
        )
      );
      toast({
        variant: "destructive",
        title: "Unable to like post",
        description: "Please try again later.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            SOCIAL MEDIA HUB
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Build your fanbase and create viral content
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Followers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{followers.toLocaleString()}</div>
              <p className="text-cream/60 text-sm">+12% this week</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">8.9%</div>
              <p className="text-cream/60 text-sm">Above average</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Monthly Reach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">2.1M</div>
              <p className="text-cream/60 text-sm">+8% vs last month</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-accent">
            <CardHeader className="pb-2">
              <CardTitle className="text-cream text-sm">Viral Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">7.8/10</div>
              <p className="text-cream/60 text-sm">Strong potential</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Post */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Create New Post</CardTitle>
                <CardDescription>Share updates with your fans across all platforms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="What's happening in the studio? Share your thoughts..."
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="min-h-24 bg-background/50 border-accent text-cream placeholder:text-cream/60"
                />
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Badge variant="outline">Instagram</Badge>
                    <Badge variant="outline">Twitter</Badge>
                    <Badge variant="outline">TikTok</Badge>
                    <Badge variant="outline">Facebook</Badge>
                  </div>
                  <Button
                    onClick={handleCreatePost}
                    className="bg-accent hover:bg-accent/80 text-background font-bold"
                    disabled={!newPost.trim() || posting}
                  >
                    {posting ? "Posting..." : "Post Now"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bebas text-cream tracking-wide">Recent Posts</h3>
              {(loadingPosts || authLoading) ? (
                <Card className="bg-card/80 border-accent">
                  <CardContent className="py-8 text-center text-cream/70">
                    Fetching your latest posts...
                  </CardContent>
                </Card>
              ) : posts.length === 0 ? (
                <Card className="bg-card/80 border-accent">
                  <CardContent className="py-8 text-center space-y-2">
                    <p className="text-cream font-semibold">No posts yet</p>
                    <p className="text-cream/70 text-sm">
                      Share your first update to start engaging with your fans.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                posts.map((post) => (
                  <Card key={post.id} className="bg-card/80 border-accent">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <p className="text-cream leading-relaxed">{post.content}</p>
                        <div className="flex justify-between items-center text-cream/60 text-sm">
                          <span>{formatPostTimestamp(post.timestamp)}</span>
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Eye className="h-4 w-4" />
                              {post.views.toLocaleString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {post.engagement.toFixed(1)}% engagement
                            </Badge>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-accent/20">
                          <div className="flex gap-6">
                            <button
                              onClick={() => handleLike(post.id)}
                              className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors"
                            >
                              <Heart className="h-4 w-4" />
                              <span>{post.likes.toLocaleString()}</span>
                            </button>
                            <button className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors">
                              <MessageCircle className="h-4 w-4" />
                              <span>{post.comments.toLocaleString()}</span>
                            </button>
                            <button className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors">
                              <Repeat2 className="h-4 w-4" />
                              <span>{post.reposts.toLocaleString()}</span>
                            </button>
                          </div>
                          <button className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors">
                            <Share className="h-4 w-4" />
                            Share
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Campaigns Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Active Campaigns</CardTitle>
                <CardDescription>Manage your promotional campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="space-y-3 p-4 border border-accent/20 rounded-lg">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-cream">{campaign.name}</h4>
                      <Badge 
                        variant={campaign.status === 'Active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-cream/80">
                        <span>Platform:</span>
                        <span>{campaign.platform}</span>
                      </div>
                      <div className="flex justify-between text-cream/80">
                        <span>Budget:</span>
                        <span>${campaign.budget.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-cream/80">
                        <span>Reach:</span>
                        <span>{campaign.reach.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-cream/80">
                        <span>Engagement:</span>
                        <span className="text-accent font-semibold">{campaign.engagement}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-cream/60">
                      {campaign.startDate} - {campaign.endDate}
                    </div>
                  </div>
                ))}
                <Button className="w-full bg-accent hover:bg-accent/80 text-background">
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Content Ideas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <h4 className="text-cream font-semibold">Trending Topics</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">#NewMusic</Badge>
                    <Badge variant="outline" className="text-xs">#BehindTheScenes</Badge>
                    <Badge variant="outline" className="text-xs">#LiveMusic</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-cream font-semibold">Suggested Posts</h4>
                  <ul className="text-sm text-cream/80 space-y-1">
                    <li>• Share studio photos</li>
                    <li>• Post gear close-ups</li>
                    <li>• Announce upcoming shows</li>
                    <li>• Share fan art</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialMedia;