import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import {
  createCommunityPost,
  fetchCommunityFeed,
  toggleCommunityReaction,
  type CommunityFeedPage,
  type CommunityFeedPost,
  type CommunityPostCategory,
  type ReactionType,
} from "@/lib/api/feed";

const reactionOptions: Array<{ type: ReactionType; label: string; emoji: string }> = [
  { type: "like", label: "Like", emoji: "👍" },
  { type: "love", label: "Love", emoji: "❤️" },
  { type: "fire", label: "Fire", emoji: "🔥" },
  { type: "wow", label: "Wow", emoji: "🤘" },
  { type: "laugh", label: "Laugh", emoji: "😂" },
];

const INITIAL_QUERY_KEY = "community-feed";

const categoryLabels: Record<CommunityPostCategory, string> = {
  gig_invite: "Jam Invite",
  challenge: "Challenge",
  shoutout: "Shoutout",
};

type ComposerPreset = {
  key: string;
  label: string;
  description: string;
  template: string;
  category: CommunityPostCategory;
};

const composerPresets: ComposerPreset[] = [
  {
    key: "jam-invite",
    label: "Jam Invite",
    description: "Rally players for a pop-up session",
    category: "gig_invite",
    template:
      "🎸 Jam invite: We need one more guitarist + drummer for tonight's rooftop session. Drop your rig + vibe if you can make it!",
  },
  {
    key: "challenge",
    label: "Challenge",
    description: "Launch a 48-hour fan or band challenge",
    category: "challenge",
    template:
      "🔥 Challenge alert: Flip our latest single into a new vibe by Sunday night. Share progress clips + tag teammates to earn rep.",
  },
];

const CommunityFeedPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [composerValue, setComposerValue] = useState("");
  const [composerCategory, setComposerCategory] = useState<CommunityPostCategory | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const viewerId = profile?.id ?? null;
  const composerCategoryLabel = composerCategory ? categoryLabels[composerCategory] : null;

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    isSuccess,
    refetch,
  } = useInfiniteQuery({
    queryKey: [INITIAL_QUERY_KEY, viewerId ?? "anonymous"],
    queryFn: ({ pageParam }) =>
      fetchCommunityFeed({
        cursor: typeof pageParam === "string" ? pageParam : null,
        viewerId,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!viewerId && !authLoading && !profileLoading,
  });

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data],
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, posts.length]);

  const { data: challengeWidgetData, isPending: challengeWidgetLoading } = useQuery({
    queryKey: [INITIAL_QUERY_KEY, "trending-challenges", viewerId ?? "anonymous"],
    queryFn: () =>
      fetchCommunityFeed({
        limit: 3,
        viewerId,
        categories: ["challenge"],
      }),
    enabled: !!viewerId && !authLoading && !profileLoading,
  });

  const trendingChallenges = challengeWidgetData?.posts ?? [];

  const updateCachedPost = (updatedPost: CommunityFeedPost) => {
    queryClient.setQueryData<InfiniteData<CommunityFeedPage>>(
      [INITIAL_QUERY_KEY, viewerId ?? "anonymous"],
      (existing) => {
        if (!existing) {
          return existing;
        }

        const nextPages = existing.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) => ((post as any).id === (updatedPost as any).id ? updatedPost : post)),
        }));

        return {
          pageParams: existing.pageParams,
          pages: nextPages,
        };
      },
    );
  };

  const prependCachedPost = (newPost: CommunityFeedPost) => {
    queryClient.setQueryData<InfiniteData<CommunityFeedPage>>(
      [INITIAL_QUERY_KEY, viewerId ?? "anonymous"],
      (existing) => {
        if (!existing) {
          const initialData: InfiniteData<CommunityFeedPage> = {
            pageParams: [undefined],
            pages: [
              {
                posts: [newPost],
                nextCursor: null,
              },
            ],
          };
          return initialData;
        }

        const [firstPage, ...restPages] = existing.pages;
        if (!firstPage) {
          return existing;
        }

        return {
          pageParams: existing.pageParams,
          pages: [
            {
              ...firstPage,
              posts: [newPost, ...firstPage.posts],
            },
            ...restPages,
          ],
        };
      },
    );
  };

  const getCategoryLabel = (category?: string | null) => {
    if (!category) {
      return null;
    }

    return categoryLabels[category as CommunityPostCategory] ?? null;
  };

  const handleApplyPreset = (preset: ComposerPreset) => {
    setComposerValue(preset.template);
    setComposerCategory(preset.category);
    composerTextareaRef.current?.focus();
  };

  const handleJoinJam = (sessionId?: string | null) => {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    navigate(`/jams${query}`);
  };

  const handleSupportBand = () => {
    const hasBandOperations = (profile?.fans ?? 0) > 0;
    navigate(hasBandOperations ? "/band" : "/fans");
  };

  const handleJoinChallenge = (challengePost: CommunityFeedPost) => {
    const title = challengePost.content.split("\n")[0]?.trim() || "this challenge";
    const responseTemplate = `Joining ${title} with a fresh take...`;
    setComposerValue(responseTemplate);
    setComposerCategory("challenge");
    composerTextareaRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderTrendingChallenges = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Top Challenges</CardTitle>
        <CardDescription>Show up for the collabs everyone is buzzing about.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {challengeWidgetLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`challenge-skeleton-${index}`} className="space-y-2 rounded-lg border p-3">
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!challengeWidgetLoading && trendingChallenges.length === 0 && (
          <p className="text-sm text-muted-foreground">No spotlighted challenges yet. Be the first to start one!</p>
        )}

        {!challengeWidgetLoading &&
          trendingChallenges.length > 0 &&
          trendingChallenges.map((challenge) => {
            const createdAt = challenge.created_at ? new Date(challenge.created_at) : null;
            const title = challenge.content.split("\n")[0]?.trim() || "Community challenge";

            return (
              <div key={challenge.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{title}</p>
                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                    Challenge
                  </Badge>
                </div>
                {createdAt && (
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(createdAt, { addSuffix: true })}
                  </p>
                )}
                <Button size="sm" className="w-full" onClick={() => handleJoinChallenge(challenge)}>
                  Share your entry
                </Button>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );

  const handleSubmitPost = async () => {
    if (!viewerId) {
      toast({
        title: "Profile required",
        description: "Create a character profile before posting to the community feed.",
        variant: "destructive",
      });
      return;
    }

    const content = composerValue.trim();
    if (!content) {
      toast({
        title: "Write something first",
        description: "Your post needs a bit more noise before it goes live.",
      });
      return;
    }

    setIsPosting(true);

    try {
      const newPost = await createCommunityPost({
        authorId: viewerId,
        content,
        category: composerCategory,
      });

      setComposerValue("");
      setComposerCategory(null);
      prependCachedPost(newPost);
      toast({
        title: "Posted to the community",
        description: "Your update is now lighting up the feed!",
      });
    } catch (postError) {
      console.error("Failed to publish community post", postError);
      toast({
        title: "Could not post",
        description: "We hit a snag saving your post. Please try again.",
        variant: "destructive",
      });
      await refetch();
    } finally {
      setIsPosting(false);
    }
  };

  const handleToggleReaction = async (postId: string, reactionType: ReactionType) => {
    if (!viewerId) {
      toast({
        title: "Sign in required",
        description: "Join the community to react to posts.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedPost = await toggleCommunityReaction(
        {
          postId,
          profileId: viewerId,
          reactionType,
        },
        viewerId,
      );

      if (updatedPost) {
        updateCachedPost(updatedPost);
      } else {
        await refetch();
      }
    } catch (reactionError) {
      console.error("Failed to toggle reaction", reactionError);
      toast({
        title: "Could not react",
        description: "Something went wrong while saving your reaction.",
        variant: "destructive",
      });
    }
  };

  const renderComposer = () => (
    <Card>
      <CardHeader>
        <CardTitle>Share with the community</CardTitle>
        <CardDescription>Post your latest wins, challenges, or crowd highlights.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Announce new releases, celebrate fan milestones, or rally help for an upcoming gig."
          value={composerValue}
          onChange={(event) => setComposerValue(event.target.value)}
          rows={4}
          maxLength={500}
          ref={composerTextareaRef}
        />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick presets</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {composerPresets.map((preset) => (
              <Button key={preset.key} type="button" variant="secondary" size="sm" onClick={() => handleApplyPreset(preset)}>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full space-y-2 text-sm text-muted-foreground">
          <div>{composerValue.length} / 500 characters</div>
          {composerCategoryLabel && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground/80">Tagged:</span>
              <Badge variant="secondary">{composerCategoryLabel}</Badge>
              <Button type="button" variant="ghost" size="sm" onClick={() => setComposerCategory(null)}>
                Clear tag
              </Button>
            </div>
          )}
        </div>
        <Button className="w-full sm:w-auto" onClick={handleSubmitPost} disabled={isPosting || composerValue.trim().length === 0}>
          {isPosting ? "Posting..." : "Post update"}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderPost = (post: CommunityFeedPost) => {
    const displayName = post.author?.display_name || post.author?.username || "Unknown artist";
    const username = post.author?.username ? `@${post.author.username}` : "@unknown";
    const createdAt = (post as any).created_at ? new Date((post as any).created_at) : null;
    const categoryLabel = getCategoryLabel((post as any).category);
    const metadata = (post.metadata && typeof post.metadata === "object" ? post.metadata : {}) as Record<string, any>;
    const sessionId = typeof metadata.sessionId === "string" ? metadata.sessionId : null;

    let postCta: JSX.Element | null = null;
    if ((post as any).category === "gig_invite") {
      postCta = (
        <Button size="sm" onClick={() => handleJoinJam(sessionId)}>
          Join Jam
        </Button>
      );
    } else if ((post as any).category === "challenge") {
      postCta = (
        <Button size="sm" variant="secondary" onClick={() => handleJoinChallenge(post)}>
          Join Challenge
        </Button>
      );
    } else if ((post as any).category === "shoutout") {
      postCta = (
        <Button size="sm" variant="outline" onClick={() => handleSupportBand()}>
          Support Band
        </Button>
      );
    }

    return (
      <Card key={(post as any).id}>
        <CardHeader className="flex flex-row gap-4">
          <Avatar>
            {post.author?.avatar_url ? (
              <AvatarImage src={post.author.avatar_url} alt={displayName} />
            ) : (
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <CardTitle className="text-lg leading-tight">{displayName}</CardTitle>
            <CardDescription>
              {username}
              {createdAt && ` • ${formatDistanceToNowStrict(createdAt, { addSuffix: true })}`}
            </CardDescription>
            {categoryLabel && <Badge className="mt-2" variant="secondary">{categoryLabel}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/90">{(post as any).content}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {reactionOptions.map((reaction) => {
              const isActive = post.viewerReaction === reaction.type;
              const count = post.reactionCounts[reaction.type] ?? 0;

              return (
                <Button
                  key={reaction.type}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggleReaction((post as any).id, reaction.type)}
                >
                  <span role="img" aria-label={reaction.label}>
                    {reaction.emoji}
                  </span>
                  {count > 0 && <span className="ml-1 text-xs font-semibold">{count}</span>}
                </Button>
              );
            })}
          </div>
          {postCta && <div className="flex flex-wrap gap-2">{postCta}</div>}
        </CardFooter>
      </Card>
    );
  };

  if (authLoading || profileLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 py-10">
        <div className="text-center text-muted-foreground">Loading your community feed...</div>
      </div>
    );
  }

  if (!user || !viewerId) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Join the community</CardTitle>
            <CardDescription>
              Sign in and create your artist profile to post updates, share reactions, and meet other bands.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-10">
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          {renderComposer()}

          {isError && (
            <Card>
              <CardHeader>
                <CardTitle>Unable to load feed</CardTitle>
                <CardDescription>
                  {(error as Error)?.message ?? "We could not connect to the feed. Try refreshing in a moment."}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </CardFooter>
            </Card>
          )}

          {isPending && (
            <Card>
              <CardHeader>
                <CardTitle>Loading feed</CardTitle>
                <CardDescription>Fetching the latest backstage chatter...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-24 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          )}

          {isSuccess && posts.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No posts yet</CardTitle>
                <CardDescription>Break the silence with the first update from your band.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {isSuccess && posts.length > 0 && (
            <div className="space-y-6">
              {posts.map((post) => renderPost(post))}
            </div>
          )}

          <div ref={sentinelRef} />

          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "Loading more..." : "Load more"}
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {renderTrendingChallenges()}
        </aside>
      </div>
    </div>
  );
};

export default CommunityFeedPage;
