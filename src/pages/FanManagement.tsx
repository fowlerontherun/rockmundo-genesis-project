import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Heart, 
  MessageCircle, 
  Share2, 
  TrendingUp,
  Instagram,
  Twitter,
  Music,
  Send,
  ThumbsUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

interface SocialPost {
  id: string;
  user_id: string;
  platform: string;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  fan_growth: number;
  created_at: string;
}

interface FanDemographics {
  id: string;
  user_id: string;
  total_fans: number;
  weekly_growth: number;
  engagement_rate: number;
  age_18_25: number;
  age_26_35: number;
  age_36_45: number;
  age_45_plus: number;
  platform_instagram: number;
  platform_twitter: number;
  platform_youtube: number;
  platform_tiktok: number;
  updated_at: string;
}

const FanManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, updateProfile, addActivity } = useGameData();
  
  const [postContent, setPostContent] = useState("");
  const [fanStats, setFanStats] = useState<FanDemographics | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (user) {
      loadFanData();
      loadSocialPosts();
    }
  }, [user]);

  const loadFanData = async () => {
    try {
      const { data, error } = await supabase
        .from('fan_demographics')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      setFanStats(data);
    } catch (error: any) {
      console.error('Error loading fan data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSocialPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSocialPosts(data || []);
    } catch (error: any) {
      console.error('Error loading social posts:', error);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram": return <Instagram className="h-4 w-4" />;
      case "twitter": return <Twitter className="h-4 w-4" />;
      case "youtube": return <Music className="h-4 w-4" />;
      default: return <Share2 className="h-4 w-4" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "border-l-success";
      case "request": return "border-l-warning";
      case "question": return "border-l-primary";
      default: return "border-l-muted";
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() || !user || !profile) return;

    setPosting(true);
    try {
      // Calculate engagement metrics based on player fame and random factors
      const baseLikes = Math.round((profile.fame || 0) * (0.1 + Math.random() * 0.2));
      const baseComments = Math.round(baseLikes * (0.1 + Math.random() * 0.15));
      const baseShares = Math.round(baseLikes * (0.05 + Math.random() * 0.1));
      const fanGrowth = Math.round(baseLikes * 0.02);

      // Create posts for multiple platforms
      const platforms = ['instagram', 'twitter', 'youtube'];
      const postPromises = platforms.map(platform => 
        supabase
          .from('social_posts')
          .insert({
            user_id: user.id,
            platform,
            content: postContent,
            likes: Math.round(baseLikes * (0.8 + Math.random() * 0.4)),
            comments: Math.round(baseComments * (0.8 + Math.random() * 0.4)),
            shares: Math.round(baseShares * (0.8 + Math.random() * 0.4)),
            fan_growth: Math.round(fanGrowth * (0.8 + Math.random() * 0.4))
          })
      );

      await Promise.all(postPromises);

      // Update fan demographics
      if (fanStats) {
        const totalFanGrowth = fanGrowth * platforms.length;
        await supabase
          .from('fan_demographics')
          .update({
            total_fans: fanStats.total_fans + totalFanGrowth,
            weekly_growth: fanStats.weekly_growth + totalFanGrowth
          })
          .eq('user_id', user.id);
      }

      // Update player fame
      const fameGain = Math.round(fanGrowth / 2);
      await updateProfile({ 
        fame: (profile.fame || 0) + fameGain 
      });

      await addActivity('social', `Posted on social media`, 0);
      await loadFanData();
      await loadSocialPosts();

      toast({
        title: "Post Shared!",
        description: `Your message gained ${fanGrowth * platforms.length} new fans across all platforms!`,
      });
      setPostContent("");
    } catch (error: any) {
      console.error('Error posting:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to share post",
      });
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading fan data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Fan Management
            </h1>
            <p className="text-muted-foreground">Connect with your audience and grow your fanbase</p>
          </div>
        </div>

        {/* Fan Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{fanStats?.total_fans?.toLocaleString() || 0}</div>
              <p className="text-xs text-success">+{fanStats?.weekly_growth || 0} this week</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
              <Heart className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{fanStats?.engagement_rate || 0}%</div>
              <Progress value={fanStats?.engagement_rate || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">+{fanStats?.weekly_growth || 0}</div>
              <p className="text-xs text-muted-foreground">New followers</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Platform</CardTitle>
              <Instagram className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{fanStats?.platform_instagram?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">Instagram followers</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Post to Social Media */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Share with Fans
              </CardTitle>
              <CardDescription>Post updates across all your social platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="What's on your mind? Share updates, behind-the-scenes, or upcoming shows..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[100px] bg-secondary/50"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {fanStats && [
                    { platform: 'instagram', followers: fanStats.platform_instagram },
                    { platform: 'twitter', followers: fanStats.platform_twitter },
                    { platform: 'youtube', followers: fanStats.platform_youtube },
                    { platform: 'tiktok', followers: fanStats.platform_tiktok }
                  ].map(({ platform, followers }) => (
                    <div key={platform} className="flex items-center gap-1 text-xs text-muted-foreground">
                      {getPlatformIcon(platform)}
                      {followers || 0}
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={handlePost}
                  disabled={!postContent.trim() || posting}
                  className="bg-gradient-primary hover:shadow-electric"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {posting ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Social Posts */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-accent" />
                Recent Posts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {socialPosts.length === 0 ? (
                <div className="text-center py-8">
                  <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No posts yet. Share something with your fans!</p>
                </div>
              ) : (
                socialPosts.map((post) => (
                  <div key={post.id} className="p-3 rounded-lg bg-secondary/30 space-y-2">
                    <div className="flex items-center gap-2">
                      {getPlatformIcon(post.platform)}
                      <Badge variant="outline" className="text-xs">
                        {post.platform}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm">{post.content}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {post.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" /> {post.shares}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Fan Messages */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-accent" />
                Fan Messages
              </CardTitle>
              <CardDescription>Connect with your most dedicated fans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center py-8">
                <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Fan messages will appear here as you grow your audience!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FanManagement;