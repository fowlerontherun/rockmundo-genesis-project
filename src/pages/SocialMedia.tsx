
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageCircle, Repeat2, Share, TrendingUp, Users, Eye, Loader2, Pencil, Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type SocialPostRow = Database["public"]["Tables"]["social_posts"]["Row"];

type SocialCampaignRow = Database["public"]["Tables"]["social_campaigns"]["Row"];

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

interface Campaign {
  id: string;
  name: string;
  platform: string;
  budget: number;
  reach: number;
  engagement: number;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
}

interface CampaignFormState {
  name: string;
  platform: string;
  budget: string;
  reach: string;
  engagement: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
}

const campaignStatusOptions: CampaignStatus[] = ["Active", "Completed"];

const mapStatusFromDb = (status: SocialCampaignRow["status"]): CampaignStatus => {
  switch (status) {
    case "completed":
      return "Completed";
    case "active":
    default:
      return "Active";
  }
};

const mapStatusToDb = (status: CampaignStatus): SocialCampaignRow["status"] => {
  switch (status) {
    case "Completed":
      return "completed";
    case "Active":
    default:
      return "active";
  }
};

const mapRowToCampaign = (row: SocialCampaignRow): Campaign => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  budget: Number(row.budget ?? 0),
  reach: Number(row.reach ?? 0),
  engagement: Number(row.engagement ?? 0),
  status: mapStatusFromDb(row.status),
  startDate: row.start_date,
  endDate: row.end_date
});

const formatCampaignDate = (date: string | null) => {
  if (!date) return "--";

  const safeDateString = `${date}T00:00:00`;
  const formattedDate = new Date(safeDateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return formattedDate;
};

const createEmptyCampaignForm = (): CampaignFormState => ({
  name: "",
  platform: "",
  budget: "",
  reach: "",
  engagement: "",
  status: "Active",
  startDate: "",
  endDate: ""
});

const mapCampaignToForm = (campaign: Campaign): CampaignFormState => ({
  name: campaign.name,
  platform: campaign.platform,
  budget: Number.isFinite(campaign.budget) ? campaign.budget.toString() : "",
  reach: Number.isFinite(campaign.reach) ? campaign.reach.toString() : "",
  engagement: Number.isFinite(campaign.engagement) ? campaign.engagement.toString() : "",
  status: campaign.status,
  startDate: campaign.startDate ?? "",
  endDate: campaign.endDate ?? ""
});

const SocialMedia = () => {
  const { user } = useAuth();
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
  ]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(() => createEmptyCampaignForm());
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!user) {
      setCampaigns([]);
      setCampaignsLoading(false);
      return;
    }

    setCampaignsLoading(true);

    try {
      const { data, error } = await supabase
        .from("social_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedCampaigns = (data ?? []).map(mapRowToCampaign);
      setCampaigns(mappedCampaigns);
    } catch (error) {
      console.error("Error loading social campaigns:", error);
      toast({
        variant: "destructive",
        title: "Unable to load campaigns",
        description: "Please try again in a moment."
      });
    } finally {
      setCampaignsLoading(false);
    }
  }, [toast, user]);

  const createCampaign = useCallback(
    async (formState: CampaignFormState) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to create campaigns",
          description: "You need to be logged in to manage marketing campaigns."
        });
        throw new Error("User not authenticated");
      }

      try {
        const { data, error } = await supabase
          .from("social_campaigns")
          .insert({
            user_id: user.id,
            name: formState.name.trim(),
            platform: formState.platform.trim(),
            budget: Number(formState.budget || 0),
            reach: Number(formState.reach || 0),
            engagement: Number(formState.engagement || 0),
            status: mapStatusToDb(formState.status),
            start_date: formState.startDate || null,
            end_date: formState.endDate || null
          })
          .select()
          .single();

        if (error) throw error;

        const newCampaign = mapRowToCampaign(data);
        setCampaigns((previous) => [newCampaign, ...previous]);
        return newCampaign;
      } catch (error) {
        console.error("Error creating campaign:", error);
        toast({
          variant: "destructive",
          title: "Campaign not saved",
          description: "We couldn't create the campaign. Please try again."
        });
        throw error;
      }
    },
    [toast, user]
  );

  const updateCampaign = useCallback(
    async (campaignId: string, updates: Partial<Campaign>) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to update campaigns",
          description: "You need to be logged in to update marketing campaigns."
        });
        throw new Error("User not authenticated");
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) updatePayload.name = updates.name.trim();
      if (updates.platform !== undefined) updatePayload.platform = updates.platform.trim();
      if (updates.budget !== undefined) updatePayload.budget = updates.budget;
      if (updates.reach !== undefined) updatePayload.reach = updates.reach;
      if (updates.engagement !== undefined) updatePayload.engagement = updates.engagement;
      if (updates.status !== undefined) updatePayload.status = mapStatusToDb(updates.status);
      if (updates.startDate !== undefined) updatePayload.start_date = updates.startDate;
      if (updates.endDate !== undefined) updatePayload.end_date = updates.endDate;

      try {
        const { data, error } = await supabase
          .from("social_campaigns")
          .update(updatePayload)
          .eq("id", campaignId)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        const updatedCampaign = mapRowToCampaign(data);
        setCampaigns((previous) =>
          previous.map((campaign) => (campaign.id === campaignId ? updatedCampaign : campaign))
        );

        return updatedCampaign;
      } catch (error) {
        console.error("Error updating campaign:", error);
        toast({
          variant: "destructive",
          title: "Campaign update failed",
          description: "We couldn't update the campaign. Please try again."
        });
        throw error;
      }
    },
    [toast, user]
  );

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

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCampaignDialogChange = (open: boolean) => {
    setCampaignDialogOpen(open);
    if (!open) {
      setEditingCampaign(null);
      setCampaignForm(createEmptyCampaignForm());
    }
  };

  const handleOpenCreateCampaign = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in to manage campaigns",
        description: "Log in to create new marketing campaigns."
      });
      return;
    }

    setEditingCampaign(null);
    setCampaignForm(createEmptyCampaignForm());
    setCampaignDialogOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm(mapCampaignToForm(campaign));
    setCampaignDialogOpen(true);
  };

  const handleCampaignFieldChange = (field: keyof CampaignFormState, value: string | CampaignStatus) => {
    setCampaignForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleCampaignSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = campaignForm.name.trim();
    const trimmedPlatform = campaignForm.platform.trim();

    if (!trimmedName || !trimmedPlatform) {
      toast({
        variant: "destructive",
        title: "Add campaign details",
        description: "Campaign name and platform are required."
      });
      return;
    }

    const numericBudget = Number(campaignForm.budget || 0);
    const numericReach = Number(campaignForm.reach || 0);
    const numericEngagement = Number(campaignForm.engagement || 0);

    setCampaignSaving(true);

    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, {
          name: trimmedName,
          platform: trimmedPlatform,
          budget: numericBudget,
          reach: numericReach,
          engagement: numericEngagement,
          status: campaignForm.status,
          startDate: campaignForm.startDate || null,
          endDate: campaignForm.endDate || null
        });

        toast({
          title: "Campaign updated",
          description: "Your campaign changes have been saved."
        });
      } else {
        await createCampaign({
          ...campaignForm,
          name: trimmedName,
          platform: trimmedPlatform,
          budget: campaignForm.budget || numericBudget.toString(),
          reach: campaignForm.reach || numericReach.toString(),
          engagement: campaignForm.engagement || numericEngagement.toString()
        });

        toast({
          title: "Campaign created",
          description: "Your new marketing campaign is ready to launch."
        });
      }

      handleCampaignDialogChange(false);
    } catch (error) {
      console.error("Error saving campaign:", error);
    } finally {
      setCampaignSaving(false);
    }
  };

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

  const handleRunCampaign = async (campaignId: string) => {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;

    if (campaign.status === "Completed") {
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

    try {
      await updateCampaign(campaignId, { status: "Completed" });
    } catch (error) {
      console.error("Error completing campaign:", error);
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
                {campaignsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-cream/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading campaigns...
                  </div>
                ) : campaigns.length > 0 ? (
                  campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="space-y-4 rounded-lg border border-accent/20 bg-background/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-cream">{campaign.name}</h4>
                          <div className="text-xs text-cream/60">
                            {formatCampaignDate(campaign.startDate)} - {formatCampaignDate(campaign.endDate)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={campaign.status === "Active" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {campaign.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-accent/40 text-cream/80 hover:text-cream"
                            onClick={() => handleEditCampaign(campaign)}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
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
                          <span className="text-accent font-semibold">{campaign.engagement.toFixed(1)}%</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => void handleRunCampaign(campaign.id)}
                        className="w-full bg-accent hover:bg-accent/80 text-background"
                        disabled={campaign.status === "Completed"}
                      >
                        {campaign.status === "Completed" ? "Campaign Completed" : "Run Campaign"}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-accent/40 py-8 text-center text-sm text-cream/60">
                    No campaigns yet. Start one to grow your reach.
                  </div>
                )}
                <Button
                  onClick={handleOpenCreateCampaign}
                  className="w-full bg-accent hover:bg-accent/80 text-background"
                >
                  <Plus className="mr-2 h-4 w-4" />
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
      <Dialog open={campaignDialogOpen} onOpenChange={handleCampaignDialogChange}>
        <DialogContent className="bg-card border border-accent/40 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-cream">
              {editingCampaign ? "Edit Campaign" : "Create Campaign"}
            </DialogTitle>
            <DialogDescription>
              Define your campaign goals, budget, and timeframe to keep your promotions on track.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCampaignSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campaign-name" className="text-cream/80">
                  Campaign Name
                </Label>
                <Input
                  id="campaign-name"
                  value={campaignForm.name}
                  onChange={(event) => handleCampaignFieldChange("name", event.target.value)}
                  placeholder="Album Launch Promo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign-platform" className="text-cream/80">
                  Platform
                </Label>
                <Input
                  id="campaign-platform"
                  value={campaignForm.platform}
                  onChange={(event) => handleCampaignFieldChange("platform", event.target.value)}
                  placeholder="Instagram, TikTok, YouTube"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-budget" className="text-cream/80">
                    Budget ($)
                  </Label>
                  <Input
                    id="campaign-budget"
                    type="number"
                    min={0}
                    step="100"
                    value={campaignForm.budget}
                    onChange={(event) => handleCampaignFieldChange("budget", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="campaign-reach" className="text-cream/80">
                    Reach
                  </Label>
                  <Input
                    id="campaign-reach"
                    type="number"
                    min={0}
                    step="1000"
                    value={campaignForm.reach}
                    onChange={(event) => handleCampaignFieldChange("reach", event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-engagement" className="text-cream/80">
                    Engagement (%)
                  </Label>
                  <Input
                    id="campaign-engagement"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={campaignForm.engagement}
                    onChange={(event) => handleCampaignFieldChange("engagement", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="campaign-status" className="text-cream/80">
                    Status
                  </Label>
                  <Select
                    value={campaignForm.status}
                    onValueChange={(value) => handleCampaignFieldChange("status", value as CampaignStatus)}
                  >
                    <SelectTrigger id="campaign-status" className="text-left">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-start-date" className="text-cream/80">
                    Start Date
                  </Label>
                  <Input
                    id="campaign-start-date"
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(event) => handleCampaignFieldChange("startDate", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="campaign-end-date" className="text-cream/80">
                    End Date
                  </Label>
                  <Input
                    id="campaign-end-date"
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(event) => handleCampaignFieldChange("endDate", event.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-accent/40"
                onClick={() => handleCampaignDialogChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-accent hover:bg-accent/80 text-background"
                disabled={campaignSaving}
              >
                {campaignSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCampaign ? "Save Changes" : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialMedia;
