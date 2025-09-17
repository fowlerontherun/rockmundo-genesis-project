import { useState, useEffect, useMemo, useCallback, FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ThumbsUp,
  Clock,
  Trash2,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
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
  media_url?: string | null;
  media_path?: string | null;
  media_type?: "image" | "video" | null;
  scheduled_for?: string | null;
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

interface FanMessage {
  id: string;
  user_id: string;
  fan_name: string | null;
  fan_email: string | null;
  platform: string | null;
  sentiment: string | null;
  message: string;
  created_at: string;
}

type MessageFormState = {
  name: string;
  email: string;
  platform: string;
  sentiment: string;
  message: string;
};

declare const applyScheduledPostEffects:
  | ((posts: SocialPost[], activityDescription: string) => Promise<void> | void)
  | undefined;

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter / X" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" }
];

const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positive" },
  { value: "request", label: "Request" },
  { value: "question", label: "Question" }
];

const FanManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, updateProfile, addActivity } = useGameData();

  const [postContent, setPostContent] = useState("");
  const [fanStats, setFanStats] = useState<FanDemographics | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<SocialPost[]>([]);
  const [scheduledTime, setScheduledTime] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [activeTab, setActiveTab] = useState<"published" | "scheduled">("published");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [fanMessages, setFanMessages] = useState<FanMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [messageForm, setMessageForm] = useState<MessageFormState>({
    name: "",
    email: "",
    platform: "instagram",
    sentiment: "positive",
    message: ""
  });
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const loadFanData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('fan_demographics')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      setFanStats(data);
    } catch (error) {
      console.error('Error loading fan data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadSocialPosts = useCallback(async () => {
    if (!user) return;

    try {
      const nowIso = new Date().toISOString();
      const [publishedResult, scheduledResult] = await Promise.all([
        supabase
          .from('social_posts')
          .select('*')
          .eq('user_id', user.id)
          .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('social_posts')
          .select('*')
          .eq('user_id', user.id)
          .gt('scheduled_for', nowIso)
          .order('scheduled_for', { ascending: true })
      ]);

      if (publishedResult.error) throw publishedResult.error;
      if (scheduledResult.error) throw scheduledResult.error;

      let publishedData = publishedResult.data || [];
      const now = new Date();

      const duePosts = publishedData.filter(
        (post) => post.scheduled_for && new Date(post.scheduled_for) <= now
      );

      if (duePosts.length > 0) {
        const duePostIds = duePosts.map((post) => post.id);
        const { error: finalizeError } = await supabase
          .from('social_posts')
          .update({ scheduled_for: null })
          .in('id', duePostIds);

        if (finalizeError) {
          console.error('Error finalizing scheduled posts:', finalizeError);
        } else {
          if (typeof applyScheduledPostEffects === 'function') {
            await applyScheduledPostEffects(duePosts, 'Scheduled social post published');
          }
          publishedData = publishedData.map((post) =>
            duePostIds.includes(post.id) ? { ...post, scheduled_for: null } : post
          );
        }
      }

      setSocialPosts(publishedData);
      setScheduledPosts(scheduledResult.data || []);
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to load social posts';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error loading social posts:', errorMessage, error);
    }
  }, [user]);

  const formatDateTimeLocal = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const clearMediaSelection = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      clearMediaSelection();
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast({
        variant: "destructive",
        title: "Unsupported file",
        description: "Please upload an image or video file.",
      });
      event.target.value = "";
      clearMediaSelection();
      return;
    }

    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleRemoveMedia = () => {
    clearMediaSelection();
  };

  const handleDeleteScheduledPost = async (post: SocialPost) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);

      if (error) throw error;
      setSocialPosts((prevPosts) => prevPosts.filter((existingPost) => existingPost.id !== post.id));
      setScheduledPosts((prevPosts) => prevPosts.filter((existingPost) => existingPost.id !== post.id));
    } catch (error) {
      console.error('Error deleting scheduled post:', error);
    }
  };

  const loadFanMessages = useCallback(async () => {
    if (!user) return;

    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('fan_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setFanMessages(data || []);
    } catch (error) {
      console.error('Error loading fan messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadFanData();
      loadSocialPosts();
      loadFanMessages();
    }
  }, [user, loadFanData, loadSocialPosts, loadFanMessages]);
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

  const filteredMessages = useMemo(() => {
    return fanMessages.filter((message) => {
      const sentimentMatch = sentimentFilter === "all" || message.sentiment === sentimentFilter;
      const platformMatch = platformFilter === "all" || message.platform === platformFilter;
      return sentimentMatch && platformMatch;
    });
  }, [fanMessages, sentimentFilter, platformFilter]);

  const updateMessageForm = (field: keyof MessageFormState, value: string) => {
    setMessageForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFanMessageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !messageForm.message.trim()) return;

    const trimmedName = messageForm.name.trim();
    const trimmedEmail = messageForm.email.trim();
    const trimmedMessage = messageForm.message.trim();

    setMessageSubmitting(true);
    try {
      const { error } = await supabase
        .from('fan_messages')
        .insert({
          user_id: user.id,
          fan_name: trimmedName || null,
          fan_email: trimmedEmail || null,
          platform: messageForm.platform || null,
          sentiment: messageForm.sentiment || null,
          message: trimmedMessage,
        });

      if (error) throw error;

      toast({
        title: "Message saved",
        description: "Your fan message has been recorded.",
      });

      setMessageForm((prev) => ({
        name: "",
        email: "",
        platform: prev.platform,
        sentiment: prev.sentiment,
        message: "",
      }));

      await loadFanMessages();
    } catch (error) {
      console.error('Error saving fan message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save fan message.",
      });
    } finally {
      setMessageSubmitting(false);
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() || !user || !profile) return;

    const scheduledDate = scheduledTime ? new Date(scheduledTime) : null;

    if (scheduledDate && Number.isNaN(scheduledDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid schedule",
        description: "Please select a valid date and time.",
      });
      return;
    }

    if (scheduledDate && scheduledDate.getTime() <= Date.now()) {
      toast({
        variant: "destructive",
        title: "Schedule in the future",
        description: "Choose a time in the future for your scheduled post.",
      });
      return;
    }

    setPosting(true);
    let uploadedMediaPath: string | null = null;
    try {
      const scheduledIso = scheduledDate ? scheduledDate.toISOString() : null;

      let mediaUrl: string | null = null;
      let mediaTypeValue: "image" | "video" | null = null;

      if (mediaFile) {
        const uniqueSegment =
          typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
            ? globalThis.crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        uploadedMediaPath = `${user.id}/${uniqueSegment}-${mediaFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('social-posts')
          .upload(uploadedMediaPath, mediaFile, {
            contentType: mediaFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('social-posts')
          .getPublicUrl(uploadedMediaPath);

        mediaUrl = publicData.publicUrl;
        mediaTypeValue = mediaType ?? (mediaFile.type.startsWith('video/') ? 'video' : 'image');
      }

      // Calculate engagement metrics based on player fame and random factors
      const baseLikes = Math.round((profile.fame || 0) * (0.1 + Math.random() * 0.2));
      const baseComments = Math.round(baseLikes * (0.1 + Math.random() * 0.15));
      const baseShares = Math.round(baseLikes * (0.05 + Math.random() * 0.1));
      const fanGrowth = Math.round(baseLikes * 0.02);

      // Create posts for multiple platforms
      const platforms = ['instagram', 'twitter', 'youtube'];
      const postPromises = platforms.map(platform => {
        const payload: Record<string, any> = {
          user_id: user.id,
          platform,
          content: postContent,
          likes: Math.round(baseLikes * (0.8 + Math.random() * 0.4)),
          comments: Math.round(baseComments * (0.8 + Math.random() * 0.4)),
          shares: Math.round(baseShares * (0.8 + Math.random() * 0.4)),
          fan_growth: Math.round(fanGrowth * (0.8 + Math.random() * 0.4))
        };

        if (mediaUrl) {
          payload.media_url = mediaUrl;
          payload.media_path = uploadedMediaPath;
          payload.media_type = mediaTypeValue;
        }

        if (scheduledIso) {
          payload.scheduled_for = scheduledIso;
          payload.created_at = scheduledIso;
          payload.timestamp = scheduledIso;
        }

        return supabase.from('social_posts').insert(payload);
      });

      const results = await Promise.all(postPromises);
      const insertError = results.find(result => result.error)?.error;

      if (insertError) throw insertError;

      if (!scheduledIso) {
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

        const fameGain = Math.round(fanGrowth / 2);
        await updateProfile({
          fame: (profile.fame || 0) + fameGain
        });

        await addActivity('social', `Posted on social media`, 0);
        toast({
          title: "Post Shared!",
          description: `Your message gained ${fanGrowth * platforms.length} new fans across all platforms!`,
        });
      } else {
        await addActivity('social', `Scheduled a social post`, 0);
        toast({
          title: "Post Scheduled!",
          description: `Your update will publish on ${scheduledDate!.toLocaleString()}.`,
        });
        setActiveTab('scheduled');
      }

      await loadFanData();
      await loadSocialPosts();

      setPostContent("");
    } catch (error) {
      console.error('Error posting:', error);
      if (uploadedMediaPath) {
        const { error: removeError } = await supabase.storage
          .from('social-posts')
          .remove([uploadedMediaPath]);
        if (removeError) {
          console.error('Error cleaning up uploaded media:', removeError);
        }
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to share post",
      });
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`fan_messages_user_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'fan_messages', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newMessage = payload.new as FanMessage;
          setFanMessages((prev) => {
            if (prev.some((message) => message.id === newMessage.id)) {
              return prev;
            }

            const updated = [newMessage, ...prev];
            return updated.slice(0, 50);
          });

          toast({
            title: "New fan message",
            description: newMessage.fan_name
              ? `${newMessage.fan_name} just reached out${newMessage.platform ? ` via ${newMessage.platform}` : ""}.`
              : "A new fan just reached out.",
          });
        }
      );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, toast]);

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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-media" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Attach media
                  </Label>
                  <Input
                    id="post-media"
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,video/*"
                    onChange={handleMediaChange}
                    disabled={posting}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Upload className="h-3 w-3" />
                    Images or videos help boost engagement.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-schedule" className="text-xs uppercase tracking-wide text-muted-foreground">
                    Schedule (optional)
                  </Label>
                  <Input
                    id="post-schedule"
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    min={scheduleMinimumValue}
                    disabled={posting}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to publish immediately.
                  </p>
                </div>
              </div>
              {mediaPreview && (
                <div className="rounded-md border border-border/40 overflow-hidden">
                  {mediaType === 'video' ? (
                    <video src={mediaPreview} controls className="w-full max-h-72 object-cover" />
                  ) : (
                    <img src={mediaPreview} alt="Selected media preview" className="w-full max-h-72 object-cover" />
                  )}
                  <div className="flex items-center justify-between px-3 py-2 bg-secondary/60">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {mediaType === 'video' ? <VideoIcon className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                      <span>Attached media preview</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRemoveMedia} disabled={posting}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {fanStats && [
                    { platform: 'instagram', followers: fanStats.platform_instagram },
                    { platform: 'twitter', followers: fanStats.platform_twitter },
                    { platform: 'youtube', followers: fanStats.platform_youtube },
                    { platform: 'tiktok', followers: fanStats.platform_tiktok }
                  ].map(({ platform, followers }) => (
                    <div key={platform} className="flex items-center gap-1">
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
                  {posting ? (isScheduling ? "Scheduling..." : "Posting...") : (isScheduling ? "Schedule Post" : "Post")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Social Posts */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-accent" />
                Social Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as "published" | "scheduled")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="published">Published</TabsTrigger>
                  <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                </TabsList>
                <TabsContent value="published" className="space-y-4">
                  {socialPosts.length === 0 ? (
                    <div className="text-center py-8">
                      <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No posts yet. Share something with your fans!</p>
                    </div>
                  ) : (
                    socialPosts.map((post) => (
                      <div key={post.id} className="p-3 rounded-lg bg-secondary/30 space-y-3 border border-border/30">
                        <div className="flex flex-wrap items-center gap-2">
                          {getPlatformIcon(post.platform)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {post.platform}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(post.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                        {post.media_url && (
                          <div className="rounded-md overflow-hidden border border-border/40">
                            {post.media_type === 'video' ? (
                              <video src={post.media_url} controls className="w-full max-h-64 object-cover" />
                            ) : (
                              <img src={post.media_url} alt="Social post media" className="w-full max-h-64 object-cover" />
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
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
                </TabsContent>
                <TabsContent value="scheduled" className="space-y-4">
                  {scheduledPosts.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No upcoming posts. Schedule content to plan ahead.</p>
                    </div>
                  ) : (
                    scheduledPosts.map((post) => (
                      <div key={post.id} className="p-3 rounded-lg bg-secondary/30 space-y-3 border border-border/30">
                        <div className="flex flex-wrap items-center gap-2">
                          {getPlatformIcon(post.platform)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {post.platform}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Scheduled
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            Publishes {post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : "soon"}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                        {post.media_url && (
                          <div className="rounded-md overflow-hidden border border-border/40">
                            {post.media_type === 'video' ? (
                              <video src={post.media_url} controls className="w-full max-h-64 object-cover" />
                            ) : (
                              <img src={post.media_url} alt="Scheduled post media" className="w-full max-h-64 object-cover" />
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <div className="flex gap-4">
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
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handlePublishScheduledPost(post)}>
                              <Send className="h-3 w-3 mr-2" /> Publish now
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteScheduledPost(post)}>
                              <Trash2 className="h-3 w-3 mr-2" /> Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
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
            <CardContent className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="p-4 rounded-lg bg-secondary/30 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Log fan outreach</h3>
                    <p className="text-sm text-muted-foreground">
                      Record new fan connections to keep track of every shoutout and opportunity.
                    </p>
                  </div>
                  <form className="space-y-4" onSubmit={handleFanMessageSubmit}>
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="fan-name">Fan name</Label>
                        <Input
                          id="fan-name"
                          value={messageForm.name}
                          onChange={(event) => updateMessageForm("name", event.target.value)}
                          placeholder="Jamie from L.A."
                          className="bg-secondary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fan-email">Fan contact</Label>
                        <Input
                          id="fan-email"
                          type="email"
                          value={messageForm.email}
                          onChange={(event) => updateMessageForm("email", event.target.value)}
                          placeholder="jamie@email.com"
                          className="bg-secondary/50"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="fan-platform">Platform</Label>
                        <Select
                          value={messageForm.platform}
                          onValueChange={(value) => updateMessageForm("platform", value)}
                        >
                          <SelectTrigger id="fan-platform" className="bg-secondary/50 border-primary/20">
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORM_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fan-sentiment">Sentiment</Label>
                        <Select
                          value={messageForm.sentiment}
                          onValueChange={(value) => updateMessageForm("sentiment", value)}
                        >
                          <SelectTrigger id="fan-sentiment" className="bg-secondary/50 border-primary/20">
                            <SelectValue placeholder="Sentiment" />
                          </SelectTrigger>
                          <SelectContent>
                            {SENTIMENT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fan-message">Message</Label>
                      <Textarea
                        id="fan-message"
                        value={messageForm.message}
                        onChange={(event) => updateMessageForm("message", event.target.value)}
                        placeholder="Share the fan's note or request..."
                        className="min-h-[120px] bg-secondary/50"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={messageSubmitting || !messageForm.message.trim()}
                      className="w-full bg-gradient-primary hover:shadow-electric"
                    >
                      {messageSubmitting ? "Saving..." : "Save Message"}
                    </Button>
                  </form>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Fan inbox</h3>
                      <p className="text-sm text-muted-foreground">Review feedback coming in from your community.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                        <SelectTrigger className="bg-secondary/50 border-primary/20 sm:w-[160px]">
                          <SelectValue placeholder="Sentiment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sentiments</SelectItem>
                          {SENTIMENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="bg-secondary/50 border-primary/20 sm:w-[160px]">
                          <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All platforms</SelectItem>
                          {PLATFORM_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    </div>
                  ) : filteredMessages.length === 0 ? (
                    <div className="text-center py-10">
                      <Heart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {fanMessages.length === 0
                          ? "Fan messages will appear here as you grow your audience!"
                          : "No messages match your current filters."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-4 rounded-lg bg-secondary/40 border-l-4 ${getSentimentColor(message.sentiment || "")}`}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold">
                              {message.fan_name || "Anonymous Fan"}
                            </span>
                            {message.fan_email && (
                              <span className="text-muted-foreground">• {message.fan_email}</span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(message.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {message.platform && (
                              <div className="flex items-center gap-1">
                                {getPlatformIcon(message.platform)}
                                <span className="uppercase tracking-wide text-[11px]">
                                  {message.platform}
                                </span>
                              </div>
                            )}
                            {message.sentiment && (
                              <Badge variant="outline" className="capitalize">
                                {message.sentiment}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                            {message.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FanManagement;