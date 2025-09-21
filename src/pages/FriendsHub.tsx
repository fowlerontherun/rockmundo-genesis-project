import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake, Loader2, MessageCircle, RefreshCcw, Sparkles, UserRound, Gift } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { useSupabasePresence } from "@/hooks/useSupabasePresence";
import RealtimeChatPanel from "@/components/chat/RealtimeChatPanel";

interface FriendEntry {
  friendship: Database["public"]["Tables"]["friendships"]["Row"];
  friendUserId: string;
  friendProfileId: string | null;
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
}

const FRIENDS_PRESENCE_CHANNEL = "friends-hub-presence";

const createFriendChannelKey = (userIdA: string, userIdB: string) => {
  return `friends-${[userIdA, userIdB].sort().join("-")}`;
};

const getDisplayName = (entry: FriendEntry) => {
  const { profile, friendUserId } = entry;

  if (profile?.display_name && profile.display_name.trim().length > 0) {
    return profile.display_name.trim();
  }

  if (profile?.username && profile.username.trim().length > 0) {
    return profile.username.trim();
  }

  return friendUserId.slice(0, 8);
};

const getInitials = (name: string) => {
  const [first = "", second = ""] = name.split(" ");
  const firstLetter = first.charAt(0);
  const secondLetter = second.charAt(0);
  const initials = `${firstLetter}${secondLetter}`.trim();

  if (initials.length > 0) {
    return initials.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
};

const FriendsHub = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [profileDialogId, setProfileDialogId] = useState<string | null>(null);

  const userId = user?.id;

  const fetchFriends = useCallback(async () => {
    if (!userId) {
      setFriends([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: friendshipRows, error: friendshipsError } = await supabase
        .from("friendships")
        .select("id, user_id, friend_user_id, user_profile_id, friend_profile_id, status, created_at, updated_at")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);

      if (friendshipsError) {
        throw friendshipsError;
      }

      const typedFriendships = (friendshipRows || []) as Database["public"]["Tables"]["friendships"]["Row"][];

      if (typedFriendships.length === 0) {
        setFriends([]);
        return;
      }

      const normalized = typedFriendships.map((friendship) => {
        const isRequester = friendship.user_id === userId;
        const friendUserId = isRequester ? friendship.friend_user_id : friendship.user_id;
        const friendProfileId = isRequester ? friendship.friend_profile_id : friendship.user_profile_id;

        return {
          friendship,
          friendUserId,
          friendProfileId,
          profile: null,
        } satisfies FriendEntry;
      });

      const friendUserIds = Array.from(new Set(normalized.map((item) => item.friendUserId)));

      let profilesMap = new Map<string, Database["public"]["Tables"]["profiles"]["Row"]>();

      if (friendUserIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, user_id, display_name, username, bio, level, fame, fans, created_at, updated_at")
          .in("user_id", friendUserIds);

        if (profileError) {
          throw profileError;
        }

        const typedProfiles = (profileRows || []) as Database["public"]["Tables"]["profiles"]["Row"][];
        profilesMap = new Map(typedProfiles.map((profile) => [profile.user_id, profile]));
      }

      const withProfiles = normalized.map((entry) => ({
        ...entry,
        profile: profilesMap.get(entry.friendUserId) ?? null,
      }));

      setFriends(withProfiles);
    } catch (fetchError) {
      console.error("Failed to load friends", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load friends right now.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void fetchFriends();
    }
  }, [fetchFriends, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`friends-hub-friendships-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchFriends();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `friend_user_id=eq.${userId}`,
        },
        () => {
          void fetchFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFriends, userId]);

  useEffect(() => {
    if (!authLoading && !userId) {
      navigate("/auth");
    }
  }, [authLoading, navigate, userId]);

  const { isConnected: presenceConnected, participantCount, onlineUserIds } = useSupabasePresence({
    channelName: FRIENDS_PRESENCE_CHANNEL,
    userId,
  });

  const onlineUserIdSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);

  const selectedFriend = useMemo(
    () => friends.find((entry) => entry.friendUserId === selectedFriendId) ?? null,
    [friends, selectedFriendId]
  );

  const activeChannelKey = useMemo(() => {
    if (!userId || !selectedFriend) {
      return null;
    }

    return createFriendChannelKey(userId, selectedFriend.friendUserId);
  }, [selectedFriend, userId]);

  const profileDialogFriend = useMemo(
    () => friends.find((entry) => entry.friendUserId === profileDialogId) ?? null,
    [friends, profileDialogId]
  );

  useEffect(() => {
    if (selectedFriendId && !friends.some((entry) => entry.friendUserId === selectedFriendId)) {
      setSelectedFriendId(null);
    }

    if (profileDialogId && !friends.some((entry) => entry.friendUserId === profileDialogId)) {
      setProfileDialogId(null);
    }
  }, [friends, profileDialogId, selectedFriendId]);

  const handleOpenChat = (entry: FriendEntry) => {
    setSelectedFriendId(entry.friendUserId);
  };

  const handleViewProfile = (entry: FriendEntry) => {
    setProfileDialogId(entry.friendUserId);
  };

  const handleStartTrade = (entry: FriendEntry) => {
    const displayName = getDisplayName(entry);
    toast({
      title: "Trading coming soon",
      description: `Trading with ${displayName} will open from your inventory hub soon.`,
    });
  };

  const handleSendGift = (entry: FriendEntry) => {
    const displayName = getDisplayName(entry);
    toast({
      title: "Gifting coming soon",
      description: `Gifting tools for ${displayName} are on the way.`,
    });
  };

  const handleRefresh = () => {
    void fetchFriends();
  };

  const renderFriendCard = (entry: FriendEntry) => {
    const displayName = getDisplayName(entry);
    const isOnline = onlineUserIdSet.has(entry.friendUserId);
    const acceptedAt = entry.friendship.updated_at || entry.friendship.created_at;
    const isSelected = selectedFriendId === entry.friendUserId;

    return (
      <div
        key={entry.friendship.id}
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-border/60 bg-background/60 p-4 transition-shadow hover:border-primary/40 hover:shadow-md",
          isSelected && "border-primary shadow-lg"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {getInitials(displayName)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground">{displayName}</span>
                <Badge
                  variant={isOnline ? "default" : "outline"}
                  className={cn(
                    "flex items-center gap-1",
                    isOnline ? "bg-emerald-500/10 text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-muted-foreground")} />
                  {isOnline ? "Online" : "Offline"}
                </Badge>
                {acceptedAt && (
                  <Badge variant="secondary" className="bg-muted/60 text-[11px]">
                    Friends since {new Date(acceptedAt).toLocaleDateString()}
                  </Badge>
                )}
              </div>
              {entry.profile?.bio && (
                <p className="max-w-xl text-sm text-muted-foreground line-clamp-2">{entry.profile.bio}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {typeof entry.profile?.level === "number" && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Level {entry.profile.level}
                  </span>
                )}
                {typeof entry.profile?.fame === "number" && (
                  <span className="flex items-center gap-1">
                    <UserRound className="h-3 w-3" /> Fame {entry.profile.fame}
                  </span>
                )}
                {typeof entry.profile?.fans === "number" && (
                  <span className="flex items-center gap-1">
                    <Handshake className="h-3 w-3" /> Fans {entry.profile.fans}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => handleOpenChat(entry)}>
              <MessageCircle className="mr-2 h-4 w-4" /> Chat
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleViewProfile(entry)}>
              View profile
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleStartTrade(entry)}>
              <Handshake className="mr-2 h-4 w-4" /> Trade
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleSendGift(entry)}>
              <Gift className="mr-2 h-4 w-4" /> Gift
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!userId && !authLoading) {
    return (
      <div className="container mx-auto space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Friends Hub</CardTitle>
            <CardDescription>Log in to manage your friendships and private chats.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">You need to be signed in to access the Friends Hub.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Handshake className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Friends Hub</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Coordinate with your inner circle, launch private chats, and prepare trades or gifts all from one place.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full border border-border/40 px-3 py-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  presenceConnected ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
              {presenceConnected ? "Presence connected" : "Connecting to presence"}
            </div>
            <Badge variant="secondary" className="border-border/40 bg-muted/50 text-foreground/70">
              {participantCount} online now
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Accepted Friends</CardTitle>
            <CardDescription>All of your confirmed friendships in one place.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Failed to load friends</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your friends list...
              </div>
            ) : friends.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                You haven't accepted any friendships yet. Send some requests from the community to get started!
              </div>
            ) : (
              <div className="space-y-4">
                {friends.map((entry) => renderFriendCard(entry))}
              </div>
            )}
          </CardContent>
        </Card>

        {activeChannelKey && selectedFriend ? (
          <RealtimeChatPanel
            key={activeChannelKey}
            channelKey={activeChannelKey}
            title={`Chat with ${getDisplayName(selectedFriend)}`}
            className="h-full"
          />
        ) : (
          <Card className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <CardHeader>
              <CardTitle>Select a friend to chat</CardTitle>
              <CardDescription>Pick someone from your list to open a dedicated channel.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Use the chat action on a friend to launch a private conversation.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={Boolean(profileDialogFriend)} onOpenChange={(open) => !open && setProfileDialogId(null)}>
        {profileDialogFriend && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{getDisplayName(profileDialogFriend)}</DialogTitle>
              <DialogDescription>Full profile snapshot</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                  {getInitials(getDisplayName(profileDialogFriend))}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User ID: {profileDialogFriend.friendUserId}</p>
                  {profileDialogFriend.friendProfileId && (
                    <p className="text-xs text-muted-foreground/80">Profile ID: {profileDialogFriend.friendProfileId}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Bio</h3>
                <p className="text-sm text-muted-foreground">
                  {profileDialogFriend.profile?.bio || "No bio provided yet."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Level</p>
                  <p className="text-base font-semibold">{profileDialogFriend.profile?.level ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Fame</p>
                  <p className="text-base font-semibold">{profileDialogFriend.profile?.fame ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Fans</p>
                  <p className="text-base font-semibold">{profileDialogFriend.profile?.fans ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Member since</p>
                  <p className="text-base font-semibold">
                    {profileDialogFriend.profile?.created_at
                      ? new Date(profileDialogFriend.profile.created_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default FriendsHub;
