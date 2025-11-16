import { Bell, Loader2, MessageSquare, TrendingUp, Video } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterFeed } from "@/hooks/useTwaats";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterMentionsFeed } from "@/components/twaater/TwaaterMentionsFeed";
import { useDailyTwaatXP } from "@/hooks/useDailyTwaatXP";
import { DikCokExperience } from "@/components/dikcok/DikCokExperience";
import { fetchCommunityFeed, type CommunityFeedPost, type CommunityPostCategory } from "@/lib/api/feed";

const communityCategoryLabels: Record<CommunityPostCategory, string> = {
  gig_invite: "Jam Invite",
  challenge: "Challenge",
  shoutout: "Shoutout",
};

const SocialMedia = () => {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const viewerId = profile?.id || null;
  const { account: twaaterAccount, isLoading: twaaterAccountLoading } =
    useTwaaterAccount("persona", profile?.id);
  const { feed: twaaterFeed, isLoading: twaaterFeedLoading } = useTwaaterFeed(
    twaaterAccount?.id,
  );
  const { twaatsPostedToday, xpEarnedToday, canEarnMore } =
    useDailyTwaatXP(twaaterAccount?.id);

  const {
    data: spotlightFeed,
    isPending: spotlightLoading,
    isError: spotlightError,
  } = useQuery({
    queryKey: ["community-feed", "spotlight", viewerId ?? "anonymous"],
    queryFn: () =>
      fetchCommunityFeed({
        viewerId,
        spotlightOnly: true,
        limit: 4,
      }),
    enabled: !!viewerId,
  });

  const spotlightPosts = spotlightFeed?.posts ?? [];

  const getCategoryLabel = (category?: string | null) => {
    if (!category) {
      return null;
    }

    return communityCategoryLabels[category as CommunityPostCategory] ?? null;
  };

  const handleJoinJam = (sessionId?: string | null) => {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    navigate(`/jams${query}`);
  };

  const handleSupportBand = () => {
    const hasBandOperations = (profile?.fans ?? 0) > 0;
    navigate(hasBandOperations ? "/band" : "/fans");
  };

  const renderSpotlightPost = (post: CommunityFeedPost) => {
    const headline = post.content.split("\n")[0]?.trim() || "Community update";
    const createdAt = post.created_at ? new Date(post.created_at) : null;
    const categoryLabel = getCategoryLabel(post.category);
    const metadata = (post.metadata && typeof post.metadata === "object" ? post.metadata : {}) as Record<string, any>;
    const sessionId = typeof metadata.sessionId === "string" ? metadata.sessionId : null;

    let ctaLabel = "View details";
    let ctaVariant: "default" | "secondary" | "outline" = "default";
    let ctaAction = () => navigate("/community/feed");

    if (post.category === "gig_invite") {
      ctaLabel = "Join Jam";
      ctaVariant = "default";
      ctaAction = () => handleJoinJam(sessionId);
    } else if (post.category === "shoutout") {
      ctaLabel = "Support Band";
      ctaVariant = "outline";
      ctaAction = () => handleSupportBand();
    } else if (post.category === "challenge") {
      ctaLabel = "Join Challenge";
      ctaVariant = "secondary";
    }

    return (
      <div key={post.id} className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{headline}</p>
          {categoryLabel && <span className="text-xs font-semibold uppercase text-muted-foreground">{categoryLabel}</span>}
        </div>
        {createdAt && (
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNowStrict(createdAt, { addSuffix: true })}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{post.content}</p>
        <Button size="sm" variant={ctaVariant} className="w-full" onClick={ctaAction}>
          {ctaLabel}
        </Button>
      </div>
    );
  };

  if (!profile) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Twaater</CardTitle>
            <CardDescription>
              Create your character profile to unlock social posting.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground">
            Share updates with fans and grow your following on Twaater or craft viral clips on DikCok.
          </p>
        </div>
      </div>

      <Tabs defaultValue="twaater" className="space-y-6">
        <TabsList>
          <TabsTrigger value="twaater" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Twaater
          </TabsTrigger>
          <TabsTrigger value="dikcok" className="flex items-center gap-2">
            <Video className="h-4 w-4" /> DikCok
          </TabsTrigger>
        </TabsList>

        <TabsContent value="twaater" className="space-y-6">
          {twaaterAccountLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : !twaaterAccount ? (
            <TwaaterAccountSetup
              ownerType="persona"
              ownerId={profile?.id || ""}
              profileUsername={profile?.username || ""}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 space-y-6">
                <TwaaterComposer accountId={twaaterAccount.id} />

                <Tabs defaultValue="feed" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="feed">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Feed
                    </TabsTrigger>
                    <TabsTrigger value="trending">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Trending
                    </TabsTrigger>
                    <TabsTrigger value="mentions">
                      <Bell className="h-4 w-4 mr-2" />
                      Mentions
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="feed">
                    <TwaaterFeed
                      viewerAccountId={twaaterAccount.id}
                      feedType="feed"
                    />
                  </TabsContent>

                  <TabsContent value="trending">
                    <Card>
                      <CardContent className="py-12">
                        <p className="text-center text-muted-foreground">
                          Trending posts coming soon! This will show viral twaats and hot topics.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="mentions">
                    <TwaaterMentionsFeed accountId={twaaterAccount.id} />
                  </TabsContent>
                </Tabs>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Community Spotlight</CardTitle>
                    <CardDescription>Catch jam invites and challenges without leaving Twaater.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {spotlightLoading && (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div key={`spotlight-skeleton-${index}`} className="space-y-2 rounded-lg border p-3">
                            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                            <div className="h-8 w-full animate-pulse rounded bg-muted" />
                          </div>
                        ))}
                      </div>
                    )}

                    {spotlightError && (
                      <p className="text-sm text-muted-foreground">Unable to load spotlighted posts right now.</p>
                    )}

                    {!spotlightLoading && !spotlightError && spotlightPosts.length === 0 && (
                      <p className="text-sm text-muted-foreground">No spotlighted community events yet.</p>
                    )}

                    {!spotlightLoading && !spotlightError && spotlightPosts.length > 0 && (
                      <div className="space-y-3">
                        {spotlightPosts.map((post) => renderSpotlightPost(post))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Your Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Followers</span>
                      <span className="font-semibold text-lg">
                        {twaaterAccount.follower_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Following</span>
                      <span className="font-semibold text-lg">
                        {twaaterAccount.following_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Fame Score</span>
                      <span className="font-semibold text-lg">
                        {Math.round(Number(twaaterAccount.fame_score))}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Daily XP</CardTitle>
                    <CardDescription>Post to earn rewards</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Twaats today</span>
                      <span className="font-semibold">{twaatsPostedToday}/3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">XP earned</span>
                      <span className="font-semibold text-primary">+{xpEarnedToday} XP</span>
                    </div>
                    {canEarnMore && (
                      <p className="text-xs text-muted-foreground">
                        Post {3 - twaatsPostedToday} more to reach daily cap!
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      • Link gigs and releases for +2 XP bonus
                    </p>
                    <p className="text-muted-foreground">
                      • Higher fame = more baseline followers
                    </p>
                    <p className="text-muted-foreground">
                      • Engage consistently for best outcomes
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dikcok" className="space-y-6">
          <DikCokExperience profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialMedia;
