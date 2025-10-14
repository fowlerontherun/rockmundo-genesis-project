import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  UserPlus,
  Users,
  Loader2,
  Check,
  X,
  UserX,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useGameData } from "@/hooks/useGameData";
import { useTwaaterAccount } from "@/hooks/useTwaaterAccount";
import { useTwaaterFeed } from "@/hooks/useTwaats";
import { TwaaterComposer } from "@/components/twaater/TwaaterComposer";
import { TwaaterFeed } from "@/components/twaater/TwaaterFeed";
import { TwaaterAccountSetup } from "@/components/twaater/TwaaterAccountSetup";
import { TwaaterMentionsFeed } from "@/components/twaater/TwaaterMentionsFeed";
import { useDailyTwaatXP } from "@/hooks/useDailyTwaatXP";
import { MessageSquare, Bell, TrendingUp } from "lucide-react";
import type { Database } from "@/lib/supabase-types";
import {
  deleteFriendship,
  fetchFriendshipsForProfile,
  fetchProfilesByIds,
  searchProfilesByQuery,
  sendFriendRequest,
  updateFriendshipStatus,
} from "@/integrations/supabase/friends";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface DecoratedFriendship {
  friendship: FriendshipRow;
  otherProfile: ProfileRow | null;
  isRequester: boolean;
}

const MINIMUM_SEARCH_LENGTH = 2;

const SocialMedia = () => {
  const { profile } = useGameData();
  const { toast } = useToast();
  const { account: twaaterAccount, isLoading: twaaterAccountLoading } = useTwaaterAccount("persona", profile?.id);
  const { feed: twaaterFeed, isLoading: twaaterFeedLoading } = useTwaaterFeed(twaaterAccount?.id);
  const { twaatsPostedToday, xpEarnedToday, canEarnMore } = useDailyTwaatXP(twaaterAccount?.id);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  const loadFriendships = useCallback(async () => {
    const profileId = profile?.id;
    if (!profileId) {
      return;
    }

    setLoadingFriends(true);
    try {
      const data = await fetchFriendshipsForProfile(profileId);
      setFriendships(data);

      const relatedProfileIds = new Set<string>();
      data.forEach((friendship) => {
        relatedProfileIds.add(friendship.requestor_id);
        relatedProfileIds.add(friendship.addressee_id);
      });
      relatedProfileIds.delete(profileId);

      if (relatedProfileIds.size === 0) {
        setProfilesById({});
        return;
      }

      const profileMap = await fetchProfilesByIds(Array.from(relatedProfileIds));
      setProfilesById(profileMap);
    } catch (error: any) {
      console.error("Failed to load friendships", error);
      toast({
        title: "Unable to load friends",
        description: error?.message ?? "Something went wrong while loading your friendships.",
        variant: "destructive",
      });
    } finally {
      setLoadingFriends(false);
    }
  }, [profile?.id, toast]);

  useEffect(() => {
    void loadFriendships();
  }, [loadFriendships]);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setSearchPerformed(false);
    }
  }, [searchQuery]);

  const existingProfileIds = useMemo(() => {
    const ids = new Set<string>();
    friendships.forEach((friendship) => {
      ids.add(friendship.requestor_id);
      ids.add(friendship.addressee_id);
    });
    if (profile?.id) {
      ids.add(profile.id);
    }
    return ids;
  }, [friendships, profile?.id]);

  const { accepted, incoming, outgoing, declined } = useMemo(() => {
    const initial = {
      accepted: [] as DecoratedFriendship[],
      incoming: [] as DecoratedFriendship[],
      outgoing: [] as DecoratedFriendship[],
      declined: [] as DecoratedFriendship[],
    };

    if (!profile?.id) {
      return initial;
    }

    return friendships.reduce((accumulator, friendship) => {
      const isRequester = friendship.requestor_id === profile.id;
      const otherProfileId = isRequester ? friendship.addressee_id : friendship.requestor_id;
      const otherProfile = profilesById[otherProfileId] ?? null;
      const decorated: DecoratedFriendship = { friendship, otherProfile, isRequester };

      switch (friendship.status) {
        case "accepted":
          accumulator.accepted.push(decorated);
          break;
        case "pending":
          if (isRequester) {
            accumulator.outgoing.push(decorated);
          } else {
            accumulator.incoming.push(decorated);
          }
          break;
        case "declined":
        case "blocked":
          accumulator.declined.push(decorated);
          break;
      }

      return accumulator;
    }, initial);
  }, [friendships, profile?.id, profilesById]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < MINIMUM_SEARCH_LENGTH) {
      toast({
        title: "Search term too short",
        description: `Enter at least ${MINIMUM_SEARCH_LENGTH} characters to search for players.`,
      });
      return;
    }

    if (!profile?.id) {
      return;
    }

    setSearching(true);
    setSearchPerformed(true);
    try {
      const exclusions = Array.from(existingProfileIds);
      const results = await searchProfilesByQuery(query, exclusions);
      setSearchResults(results);
    } catch (error: any) {
      console.error("Friend search failed", error);
      toast({
        title: "Search failed",
        description: error?.message ?? "We couldn't search for players right now.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetProfileId: string) => {
    if (!profile?.id) {
      return;
    }

    setActionTarget(targetProfileId);
    try {
      await sendFriendRequest({
        requestorProfileId: profile.id,
        addresseeProfileId: targetProfileId,
      });
      toast({
        title: "Friend request sent",
        description: "We'll let you know when they respond.",
      });
      setSearchResults((previous) => previous.filter((result) => result.id !== targetProfileId));
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to send friend request", error);
      toast({
        title: "Couldn't send request",
        description: error?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleAccept = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await updateFriendshipStatus(friendshipId, "accepted");
      toast({
        title: "Friend added",
        description: "You're now connected. Time to jam!",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to accept friend request", error);
      toast({
        title: "Unable to accept request",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleDecline = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await updateFriendshipStatus(friendshipId, "declined");
      toast({
        title: "Request declined",
        description: "The player has been notified of your decision.",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to decline friend request", error);
      toast({
        title: "Unable to decline",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleCancel = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await deleteFriendship(friendshipId);
      toast({
        title: "Request cancelled",
        description: "You can always send another request later.",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to cancel friend request", error);
      toast({
        title: "Unable to cancel",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  const handleRemove = async (friendshipId: string) => {
    setActionTarget(friendshipId);
    try {
      await deleteFriendship(friendshipId);
      toast({
        title: "Friend removed",
        description: "They're no longer on your friends list.",
      });
      await loadFriendships();
    } catch (error: any) {
      console.error("Failed to remove friend", error);
      toast({
        title: "Unable to remove friend",
        description: error?.message ?? "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setActionTarget(null);
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Friends</CardTitle>
            <CardDescription>Create your character profile to access friend features.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Once your profile is ready you'll be able to find bandmates, send friend requests, and manage your
              connections from here.
            </p>
          </CardContent>
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
            Connect with friends, post updates, and build your following in the music world.
          </p>
        </div>
      </div>

      <Tabs defaultValue="friends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Friends
          </TabsTrigger>
          <TabsTrigger value="twaater" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Twaater
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find new friends
          </CardTitle>
          <CardDescription>Search by username or stage name to send friend requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search players by username or display name"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={searching || searchQuery.trim().length < MINIMUM_SEARCH_LENGTH}>
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" /> Search
                </>
              )}
            </Button>
          </form>

          {searchResults.length > 0 ? (
            <div className="grid gap-3">
              {searchResults.map((result) => (
                <Card key={result.id} className="border-border/80">
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{result.display_name ?? result.username}</span>
                        <Badge variant="outline">@{result.username}</Badge>
                      </div>
                      {result.bio ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.bio}</p>
                      ) : null}
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        {typeof result.level === "number" && <span>Level {result.level}</span>}
                        {typeof result.fame === "number" && <span>Fame {result.fame}</span>}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleSendRequest(result.id)}
                      disabled={actionTarget === result.id}
                    >
                      {actionTarget === result.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" /> Send request
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchPerformed ? (
            <p className="text-sm text-muted-foreground">No players matched your search. Try another name or handle.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter at least {MINIMUM_SEARCH_LENGTH} characters to search for other performers.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Current
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Requests
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <Card>
            <CardHeader>
              <CardTitle>Current friends</CardTitle>
              <CardDescription>Accepted friendships appear here. Remove a friend at any time.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingFriends ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accepted.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  You haven't accepted any friends yet. Send a few requests to start building your network.
                </div>
              ) : (
                <div className="grid gap-3">
                  {accepted.map(({ friendship, otherProfile }) => (
                    <Card key={friendship.id} className="border-border/80">
                      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {otherProfile?.display_name ?? otherProfile?.username ?? "Former friend"}
                            </span>
                            {otherProfile?.username && (
                              <Badge variant="outline">@{otherProfile.username}</Badge>
                            )}
                          </div>
                          {otherProfile?.bio ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{otherProfile.bio}</p>
                          ) : null}
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            {typeof otherProfile?.level === "number" && <span>Level {otherProfile.level}</span>}
                            {typeof otherProfile?.fame === "number" && <span>Fame {otherProfile.fame}</span>}
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => handleRemove(friendship.id)}
                          disabled={actionTarget === friendship.id}
                        >
                          {actionTarget === friendship.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserX className="mr-2 h-4 w-4" /> Remove friend
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Incoming requests</CardTitle>
                <CardDescription>Accept or decline players who want to connect with you.</CardDescription>
              </CardHeader>
              <CardContent>
                {incoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You're all caught up. When someone sends a request it'll appear here.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {incoming.map(({ friendship, otherProfile }) => (
                      <Card key={friendship.id} className="border-border/80">
                        <CardContent className="flex flex-col gap-3 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {otherProfile?.display_name ?? otherProfile?.username ?? "Unknown performer"}
                              </span>
                              {otherProfile?.username && (
                                <Badge variant="outline">@{otherProfile.username}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Requested {new Date(friendship.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                            <Button
                              className="flex-1"
                              onClick={() => handleAccept(friendship.id)}
                              disabled={actionTarget === friendship.id}
                            >
                              {actionTarget === friendship.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" /> Accept
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleDecline(friendship.id)}
                              disabled={actionTarget === friendship.id}
                            >
                              {actionTarget === friendship.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" /> Decline
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outgoing requests</CardTitle>
                <CardDescription>Requests you've sent that are still pending.</CardDescription>
              </CardHeader>
              <CardContent>
                {outgoing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You haven't sent any friend requests yet. Search for players to start building your crew.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {outgoing.map(({ friendship, otherProfile }) => (
                      <Card key={friendship.id} className="border-border/80">
                        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {otherProfile?.display_name ?? otherProfile?.username ?? "Unknown performer"}
                              </span>
                              {otherProfile?.username && (
                                <Badge variant="outline">@{otherProfile.username}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Sent {new Date(friendship.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleCancel(friendship.id)}
                            disabled={actionTarget === friendship.id}
                          >
                            {actionTarget === friendship.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="mr-2 h-4 w-4" /> Cancel request
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Request history</CardTitle>
              <CardDescription>Recently declined or blocked requests are listed for reference.</CardDescription>
            </CardHeader>
            <CardContent>
              {declined.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No declined requests at the moment. Keep exploring to meet more performers.
                </p>
              ) : (
                <div className="grid gap-3">
                  {declined.map(({ friendship, otherProfile, isRequester }) => (
                    <Card key={friendship.id} className="border-border/80">
                      <CardContent className="py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {otherProfile?.display_name ?? otherProfile?.username ?? "Unknown performer"}
                            </span>
                            {otherProfile?.username && (
                              <Badge variant="outline">@{otherProfile.username}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isRequester ? "You" : "They"} closed this request on {new Date(friendship.updated_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {friendship.status === "blocked" ? "Blocked" : "Declined"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </TabsContent>

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
              {/* Main Feed */}
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
                      feed={twaaterFeed || []} 
                      isLoading={twaaterFeedLoading} 
                      viewerAccountId={twaaterAccount.id} 
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
              </div>

              {/* Sidebar */}
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
      </Tabs>
    </div>
  );
};

export default SocialMedia;
