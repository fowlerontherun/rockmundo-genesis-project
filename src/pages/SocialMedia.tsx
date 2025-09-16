import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageCircle, Repeat2, Share, TrendingUp, Users, Eye } from "lucide-react";

type CampaignStatus = "Active" | "Completed";

interface SocialPost {
  id: number;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  engagement: number;
}

interface Campaign {
  id: number;
  name: string;
  platform: string;
  budget: number;
  reach: number;
  engagement: number;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
}

const SocialMedia = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newPost, setNewPost] = useState("");
  const [followers, setFollowers] = useState<number | null>(null);
  const [engagementRate, setEngagementRate] = useState<number | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([
    {
      id: 1,
      content: "Just finished recording our new single! Can't wait for you all to hear it 🎸🔥",
      timestamp: "2 hours ago",
      likes: 1250,
      comments: 89,
      reposts: 234,
      views: 15600,
      engagement: 9.8
    },
    {
      id: 2,
      content: "Behind the scenes at today's photo shoot. New album artwork coming soon! 📸✨",
      timestamp: "1 day ago",
      likes: 2100,
      comments: 156,
      reposts: 445,
      views: 28900,
      engagement: 12.4
    },
    {
      id: 3,
      content: "Thank you Chicago! What an incredible show tonight. You were AMAZING! 🎤❤️",
      timestamp: "3 days ago",
      likes: 3400,
      comments: 298,
      reposts: 678,
      views: 45200,
      engagement: 15.2
    }
  ]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([
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
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setFollowers(null);
        setEngagementRate(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("followers, engagement_rate")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

        setFollowers(data?.followers ?? 0);
        setEngagementRate(data?.engagement_rate ?? 0);
      } catch (error) {
        console.error("Error fetching social metrics:", error);
      }
    };

    fetchStats();
  }, [user]);

  const applySocialGrowth = async (followerGain: number, engagementBoost: number, message: string) => {
    if (followerGain <= 0 && engagementBoost <= 0) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Log in to track growth",
        description: "Sign in to sync social stats with your profile."
      });
      return;
    }

    const currentFollowers = followers ?? 0;
    const currentEngagement = engagementRate ?? 0;
    const nextFollowers = Math.max(0, Math.round(currentFollowers + followerGain));
    const nextEngagement = Math.max(0, Math.min(100, parseFloat((currentEngagement + engagementBoost).toFixed(2))));

    setFollowers(nextFollowers);
    setEngagementRate(nextEngagement);

    const { error } = await supabase
      .from("profiles")
      .update({
        followers: nextFollowers,
        engagement_rate: nextEngagement,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating social metrics:", error);
      setFollowers(currentFollowers);
      setEngagementRate(currentEngagement);
      toast({
        variant: "destructive",
        title: "Couldn't update stats",
        description: "Please try again after a moment."
      });
      return;
    }

    toast({
      title: "Social stats updated",
      description: message
    });
  };

  const handleCreatePost = () => {
    if (!newPost.trim()) return;

    const baseViews = Math.floor(Math.random() * 5000) + 4000;
    const likeRate = 0.06 + Math.random() * 0.05;
    const likes = Math.round(baseViews * likeRate);
    const comments = Math.round(likes * 0.15);
    const reposts = Math.round(likes * 0.18);
    const views = baseViews + Math.round(reposts * 8);
    const engagement = parseFloat(Math.min(100, ((likes + comments + reposts) / views) * 100).toFixed(1));

    setPosts((prevPosts) => {
      const nextId = prevPosts.length > 0 ? Math.max(...prevPosts.map((post) => post.id)) + 1 : 1;
      const post: SocialPost = {
        id: nextId,
        content: newPost,
        timestamp: "Just now",
        likes,
        comments,
        reposts,
        views,
        engagement
      };
      return [post, ...prevPosts];
    });

    setNewPost("");
    toast({
      title: "Post Published!",
      description: "Your post has been shared across all platforms."
    });

    if (engagement >= 10) {
      const followerGain = Math.round(likes * (engagement / 80));
      const engagementBoost = parseFloat(Math.min(10, engagement / 4).toFixed(2));
      void applySocialGrowth(
        followerGain,
        engagementBoost,
        `Your latest post is trending! +${followerGain.toLocaleString()} followers and +${engagementBoost.toFixed(2)}% engagement.`
      );
    }
  };

  const handleLike = (postId: number) => {
    let previousPost: SocialPost | null = null;
    let updatedPost: SocialPost | null = null;

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id !== postId) return post;

        previousPost = post;
        const likeBoost = Math.floor(Math.random() * 40) + 10;
        const viewBoost = likeBoost * 20;
        const commentBoost = Math.floor(likeBoost * 0.2);
        const repostBoost = Math.floor(likeBoost * 0.15);
        const likes = post.likes + likeBoost;
        const comments = post.comments + commentBoost;
        const reposts = post.reposts + repostBoost;
        const views = post.views + viewBoost;
        const engagement = parseFloat(
          Math.min(100, ((likes + comments + reposts) / views) * 100).toFixed(1)
        );

        updatedPost = { ...post, likes, comments, reposts, views, engagement };
        return updatedPost;
      })
    );

    if (previousPost && updatedPost) {
      const likeGrowth = updatedPost.likes - previousPost.likes;
      const engagementGrowth = updatedPost.engagement - previousPost.engagement;

      if (likeGrowth > 150 || engagementGrowth > 1.5) {
        const followerGain = Math.max(0, Math.round(likeGrowth * 1.2));
        const engagementBoost = Math.max(0, parseFloat(Math.max(engagementGrowth, 0).toFixed(2)));
        void applySocialGrowth(
          followerGain,
          engagementBoost,
          `Post engagement spiked! +${followerGain.toLocaleString()} followers and +${engagementBoost.toFixed(2)}% engagement.`
        );
      }
    }
  };

  const handleRunCampaign = (campaignId: number) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;

    if (campaign.status === "Completed") {
      toast({
        title: "Campaign already completed",
        description: "Launch a new campaign to continue growing your audience.",
      });
      return;
    }

    const followerGain = Math.round(campaign.reach * (campaign.engagement / 100) * 0.02);
    const engagementBoost = parseFloat(Math.min(15, campaign.engagement / 3).toFixed(2));

    void applySocialGrowth(
      followerGain,
      engagementBoost,
      `${campaign.name} boosted your audience by +${followerGain.toLocaleString()} followers!`
    );

    setCampaigns((prevCampaigns) =>
      prevCampaigns.map((item) =>
        item.id === campaignId ? { ...item, status: "Completed" } : item
      )
    );
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
              <div className="text-2xl font-bold text-accent">
                {followers !== null ? followers.toLocaleString() : "--"}
              </div>
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
              <div className="text-2xl font-bold text-accent">
                {engagementRate !== null ? `${engagementRate.toFixed(1)}%` : "--"}
              </div>
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
                    disabled={!newPost.trim()}
                  >
                    Post Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Posts Feed */}
            <div className="space-y-4">
              <h3 className="text-2xl font-bebas text-cream tracking-wide">Recent Posts</h3>
              {posts.map((post) => (
                <Card key={post.id} className="bg-card/80 border-accent">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <p className="text-cream leading-relaxed">{post.content}</p>
                      <div className="flex justify-between items-center text-cream/60 text-sm">
                        <span>{post.timestamp}</span>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {post.views.toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {post.engagement}% engagement
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
              ))}
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
                        variant={campaign.status === "Active" ? "default" : "secondary"}
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
                    <Button
                      onClick={() => handleRunCampaign(campaign.id)}
                      className="w-full bg-accent hover:bg-accent/80 text-background"
                      disabled={campaign.status === "Completed"}
                    >
                      {campaign.status === "Completed" ? "Campaign Completed" : "Run Campaign"}
                    </Button>
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
