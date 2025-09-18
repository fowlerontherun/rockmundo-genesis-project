import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { getStoredAvatarPreviewUrl } from "@/utils/avatar";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  TrendingUp,
  Users,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Send,
} from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

type SocialPostRow = Database["public"]["Tables"]["social_posts"]["Row"];
type SocialCampaignRow = Database["public"]["Tables"]["social_campaigns"]["Row"];
type SocialCommentRow = Database["public"]["Tables"]["social_comments"]["Row"];
type SocialRepostRow = Database["public"]["Tables"]["social_reposts"]["Row"];

type CampaignStatus = "Active" | "Completed";

interface SocialProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface SocialComment extends SocialCommentRow {
  replies: SocialComment[];
  author?: SocialProfile;
}

interface SocialRepost extends SocialRepostRow {
  author?: SocialProfile;
}

interface SocialPost {
  id: string;
  userId: string;
  content: string;
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  timestamp: string;
  engagement: number;
  author?: SocialProfile;
  commentsTree: SocialComment[];
  repostsList: SocialRepost[];
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

const extractMissingColumn = (error: PostgrestError | null | undefined) => {
  const match = error?.message?.match(
    /column\s+(?:"?[\w]+"?\.)?"?([\w]+)"?\s+does not exist/i,
  );
  return match?.[1] ?? null;
};

const omitFromRecord = <T extends Record<string, unknown>>(source: T, key: string) => {
  if (!(key in source)) {
    return source;
  }

  const { [key]: _omitted, ...rest } = source;
  return rest as T;
};

const getDisplayName = (profile?: SocialProfile) => {
  if (!profile) {
    return "Fan";
  }

  return profile.displayName || profile.username || "Fan";
};

const calculateEngagement = (likes: number, comments: number, reposts: number, views: number) => {
  if (!views || views <= 0) {
    return 0;
  }

  const score = likes + comments * 1.5 + reposts * 2;
  return Math.min(100, parseFloat(((score / views) * 100).toFixed(1)));
};

const getTimeValue = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const formatRelativeTime = (timestamp?: string | null) => {
  if (!timestamp) {
    return "moments ago";
  }

  const target = new Date(timestamp);
  if (Number.isNaN(target.getTime())) {
    return "moments ago";
  }

  const diffSeconds = Math.floor((Date.now() - target.getTime()) / 1000);
  if (diffSeconds < 0) {
    return target.toLocaleString();
  }

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
};

const countComments = (comments: SocialComment[]): number =>
  comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);

const sortCommentsByDate = (comments: SocialComment[]): SocialComment[] => {
  comments.sort((a, b) => getTimeValue(a.created_at ?? a.updated_at) - getTimeValue(b.created_at ?? b.updated_at));
  comments.forEach((comment) => {
    if (comment.replies.length > 0) {
      sortCommentsByDate(comment.replies);
    }
  });
  return comments;
};

const buildCommentTree = (
  commentRows: SocialCommentRow[],
  profileMap: Record<string, SocialProfile>,
): SocialComment[] => {
  const commentMap = new Map<string, SocialComment>();

  commentRows.forEach((row) => {
    commentMap.set(row.id, {
      ...row,
      replies: [],
      author: profileMap[row.user_id],
    });
  });

  const roots: SocialComment[] = [];

  commentRows.forEach((row) => {
    const comment = commentMap.get(row.id);
    if (!comment) {
      return;
    }

    if (row.parent_comment_id && commentMap.has(row.parent_comment_id)) {
      const parent = commentMap.get(row.parent_comment_id);
      parent?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return sortCommentsByDate(roots);
};

const buildRepostList = (
  rows: SocialRepostRow[],
  profileMap: Record<string, SocialProfile>,
): SocialRepost[] =>
  rows
    .map((row) => ({
      ...row,
      author: profileMap[row.user_id],
    }))
    .sort((a, b) => getTimeValue(b.created_at) - getTimeValue(a.created_at));

const mapPostRow = (
  row: SocialPostRow,
  profileMap: Record<string, SocialProfile>,
  commentTree: SocialComment[],
  repostList: SocialRepost[],
): SocialPost => {
  const likes = row.likes ?? 0;
  const comments = row.comments ?? countComments(commentTree);
  const reposts = row.reposts ?? repostList.length;
  const views = row.views ?? 0;
  const timestamp = row.timestamp ?? row.created_at ?? new Date().toISOString();

  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    likes,
    comments,
    reposts,
    views,
    timestamp,
    engagement: calculateEngagement(likes, comments, reposts, views),
    author: profileMap[row.user_id],
    commentsTree: commentTree,
    repostsList: repostList,
  };
};

const commentExists = (comments: SocialComment[], commentId: string): boolean =>
  comments.some((comment) => comment.id === commentId || commentExists(comment.replies, commentId));

const addCommentToTree = (comments: SocialComment[], newComment: SocialComment): SocialComment[] => {
  if (!newComment.parent_comment_id) {
    const updated = [...comments, { ...newComment, replies: newComment.replies ?? [] }];
    return sortCommentsByDate(updated);
  }

  let inserted = false;
  const updated = comments.map((comment) => {
    if (comment.id === newComment.parent_comment_id) {
      inserted = true;
      const updatedReplies = [...comment.replies, { ...newComment, replies: newComment.replies ?? [] }];
      sortCommentsByDate(updatedReplies);
      return {
        ...comment,
        replies: updatedReplies,
      };
    }

    if (comment.replies.length > 0) {
      const nestedReplies = addCommentToTree(comment.replies, newComment);
      if (nestedReplies !== comment.replies) {
        inserted = true;
        return {
          ...comment,
          replies: nestedReplies,
        };
      }
    }

    return comment;
  });

  return inserted ? updated : comments;
};

const removeCommentFromTree = (
  comments: SocialComment[],
  commentId: string,
): { updated: SocialComment[]; removedCount: number } => {
  let removedCount = 0;

  const traverse = (list: SocialComment[]): SocialComment[] => {
    let changed = false;
    const result: SocialComment[] = [];

    list.forEach((comment) => {
      if (comment.id === commentId) {
        removedCount += 1 + countComments(comment.replies);
        changed = true;
        return;
      }

      const updatedReplies = traverse(comment.replies);
      if (updatedReplies !== comment.replies) {
        changed = true;
        result.push({
          ...comment,
          replies: updatedReplies,
        });
      } else {
        result.push(comment);
      }
    });

    return changed ? result : list;
  };

  const updated = traverse(comments);
  if (removedCount === 0) {
    return { updated: comments, removedCount: 0 };
  }

  return { updated, removedCount };
};

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
  endDate: row.end_date,
});

const formatCampaignDate = (date: string | null) => {
  if (!date) {
    return "--";
  }

  const safeDate = `${date}T00:00:00`;
  return new Date(safeDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const createEmptyCampaignForm = (): CampaignFormState => ({
  name: "",
  platform: "",
  budget: "",
  reach: "",
  engagement: "",
  status: "Active",
  startDate: "",
  endDate: "",
});

const mapCampaignToForm = (campaign: Campaign): CampaignFormState => ({
  name: campaign.name,
  platform: campaign.platform,
  budget: Number.isFinite(campaign.budget) ? campaign.budget.toString() : "",
  reach: Number.isFinite(campaign.reach) ? campaign.reach.toString() : "",
  engagement: Number.isFinite(campaign.engagement) ? campaign.engagement.toString() : "",
  status: campaign.status,
  startDate: campaign.startDate ?? "",
  endDate: campaign.endDate ?? "",
});

const SocialMedia = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [followers, setFollowers] = useState<number | null>(null);
  const [engagementRate, setEngagementRate] = useState<number | null>(null);
  const [newPost, setNewPost] = useState("");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [activeReplyTargets, setActiveReplyTargets] = useState<Record<string, string | null>>({});
  const [pendingComments, setPendingComments] = useState<Record<string, boolean>>({});
  const [activeRepostPostId, setActiveRepostPostId] = useState<string | null>(null);
  const [repostDrafts, setRepostDrafts] = useState<Record<string, string>>({});
  const [pendingReposts, setPendingReposts] = useState<Record<string, boolean>>({});
  const [profileLookup, setProfileLookup] = useState<Record<string, SocialProfile>>({});
  const commentInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignSaving, setCampaignSaving] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(() => createEmptyCampaignForm());
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const postIdsKey = useMemo(() => posts.map((post) => post.id).sort().join(","), [posts]);

  const ensureProfile = useCallback(
    async (userId: string) => {
      if (!userId) {
        return undefined;
      }

      const cached = profileLookup[userId];
      if (cached) {
        return cached;
      }

      const { data, error } = await supabase
        .from("public_profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return undefined;
      }

      if (!data) {
        return undefined;
      }

      const profile: SocialProfile = {
        userId: data.user_id,
        username: data.username,
        displayName: data.display_name ?? data.username,
        avatarUrl: getStoredAvatarPreviewUrl(data.avatar_url ?? null),
      };

      setProfileLookup((previous) => ({ ...previous, [userId]: profile }));
      return profile;
    },
    [profileLookup],
  );

  const loadPosts = useCallback(async () => {
    if (!user) {
      setPosts([]);
      setProfileLookup({});
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);

    try {
      const { data: postRows, error: postError } = await supabase
        .from("social_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false });

      if (postError) {
        throw postError;
      }

      const postsData = postRows ?? [];
      const postIds = postsData.map((row) => row.id);

      let commentRows: SocialCommentRow[] = [];
      if (postIds.length > 0) {
        const { data, error } = await supabase
          .from("social_comments")
          .select("*")
          .in("post_id", postIds)
          .order("created_at", { ascending: true });

        if (error) {
          throw error;
        }

        commentRows = data ?? [];
      }

      let repostRows: SocialRepostRow[] = [];
      if (postIds.length > 0) {
        const { data, error } = await supabase
          .from("social_reposts")
          .select("*")
          .in("post_id", postIds)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        repostRows = data ?? [];
      }

      const userIds = new Set<string>();
      postsData.forEach((row) => userIds.add(row.user_id));
      commentRows.forEach((row) => userIds.add(row.user_id));
      repostRows.forEach((row) => userIds.add(row.user_id));

      const profileMap: Record<string, SocialProfile> = {};
      if (userIds.size > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("public_profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", Array.from(userIds));

        if (profileError) {
          throw profileError;
        }

        (profileRows ?? []).forEach((profile) => {
          profileMap[profile.user_id] = {
            userId: profile.user_id,
            username: profile.username,
            displayName: profile.display_name ?? profile.username,
            avatarUrl: getStoredAvatarPreviewUrl(profile.avatar_url ?? null),
          };
        });

        setProfileLookup((previous) => ({ ...previous, ...profileMap }));
      }

      const commentsByPost = new Map<string, SocialCommentRow[]>();
      commentRows.forEach((comment) => {
        const list = commentsByPost.get(comment.post_id) ?? [];
        list.push(comment);
        commentsByPost.set(comment.post_id, list);
      });

      const repostsByPost = new Map<string, SocialRepostRow[]>();
      repostRows.forEach((repost) => {
        const list = repostsByPost.get(repost.post_id) ?? [];
        list.push(repost);
        repostsByPost.set(repost.post_id, list);
      });

      const mappedPosts = postsData.map((row) => {
        const commentTree = buildCommentTree(commentsByPost.get(row.id) ?? [], profileMap);
        const repostList = buildRepostList(repostsByPost.get(row.id) ?? [], profileMap);
        return mapPostRow(row, profileMap, commentTree, repostList);
      });

      setPosts(mappedPosts);
    } catch (error) {
      console.error("Error loading social posts:", error);
      toast({
        variant: "destructive",
        title: "Unable to load posts",
        description: "Please try again in a moment.",
      });
    } finally {
      setLoadingPosts(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (!user) {
      setFollowers(24500);
      setEngagementRate(7.8);
      return;
    }

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          if (error.code === "42703") {
            setFollowers(0);
            setEngagementRate(0);
            return;
          }

          throw error;
        }

        if (data) {
          const followerCount = typeof data.followers === "number"
            ? data.followers
            : typeof data.fans === "number"
              ? data.fans
              : 0;
          const engagement = typeof data.engagement_rate === "number" ? data.engagement_rate : 0;

          setFollowers(followerCount);
          setEngagementRate(engagement);
          setProfileLookup(previous => ({
            ...previous,
            [data.user_id]: {
              userId: data.user_id,
              username: data.username,
              displayName: data.display_name ?? data.username ?? "Player",
              avatarUrl: getStoredAvatarPreviewUrl(data.avatar_url ?? null)
            },
          }));
        } else {
          setFollowers(0);
          setEngagementRate(0);
        }
      } catch (error) {
        console.error("Error fetching social metrics:", error);
      }
    };

    void fetchStats();
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void loadPosts();
  }, [authLoading, loadPosts]);

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

      if (error) {
        throw error;
      }

      const mappedCampaigns = (data ?? []).map(mapRowToCampaign);
      setCampaigns(mappedCampaigns);
    } catch (error) {
      console.error("Error loading social campaigns:", error);
      toast({
        variant: "destructive",
        title: "Unable to load campaigns",
        description: "Please try again in a moment.",
      });
    } finally {
      setCampaignsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void loadCampaigns();
  }, [authLoading, loadCampaigns]);

  const createCampaign = useCallback(
    async (formState: CampaignFormState) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to create campaigns",
          description: "You need to be logged in to manage marketing campaigns.",
        });
        throw new Error("User not authenticated");
      }

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
          end_date: formState.endDate || null,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const campaign = mapRowToCampaign(data);
      setCampaigns((previous) => [campaign, ...previous]);
      return campaign;
    },
    [toast, user],
  );

  const updateCampaign = useCallback(
    async (campaignId: string, updates: Partial<Campaign>) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to update campaigns",
          description: "You need to be logged in to update marketing campaigns.",
        });
        throw new Error("User not authenticated");
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updatePayload.name = updates.name.trim();
      if (updates.platform !== undefined) updatePayload.platform = updates.platform.trim();
      if (updates.budget !== undefined) updatePayload.budget = updates.budget;
      if (updates.reach !== undefined) updatePayload.reach = updates.reach;
      if (updates.engagement !== undefined) updatePayload.engagement = updates.engagement;
      if (updates.status !== undefined) updatePayload.status = mapStatusToDb(updates.status);
      if (updates.startDate !== undefined) updatePayload.start_date = updates.startDate;
      if (updates.endDate !== undefined) updatePayload.end_date = updates.endDate;

      const { data, error } = await supabase
        .from("social_campaigns")
        .update(updatePayload)
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updatedCampaign = mapRowToCampaign(data);
      setCampaigns((previous) =>
        previous.map((campaign) => (campaign.id === campaignId ? updatedCampaign : campaign)),
      );

      return updatedCampaign;
    },
    [toast, user],
  );

  const handleCampaignFieldChange = useCallback(
    (field: keyof CampaignFormState, value: string | CampaignStatus) => {
      setCampaignForm((previous) => ({
        ...previous,
        [field]: value,
      }));
    },
    [],
  );

  const handleCampaignDialogChange = useCallback((open: boolean) => {
    setCampaignDialogOpen(open);
    if (!open) {
      setEditingCampaign(null);
      setCampaignForm(createEmptyCampaignForm());
    }
  }, []);

  const handleOpenCreateCampaign = useCallback(() => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in to manage campaigns",
        description: "Log in to create new marketing campaigns.",
      });
      return;
    }

    setEditingCampaign(null);
    setCampaignForm(createEmptyCampaignForm());
    setCampaignDialogOpen(true);
  }, [toast, user]);

  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm(mapCampaignToForm(campaign));
    setCampaignDialogOpen(true);
  }, []);

  const handleCampaignSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = campaignForm.name.trim();
      const trimmedPlatform = campaignForm.platform.trim();

      if (!trimmedName || !trimmedPlatform) {
        toast({
          variant: "destructive",
          title: "Add campaign details",
          description: "Campaign name and platform are required.",
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
            endDate: campaignForm.endDate || null,
          });

          toast({
            title: "Campaign updated",
            description: "Your campaign changes have been saved.",
          });
        } else {
          await createCampaign({
            ...campaignForm,
            name: trimmedName,
            platform: trimmedPlatform,
            budget: numericBudget.toString(),
            reach: numericReach.toString(),
            engagement: numericEngagement.toString(),
          });

          toast({
            title: "Campaign created",
            description: "Your new marketing campaign is ready to launch.",
          });
        }

        handleCampaignDialogChange(false);
      } catch (error) {
        console.error("Error saving campaign:", error);
      } finally {
        setCampaignSaving(false);
      }
    },
    [campaignForm, createCampaign, editingCampaign, handleCampaignDialogChange, toast, updateCampaign],
  );

  const applySocialGrowth = useCallback(
    async (followerGain: number, engagementBoost: number, message: string) => {
      if (followerGain <= 0 && engagementBoost <= 0) {
        return;
      }

      if (!user) {
        toast({
          variant: "destructive",
          title: "Log in to track growth",
          description: "Sign in to sync social stats with your profile.",
        });
        return;
      }

      const currentFollowers = followers ?? 0;
      const currentEngagement = engagementRate ?? 0;
      const nextFollowers = Math.max(0, Math.round(currentFollowers + followerGain));
      const nextEngagement = Math.max(0, Math.min(100, parseFloat((currentEngagement + engagementBoost).toFixed(2))));

      setFollowers(nextFollowers);
      setEngagementRate(nextEngagement);

      const updatePayload: Record<string, unknown> = {
        followers: nextFollowers,
        fans: nextFollowers,
        engagement_rate: nextEngagement,
        updated_at: new Date().toISOString(),
      };

      let attemptedPayload: Record<string, unknown> = { ...updatePayload };
      const skippedColumns = new Set<string>();
      let updateError: PostgrestError | null = null;

      while (Object.keys(attemptedPayload).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(attemptedPayload)
          .eq("user_id", user.id);

        if (!error) {
          updateError = null;
          break;
        }

        if (error.code === "42703") {
          const missingColumn = extractMissingColumn(error);
          if (!missingColumn || skippedColumns.has(missingColumn)) {
            updateError = error;
            break;
          }

          skippedColumns.add(missingColumn);
          attemptedPayload = omitFromRecord(attemptedPayload, missingColumn);
          continue;
        }

        updateError = error;
        break;
      }

      if (Object.keys(attemptedPayload).length === 0 && updateError?.code === "42703") {
        updateError = null;
      }

      if (updateError) {
        console.error("Error updating social metrics:", updateError);
        setFollowers(currentFollowers);
        setEngagementRate(currentEngagement);
        toast({
          variant: "destructive",
          title: "Couldn't update stats",
          description: "Please try again after a moment.",
        });
        return;
      }

      toast({
        title: "Social stats updated",
        description: message,
      });
    },
    [engagementRate, followers, toast, user],
  );

  const handleRunCampaign = useCallback(
    async (campaignId: string) => {
      const campaign = campaigns.find((item) => item.id === campaignId);
      if (!campaign) {
        return;
      }

      if (campaign.status === "Completed") {
        toast({
          variant: "destructive",
          title: "Campaign already completed",
          description: "Select another campaign to run.",
        });
        return;
      }

      const followerGain = Math.max(0, Math.round(campaign.reach * 0.05));
      const engagementBoost = Math.max(0, parseFloat((campaign.engagement * 0.1).toFixed(2)));

      await applySocialGrowth(
        followerGain,
        engagementBoost,
        `${campaign.name} drove ${followerGain.toLocaleString()} new followers.`,
      );

      try {
        await updateCampaign(campaignId, { status: "Completed" });
      } catch (error) {
        console.error("Error completing campaign:", error);
      }
    },
    [applySocialGrowth, campaigns, toast, updateCampaign],
  );

  const handleCreatePost = useCallback(async () => {
    const content = newPost.trim();
    if (!content) {
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "You need to be signed in to create a post.",
      });
      return;
    }

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

      if (error) {
        throw error;
      }

      if (data) {
        const profile = await ensureProfile(user.id);
        const profileMap: Record<string, SocialProfile> = {};
        if (profile) {
          profileMap[user.id] = profile;
        }

        const mappedPost = mapPostRow(data as SocialPostRow, profileMap, [], []);
        setPosts((previous) => [mappedPost, ...previous]);
      }

      setNewPost("");
      toast({
        title: "Post published!",
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
  }, [ensureProfile, newPost, toast, user]);

  const handleLike = useCallback(
    async (postId: string) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to like posts",
          description: "Log in to engage with your social feed.",
        });
        return;
      }

      const existingPost = posts.find((post) => post.id === postId);
      if (!existingPost) {
        return;
      }

      const optimisticLikes = existingPost.likes + 1;

      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: optimisticLikes,
                engagement: calculateEngagement(optimisticLikes, post.comments, post.reposts, post.views),
              }
            : post,
        ),
      );

      const { data, error } = await supabase
        .from("social_posts")
        .update({ likes: optimisticLikes })
        .eq("id", postId)
        .select("likes, comments, reposts, views")
        .single();

      if (error) {
        console.error("Error updating likes:", error);
        setPosts((previous) =>
          previous.map((post) => (post.id === postId ? existingPost : post)),
        );
        toast({
          variant: "destructive",
          title: "Unable to like post",
          description: "Please try again later.",
        });
        return;
      }

      if (data) {
        setPosts((previous) =>
          previous.map((post) => {
            if (post.id !== postId) {
              return post;
            }

            const likes = data.likes ?? optimisticLikes;
            const commentsCount = data.comments ?? post.comments;
            const repostCount = data.reposts ?? post.reposts;
            const views = data.views ?? post.views;

            return {
              ...post,
              likes,
              comments: commentsCount,
              reposts: repostCount,
              views,
              engagement: calculateEngagement(likes, commentsCount, repostCount, views),
            };
          }),
        );
      }
    },
    [posts, toast, user],
  );

  const handleSubmitComment = useCallback(
    async (postId: string, parentCommentId?: string) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to comment",
          description: "You need to sign in to participate in the conversation.",
        });
        return;
      }

      const key = parentCommentId ? `${postId}:${parentCommentId}` : postId;
      const content = commentDrafts[key]?.trim();
      if (!content) {
        return;
      }

      setPendingComments((previous) => ({ ...previous, [key]: true }));

      try {
        const { data, error } = await supabase
          .from("social_comments")
          .insert({
            post_id: postId,
            user_id: user.id,
            parent_comment_id: parentCommentId ?? null,
            content,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const profile = await ensureProfile(user.id);
          const newComment: SocialComment = {
            ...(data as SocialCommentRow),
            replies: [],
            author: profile,
          };

          setPosts((previous) =>
            previous.map((post) => {
              if (post.id !== postId) {
                return post;
              }

              if (commentExists(post.commentsTree, newComment.id)) {
                return post;
              }

              const updatedTree = addCommentToTree(post.commentsTree, newComment);
              const nextComments = post.comments + 1;

              return {
                ...post,
                commentsTree: updatedTree,
                comments: nextComments,
                engagement: calculateEngagement(post.likes, nextComments, post.reposts, post.views),
              };
            }),
          );
        }

        setCommentDrafts((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });

        if (parentCommentId) {
          setActiveReplyTargets((previous) => ({ ...previous, [postId]: null }));
        }

        toast({
          title: "Comment added",
          description: "Your comment is live for fans to see.",
        });
      } catch (error) {
        console.error("Error posting comment:", error);
        toast({
          variant: "destructive",
          title: "Unable to post comment",
          description: "Please try again in a moment.",
        });
      } finally {
        setPendingComments((previous) => {
          const next = { ...previous };
          delete next[key];
          return next;
        });
      }
    },
    [commentDrafts, ensureProfile, toast, user],
  );

  const handleToggleRepost = useCallback(
    (postId: string) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to repost",
          description: "Log in to share posts with your followers.",
        });
        return;
      }

      setActiveRepostPostId((current) => (current === postId ? null : postId));
    },
    [toast, user],
  );

  const handleCancelRepost = useCallback((postId: string) => {
    setActiveRepostPostId((current) => (current === postId ? null : current));
    setRepostDrafts((previous) => {
      if (!(postId in previous)) {
        return previous;
      }

      const next = { ...previous };
      delete next[postId];
      return next;
    });
  }, []);

  const handleSubmitRepost = useCallback(
    async (postId: string) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Sign in to repost",
          description: "Log in to share posts with your followers.",
        });
        return;
      }

      setPendingReposts((previous) => ({ ...previous, [postId]: true }));
      const message = repostDrafts[postId]?.trim() ?? "";

      try {
        const { data, error } = await supabase
          .from("social_reposts")
          .insert({
            post_id: postId,
            user_id: user.id,
            message: message || null,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          const profile = await ensureProfile(user.id);
          const repost: SocialRepost = {
            ...(data as SocialRepostRow),
            author: profile,
          };

          setPosts((previous) =>
            previous.map((post) => {
              if (post.id !== postId) {
                return post;
              }

              const updatedList = [repost, ...post.repostsList].sort(
                (a, b) => getTimeValue(b.created_at) - getTimeValue(a.created_at),
              );
              const nextReposts = post.reposts + 1;

              return {
                ...post,
                repostsList: updatedList,
                reposts: nextReposts,
                engagement: calculateEngagement(post.likes, post.comments, nextReposts, post.views),
              };
            }),
          );
        }

        setRepostDrafts((previous) => {
          const next = { ...previous };
          delete next[postId];
          return next;
        });
        setActiveRepostPostId(null);

        toast({
          title: "Post reposted",
          description: "Your repost is now visible to your fans.",
        });
      } catch (error) {
        console.error("Error reposting:", error);
        toast({
          variant: "destructive",
          title: "Unable to repost",
          description: "Please try again later.",
        });
      } finally {
        setPendingReposts((previous) => {
          const next = { ...previous };
          delete next[postId];
          return next;
        });
      }
    },
    [ensureProfile, repostDrafts, toast, user],
  );

  const handleShare = useCallback(
    (post: SocialPost) => {
      const shareText = `${post.content}\n\nShared via Rockmundo Social Hub`;
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard
          .writeText(shareText)
          .then(() => {
            toast({
              title: "Post copied",
              description: "The post content has been copied to your clipboard.",
            });
          })
          .catch(() => {
            toast({
              title: "Post ready to share",
              description: "Copy the post manually to share it with fans.",
            });
          });
      } else {
        toast({
          title: "Post ready to share",
          description: "Copy the post manually to share it with fans.",
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!postIdsKey) {
      return;
    }

    const postIds = postIdsKey.split(",").filter(Boolean);
    if (postIds.length === 0) {
      return;
    }

    const formattedIds = postIds.map((id) => `"${id}"`).join(",");
    const postsFilter = `id=in.(${formattedIds})`;
    const relatedFilter = `post_id=in.(${formattedIds})`;

    const channel = supabase.channel(`social-media-${user.id}`);

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "social_posts", filter: postsFilter },
      (payload) => {
        const updated = payload.new as SocialPostRow;
        setPosts((previous) =>
          previous.map((post) => {
            if (post.id !== updated.id) {
              return post;
            }

            const likes = updated.likes ?? post.likes;
            const commentsCount = updated.comments ?? post.comments;
            const repostCount = updated.reposts ?? post.reposts;
            const views = updated.views ?? post.views;
            const timestamp = updated.timestamp ?? post.timestamp;

            return {
              ...post,
              likes,
              comments: commentsCount,
              reposts: repostCount,
              views,
              timestamp,
              engagement: calculateEngagement(likes, commentsCount, repostCount, views),
            };
          }),
        );
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "social_comments", filter: relatedFilter },
      (payload) => {
        const newRow = payload.new as SocialCommentRow;
        void (async () => {
          const profile = await ensureProfile(newRow.user_id);
          setPosts((previous) =>
            previous.map((post) => {
              if (post.id !== newRow.post_id) {
                return post;
              }

              if (commentExists(post.commentsTree, newRow.id)) {
                return post;
              }

              const comment: SocialComment = {
                ...newRow,
                replies: [],
                author: profile,
              };

              const updatedTree = addCommentToTree(post.commentsTree, comment);
              const nextComments = post.comments + 1;

              return {
                ...post,
                commentsTree: updatedTree,
                comments: nextComments,
                engagement: calculateEngagement(post.likes, nextComments, post.reposts, post.views),
              };
            }),
          );
        })();
      },
    );

    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "social_comments", filter: relatedFilter },
      (payload) => {
        const oldRow = payload.old as SocialCommentRow;
        setPosts((previous) =>
          previous.map((post) => {
            if (post.id !== oldRow.post_id) {
              return post;
            }

            const { updated, removedCount } = removeCommentFromTree(post.commentsTree, oldRow.id);
            if (removedCount === 0) {
              return post;
            }

            const nextComments = Math.max(0, post.comments - removedCount);
            return {
              ...post,
              commentsTree: updated,
              comments: nextComments,
              engagement: calculateEngagement(post.likes, nextComments, post.reposts, post.views),
            };
          }),
        );
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "social_reposts", filter: relatedFilter },
      (payload) => {
        const newRow = payload.new as SocialRepostRow;
        void (async () => {
          const profile = await ensureProfile(newRow.user_id);
          setPosts((previous) =>
            previous.map((post) => {
              if (post.id !== newRow.post_id) {
                return post;
              }

              if (post.repostsList.some((item) => item.id === newRow.id)) {
                return post;
              }

              const repost: SocialRepost = {
                ...newRow,
                author: profile,
              };

              const updatedList = [repost, ...post.repostsList].sort(
                (a, b) => getTimeValue(b.created_at) - getTimeValue(a.created_at),
              );
              const nextReposts = post.reposts + 1;

              return {
                ...post,
                repostsList: updatedList,
                reposts: nextReposts,
                engagement: calculateEngagement(post.likes, post.comments, nextReposts, post.views),
              };
            }),
          );
        })();
      },
    );

    channel.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "social_reposts", filter: relatedFilter },
      (payload) => {
        const oldRow = payload.old as SocialRepostRow;
        setPosts((previous) =>
          previous.map((post) => {
            if (post.id !== oldRow.post_id) {
              return post;
            }

            const filtered = post.repostsList.filter((repost) => repost.id !== oldRow.id);
            if (filtered.length === post.repostsList.length) {
              return post;
            }

            const nextReposts = Math.max(0, post.reposts - 1);
            return {
              ...post,
              repostsList: filtered,
              reposts: nextReposts,
              engagement: calculateEngagement(post.likes, post.comments, nextReposts, post.views),
            };
          }),
        );
      },
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ensureProfile, postIdsKey, user]);

  const renderComments = (comments: SocialComment[], postId: string, depth = 0): JSX.Element[] =>
    comments.map((comment) => {
      const replyKey = `${postId}:${comment.id}`;
      const isReplying = activeReplyTargets[postId] === comment.id;
      const pendingReply = pendingComments[replyKey];

      return (
        <div
          key={comment.id}
          className={`space-y-3 ${depth > 0 ? "pl-4 border-l border-accent/20" : ""}`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-cream/60">
              <span className="font-semibold text-cream">{getDisplayName(comment.author)}</span>
              <span>{formatRelativeTime(comment.created_at ?? comment.updated_at)}</span>
            </div>
            <p className="text-sm text-cream/90 whitespace-pre-wrap">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-cream/60">
            <button
              type="button"
              className="font-semibold uppercase tracking-wide hover:text-accent transition-colors"
              onClick={() => setActiveReplyTargets((previous) => ({ ...previous, [postId]: comment.id }))}
            >
              Reply
            </button>
          </div>
          {isReplying && (
            <div className="space-y-2 rounded-lg border border-accent/30 bg-background/30 p-3">
              <Textarea
                value={commentDrafts[replyKey] ?? ""}
                onChange={(event) =>
                  setCommentDrafts((previous) => ({
                    ...previous,
                    [replyKey]: event.target.value,
                  }))
                }
                placeholder={`Reply to ${getDisplayName(comment.author)}...`}
                className="min-h-20 bg-background/40 border-accent/30 text-cream placeholder:text-cream/60"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-cream/70 hover:text-cream"
                  onClick={() => {
                    setActiveReplyTargets((previous) => ({ ...previous, [postId]: null }));
                    setCommentDrafts((previous) => {
                      if (!(replyKey in previous)) {
                        return previous;
                      }

                      const next = { ...previous };
                      delete next[replyKey];
                      return next;
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-accent hover:bg-accent/80 text-background"
                  disabled={pendingReply || !(commentDrafts[replyKey]?.trim())}
                  onClick={() => void handleSubmitComment(postId, comment.id)}
                >
                  {pendingReply ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Replying...
                    </>
                  ) : (
                    "Reply"
                  )}
                </Button>
              </div>
            </div>
          )}
          {comment.replies.length > 0 && (
            <div className="space-y-3">
              {renderComments(comment.replies, postId, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">SOCIAL MEDIA HUB</h1>
          <p className="text-xl text-cream/80 font-oswald">Build your fanbase and create viral content</p>
        </div>

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
                  onChange={(event) => setNewPost(event.target.value)}
                  className="min-h-24 bg-background/50 border-accent text-cream placeholder:text-cream/60"
                />
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Instagram</Badge>
                    <Badge variant="outline">Twitter</Badge>
                    <Badge variant="outline">TikTok</Badge>
                    <Badge variant="outline">Facebook</Badge>
                  </div>
                  <Button
                    onClick={() => void handleCreatePost()}
                    className="bg-accent hover:bg-accent/80 text-background font-bold"
                    disabled={!newPost.trim() || posting}
                  >
                    {posting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      "Post Now"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-2xl font-bebas text-cream tracking-wide">Recent Posts</h3>
              {loadingPosts || authLoading ? (
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
                    <CardContent className="pt-6 space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-cream/60">
                          <span className="font-semibold text-cream">{getDisplayName(post.author)}</span>
                          <span>{formatRelativeTime(post.timestamp)}</span>
                        </div>
                        <p className="text-cream leading-relaxed whitespace-pre-wrap">{post.content}</p>
                        <div className="flex justify-between items-center text-cream/60 text-sm">
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {post.views.toLocaleString()}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {post.engagement.toFixed(1)}% engagement
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-accent/20 pt-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <button
                            onClick={() => void handleLike(post.id)}
                            className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors"
                          >
                            <Heart className="h-4 w-4" />
                            <span>{post.likes.toLocaleString()}</span>
                          </button>
                          <button
                            onClick={() => commentInputRefs.current[post.id]?.focus()}
                            className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span>{post.comments.toLocaleString()}</span>
                          </button>
                          <button
                            onClick={() => handleToggleRepost(post.id)}
                            className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors"
                          >
                            <Repeat2 className="h-4 w-4" />
                            <span>{post.reposts.toLocaleString()}</span>
                          </button>
                        </div>
                        <button
                          onClick={() => handleShare(post)}
                          className="flex items-center gap-2 text-cream/80 hover:text-accent transition-colors"
                        >
                          <Share className="h-4 w-4" />
                          Share
                        </button>
                      </div>

                      {activeRepostPostId === post.id && (
                        <div className="space-y-3 rounded-lg border border-accent/30 bg-background/30 p-4">
                          <Textarea
                            value={repostDrafts[post.id] ?? ""}
                            onChange={(event) =>
                              setRepostDrafts((previous) => ({
                                ...previous,
                                [post.id]: event.target.value,
                              }))
                            }
                            placeholder="Add a message to your repost (optional)..."
                            className="min-h-20 bg-background/40 border-accent/30 text-cream placeholder:text-cream/60"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-cream/70 hover:text-cream"
                              onClick={() => handleCancelRepost(post.id)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-accent hover:bg-accent/80 text-background"
                              disabled={pendingReposts[post.id]}
                              onClick={() => void handleSubmitRepost(post.id)}
                            >
                              {pendingReposts[post.id] ? (
                                <>
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  Sharing...
                                </>
                              ) : (
                                "Repost"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {post.repostsList.length > 0 && (
                        <div className="space-y-3 rounded-lg border border-accent/20 bg-background/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-cream/60">Recent reposts</p>
                          <div className="space-y-3">
                            {post.repostsList.map((repost) => (
                              <div key={repost.id} className="space-y-1">
                                <div className="flex items-center justify-between text-sm text-cream/80">
                                  <span className="font-semibold text-cream">{getDisplayName(repost.author)}</span>
                                  <span className="text-xs text-cream/60">{formatRelativeTime(repost.created_at)}</span>
                                </div>
                                {repost.message && (
                                  <p className="text-sm text-cream/90 whitespace-pre-wrap">{repost.message}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4 rounded-lg border border-accent/20 bg-background/10 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-cream">Comments</h4>
                          <span className="text-xs text-cream/60">{post.comments.toLocaleString()} total</span>
                        </div>
                        {post.commentsTree.length === 0 ? (
                          <p className="text-sm text-cream/60">Be the first to share your thoughts.</p>
                        ) : (
                          <div className="space-y-4">{renderComments(post.commentsTree, post.id)}</div>
                        )}
                        <div className="space-y-2">
                          <Textarea
                            ref={(element) => {
                              commentInputRefs.current[post.id] = element;
                            }}
                            value={commentDrafts[post.id] ?? ""}
                            onChange={(event) =>
                              setCommentDrafts((previous) => ({
                                ...previous,
                                [post.id]: event.target.value,
                              }))
                            }
                            placeholder="Share your thoughts..."
                            className="min-h-20 bg-background/40 border-accent/30 text-cream placeholder:text-cream/60"
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              className="bg-accent hover:bg-accent/80 text-background"
                              disabled={pendingComments[post.id] || !(commentDrafts[post.id]?.trim())}
                              onClick={() => void handleSubmitComment(post.id)}
                            >
                              {pendingComments[post.id] ? (
                                <>
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  Posting...
                                </>
                              ) : (
                                <>
                                  <Send className="mr-2 h-3.5 w-3.5" />
                                  Comment
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

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
