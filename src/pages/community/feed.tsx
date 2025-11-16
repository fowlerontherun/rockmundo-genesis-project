// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import {
  createCommunityPost,
  fetchCommunityFeed,
  toggleCommunityReaction,
  type CommunityFeedPage,
  type CommunityFeedPost,
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

const CommunityFeedPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [composerValue, setComposerValue] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const viewerId = profile?.id ?? null;

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
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!viewerId && !authLoading && !profileLoading,
  });

  const posts = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data],
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const updateCachedPost = (updatedPost: CommunityFeedPost) => {
    queryClient.setQueryData<InfiniteData<CommunityFeedPage>>(
      [INITIAL_QUERY_KEY, viewerId ?? "anonymous"],
      (existing) => {
        if (!existing) {
          return existing;
        }

        const nextPages = existing.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
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
      });

      setComposerValue("");
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
      <CardContent>
        <Textarea
          placeholder="Announce new releases, celebrate fan milestones, or rally help for an upcoming gig."
          value={composerValue}
          onChange={(event) => setComposerValue(event.target.value)}
          rows={4}
          maxLength={500}
        />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {composerValue.length} / 500 characters
        </div>
        <Button onClick={handleSubmitPost} disabled={isPosting || composerValue.trim().length === 0}>
          {isPosting ? "Posting..." : "Post update"}
        </Button>
      </CardFooter>
    </Card>
  );

  const renderPost = (post: CommunityFeedPost) => {
    const displayName = post.author?.display_name || post.author?.username || "Unknown artist";
    const username = post.author?.username ? `@${post.author.username}` : "@unknown";
    const createdAt = post.created_at ? new Date(post.created_at) : null;

    return (
      <Card key={post.id}>
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
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/90">{post.content}</p>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2">
          {reactionOptions.map((reaction) => {
            const isActive = post.viewerReaction === reaction.type;
            const count = post.reactionCounts[reaction.type] ?? 0;

            return (
              <Button
                key={reaction.type}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleReaction(post.id, reaction.type)}
              >
                <span role="img" aria-label={reaction.label}>
                  {reaction.emoji}
                </span>
                {count > 0 && <span className="ml-1 text-xs font-semibold">{count}</span>}
              </Button>
            );
          })}
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
    <div className="container mx-auto max-w-3xl space-y-6 py-10">
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
  );
};

export default CommunityFeedPage;
