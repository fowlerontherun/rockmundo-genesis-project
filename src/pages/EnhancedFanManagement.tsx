import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Heart, 
  MessageCircle, 
  Share2, 
  Star,
  Target,
  Calendar,
  Instagram,
  Twitter,
  Youtube,
  Zap,
  Mail,
  MailOpen,
  Reply
} from "lucide-react";

interface FanDemographics {
  id: string;
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

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  likes: number;
  shares: number;
  comments: number;
  fan_growth: number;
  created_at: string;
}

interface EngagementCampaign {
  id: string;
  title: string;
  description: string;
  cost: number;
  duration: number;
  expectedGrowth: number;
  targetDemographic: string;
}

interface FanMessage {
  id: string;
  user_id: string;
  fan_name: string;
  message: string;
  timestamp: string;
  sentiment: string;
  is_read: boolean;
  reply_message: string | null;
  replied_at: string | null;
}

const sentimentDisplay: Record<string, { label: string; className: string }> = {
  positive: {
    label: "Positive",
    className: "border-green-500/30 text-green-600 bg-green-500/10",
  },
  neutral: {
    label: "Neutral",
    className: "border-slate-500/30 text-slate-600 bg-slate-500/10",
  },
  negative: {
    label: "Negative",
    className: "border-red-500/30 text-red-600 bg-red-500/10",
  }
};

const EnhancedFanManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fanData, setFanData] = useState<FanDemographics | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [campaigning, setCampaigning] = useState(false);
  const [fanMessages, setFanMessages] = useState<FanMessage[]>([]);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyLoadingId, setReplyLoadingId] = useState<string | null>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({
    platform: "",
    content: ""
  });

  const platforms = [
    { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-500" },
    { id: "twitter", name: "Twitter", icon: Twitter, color: "text-blue-400" },
    { id: "youtube", name: "YouTube", icon: Youtube, color: "text-red-500" },
    { id: "tiktok", name: "TikTok", icon: Zap, color: "text-purple-500" }
  ];

  const campaigns: EngagementCampaign[] = [
    {
      id: "youth_campaign",
      title: "Youth Outreach",
      description: "Target 18-25 age group with trendy content and collaborations",
      cost: 500,
      duration: 7,
      expectedGrowth: 15,
      targetDemographic: "age_18_25"
    },
    {
      id: "social_boost",
      title: "Social Media Boost",
      description: "Increase engagement across all platforms with sponsored content",
      cost: 750,
      duration: 5,
      expectedGrowth: 20,
      targetDemographic: "all_platforms"
    },
    {
      id: "mature_audience",
      title: "Mature Audience Campaign",
      description: "Appeal to older demographics with refined marketing",
      cost: 600,
      duration: 10,
      expectedGrowth: 12,
      targetDemographic: "age_36_45"
    },
    {
      id: "viral_push",
      title: "Viral Content Push",
      description: "Create buzz with trending challenges and memes",
      cost: 1000,
      duration: 3,
      expectedGrowth: 35,
      targetDemographic: "platform_tiktok"
    }
  ];

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [fanResponse, postsResponse, profileResponse, messagesResponse] = await Promise.all([
        supabase.from("fan_demographics").select("*").eq("user_id", user?.id).single(),
        supabase.from("social_posts").select("*").eq("user_id", user?.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("*").eq("user_id", user?.id).single(),
        supabase.from("fan_messages").select("*").eq("user_id", user?.id).order("timestamp", { ascending: false })
      ]);

      if (fanResponse.data) setFanData(fanResponse.data);
      if (postsResponse.data) setSocialPosts(postsResponse.data);
      if (profileResponse.data) setProfile(profileResponse.data);
      if (messagesResponse.error) {
        console.error("Error fetching fan messages:", messagesResponse.error);
      } else if (messagesResponse.data) {
        const messages = messagesResponse.data as FanMessage[];
        setFanMessages(messages);
        setReplyInputs(messages.reduce((acc, message) => {
          acc[message.id] = message.reply_message || "";
          return acc;
        }, {} as Record<string, string>));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createSocialPost = async () => {
    if (!newPost.platform || !newPost.content) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a platform and write your post content."
      });
      return;
    }

    setPosting(true);

    try {
      // Calculate engagement based on content quality and platform
      const contentScore = Math.min(100, newPost.content.length / 2);
      const platformMultiplier = getPlatformMultiplier(newPost.platform);
      
      const likes = Math.round((Math.random() * 100 + contentScore) * platformMultiplier);
      const shares = Math.round(likes * 0.3);
      const comments = Math.round(likes * 0.2);
      const fanGrowth = Math.round(likes * 0.1);

      const { data, error } = await supabase
        .from("social_posts")
        .insert({
          user_id: user?.id,
          platform: newPost.platform,
          content: newPost.content,
          likes,
          shares,
          comments,
          fan_growth: fanGrowth
        })
        .select()
        .single();

      if (error) throw error;

      // Update fan demographics
      if (fanData) {
        const platformKey = `platform_${newPost.platform}` as keyof FanDemographics;
        const newFanData = {
          ...fanData,
          total_fans: fanData.total_fans + fanGrowth,
          weekly_growth: fanData.weekly_growth + fanGrowth,
          [platformKey]: (fanData[platformKey] as number) + fanGrowth
        };

        await supabase
          .from("fan_demographics")
          .update(newFanData)
          .eq("user_id", user?.id);

        setFanData(newFanData);
      }

      // Add activity
      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "social",
          message: `Posted on ${newPost.platform}: "${newPost.content.substring(0, 50)}..." (+${fanGrowth} fans)`,
          earnings: 0
        });

      setSocialPosts(prev => [data, ...prev]);
      setNewPost({ platform: "", content: "" });

      toast({
        title: "Post Published!",
        description: `Your ${newPost.platform} post gained ${fanGrowth} new fans!`
      });

    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        variant: "destructive",
        title: "Post Failed",
        description: "Failed to publish post. Please try again."
      });
    } finally {
      setPosting(false);
    }
  };

  const launchCampaign = async (campaign: EngagementCampaign) => {
    if (!user) return;

    if ((profile?.cash || 0) < campaign.cost) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need $${campaign.cost} to launch this campaign.`
      });
      return;
    }

    setCampaigning(true);

    try {
      const newCash = (profile?.cash || 0) - campaign.cost;
      const performanceMultiplier = 0.75 + Math.random() * 0.5;
      const actualGrowth = Math.max(0, Math.round(campaign.expectedGrowth * performanceMultiplier));
      const estimatedRevenue = actualGrowth * FAN_VALUE_PER_FAN;
      const roiValue = campaign.cost > 0
        ? Number((((estimatedRevenue - campaign.cost) / campaign.cost) * 100).toFixed(1))
        : 0;
      const performanceSummary =
        actualGrowth > campaign.expectedGrowth
          ? "Exceeded expectations"
          : actualGrowth === campaign.expectedGrowth
            ? "Met expectations"
            : "Underperformed expectations";

      await supabase
        .from("profiles")
        .update({ cash: newCash })
        .eq("user_id", user?.id);

      if (fanData) {
        let updates: Partial<FanDemographics> = {
          total_fans: fanData.total_fans + actualGrowth,
          weekly_growth: fanData.weekly_growth + actualGrowth
        };

        if (campaign.targetDemographic === "age_18_25") {
          updates.age_18_25 = fanData.age_18_25 + Math.round(actualGrowth * 0.8);
        } else if (campaign.targetDemographic === "age_36_45") {
          updates.age_36_45 = fanData.age_36_45 + Math.round(actualGrowth * 0.8);
        } else if (campaign.targetDemographic === "platform_tiktok") {
          updates.platform_tiktok = fanData.platform_tiktok + Math.round(actualGrowth * 0.9);
        } else if (campaign.targetDemographic === "all_platforms") {
          const growthPerPlatform = Math.round(actualGrowth / 4);
          updates.platform_instagram = fanData.platform_instagram + growthPerPlatform;
          updates.platform_twitter = fanData.platform_twitter + growthPerPlatform;
          updates.platform_youtube = fanData.platform_youtube + growthPerPlatform;
          updates.platform_tiktok = fanData.platform_tiktok + growthPerPlatform;
        }

        await supabase
          .from("fan_demographics")
          .update(updates)
          .eq("user_id", user?.id);

        setFanData(prev => (prev ? { ...prev, ...updates } : prev));
      }

      const formattedTarget = formatTargetDemo(campaign.targetDemographic);

      const { data: insertedCampaign, error: campaignError } = await supabase
        .from("fan_campaigns")
        .insert({
          user_id: user?.id,
          title: campaign.title,
          cost: campaign.cost,
          duration: campaign.duration,
          expected_growth: campaign.expectedGrowth,
          target_demo: campaign.targetDemographic,
          actual_growth: actualGrowth,
          roi: roiValue,
          results: {
            summary: performanceSummary,
            actual_growth: actualGrowth,
            expected_growth: campaign.expectedGrowth,
            estimated_revenue: estimatedRevenue,
            roi: roiValue,
            notes: `Targeted ${formattedTarget} audience.`
          }
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      await supabase
        .from("activity_feed")
        .insert({
          user_id: user?.id,
          activity_type: "campaign",
          message: `"${campaign.title}" campaign gained ${actualGrowth} fans (${roiValue.toFixed(1)}% ROI)`,
          earnings: estimatedRevenue - campaign.cost
        });

      setProfile(prev => (prev ? { ...prev, cash: newCash } : prev));

      if (insertedCampaign) {
        const normalizedCampaign: FanCampaignRecord = {
          ...insertedCampaign,
          cost: typeof insertedCampaign.cost === "string" ? parseFloat(insertedCampaign.cost) : insertedCampaign.cost,
          roi:
            insertedCampaign.roi !== null
              ? typeof insertedCampaign.roi === "string"
                ? parseFloat(insertedCampaign.roi)
                : insertedCampaign.roi
              : null,
          results: insertedCampaign.results as CampaignResults | null
        };
        setCampaignHistory(prev => [normalizedCampaign, ...prev]);
      }

      toast({
        title: "Campaign Completed!",
        description: `"${campaign.title}" brought in ${actualGrowth} new fans with a ${roiValue.toFixed(1)}% ROI.`
      });

    } catch (error) {
      console.error("Error launching campaign:", error);
      toast({
        variant: "destructive",
        title: "Campaign Failed",
        description: "Failed to launch campaign. Please try again."
      });
    } finally {
      setCampaigning(false);
    }
  };

  const getPlatformMultiplier = (platform: string): number => {
    switch (platform) {
      case "tiktok": return 2.5;
      case "instagram": return 1.8;
      case "youtube": return 1.5;
      case "twitter": return 1.2;
      default: return 1.0;
    }
  };

  const getPlatformIcon = (platform: string) => {
    const platformData = platforms.find(p => p.id === platform);
    return platformData ? platformData.icon : MessageCircle;
  };

  const getPlatformColor = (platform: string) => {
    const platformData = platforms.find(p => p.id === platform);
    return platformData ? platformData.color : "text-gray-500";
  };

  const handleReplyChange = (messageId: string, value: string) => {
    setReplyInputs(prev => ({ ...prev, [messageId]: value }));
  };

  const markMessageAsRead = async (messageId: string) => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Unable to update message",
        description: "You need to be signed in to manage fan messages."
      });
      return;
    }

    setMarkingReadId(messageId);

    try {
      const { error } = await supabase
        .from("fan_messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setFanMessages(prev =>
        prev.map(message =>
          message.id === messageId ? { ...message, is_read: true } : message
        )
      );

      toast({
        title: "Message marked as read",
        description: "Take a moment to craft the perfect reply."
      });
    } catch (error) {
      console.error("Error marking fan message as read:", error);
      toast({
        variant: "destructive",
        title: "Could not update message",
        description: "We couldn't mark the message as read. Please try again."
      });
    } finally {
      setMarkingReadId(null);
    }
  };

  const sendReply = async (messageId: string) => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Unable to send reply",
        description: "You need to be signed in to reply to fans."
      });
      return;
    }

    const replyText = (replyInputs[messageId] || "").trim();

    if (!replyText) {
      toast({
        variant: "destructive",
        title: "Reply cannot be empty",
        description: "Write a quick message before sending your reply."
      });
      return;
    }

    setReplyLoadingId(messageId);
    const repliedAt = new Date().toISOString();

    try {
      const { error } = await supabase
        .from("fan_messages")
        .update({
          reply_message: replyText,
          replied_at: repliedAt,
          is_read: true
        })
        .eq("id", messageId)
        .eq("user_id", user.id);

      if (error) throw error;

      setFanMessages(prev =>
        prev.map(message =>
          message.id === messageId
            ? { ...message, reply_message: replyText, replied_at: repliedAt, is_read: true }
            : message
        )
      );
      setReplyInputs(prev => ({ ...prev, [messageId]: replyText }));

      toast({
        title: "Reply sent!",
        description: "Your fan will appreciate the personal touch."
      });
    } catch (error) {
      console.error("Error replying to fan message:", error);
      toast({
        variant: "destructive",
        title: "Reply failed",
        description: "We couldn't send your reply. Please try again."
      });
    } finally {
      setReplyLoadingId(null);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  };

  const unreadMessagesCount = fanMessages.filter(message => !message.is_read).length;
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading fan management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bebas tracking-wider">FAN MANAGEMENT HQ</h1>
        <p className="text-lg text-muted-foreground font-oswald">
          Build your fanbase and engage with your audience
        </p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="font-oswald">{fanData?.total_fans?.toLocaleString() || 0} Total Fans</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="font-oswald">+{fanData?.weekly_growth || 0} This Week</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="messages">
            Fan Messages{unreadMessagesCount > 0 ? ` (${unreadMessagesCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <div className="text-2xl font-bold">{fanData?.total_fans?.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">Total Fans</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <div className="text-2xl font-bold">+{fanData?.weekly_growth || 0}</div>
                <div className="text-sm text-muted-foreground">Weekly Growth</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Heart className="h-8 w-8 mx-auto mb-2 text-red-400" />
                <div className="text-2xl font-bold">{fanData?.engagement_rate || 0}%</div>
                <div className="text-sm text-muted-foreground">Engagement Rate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                <div className="text-2xl font-bold">{socialPosts.length}</div>
                <div className="text-sm text-muted-foreground">Recent Posts</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-bebas">PLATFORM BREAKDOWN</CardTitle>
              <CardDescription>Where your fans are most active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {platforms.map(platform => {
                  const Icon = platform.icon;
                  const followers = fanData?.[`platform_${platform.id}` as keyof FanDemographics] as number || 0;
                  const percentage = fanData?.total_fans ? Math.round((followers / fanData.total_fans) * 100) : 0;
                  
                  return (
                    <div key={platform.id} className="text-center p-4 bg-muted rounded-lg">
                      <Icon className={`h-6 w-6 mx-auto mb-2 ${platform.color}`} />
                      <div className="text-lg font-bold">{followers.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">{platform.name}</div>
                      <div className="text-xs text-muted-foreground">{percentage}%</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-bebas">AGE DEMOGRAPHICS</CardTitle>
              <CardDescription>Age distribution of your fanbase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "18-25", key: "age_18_25", color: "bg-blue-500" },
                { label: "26-35", key: "age_26_35", color: "bg-green-500" },
                { label: "36-45", key: "age_36_45", color: "bg-yellow-500" },
                { label: "45+", key: "age_45_plus", color: "bg-red-500" }
              ].map(age => {
                const count = fanData?.[age.key as keyof FanDemographics] as number || 0;
                const percentage = fanData?.total_fans ? Math.round((count / fanData.total_fans) * 100) : 0;
                
                return (
                  <div key={age.key} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{age.label} years old</span>
                      <span className="text-sm text-muted-foreground">{count.toLocaleString()} ({percentage}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-bebas">ENGAGEMENT INSIGHTS</CardTitle>
              <CardDescription>How your fans interact with your content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Heart className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <div className="text-xl font-bold">{fanData?.engagement_rate || 0}%</div>
                  <div className="text-sm text-muted-foreground">Engagement Rate</div>
                  <p className="text-xs mt-2 text-muted-foreground">
                    {fanData?.engagement_rate && fanData.engagement_rate > 5 ? "Excellent engagement!" : "Room for improvement"}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-400" />
                  <div className="text-xl font-bold">+{fanData?.weekly_growth || 0}</div>
                  <div className="text-sm text-muted-foreground">Weekly Growth</div>
                  <p className="text-xs mt-2 text-muted-foreground">
                    {fanData?.weekly_growth && fanData.weekly_growth > 0 ? "Growing steadily" : "Consider new strategies"}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Target className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                  <div className="text-xl font-bold">Level {Math.floor((fanData?.total_fans || 0) / 1000) + 1}</div>
                  <div className="text-sm text-muted-foreground">Fan Level</div>
                  <p className="text-xs mt-2 text-muted-foreground">
                    {Math.max(0, 1000 - ((fanData?.total_fans || 0) % 1000))} fans to next level
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-bebas">CREATE NEW POST</CardTitle>
              <CardDescription>Share content with your fans and grow your audience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Platform</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {platforms.map(platform => {
                    const Icon = platform.icon;
                    return (
                      <Button
                        key={platform.id}
                        variant={newPost.platform === platform.id ? "default" : "outline"}
                        onClick={() => setNewPost(prev => ({ ...prev, platform: platform.id }))}
                        className="flex items-center gap-2"
                      >
                        <Icon className={`h-4 w-4 ${platform.color}`} />
                        {platform.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Content</label>
                <textarea
                  className="w-full mt-2 p-3 border rounded-lg resize-none"
                  rows={4}
                  placeholder="What's happening in your music world? Share updates, behind-the-scenes content, or connect with your fans..."
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                  maxLength={280}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {newPost.content.length}/280 characters
                </div>
              </div>

              <Button
                onClick={createSocialPost}
                disabled={posting || !newPost.platform || !newPost.content}
                className="w-full"
              >
                {posting ? "Publishing..." : "Publish Post"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-bebas">RECENT POSTS</CardTitle>
              <CardDescription>Your latest social media activity</CardDescription>
            </CardHeader>
            <CardContent>
              {socialPosts.length > 0 ? (
                <div className="space-y-4">
                  {socialPosts.map(post => {
                    const Icon = getPlatformIcon(post.platform);
                    return (
                      <div key={post.id} className="p-4 border rounded-lg">
                        <div className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 mt-1 ${getPlatformColor(post.platform)}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="capitalize">{post.platform}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(post.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm mb-3">{post.content}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {post.likes}
                              </span>
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />
                                {post.shares}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {post.comments}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                +{post.fan_growth} fans
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Posts Yet</h3>
                  <p className="text-muted-foreground">Create your first social media post to start engaging with fans!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="font-bebas">FAN MESSAGES</CardTitle>
                <CardDescription>Read and reply to the fans who reach out to you</CardDescription>
              </div>
              {fanMessages.length > 0 && (
                <Badge variant="secondary" className="text-xs uppercase tracking-wider">
                  {unreadMessagesCount} unread
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {fanMessages.length > 0 ? (
                <div className="space-y-4">
                  {fanMessages.map(message => {
                    const sentimentKey = (message.sentiment || "neutral").toLowerCase();
                    const sentiment = sentimentDisplay[sentimentKey] ?? sentimentDisplay.neutral;
                    const replyValue = replyInputs[message.id] ?? "";

                    return (
                      <div
                        key={message.id}
                        className={`rounded-lg border p-4 space-y-4 transition ${message.is_read ? "bg-background" : "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"}`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-3">
                            <Mail className={`mt-1 h-5 w-5 ${message.is_read ? "text-muted-foreground" : "text-primary"}`} />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold capitalize">{message.fan_name}</p>
                                <Badge variant="outline" className={`text-xs capitalize ${sentiment.className}`}>
                                  {sentiment.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(message.timestamp) || "Just now"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={message.is_read ? "outline" : "default"} className="uppercase tracking-wide text-[10px]">
                              {message.is_read ? "Read" : "New"}
                            </Badge>
                            {!message.is_read && (
                              <Button
                                onClick={() => markMessageAsRead(message.id)}
                                disabled={markingReadId === message.id}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-2"
                              >
                                <MailOpen className="h-4 w-4" />
                                {markingReadId === message.id ? "Marking..." : "Mark as Read"}
                              </Button>
                            )}
                          </div>
                        </div>

                        <p className="text-sm leading-relaxed">{message.message}</p>

                        <div className="space-y-2">
                          <label className="text-xs font-medium uppercase text-muted-foreground">
                            Reply to {message.fan_name}
                          </label>
                          <Textarea
                            value={replyValue}
                            onChange={(event) => handleReplyChange(message.id, event.target.value)}
                            placeholder="Send a heartfelt message back..."
                            rows={3}
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              onClick={() => sendReply(message.id)}
                              disabled={replyLoadingId === message.id || replyValue.trim().length === 0}
                              size="sm"
                              className="flex items-center gap-2"
                            >
                              <Reply className="h-4 w-4" />
                              {replyLoadingId === message.id ? "Sending..." : message.reply_message ? "Update Reply" : "Send Reply"}
                            </Button>
                            {message.replied_at && (
                              <span className="text-xs text-muted-foreground">
                                Replied on {formatDateTime(message.replied_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No fan messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Grow your community and fans will start reaching out with their love and support.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(campaign => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-oswald text-lg">{campaign.title}</CardTitle>
                      <CardDescription>{campaign.description}</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {campaign.duration} days
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      <span>+{campaign.expectedGrowth} fans</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                      <span>${campaign.cost}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => launchCampaign(campaign)}
                    disabled={campaigning || (profile?.cash || 0) < campaign.cost}
                    className="w-full"
                  >
                    {campaigning ? "Launching..." : 
                     (profile?.cash || 0) < campaign.cost ? "Can't Afford" : 
                     `Launch Campaign ($${campaign.cost})`}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-bebas">CAMPAIGN ANALYTICS</CardTitle>
              <CardDescription>Track performance, ROI, and audience impact from your launches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {campaignHistory.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaigns Run</p>
                      <p className="text-2xl font-bold">{campaignHistory.length}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fans Gained</p>
                      <p className="text-2xl font-bold text-green-500">+{totalCampaignGrowth.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Spend</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalCampaignSpend)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average ROI</p>
                      <p
                        className={`text-2xl font-bold ${averageCampaignRoi >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {formatPercentage(averageCampaignRoi)}
                      </p>
                    </div>
                  </div>

                  {bestCampaign && (
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Top Performing Campaign
                          </p>
                          <p className="font-medium">{bestCampaign.title}</p>
                          <p className="text-xs text-muted-foreground">
                            +{bestCampaignGrowth.toLocaleString()} fans • {formatCurrency(bestCampaignSpend)} spend • Target: {formatTargetDemo(bestCampaign.target_demo)}
                          </p>
                        </div>
                        <Badge
                          variant={bestCampaignRoi >= 0 ? "secondary" : "destructive"}
                          className="w-fit"
                        >
                          ROI {formatPercentage(bestCampaignRoi)}
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {campaignHistory.map(campaign => {
                      const actualGrowth = getActualGrowth(campaign);
                      const roiValue = getCampaignRoi(campaign);
                      const roiPositive = roiValue >= 0;

                      return (
                        <div key={campaign.id} className="space-y-3 rounded-lg border p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold">{campaign.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(campaign.completed_at ?? campaign.launched_at).toLocaleDateString()} • Target: {formatTargetDemo(campaign.target_demo)}
                              </p>
                            </div>
                            <Badge variant={roiPositive ? "secondary" : "destructive"} className="w-fit">
                              ROI {formatPercentage(roiValue)}
                            </Badge>
                          </div>

                          {campaign.results?.summary && (
                            <p className="text-sm text-muted-foreground">{campaign.results.summary}</p>
                          )}

                          <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-green-500" />
                              <span>
                                +{actualGrowth.toLocaleString()} fans
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({campaign.expected_growth.toLocaleString()} expected)
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              <span>{formatCurrency(typeof campaign.cost === "number" ? campaign.cost : 0)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-500" />
                              <span>{campaign.duration} days</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-purple-500" />
                              <span>{formatTargetDemo(campaign.target_demo)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-3 py-8 text-center text-muted-foreground">
                  <TrendingUp className="mx-auto h-10 w-10" />
                  <p className="font-medium text-foreground">No campaigns launched yet</p>
                  <p className="text-sm">
                    Launch a campaign to see detailed performance analytics and ROI insights.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedFanManagement;