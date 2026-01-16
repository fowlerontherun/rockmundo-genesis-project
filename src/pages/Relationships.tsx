import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { useFriendships } from "@/features/relationships/hooks/useFriendships";
import { FriendshipList } from "@/features/relationships/components/FriendshipList";
import { FriendDetailPanel } from "@/features/relationships/components/FriendDetailPanel";
import { useRelationshipEvents } from "@/features/relationships/hooks/useRelationshipEvents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Users, HeartHandshake, Search, UserPlus, Clock, Loader2, Star } from "lucide-react";
import { searchProfilesByQuery, sendFriendRequest } from "@/integrations/supabase/friends";

export default function RelationshipsPage() {
  const { user } = useAuth();
  const { profile } = useGameData();
  const { toast } = useToast();
  const { friendships, loading, acceptRequest, declineRequest, removeFriend, sendRequest } = useFriendships(
    profile?.id,
  );
  const [selectedFriendshipId, setSelectedFriendshipId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const selectedFriendship = useMemo(
    () => friendships.find((friend) => friend.friendship.id === selectedFriendshipId) ?? null,
    [friendships, selectedFriendshipId],
  );

  const excludeProfileIds = useMemo(() => {
    const ids = new Set<string>();
    if (profile?.id) {
      ids.add(profile.id);
    }
    friendships.forEach((friend) => {
      if (friend.otherProfile?.id) {
        ids.add(friend.otherProfile.id);
      }
    });
    return Array.from(ids);
  }, [profile?.id, friendships]);

  // Filter friendships by status
  const acceptedFriendships = useMemo(
    () => friendships.filter((f) => f.friendship.status === "accepted"),
    [friendships]
  );

  const incomingRequests = useMemo(
    () => friendships.filter((f) => f.friendship.status === "pending" && f.friendship.addressee_id === profile?.id),
    [friendships, profile?.id]
  );

  const outgoingRequests = useMemo(
    () => friendships.filter((f) => f.friendship.status === "pending" && f.friendship.requestor_id === profile?.id),
    [friendships, profile?.id]
  );

  useEffect(() => {
    if (selectedFriendshipId) {
      const stillExists = friendships.some((friend) => friend.friendship.id === selectedFriendshipId);
      if (!stillExists) {
        setSelectedFriendshipId(acceptedFriendships[0]?.friendship.id ?? null);
      }
      return;
    }

    if (acceptedFriendships.length > 0) {
      setSelectedFriendshipId(acceptedFriendships[0]?.friendship.id ?? null);
    }
  }, [friendships, selectedFriendshipId, acceptedFriendships]);

  const { events, summary, refetch: refetchEvents } = useRelationshipEvents({
    profileId: profile?.id ?? null,
    otherProfileId: selectedFriendship?.otherProfile?.id ?? null,
    userIds: [user?.id ?? null, selectedFriendship?.otherProfile?.user_id ?? null],
    enabled: Boolean(selectedFriendship),
  });

  const resolveErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      toast({ title: "Search query too short", description: "Enter at least 2 characters", variant: "destructive" });
      return;
    }
    setSearchLoading(true);
    try {
      const results = await searchProfilesByQuery(searchQuery, excludeProfileIds);
      setSearchResults(results);
    } catch (error) {
      toast({ title: "Search failed", description: resolveErrorMessage(error), variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (targetProfileId: string) => {
    if (!profile?.id) {
      toast({ title: "Error", description: "You need a profile before sending requests", variant: "destructive" });
      return;
    }
    setSendingTo(targetProfileId);
    try {
      await sendRequest(targetProfileId);
      toast({ title: "Friend request sent!", description: "Waiting for them to accept." });
      setSearchResults((prev) => prev.filter((p) => p.id !== targetProfileId));
    } catch (error) {
      toast({ title: "Failed to send request", description: resolveErrorMessage(error), variant: "destructive" });
    } finally {
      setSendingTo(null);
    }
  };

  const pendingCount = incomingRequests.length + outgoingRequests.length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HeartHandshake className="h-8 w-8" />
          Relationships
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Build friendships, track affinity, and collaborate with other players.
        </p>
      </div>

      <Tabs defaultValue="friends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="friends" className="gap-2">
            <Users className="h-4 w-4" />
            Friends {acceptedFriendships.length > 0 && `(${acceptedFriendships.length})`}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </TabsTrigger>
          <TabsTrigger value="find" className="gap-2">
            <Search className="h-4 w-4" />
            Find Friends
          </TabsTrigger>
        </TabsList>

        {/* Friends Tab */}
        <TabsContent value="friends" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : acceptedFriendships.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Friends Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Find other players and send them friend requests to build your network!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr),minmax(0,1.15fr)]">
              <FriendshipList
                friendships={acceptedFriendships}
                loading={loading}
                onSelect={(friendship) => setSelectedFriendshipId(friendship.friendship.id)}
                selectedFriendshipId={selectedFriendshipId}
                onAccept={(id) => acceptRequest(id).catch((error: unknown) => {
                  toast({ title: "Unable to accept request", description: resolveErrorMessage(error), variant: "destructive" });
                })}
                onDecline={(id) => declineRequest(id).catch((error: unknown) => {
                  toast({ title: "Unable to decline request", description: resolveErrorMessage(error), variant: "destructive" });
                })}
                onRemove={(id) => removeFriend(id).catch((error: unknown) => {
                  toast({ title: "Unable to modify friendship", description: resolveErrorMessage(error), variant: "destructive" });
                })}
                filter="accepted"
              />
              <FriendDetailPanel
                friendship={selectedFriendship}
                summary={summary}
                events={events}
                currentProfileId={profile?.id ?? ""}
                currentUserId={user?.id ?? null}
                onRefreshEvents={refetchEvents}
              />
            </div>
          )}
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-6">
          {/* Incoming Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5" />
                Incoming Requests ({incomingRequests.length})
              </CardTitle>
              <CardDescription>Players who want to be your friend</CardDescription>
            </CardHeader>
            <CardContent>
              {incomingRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No incoming requests</p>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((f) => (
                    <div key={f.friendship.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={f.otherProfile?.avatar_url ?? undefined} />
                          <AvatarFallback>{f.otherProfile?.display_name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{f.otherProfile?.display_name || f.otherProfile?.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Level {f.otherProfile?.level ?? 1} • Fame {f.otherProfile?.fame?.toLocaleString() ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => acceptRequest(f.friendship.id)}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => declineRequest(f.friendship.id)}>Decline</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outgoing Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Sent Requests ({outgoingRequests.length})
              </CardTitle>
              <CardDescription>Waiting for their response</CardDescription>
            </CardHeader>
            <CardContent>
              {outgoingRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No pending requests</p>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map((f) => (
                    <div key={f.friendship.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={f.otherProfile?.avatar_url ?? undefined} />
                          <AvatarFallback>{f.otherProfile?.display_name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{f.otherProfile?.display_name || f.otherProfile?.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Level {f.otherProfile?.level ?? 1} • Fame {f.otherProfile?.fame?.toLocaleString() ?? 0}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Find Friends Tab */}
        <TabsContent value="find" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Players
              </CardTitle>
              <CardDescription>Search by username or display name</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter username or display name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchLoading}>
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {searchResults.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback>{p.display_name?.[0] ?? p.username?.[0] ?? "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{p.display_name || p.username}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>Level {p.level ?? 1}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                {p.fame?.toLocaleString() ?? 0}
                              </span>
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSendRequest(p.id)}
                          disabled={sendingTo === p.id}
                        >
                          {sendingTo === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {searchResults.length === 0 && searchQuery.length >= 2 && !searchLoading && (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No players found. Try a different search term.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
